"use client";

import { memo, useEffect, useState } from "react";
import type { RoleId, RoleStatus } from "@/lib/cyber-office/types";

// 非发言状态用哪张图。发言时在 standing(闭嘴)/talking(张嘴) 间循环，单独处理。
const POSE: Record<RoleStatus, "standing" | "raising" | "sitting"> = {
  idle: "sitting",
  thinking: "sitting",
  raising_hand: "raising",
  speaking: "standing",
};

// 角色在场景里的显示高度（px）。所有精灵原生 320 高、宽度略有差异，
// 这里统一按“高度”缩放、宽度自动，保证 6 个角色一样高、脚在同一条线。
// office-scene 定位也用这个值，所以 export 出去共用。
export const CHAR_DISPLAY_H = 150; // 精灵含椅子；缩小一点，别遮住窗户

// 这个角色会用到的全部帧。用于挂载时预加载，避免切帧时才去下载导致闪烁。
const ALL_POSES = [
  "sitting",
  "act1",
  "act2",
  "blink",
  "raising",
  "standing",
  "talking",
] as const;

interface CharacterProps {
  id: RoleId;
  name: string;
  status: RoleStatus;
  dimmed?: boolean; // 有人在发言、但不是我 → 压暗，突出发言者
  showName?: boolean; // 名字是否在此渲染（场景里改由顶层统一画，避免被桌子挡）
}

function Character({
  id,
  name,
  status,
  dimmed,
  showName = true,
}: CharacterProps) {
  // 举手或发言时，名字用橙色高亮，突出“当前在场上的人”
  const isActive = status === "speaking" || status === "raising_hand";
  const isIdle = status === "idle" || status === "thinking";

  // 待机不做成"持续循环"（那样机械又像切图片），而是"平时静坐，隔几秒偶发一次
  // 小动作或眨眼"，像真人一样。每次动作只播它自己的几帧、结束回到坐姿。
  const [idlePose, setIdlePose] = useState("sitting");
  // 预加载：把这个角色的所有帧提前塞进浏览器缓存。
  // 不这么做的话，第一次切到某个动作时才开始下载，画面会闪一下。
  // new Image() 只是触发下载，不需要放进 DOM。
  useEffect(() => {
    for (const pose of ALL_POSES) {
      const img = new Image();
      img.src = `/sprites/${id}-${pose}.png`;
    }
  }, [id]);

  useEffect(() => {
    if (!isIdle) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const set = (p: string, delay: number) =>
      timers.push(setTimeout(() => !cancelled && setIdlePose(p), delay));

    set("sitting", 0); // 进入待机先归位坐姿
    const loop = () => {
      if (cancelled) return;
      const wait = 5000 + Math.random() * 5000; // 隔更久才动一次，更从容
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          // 一半概率做个性化动作，一半概率只眨眼
          const isAct = Math.random() < 0.35;
          const frames = isAct
            ? ["act1", "act2", "act1", "sitting"]
            : ["blink", "sitting"];
          // 眨眼要快(闭一下就睁)，动作要慢一点、更自然
          const step = isAct ? 500 : 130;
          frames.forEach((f, i) => set(f, i * step));
          timers.push(setTimeout(loop, frames.length * step + 200));
        }, wait),
      );
    };
    loop();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [isIdle]);

  // 发言时嘴型循环：standing(闭)↔talking(开)。
  const [mouthOpen, setMouthOpen] = useState(false);
  useEffect(() => {
    if (status !== "speaking") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setMouthOpen((m) => !m), 180);
    return () => clearInterval(timer);
  }, [status]);

  // 当前该显示哪一帧
  let pose: string;
  if (status === "speaking") pose = mouthOpen ? "talking" : "standing";
  else if (status === "raising_hand") pose = "raising";
  else if (isIdle) pose = idlePose;
  else pose = POSE[status];

  return (
    // aria-label 让读屏能报出角色名；下面 <img alt=""> 避免重复播报
    <div
      className="flex flex-col items-center gap-1"
      aria-label={name}
      style={{
        // 非发言者退到"在听"的背景层；发言者保持全亮，拉开对比
        opacity: dimmed ? 0.55 : 1,
        transition: "opacity .35s ease",
      }}
    >
      {/* 外层：仅"举手"时轻微上移；发言不再额外位移，减少跳变 */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: status === "raising_hand" ? "translateY(-4px)" : "none",
        }}
      >
        {/* 发言时身后一圈柔和暖光。一直渲染、只改透明度，
            这样亮起/暗下是渐变的，不会在切换发言者时"啪"地跳一下。 */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ease-out"
          style={{
            width: 150,
            height: 190,
            background:
              "radial-gradient(circle, rgba(234,88,12,0.28) 0%, rgba(234,88,12,0) 68%)",
            filter: "blur(4px)",
            zIndex: -1,
            opacity: status === "speaking" ? 1 : 0,
          }}
        />
        {/* 发言时脚下一抹橙色微光，同样用透明度过渡 */}
        <span
          className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px] transition-opacity duration-500 ease-out"
          style={{ opacity: status === "speaking" ? 1 : 0 }}
        />

        {/* 内层：只有「发言中」才有身体动静（底部锚定的轻微起伏，椅子不动）。
            待机保持静止——之前的呼吸浮动会带着椅子一起飘，已弃用。
            错峰延迟让多人同时说话时不会整齐划一。 */}
        <div
          className={status === "speaking" ? "pixel-talk" : undefined}
          style={{ animationDelay: `${(id.charCodeAt(0) % 7) * 0.13}s` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示 */}
          <img
            src={`/sprites/${id}-${pose}.png`}
            alt=""
            style={{ height: CHAR_DISPLAY_H, width: "auto", display: "block" }}
            draggable={false}
            onError={(e) => {
              const el = e.currentTarget;
              if (!el.src.endsWith(`${id}-sitting.png`)) {
                el.src = `/sprites/${id}-sitting.png`;
              }
            }}
          />
        </div>

        {/* 思考省略号：仅 thinking 状态显示，浮在头顶 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      {/* 名字（showName=false 时不画，交给场景顶层统一渲染） */}
      {showName && (
        <span
          className="text-[11px] font-medium"
          style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// 打字机每出一个字都会让整棵组件树重渲染，但角色的 props
// （id / name / status / dimmed）在一个人说话的全过程中根本没变。
// memo 让这 5 个角色直接跳过重渲染 —— 这是消除"字幕不流畅"的关键：
// 渲染变轻后，打字机的 setTimeout 才不会被拖慢，出字节奏才均匀。
export default memo(Character);
