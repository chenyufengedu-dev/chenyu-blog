import type { RoleId, RoleStatus } from "@/lib/cyber-office/types";

// 每种状态显示哪张姿势精灵：闲置/思考=坐，被点名=举手，发言=起身。
const POSE: Record<RoleStatus, "standing" | "raising" | "sitting"> = {
  idle: "sitting",
  thinking: "sitting",
  raising_hand: "raising",
  speaking: "standing",
};

// 角色在场景里的显示高度（px）。所有精灵原生 320 高、宽度略有差异，
// 这里统一按“高度”缩放、宽度自动，保证 6 个角色一样高、脚在同一条线。
// office-scene 定位也用这个值，所以 export 出去共用。
export const CHAR_DISPLAY_H = 132;

interface CharacterProps {
  id: RoleId;
  name: string;
  status: RoleStatus;
  dimmed?: boolean; // 有人在发言、但不是我 → 压暗，突出发言者
}

export default function Character({
  id,
  name,
  status,
  dimmed,
}: CharacterProps) {
  // 举手或发言时，名字用橙色高亮，突出“当前在场上的人”
  const isActive = status === "speaking" || status === "raising_hand";
  const pose = POSE[status];

  return (
    // aria-label 让读屏能报出角色名；下面 <img alt=""> 避免重复播报
    <div
      className="flex flex-col items-center gap-1"
      aria-label={name}
      style={{
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "saturate(0.55)" : "none",
        transition: "opacity .35s ease, filter .35s ease",
      }}
    >
      {/* 外层：举手/发言时整体轻微上移，做出“起身”感 */}
      <div
        className="relative transition-transform duration-300"
        style={{ transform: isActive ? "translateY(-4px)" : "none" }}
      >
        {/* 发言时脚下橙色微光，强化“当前发言者” */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}
        {/* 说话中：头顶像素小气泡做“正在发言”指示（完整台词在下方字幕） */}
        {status === "speaking" && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 border-2 border-accent bg-background px-1 text-[10px] leading-none text-accent">
            ● ● ●
          </span>
        )}

        {/* 内层：呼吸/说话动画（来自 globals.css，尊重 reduced-motion） */}
        <div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>
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

      {/* 名字 */}
      <span
        className="text-[11px] font-medium"
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
