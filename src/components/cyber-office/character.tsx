"use client";

import { useEffect, useState } from "react";
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

interface CharacterProps {
  id: RoleId;
  name: string;
  status: RoleStatus;
  dimmed?: boolean; // 有人在发言、但不是我 → 压暗，突出发言者
  showName?: boolean; // 名字是否在此渲染（场景里改由顶层统一画，避免被桌子挡）
}

export default function Character({
  id,
  name,
  status,
  dimmed,
  showName = true,
}: CharacterProps) {
  // 举手或发言时，名字用橙色高亮，突出“当前在场上的人”
  const isActive = status === "speaking" || status === "raising_hand";

  // 发言时嘴型循环：standing(闭)↔talking(开)，做出"在说话"的动效。
  const [mouthOpen, setMouthOpen] = useState(false);
  useEffect(() => {
    if (status !== "speaking") return;
    // 尊重"减少动态效果"：开启时不循环（静态一帧即可）
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setMouthOpen((m) => !m), 180);
    return () => clearInterval(timer);
  }, [status]);

  // 非发言时 mouthOpen 无所谓，pose 直接取 POSE[status]
  const pose =
    status === "speaking" ? (mouthOpen ? "talking" : "standing") : POSE[status];

  return (
    // aria-label 让读屏能报出角色名；下面 <img alt=""> 避免重复播报
    <div
      className="flex flex-col items-center gap-1"
      aria-label={name}
      style={{
        // 非发言者只是"轻轻退后在听"，不做成幽灵/被禁用的样子
        opacity: dimmed ? 0.7 : 1,
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
        {/* 发言时脚下一抹橙色微光——保留这一个克制的"在台上"提示即可 */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}

        {/* 内层：温和呼吸浮动；说话感由嘴型循环表达，不再用快速抖动 */}
        <div className="pixel-idle">
          {/* eslint-disable-next-line @next/next/no-img-element -- 精灵图需按原样显示，next/image 会重编码糊掉像素 */}
          <img
            src={`/sprites/${id}-${pose}.png`}
            alt=""
            style={{ height: CHAR_DISPLAY_H, width: "auto", display: "block" }}
            draggable={false}
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
