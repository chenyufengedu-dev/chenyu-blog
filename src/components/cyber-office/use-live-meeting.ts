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

// 会议进度：暂停后要靠它从原处接着跑，所以必须存在 ref 里跨调用存活。
interface MeetingProgress {
  topic: string;
  participants: RoleId[];
  transcript: TranscriptTurn[];
  turn: number;
  discussionDone: boolean; // 讨论阶段是否已结束（接下来该收口总结）
}

export function useLiveMeeting() {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 用 ref 而不是 state 存"是否暂停"：异步循环里要读到**最新**的值，
  // 而 state 在闭包里会是旧快照。isPaused 那个 state 只负责驱动按钮文案。
  const pausedRef = useRef(false);
  const progressRef = useRef<MeetingProgress | null>(null);

  const cancel = useCallback(() => {
    // 彻底终止：清空进度，之后不能再 resume。
    pausedRef.current = false;
    setIsPaused(false);
    progressRef.current = null;
    abortRef.current?.abort();
  }, []);

  // 会议主循环：从 progressRef 的当前进度接着跑。start 和 resume 都调它。
  const runLoop = useCallback(async (controller: AbortController) => {
    const progress = progressRef.current;
    if (!progress) return;

    setIsRunning(true);

    try {
      while (!progress.discussionDone && progress.turn < CLIENT_MAX_TURNS) {
        // ★ 暂停检查点：就在这里。已暂停就直接退出循环，
        //   不发起下一次请求 —— 这就是"真暂停"的全部秘密。
        if (pausedRef.current) return;

        const result = await runStep({
          body: {
            topic: progress.topic,
            participants: progress.participants,
            transcript: progress.transcript,
            turn: progress.turn,
            mode: "turn",
          },
          signal: controller.signal,
          dispatch,
          transcript: progress.transcript,
        });

        if (result.failed) return; // 错误事件已 dispatch，收工
        progress.turn = result.nextTurn;
        progress.discussionDone = result.done;
      }

      // 讨论跑完了，但如果用户刚好在这时按了暂停，总结也先别做。
      if (pausedRef.current) return;

      await runStep({
        body: {
          topic: progress.topic,
          participants: progress.participants,
          transcript: progress.transcript,
          turn: progress.turn,
          mode: "summarize",
        },
        signal: controller.signal,
        dispatch,
        transcript: progress.transcript,
      });

      progressRef.current = null; // 会议真正结束，没有可恢复的进度了
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return; // 用户主动取消，静默退出
      }

      dispatch({
        type: "error",
        message: LIVE_MEETING_MESSAGES.networkFailed,
      });
    } finally {
      // 竞态防御：只有全局控制器仍是自己创建的那个，才清理状态。
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsRunning(false);
      }
    }
  }, []);

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      cancel(); // 保证同一时刻只有最新一场会议
      dispatch({ type: "reset" });

      pausedRef.current = false;
      setIsPaused(false);

      const controller = new AbortController();
      abortRef.current = controller;

      // 全新会议：进度从零开始。
      progressRef.current = {
        topic,
        participants,
        transcript: [],
        turn: 0,
        discussionDone: false,
      };

      // meeting_start 只初始化画面、不调模型，前端本地发。
      dispatch({ type: "meeting_start", topic, participants });

      await runLoop(controller);
    },
    [cancel, runLoop],
  );

  // 暂停：只是把旗子插上。当前这一轮会自然说完，循环在下一个检查点停住。
  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  // 继续：带着保存下来的进度，重新进入主循环。
  const resume = useCallback(async () => {
    if (!progressRef.current) return; // 没有可恢复的会议

    pausedRef.current = false;
    setIsPaused(false);

    const controller = new AbortController();
    abortRef.current = controller;

    await runLoop(controller);
  }, [runLoop]);

  // 组件卸载时取消在途请求，避免内存泄漏和幽灵请求。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, isPaused, start, pause, resume, cancel };
}
