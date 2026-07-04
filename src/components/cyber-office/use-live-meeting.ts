"use client";
// fetch / ReadableStream 负责在门外接快递（网络流），拆开包装后，交给跑腿的 dispatch，dispatch 送进屋里给老会计 applyEvent 记账，这一切复杂的流程，最终被精美地包装在了一个叫做 useLiveMeeting 的 Hook 黑盒子里
import { useCallback, useReducer, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import type { RoleId } from "@/lib/cyber-office/types";
import { parseSseChunk } from "@/lib/cyber-office/sse";

export function useLiveMeeting() {
  // 实时会议和回放一样，也用同一个 reducer 消费 OfficeEvent。
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  // isRunning 只控制按钮禁用/文案，不存会议内容；会议内容都在 state 里。
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback(async (topic: string, participants: RoleId[]) => {
    // 开新会前清空旧会，避免上一场 summary 或气泡残留。
    dispatch({ type: "reset" });
    setIsRunning(true);

    try {
      // 这里用 POST，因为要把用户输入的 topic 和 participants 放进请求体。
      const response = await fetch("/api/cyber-office/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, participants }),
      });

      if (!response.ok || !response.body) {
        dispatch({
          type: "error",
          message: "实时会议启动失败，请稍后再试。",
        });
        return;
      }

      // response.body 是浏览器拿到的流；reader 可以一段一段读后端推来的字节。
      const reader = response.body.getReader();
      // TextDecoder 把 Uint8Array 字节还原成字符串。
      const decoder = new TextDecoder();
      // buffer 保存“还没凑成完整 SSE 消息”的半截文本。
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // stream: true 表示这不是最后一段，decoder 要保留跨 chunk 的字符状态。
        buffer += decoder.decode(value, { stream: true });
        // SSE 每条消息用空行分隔，所以按 \n\n 切。
        const parts = buffer.split("\n\n");
        // 最后一段可能是不完整消息，先放回 buffer，等下一次网络 chunk 补齐。
        // 在 JavaScript 中，数组.pop() 的作用是：把数组的最后一个元素“拔”出来，并从原数组中删掉它
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const event of parseSseChunk(`${part}\n\n`)) {
            // 每解析出一个 OfficeEvent，就交给 reducer 更新画面。
            dispatch(event);
          }
        }
      }

      if (buffer.trim()) {
        // 流结束时如果 buffer 里还剩最后一条消息，也要解析掉。
        for (const event of parseSseChunk(buffer)) {
          dispatch(event);
        }
      }
    } catch {
      dispatch({
        type: "error",
        message: "网络连接中断，请稍后再试。",
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { state, isRunning, start };
}
