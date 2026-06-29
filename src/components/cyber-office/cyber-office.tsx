"use client";

import OfficeScene from "./office-scene";
import { useReplay } from "./use-replay";
import { SAMPLE_MEETING } from "@/lib/cyber-office/sample-meeting";

// 顶层组件：把"回放逻辑（hook）"和"画面（场景/按钮/总结）"组装到一起。
export default function CyberOffice() {
  // 从 hook 里拿到当前状态、是否在播、以及开始播放的函数
  const { state, isPlaying, start } = useReplay(SAMPLE_MEETING);

  return (
    <div className="flex flex-col gap-8">
      {/* 议题 + 播放控制 */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-subtle p-5">
        <p className="text-sm text-text-secondary">
          {/* state.topic 有值就显示议题，否则显示提示语 */}
          {state.topic || "点击下方按钮，回放一场样本会议。"}
        </p>
        <button
          onClick={start}
          disabled={isPlaying} // 播放中禁用按钮，防止重复点击
          className="w-fit rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPlaying ? "会议进行中…" : "▶ 播放样本会议"}
        </button>
      </div>

      {/* 主持人当前发言（hostText 有值才显示） */}
      {state.hostText && (
        <p className="text-center text-sm italic text-text-muted">
          主持人：{state.hostText}
        </p>
      )}

      {/* 圆桌场景 */}
      <OfficeScene state={state} />

      {/* 总结产物（summary 有值才显示） */}
      {state.summary && (
        <div className="rounded-lg border border-border bg-bg-subtle p-5">
          <h3 className="mb-3 font-mono text-sm uppercase tracking-widest text-text-muted">
            Summary
          </h3>
          {/* pre 保留换行；whitespace-pre-wrap 让长行也能自动折行 */}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-secondary">
            {state.summary}
          </pre>
        </div>
      )}
    </div>
  );
}
