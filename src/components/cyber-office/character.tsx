import type { RoleStatus } from "@/lib/cyber-office/types";

// interface 在这里定义"这个组件接收哪些 props（外部传入的参数）"。
interface CharacterProps {
  name: string;
  color: string;
  status: RoleStatus; // idle / thinking / raising_hand / speaking
}

// 一个角色小人。P0/P1 用纯色方块占位（设计文档选项 c），P4 再换成像素 sprite。
// { name, color, status } 是"解构"——直接从传入的 props 对象里把这三个字段拆出来用。
export default function Character({ name, color, status }: CharacterProps) {
  // 举手或正在说话时，名字用橙色高亮，突出"当前在场上的人"
  const isActive = status === "speaking" || status === "raising_hand";

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 小人方块本体 */}
      <div
        className="relative flex h-11 w-11 items-center justify-center rounded-[3px] text-white text-xs font-mono transition-transform duration-300"
        // 动态样式（颜色、位移、描边随状态变）写在 style 里，因为值是计算出来的
        style={{
          backgroundColor: color,
          // 举手时整个小人轻微上移 6px，做出"站起来"的感觉
          transform: status === "raising_hand" ? "translateY(-6px)" : "none",
          // 说话时加一圈橙色描边（box-shadow 当描边用），表示"麦克风在他手上"
          boxShadow: status === "speaking" ? "0 0 0 2px #ea580c" : "none",
        }}
      >
        {/* 方块里显示名字前两个字当头像占位，如"产品" */}
        {name.slice(0, 2)}

        {/* 举手图标：仅在 raising_hand 状态显示 */}
        {/* 条件 && <JSX>} 是 React 常用写法：条件为真才渲染后面的元素 */}
        {status === "raising_hand" && (
          <span className="absolute -top-4 text-sm">✋</span>
        )}

        {/* 思考省略号：仅在 thinking 状态显示 */}
        {status === "thinking" && (
          <span className="absolute -top-4 text-sm text-text-muted">…</span>
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
