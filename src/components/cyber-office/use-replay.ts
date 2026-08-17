"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

// 事件之间的间隔（毫秒）——只负责"事件什么时候到达"，不负责"文字怎么播"。
//
// ⚠️ 职责划分：逐字显示的节奏由 office-scene 的节奏控制器统一掌管
//    （所有人同一速度、说完停一拍）。这里再做一遍逐字节奏就会两套时钟叠加，
//    结果是回放明显比实时慢，而且这里的标点停顿会被显示层覆盖、变成死代码。
//    所以 token 用一个略快于显示速度的固定值：保证事件不落后于显示，
//    真正的观感由显示层决定。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token":
      return 30; // 略快于显示层的 55ms/字，让显示层当限速器
    case "speaking_start":
      return 200;
    case "host_speak":
    case "call_on":
    case "speaking_end":
      // 换人时的"呼吸感"由显示层的结尾停顿提供，这里只留一点结构性间隔。
      return 300;
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
