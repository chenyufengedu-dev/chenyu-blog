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
          会议议题
          <textarea
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={busy}
            rows={3}
            className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-[1.7] text-text-primary outline-none transition-colors focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <p className="text-sm leading-[1.7] text-text-secondary">
          {helperText}
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              live.cancel();
              setMode("replay");
              replay.start();
            }}
            disabled={!canRunReplay}
            className="rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {replay.isPlaying ? "回放中…" : "播放样本会议"}
          </button>

          <button
            onClick={() => {
              setMode("live");
              live.start(topic, LIVE_PARTICIPANTS);
            }}
            disabled={!canRunLive}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {live.isRunning ? "实时会议进行中…" : "实时运行 DeepSeek 会议"}
          </button>

          {live.isRunning && (
            <button
              onClick={live.cancel}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
            >
              停止实时会议
            </button>
          )}
        </div>
      </div>

      <OfficeScene state={state} />
      <SubtitleBar state={state} />

      <SummaryPanel summary={state.summary} />

      <OrchestrationPanel state={state} />
    </div>
  );
}
