"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

// 不同事件的播放间隔（毫秒）。token 很短，营造逐字打字感；说完后停顿久一点。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token":
      return 40; // 每个字 40ms，像打字机
    case "host_speak":
      return 900;
    case "call_on":
      return 700;
    case "speaking_start":
      return 250;
    case "speaking_end":
      return 450;
    case "summary":
      return 1000;
    default:
      return 500;
  }
}

export function useReplay(events: OfficeEvent[]) {
  // 💡 useReducer：React 内置 hook。把 reducer 交给它管理状态。
  //    第三个参数 createInitialState 是"惰性初始化"——首次渲染时调用它得到初始 state。
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );

  const [isPlaying, setIsPlaying] = useState(false); // 是否正在播放
  const indexRef = useRef(0); // 当前播到第几条事件（用 ref 存，改它不触发重渲染）
  // 如果 tick 是 useRef 则当第一条剧本播完，React 根本不知道数据变了，组件没有重绘。于是，下方的 useEffect 永远不会被再次唤醒，你的播放器播完第一帧就彻底死机了。
  const [tick, setTick] = useState(0); // 每播一条事件 +1，专门用来"再次唤醒"下面的 effect

  // start：从头开始播放。useCallback 让这个函数引用稳定，避免不必要的重建。
  const start = useCallback(() => {
    dispatch({ type: "reset" });
    indexRef.current = 0;
    setTick(0);
    setIsPlaying(true);
  }, []);

  // 核心：每当 isPlaying 或 tick 变化，就安排"播放下一条事件"。
  useEffect(() => {
    if (!isPlaying) return; // 没在播就什么都不做
    if (indexRef.current >= events.length) {
      setIsPlaying(false); // 播完了，停下
      return;
    }
    const event = events[indexRef.current];
    // setTimeout：等 delayFor(event) 毫秒后，再处理这条事件
    const timer = setTimeout(() => {
      dispatch(event); // 把事件喂给 reducer → state 更新 → 场景重渲染
      indexRef.current += 1; // 指针前移
      setTick((n) => n + 1); // 改 tick → 触发本 effect 再跑一次 → 安排下一条
    }, delayFor(event));
    // 清理函数：如果在等待期间组件卸载/重跑，取消这个定时器，避免重复触发
    return () => clearTimeout(timer);
  }, [isPlaying, tick, events]);

  return { state, isPlaying, start };
}
