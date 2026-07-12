import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { toPublicLiveMeetingError } from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_LIMITS } from "@/lib/cyber-office/limits";
import { parseRunMeetingRequest } from "@/lib/cyber-office/live-schema";
import { runMeeting } from "@/lib/cyber-office/orchestrator";
import { guardLiveMeetingRequest } from "@/lib/cyber-office/rate-limit";
import { encodeSseEvent } from "@/lib/cyber-office/sse";
import type { OfficeEvent } from "@/lib/cyber-office/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// TextEncoder 把字符串转成 Uint8Array，ReadableStream 只能 enqueue 字节数据。
const encoder = new TextEncoder();

function streamEvent(
  controller: ReadableStreamDefaultController,
  event: OfficeEvent,
) {
  // 每个 OfficeEvent 都先变成 SSE 文本，再编码成字节推给浏览器。
  controller.enqueue(encoder.encode(encodeSseEvent(event)));
}

export async function POST(request: Request) {
  // request.json() 可能因为非法 JSON 失败；catch 后交给 schema 统一返回 400。
  const body = await request.json().catch(() => null);
  const parsed = parseRunMeetingRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  const guard = await guardLiveMeetingRequest(request);

  if (!guard.allowed) {
    return Response.json(
      {
        code: guard.error.code,
        message: guard.error.message,
        retryAfter: guard.error.retryAfter,
      },
      { status: guard.error.status },
    );
  }

  // 客户端是否已断开（点了取消 / 关了页面）。断开后不再往流里写。
  let clientGone = false;

  //  ReadableStream是现代浏览器和 Node.js 系统自带的底层 API（属于 Web Streams API 标准）
  const stream = new ReadableStream({
    //async start(controller)= start: async function(controller)
    async start(controller) {
      // 安全写入：客户端已走就直接跳过；万一 enqueue 仍抛错（竞态），
      // 就吞掉异常并标记 clientGone，让循环尽快停下。
      const safeEnqueue = (event: OfficeEvent) => {
        if (clientGone) return;
        try {
          streamEvent(controller, event);
        } catch {
          clientGone = true;
        }
      };

      try {
        // 真正的 DeepSeek client 只在请求开始后、服务端内部创建。
        const model = createDeepSeekChatModel();

        // runMeeting 是异步生成器：每生成一个 OfficeEvent，就立刻写入 SSE。
        for await (const event of runMeeting({
          topic: parsed.data.topic,
          participants: parsed.data.participants,
          model,
          maxTurns: LIVE_MEETING_LIMITS.maxTurns,
        })) {
          if (clientGone) break; // 客户端已取消，停止继续生成/写入
          safeEnqueue(event);
        }
      } catch (error) {
        // 客户端已走就不用再报错给它了
        if (!clientGone) {
          const publicError = toPublicLiveMeetingError(error);
          console.error("[cyber-office] live meeting failed", error);
          safeEnqueue({ type: "error", message: publicError.message });
        }
      } finally {
        // 只在流还开着时才 close，避免对已关闭的 controller 二次 close 又抛错。
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // 已经关了就忽略
          }
        }
      }
    },
    // 浏览器 abort → 连接关闭 → Next.js 调用这里。标记后上面的循环会尽快停下。
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: {
      // text/event-stream 是 SSE 必需的 Content-Type。
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
