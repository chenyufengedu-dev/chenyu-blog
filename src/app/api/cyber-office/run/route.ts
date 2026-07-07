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
    const body = {
      code: guard.error.code,
      message: guard.error.message,
      retryAfter: guard.error.retryAfter,
    };

    return Response.json(body, { status: guard.error.status });
  }

  //  ReadableStream是现代浏览器和 Node.js 系统自带的底层 API（属于 Web Streams API 标准）
  const stream = new ReadableStream({
    //async start(controller)= start: async function(controller)
    async start(controller) {
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
          streamEvent(controller, event);
        }
      } catch (error) {
        const publicError = toPublicLiveMeetingError(error);

        // 服务端可以记录原始错误；前端只接收脱敏后的 OfficeEvent。
        console.error("[cyber-office] live meeting failed", error);
        streamEvent(controller, {
          type: "error",
          message: publicError.message,
        });
      } finally {
        // close 告诉浏览器：这场会议的 SSE 流结束了。
        controller.close();
      }
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
