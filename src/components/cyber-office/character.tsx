import type { RoleId, RoleStatus } from "@/lib/cyber-office/types";
import { getCharacterLayers } from "@/lib/cyber-office/character-atlas";
import PixelSprite from "./pixel-sprite";

// interface 在这里定义"这个组件接收哪些 props（外部传入的参数）"。
interface CharacterProps {
  id: RoleId;
  name: string;
  color: string;
  status: RoleStatus; // idle / thinking / raising_hand / speaking
}

// 一个角色小人。P0/P1 用纯色方块占位（设计文档选项 c），P4 再换成像素 sprite。
// { name, color, status } 是"解构"——直接从传入的 props 对象里把这三个字段拆出来用。
export default function Character({ id, name, color, status }: CharacterProps) {
  // 举手或正在说话时，名字用橙色高亮，突出"当前在场上的人"
  const isActive = status === "speaking" || status === "raising_hand";

  // 组装该角色的像素图层（身体 + 手臂 + 配件）
  const layers = getCharacterLayers(id, color, status);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 外层：举手时整体轻微上移，做出"起身"感 */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: status === "raising_hand" ? "translateY(-4px)" : "none",
        }}
      >
        {/* 发言时脚下橙色微光 */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}

        {/* 内层：呼吸/说话动画（来自 P4.2 的 globals.css） */}
        <div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>
          <PixelSprite layers={layers} />
        </div>

        {/* 思考省略号 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      {/* 名字 */}
      <span
        className="text-[10px] font-medium"
        // 活跃时橙色，否则用次要文字色（CSS 变量来自你的设计系统）
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
