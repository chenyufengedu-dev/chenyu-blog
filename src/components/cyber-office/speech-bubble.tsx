// 头顶气泡。文字由外部传入（来自 state.roles[id].bubble）。
// 本组件不关心"流式"——文字是逐字追加还是一次给完，它都照样显示。
export default function SpeechBubble({ text }: { text: string }) {
  // 没文字就不渲染气泡（提前 return，React 里返回 null = 什么都不画）
  if (!text) return null;

  return (
    <div className="absolute bottom-full left-1/2 mb-1 w-40 -translate-x-1/2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] leading-snug text-text-secondary shadow-sm">
      {text}
      {/* 气泡下方的小三角尾巴：用一个旋转 45° 的小方块伪装 */}
      <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-border bg-background" />
    </div>
  );
}
