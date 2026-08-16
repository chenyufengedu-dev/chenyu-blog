"use client";

import { useState } from "react";
import OfficeScene from "./office-scene";
import { useReplay } from "./use-replay";
import { useLiveMeeting } from "./use-live-meeting";
import { SAMPLE_MEETING } from "@/lib/cyber-office/sample-meeting";
import type { MeetingState, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";
import OrchestrationPanel from "./orchestration-panel";
import TranscriptPanel from "./transcript-panel";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
  if (!summary) return null;

  // 复制到剪贴板
  const copy = () => navigator.clipboard?.writeText(summary);

  // 导出为 .md 文件：用 Blob 造一个临时下载链接，点一下即下载。
  const exportMd = () => {
    const blob = new Blob([summary], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cyber-office-会议结论.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-mono text-sm uppercase tracking-widest text-text-muted">
          会议结论
        </h3>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
          >
            复制
          </button>
          <button
            onClick={exportMd}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
          >
            导出 Markdown
          </button>
        </div>
      </div>
      <div className="prose prose-sm max-w-none leading-[1.7] dark:prose-invert prose-headings:font-semibold prose-a:text-accent prose-table:block prose-table:overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      </div>
    </div>
  );
}

function SubtitleBar({
  state,
  onSkip,
}: {
  state: MeetingState;
  onSkip?: () => void; // 传入则在字幕右上角显示“跳过打字机”，作为这条字幕的控制
}) {
  // 一处字幕搞定三种情况：错误 / 当前发言者 / 主持人串场
  let speaker = "";
  let text = "";
  let accent = false; // 发言者/错误用橙色名，主持人串场用灰色名

  if (state.error) {
    speaker = "系统";
    text = state.error;
    accent = true;
  } else if (state.activeSpeaker && state.roles[state.activeSpeaker]?.bubble) {
    // 有人正在说：显示逐字增长的实时发言
    speaker = getRole(state.activeSpeaker).name;
    text = state.roles[state.activeSpeaker].bubble;
    accent = true;
  } else {
    // 没人在说：显示"最后说完的那句"。
    // 这里必须取 transcript 的最后一条，而不是 hostText——因为 hostText 是本轮开头
    // 主持人的串场词，比刚说完的角色发言更旧，直接用它字幕会"倒退"回上一句。
    const last = state.transcript.at(-1);
    if (last) {
      speaker = getRole(last.speaker).name;
      text = last.text;
      accent = last.speaker !== "host";
    }
  }

  if (!text) return null; // 没内容就不占位

  return (
    // 与舞台/其它卡片统一：1px 边 + rounded-lg（原来的 border-2 直角在页面里很突兀）。
    <div className="rounded-lg border border-border bg-bg-subtle px-5 py-4">
      {/* key 换人时变化 → React 重新挂载这块 → 淡入动画重放。
          这是"用 key 触发动画"的常见手法，比手动管理动画状态简单得多。 */}
      <div key={speaker} className="subtitle-in">
        {/* 顶行：左边发言者名，右边（可选）跳过按钮，同一行更有归属感 */}
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <p
            className="text-xs font-medium"
            style={{ color: accent ? "#ea580c" : "var(--text-muted)" }}
          >
            {speaker}
          </p>
          {onSkip && (
            <button
              onClick={onSkip}
              className="shrink-0 text-xs text-text-muted transition-colors hover:text-accent"
            >
              跳过打字机 ⏭
            </button>
          )}
        </div>
        <p className="text-sm leading-[1.7] text-text-secondary">{text}</p>
      </div>
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
  // 用户手动选择的模式。
  const [modeChoice, setModeChoice] = useState<"replay" | "live">("replay");
  // 实际展示的模式：只要有实时会议在跑或被暂停（包括刷新后恢复出来的那场），
  // 页面就必然显示实时模式。用"算出来"代替在 effect 里 setState——
  // 后者会触发级联渲染，React 19 的 lint 规则也直接禁止。
  const mode = live.isRunning || live.isPaused ? "live" : modeChoice;
  const [topic, setTopic] = useState(
    "讨论一个空间转录组可视化的博客选题，并产出文章大纲",
  );

  // 当前展示的会议状态：回放模式看 replay.state，实时模式看 live.state。
  const state = mode === "live" ? live.state : replay.state;
  // 暂停中的会议也算"占用中"：此时不允许改议题或另起一场，避免状态打架。
  const busy = replay.isPlaying || live.isRunning || live.isPaused;
  const canRunReplay = !replay.isPlaying;
  const canRunLive = topic.trim().length >= 6 && !busy;

  // 实时模式下：请求在跑、但暂时没人发言、也没出结论 → 视为“正在思考下一步”。
  const thinking =
    mode === "live" &&
    live.isRunning &&
    !state.activeSpeaker &&
    !state.summary &&
    !state.error;

  return (
    <div className="flex flex-col gap-12">
      {/* ===== Hero：桌面双栏（左控制 / 右舞台），移动端单列 ===== */}
      {/* 左栏固定 380px；右栏用 minmax(0,1fr) 允许缩到舞台原生 760px 以下
          （舞台自带 ResizeObserver 等比缩放）。若右栏写成 1fr，其最小值是
          内容宽度 760px，会把左栏挤扁——这是 CSS Grid 常见坑。 */}
      <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        {/* 左栏：标题 + 副标题 + 控制区 */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Cyber <span className="text-accent">Office</span>
            </h1>
            <p className="mt-3 text-base leading-[1.7] text-text-secondary">
              一个多 Agent
              协作实验室。给一个议题，角色们围坐圆桌轮流发言、由主持人动态调度，最后产出结论。
            </p>
          </div>

          {/* 控制区卡片（原样，只是搬进左栏） */}
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

            {/* 示例议题：窄栏里改成整齐的满宽列表，避免三条参差不齐的小方块 */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-text-muted">试试这些问题</p>
              {EXAMPLE_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  disabled={busy}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-left text-xs leading-[1.6] text-text-secondary transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setModeChoice("live");
                  live.start(topic, LIVE_PARTICIPANTS);
                }}
                disabled={!canRunLive}
                className="rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {live.isRunning ? "会议进行中…" : "用我的议题开始"}
              </button>

              <button
                onClick={() => {
                  live.cancel();
                  setModeChoice("replay");
                  replay.start();
                }}
                disabled={!canRunReplay}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:border-accent/40 hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
              >
                {replay.isPlaying ? "演示回放中…" : "看一场演示"}
              </button>

              {(live.isRunning || live.isPaused) && (
                <button
                  onClick={live.cancel}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                >
                  停止会议
                </button>
              )}

              {/* 实时会议的暂停/继续。暂停后不再发起下一轮请求，真正停止调用大模型。 */}
              {mode === "live" && (live.isRunning || live.isPaused) && (
                <button
                  onClick={() => (live.isPaused ? live.resume() : live.pause())}
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {live.isPaused ? "继续会议" : "暂停会议"}
                </button>
              )}

              {mode === "replay" && replay.isPlaying && (
                <button
                  onClick={() =>
                    replay.isPaused ? replay.resume() : replay.pause()
                  }
                  className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
                >
                  {replay.isPaused ? "继续" : "暂停"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 右栏：状态条 + 思考/错误 + 舞台 + 字幕 */}
        <div className="flex flex-col gap-3">
          <StatusBar state={state} />
          {mode === "live" && live.isPaused && live.isRunning && (
            <p className="text-sm text-text-muted">
              本轮说完后暂停…（正在说的这句会讲完）
            </p>
          )}
          {mode === "live" && live.isPaused && !live.isRunning && (
            <p className="text-sm text-text-muted">
              会议已暂停 · 未在调用模型
              {live.state.topic ? ` · 议题：${live.state.topic}` : ""}
              。点「继续会议」接着开。
            </p>
          )}
          {thinking && !live.isPaused && (
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
          <SubtitleBar
            state={state}
            onSkip={
              mode === "replay" && replay.isPlaying && state.activeSpeaker
                ? replay.skip
                : undefined
            }
          />
        </div>
      </div>

      {/* ===== 结论区 ===== */}
      <SummaryPanel summary={state.summary} />

      {/* ===== 编排面板（技术亮点，独占一块） ===== */}
      <OrchestrationPanel state={state} />

      {/* ===== 发言记录（默认折叠） ===== */}
      <TranscriptPanel state={state} />
    </div>
  );
}
