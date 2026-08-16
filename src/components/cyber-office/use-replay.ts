"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

// 不同事件的播放间隔（毫秒）。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token": {
      // 逐字节奏：句末停顿最久、逗号次之，普通字带随机抖动。
      // 固定 40ms 会均匀得像机器打字，加了停顿和抖动才有人在说话的感觉。
      const ch = e.delta;
      if (/[。！？…]/.test(ch)) return 300;
      if (/[，、；：]/.test(ch)) return 170;
      return 32 + Math.random() * 28; // 32~60ms
    }
    case "host_speak":
      return 900;
    case "call_on":
      return 700;
    case "speaking_start":
      return 250;
    case "speaking_end":
      return 600; // 说完多留一点余韵，再进下一轮
    case "summary":
      return 1000;
    default:
      return 500;
  }
}

export function useReplay(events: OfficeEvent[]) {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 新增：是否暂停
  const indexRef = useRef(0);
  const [tick, setTick] = useState(0);

  const start = useCallback(() => {
    dispatch({ type: "reset" });
    indexRef.current = 0;
    setTick(0);
    setIsPaused(false); // 开新回放时清掉暂停
    setIsPlaying(true);
  }, []);

  // 暂停：置 isPaused=true → 下面 effect 依赖变化 → 清掉待播定时器并提前 return。
  const pause = useCallback(() => setIsPaused(true), []);
  // 继续：解除暂停并 bump tick，重新唤醒 effect 排下一条。
  const resume = useCallback(() => {
    setIsPaused(false);
    setTick((n) => n + 1);
  }, []);

  // 点击跳过打字机：把"当前这段发言剩余的 token"一次性 dispatch 完，直接显示整句，
  // 然后从下一条（speaking_end）继续正常播放。只在正逐字播 token 时有效。
  const skip = useCallback(() => {
    let i = indexRef.current;
    let advanced = false;
    while (i < events.length && events[i].type === "token") {
      dispatch(events[i]);
      i++;
      advanced = true;
    }
    if (advanced) {
      indexRef.current = i;
      setTick((n) => n + 1); // 唤醒 effect，从 speaking_end 继续
    }
  }, [events]);

  useEffect(() => {
    if (!isPlaying || isPaused) return; // 没播或暂停：不排下一条
    if (indexRef.current >= events.length) return;

    const event = events[indexRef.current];
    const timer = setTimeout(() => {
      dispatch(event);
      const nextIndex = indexRef.current + 1;
      indexRef.current = nextIndex;
      if (nextIndex >= events.length) {
        setIsPlaying(false);
      } else {
        setTick((n) => n + 1);
      }
    }, delayFor(event));
    return () => clearTimeout(timer);
  }, [isPlaying, isPaused, tick, events]);

  return { state, isPlaying, isPaused, start, pause, resume, skip };
}
