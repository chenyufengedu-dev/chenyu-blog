"use client";

import { memo } from "react";

/**
 * 角色头顶的发言气泡。
 *
 * 定位约定：调用方把它放在「角色头顶正上方那个点」，组件内部用
 * translate(-50%, -100%) 把自己的**底边中点**对齐到该点。
 * 这样逐字打字时气泡是向上生长的，底部的小尾巴始终钉在角色头顶不动——
 * 如果反过来按顶部定位，打字时整个气泡会往下爬，非常晃眼。
 */

function SpeechBubble({
  name,
  text,
  x,
  y,
}: {
  name: string;
  text: string;
  x: number; // 设计坐标：角色水平中心
  y: number; // 设计坐标：气泡底边（角色头顶上方一点）
}) {
  // 这个组件只负责画，不管节奏：逐字进度由 office-scene 统一掌控，
  // 因为角色的动作也要跟着同一个时钟走（否则会出现"人坐下了、字还在打"）。
  if (!text) return null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        // 300px：够 60 字排成 3 行（再窄就要 4 行，主持人的气泡会顶出画布）；
        // 各座位居中展开 ±150 后仍在 760 画布内，不需要边界回收逻辑。
        width: "max-content",
        maxWidth: 300,
        zIndex: 600, // 高于前桌沿(430)与名字层(400)
      }}
    >
      <div className="rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm">
        <p className="mb-1 text-[11px] font-medium leading-none text-accent">
          {name}
        </p>
        {/* 14px：场景整体会被缩放到列宽（约 0.9），14px 落地约 12.5px，仍清晰。
            再小就吃力了。 */}
        <p className="text-[14px] leading-[1.6] text-text-primary">{text}</p>
      </div>

      {/* 指向角色的小尾巴：一个旋转 45° 的方块，只露出下半个角 */}
      <span
        className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-background"
        style={{ bottom: -4 }}
      />
    </div>
  );
}

// 和 Character 同理：打字时父层每个字都会重渲染，但没在说话的角色
// 气泡内容没变，memo 让它们跳过。
export default memo(SpeechBubble);
