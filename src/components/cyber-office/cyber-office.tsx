"use client";

import { useMemo, useState } from "react";
import OfficeScene from "./office-scene";
import { useReplay } from "./use-replay";
import { useLiveMeeting } from "./use-live-meeting";
import { SAMPLE_MEETING } from "@/lib/cyber-office/sample-meeting";
import type { MeetingState, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";
import OrchestrationPanel from "./orchestration-panel";

// P2 先固定参会角色；P5 再做用户自定义角色。
const LIVE_PARTICIPANTS: RoleId[] = [
  "host",
  "pm",
  "frontend",
  "bio",
  "reviewer",
];

// 示例议题：点击 chip 直接填进输入框，降低"不知道输入什么"的门槛。
const EXAMPLE_TOPICS = [
  "AI 对产品经理的工作有哪些实际影响？",
  "如何建立一个高质量的数据指标体系？",
  "空间转录组可视化，怎么让入门读者看懂？",
];

function SummaryPanel({ summary }: { summary: string | null }) {
  // summary 还没生成时不渲染面板，避免页面上出现空卡片。
  if (!summary) return null;

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-5">
      <h3 className="mb-3 font-mono text-sm uppercase tracking-widest text-text-muted">
        Summary
      </h3>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-secondary">
        {summary}
      </pre>
    </div>
  );
}

function SubtitleBar({ state }: { state: MeetingState }) {
  // 一处字幕搞定三种情况：错误 / 当前发言者 / 主持人串场
  let speaker = "";
  let text = "";
  let accent = false; // 发言者/错误用橙色名，主持人串场用灰色名

  if (state.error) {
    speaker = "系统";
    text = state.error;
    accent = true;
  } else if (state.activeSpeaker && state.roles[state.activeSpeaker]?.bubble) {
    speaker = getRole(state.activeSpeaker).name;
    text = state.roles[state.activeSpeaker].bubble;
    accent = true;
  } else if (state.hostText) {
    speaker = getRole("host").name;
    text = state.hostText;
  }

  if (!text) return null; // 没内容就不占位

  return (
    <div className="border-2 border-border bg-bg-subtle px-5 py-4">
      <p
        className="mb-1.5 text-xs font-medium"
        style={{ color: accent ? "#ea580c" : "var(--text-muted)" }}
      >
        {speaker}
      </p>
      <p className="text-sm leading-[1.7] text-text-secondary">{text}</p>
    </div>
  );
}

function StatusBar({ state }: { state: MeetingState }) {
  // 三种阶段用不同文案；讨论中额外显示当前发言者。
  let label = "";
  if (state.phase === "running") {
    const who = state.activeSpeaker
      ? getRole(state.activeSpeaker).name
      : "主持人";
    label = `讨论中 · 当前：${who}`;
  } else if (state.phase === "ended") {
    label = state.error ? "会议中断" : "会议完成 ✓";
  } else {
    return null; // idle：还没开始，不占位
  }

  return (
    <div className="flex items-center gap-2 text-sm text-text-secondary">
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          state.phase === "running" ? "bg-accent" : "bg-border"
        }`}
      />
      {label}
    </div>
  );
}

export default function CyberOffice() {
  // replay 和 live 各自管理自己的状态；mode 决定当前页面展示哪一份 state。
  const replay = useReplay(SAMPLE_MEETING);
  const live = useLiveMeeting();
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [topic, setTopic] = useState(
    "讨论一个空间转录组可视化的博客选题，并产出文章大纲",
  );

  // 当前展示的会议状态：回放模式看 replay.state，实时模式看 live.state。
  const state = mode === "live" ? live.state : replay.state;
  // 任意一种会议正在跑时，都禁用按钮，避免两个流同时改 UI。
  const busy = replay.isPlaying || live.isRunning;
  const canRunReplay = !replay.isPlaying;
  const canRunLive = topic.trim().length >= 6 && !busy;

  // 实时模式下：请求在跑、但暂时没人发言、也没出结论 → 视为“正在思考下一步”。
  const thinking =
    mode === "live" &&
    live.isRunning &&
    !state.activeSpeaker &&
    !state.summary &&
    !state.error;

  const helperText = useMemo(() => {
    // useMemo 只是避免每次渲染都重新算这段提示文字；这里不是必须，但语义清楚。
    //useMemo: 在组件重新渲染（re-render）时，只有在特定的依赖项([mode, state.topic, topic])发生变化时，才会重新执行该计算过程
    if (mode === "live") return state.topic || topic;
    return state.topic || "点击下方按钮，回放一场样本会议。";
  }, [mode, state.topic, topic]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-subtle p-5">
        <label className="flex flex-col gap-2 text-sm text-text-secondary">
          你想让这支 AI 团队讨论什么问题？
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={busy}
            rows={3}
            placeholder="输入你的问题，或点下方示例试试……"
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-[1.7] text-text-primary outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        {/* 示例议题 chip：点一下填进输入框 */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTopic(t)}
              disabled={busy}
              className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t}
            </button>
          ))}
        </div>

        <p className="text-sm leading-[1.7] text-text-secondary">
          {helperText}
        </p>

        <div className="flex flex-wrap gap-3">
          {/* 主入口：用用户自己的议题跑真实会议 */}
          <button
            onClick={() => {
              setMode("live");
              live.start(topic, LIVE_PARTICIPANTS);
            }}
            disabled={!canRunLive}
            className="rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {live.isRunning ? "会议进行中…" : "用我的议题开始"}
          </button>

          {/* 次入口：零门槛看一场预生成的样本会议 */}
          <button
            onClick={() => {
              live.cancel();
              setMode("replay");
              replay.start();
            }}
            disabled={!canRunReplay}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {replay.isPlaying ? "演示回放中…" : "看一场演示"}
          </button>

          {live.isRunning && (
            <button
              onClick={live.cancel}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
            >
              停止会议
            </button>
          )}
        </div>
      </div>

      <StatusBar state={state} />
      {thinking && (
        <p className="text-sm text-text-muted">AI 正在思考下一步…</p>
      )}
      {state.error && mode === "live" && !live.isRunning && (
        <button
          onClick={() => live.start(topic, LIVE_PARTICIPANTS)}
          className="self-start rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
        >
          重试
        </button>
      )}
      <OfficeScene state={state} />
      <SubtitleBar state={state} />

      <SummaryPanel summary={state.summary} />

      <OrchestrationPanel state={state} />
    </div>
  );
}
