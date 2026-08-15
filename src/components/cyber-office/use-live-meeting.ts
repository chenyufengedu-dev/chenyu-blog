"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";
import { parseSseChunk } from "@/lib/cyber-office/sse";
import type { OfficeEvent, RoleId } from "@/lib/cyber-office/types";

interface LiveErrorResponse {
  message?: string;
}

// 前端侧的安全阀：正常情况下服务端会在 maxTurns 时把 done 置 true，
// 这里再兜一层，防止任何异常导致无限循环狂发请求。
const CLIENT_MAX_TURNS = 12;

type TranscriptTurn = { speaker: RoleId; text: string };

// 一步跑完后的结果：下一轮编号、是否该收口、有没有失败。
interface StepResult {
  nextTurn: number;
  done: boolean;
  failed: boolean;
}

async function readErrorMessage(response: Response) {
  const body = (await response
    .json()
    .catch(() => null)) as LiveErrorResponse | null;
  return body?.message || LIVE_MEETING_MESSAGES.deepseekFailed;
}

/**
 * 发一次 /step 请求，把服务端流式推来的事件边收边 dispatch 到画面上。
 * 同时把本轮的完整发言攒进 transcript —— 下一轮请求要把它带回给服务端当上下文。
 */
async function runStep(params: {
  body: unknown;
  signal: AbortSignal;
  dispatch: (event: OfficeEvent) => void;
  transcript: TranscriptTurn[];
}): Promise<StepResult> {
  const { body, signal, dispatch, transcript } = params;

  const response = await fetch("/api/cyber-office/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    dispatch({ type: "error", message: await readErrorMessage(response) });
    return { nextTurn: 0, done: true, failed: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pending = ""; // 本轮发言逐字攒起来
  // 默认 done: true —— 万一流意外结束（没收到 step_end），循环就停下而不是空转。
  let result: StepResult = { nextTurn: 0, done: true, failed: false };

  const handle = (event: OfficeEvent) => {
    if (event.type === "step_end") {
      // 控制事件：只用来记录进度，不往画面上送。
      result = { nextTurn: event.nextTurn, done: event.done, failed: false };
      return;
    }

    if (event.type === "error") {
      result.failed = true;
    }

    if (event.type === "token") {
      pending += event.delta;
    }

    if (event.type === "speaking_end") {
      // 这一轮说完了，把完整发言归档进会议历史。
      transcript.push({ speaker: event.speaker, text: pending });
      pending = "";
    }

    dispatch(event);
  };

  // SSE 按 \n\n 分隔消息；网络可能一次给半条，所以尾巴要留到下次拼。
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const event of parseSseChunk(`${part}\n\n`)) {
        handle(event);
      }
    }
  }

  if (buffer.trim()) {
    for (const event of parseSseChunk(buffer)) {
      handle(event);
    }
  }

  return result;
}

export function useLiveMeeting() {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    // 只发取消信号；清理 running 状态放在各自请求的 finally 里，
    // 避免旧请求误关掉刚启动的新请求。
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      cancel(); // 保证同一时刻只有最新一场会议在跑
      dispatch({ type: "reset" });
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // 会议历史由前端持有：每一步都带给服务端，服务端自己不记任何东西。
      // 这也是之后"暂停后还能继续"的基础——进度就在这个数组里。
      const transcript: TranscriptTurn[] = [];

      try {
        // meeting_start 只是初始化画面、不调模型，前端本地发一条即可。
        dispatch({ type: "meeting_start", topic, participants });

        let turn = 0;
        let done = false;

        // 逐轮驱动。以后的"暂停"，就是在这个循环里不再发起下一轮请求。
        while (!done && turn < CLIENT_MAX_TURNS) {
          const result = await runStep({
            body: { topic, participants, transcript, turn, mode: "turn" },
            signal: controller.signal,
            dispatch,
            transcript,
          });

          if (result.failed) return; // 错误事件已经 dispatch 过，直接收工
          turn = result.nextTurn;
          done = result.done;
        }

        // 讨论结束 → 收口做总结（同一个接口，换个 mode）。
        await runStep({
          body: { topic, participants, transcript, turn, mode: "summarize" },
          signal: controller.signal,
          dispatch,
          transcript,
        });
      } catch (error) {
        // 用户主动取消：静默退出，不当成错误。
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        dispatch({
          type: "error",
          message: LIVE_MEETING_MESSAGES.networkFailed,
        });
      } finally {
        // 竞态防御：只有当全局控制器仍是自己创建的那个，才清理状态。
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [cancel],
  );

  // 组件卸载时取消在途请求，避免内存泄漏和幽灵请求。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, start, cancel };
}
