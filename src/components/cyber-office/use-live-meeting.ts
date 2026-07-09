"use client";
// fetch / ReadableStream 负责在门外接快递（网络流），拆开包装后，交给跑腿的 dispatch，dispatch 送进屋里给老会计 applyEvent 记账，这一切复杂的流程，最终被精美地包装在了一个叫做 useLiveMeeting 的 Hook 黑盒子里
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";
import { parseSseChunk } from "@/lib/cyber-office/sse";
import type { RoleId } from "@/lib/cyber-office/types";

interface LiveErrorResponse {
  message?: string;
}

async function readErrorMessage(response: Response) {
  const body = (await response
    .json()
    .catch(() => null)) as LiveErrorResponse | null;
  return body?.message || LIVE_MEETING_MESSAGES.deepseekFailed;
}

export function useLiveMeeting() {
  // 实时会议和回放一样，也用同一个 reducer 消费 OfficeEvent。
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  // isRunning 只控制按钮禁用/文案，不存会议内容；会议内容都在 state 里。
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    // 只负责发出取消信号。真正清理 running 状态放在对应请求自己的 finally 里，
    // 这样旧请求不会误关掉刚启动的新请求。
    abortRef.current?.abort();
  }, []); //, [] 不依赖任何东西

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      // 确保了“在任何时刻，永远只有最新的一次请求在运行，旧请求必须死”
      cancel();
      // 开新会前清空旧会，避免上一场 summary 或气泡残留。
      dispatch({ type: "reset" });
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        // 这里用 POST，因为要把用户输入的 topic 和 participants 放进请求体。
        const response = await fetch("/api/cyber-office/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          //stringify将我们的对象翻译成了一段符合国际标准 JSON 格式的纯文本字符串
          body: JSON.stringify({ topic, participants }),
          // signal 把 fetch 和 AbortController 绑在一起；cancel() 会让 reader.read() 也中断。
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          dispatch({
            type: "error",
            message: await readErrorMessage(response),
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
          // SSE 报文必须以 \n\n 结尾。截留数组最后一项放回 buffer，防止网络截断导致 JSON 不完整。
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
      } catch (error) {
        // 只有当 JavaScript 代码显式调用了 AbortController.abort() 方法时，浏览器底层的 Web API 才会强制停止流的读取，并唯一且精确地抛出一个名为 AbortError 的 DOMException，DOMException 是浏览器底层（DOM）专用的标准异常类
        // 是用户主动停止的
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        // 因为网络灾难的发生造成的
        // 真实的物理网络异常，分发统一的错误状态更新 UI。
        dispatch({
          type: "error",
          message: LIVE_MEETING_MESSAGES.networkFailed,
        });
      } finally {
        /// 竞态条件 (Race Condition) 防御。
        // 在结束请求前，严格校验当前的全局控制器是否仍是自己当年创建的那个。
        // 若身份不一致，说明用户已发起新请求，当前实例需静默销毁，严禁修改页面的 loading 状态。
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsRunning(false);
        }
      }
    },
    //“依赖数组” ，只要有用到外部的工具，则必须写到雷达监测中
    [cancel],
  );
  // 防止前端极其致命的“内存泄漏（Memory Leak）”和“幽灵网络请求”
  // 组件从屏幕上消失，并不等于后台任务的停止，防止用户点击了生成之后，点击返回按钮，离开了页面，但是后台继续生成。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, start, cancel };
}
