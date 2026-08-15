import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { toPublicLiveMeetingError } from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_LIMITS } from "@/lib/cyber-office/limits";
import { parseStepRequest } from "@/lib/cyber-office/live-schema";
import { runOneTurn, runSummary } from "@/lib/cyber-office/orchestrator";
import { guardLiveMeetingRequest } from "@/lib/cyber-office/rate-limit";
import { encodeSseEvent } from "@/lib/cyber-office/sse";
import type { OfficeEvent } from "@/lib/cyber-office/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

// 「单步」接口：一次只跑一轮讨论（或一次总结），跑完就结束。
// 会议进度由前端持有（topic + transcript + turn 每次回传），
// 所以服务端不需要记住任何东西 —— 前端想暂停，不发下一次请求就行。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseStepRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  // 注意传 "step"：单步接口用的是按步换算过的额度，别和整场接口共用计数。
  const guard = await guardLiveMeetingRequest(request, "step");

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

  let clientGone = false;

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (event: OfficeEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event)));
        } catch {
          clientGone = true;
        }
      };

      try {
        const model = createDeepSeekChatModel();
        const { topic, participants, transcript, turn, mode } = parsed.data;

        // 二选一：跑一轮讨论，或收口总结。两者都能在 60 秒内跑完。
        const events =
          mode === "summarize"
            ? runSummary({ topic, transcript, model })
            : runOneTurn({
                topic,
                participants,
                model,
                transcript,
                turn,
                maxTurns: LIVE_MEETING_LIMITS.maxTurns,
              });

        for await (const event of events) {
          if (clientGone) break;
          safeEnqueue(event);
        }
      } catch (error) {
        if (!clientGone) {
          const publicError = toPublicLiveMeetingError(error);
          console.error("[cyber-office] step failed", error);
          safeEnqueue({ type: "error", message: publicError.message });
        }
      } finally {
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // 已经关了就忽略
          }
        }
      }
    },
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
