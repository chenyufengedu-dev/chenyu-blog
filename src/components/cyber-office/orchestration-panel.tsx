"use client";

import { useState } from "react";
import type {
  MeetingState,
  ModeratorDecision,
  RoleId,
} from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";

// 会议没开始 / 异常结束时 participants 为空，用默认名单兜底，让流向图始终完整。
const DEFAULT_EXPERTS: RoleId[] = ["pm", "frontend", "bio", "reviewer"];

// 推断"实时"走到哪个节点（不点击时的默认高亮）。
function activeNode(state: MeetingState): "host" | "output" | RoleId | null {
  if (state.summary || state.phase === "ended") return "output";
  if (state.activeSpeaker) return state.activeSpeaker;
  if (state.lastDecision) return "host";
  return null;
}

// 流程连接线
function Arrow() {
  return (
    <span className="flex items-center text-text-muted" aria-hidden>
      <span className="h-px w-5 bg-border" />
      <span className="-ml-1 text-xs">▸</span>
    </span>
  );
}

// 单个节点：clickable 时可点击回看；selected 加橙色 ring；active 是实时高亮。
function Node({
  label,
  sub,
  active,
  selected,
  clickable,
  onClick,
}: {
  label: string;
  sub?: string;
  active: boolean;
  selected?: boolean;
  clickable?: boolean;
  onClick?: () => void;
}) {
  const highlight = active || selected;
  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`rounded-lg border px-3 py-2 text-center transition-colors ${
        highlight
          ? "border-accent bg-accent-subtle"
          : "border-border bg-bg-subtle"
      } ${selected ? "ring-2 ring-accent/40" : ""} ${
        clickable ? "cursor-pointer hover:border-accent/60" : "cursor-default"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          highlight ? "text-accent" : "text-text-primary"
        }`}
      >
        {label}
      </p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </button>
  );
}

// 决策 + 发言 的详情展示
function DecisionView({
  decision,
  speech,
}: {
  decision?: ModeratorDecision | null;
  speech?: string;
}) {
  if (!decision) {
    return (
      <p className="text-sm text-text-muted">
        会议开始后，这里会显示主持人每一轮的调度决策。
      </p>
    );
  }
  return (
    <>
      <p className="mb-2 text-sm leading-[1.7] text-text-secondary">
        {decision.action === "call_on"
          ? `点名「${getRole(decision.speaker).name}」发言 —— 指令：${decision.prompt}`
          : "判断讨论已充分，转入总结。"}
      </p>
      {speech && (
        <p className="mb-2 rounded-md border border-border bg-background px-3 py-2 text-sm leading-[1.7] text-text-secondary">
          发言：{speech}
        </p>
      )}
      <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-[1.6] text-text-secondary">
        {JSON.stringify(decision, null, 2)}
      </pre>
    </>
  );
}

type NodeKey = "host" | "output" | RoleId;

export default function OrchestrationPanel({ state }: { state: MeetingState }) {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState<NodeKey | null>(null); // 回看选中的节点
  const active = activeNode(state);
  const participants =
    state.participants.length > 0 ? state.participants : DEFAULT_EXPERTS;
  const experts = participants.filter((id) => id !== "host");

  // 各节点是否有可回看内容
  const hostHasContent = state.decisions.length > 0;
  const expertHasContent = (id: RoleId) =>
    state.decisions.some((d) => d.action === "call_on" && d.speaker === id) ||
    state.transcript.some((t) => t.speaker === id);

  const toggle = (key: NodeKey) =>
    setSelected((cur) => (cur === key ? null : key)); // 再点一次取消回看

  // 详情区：选中了就回看该节点；没选中就跟随实时（lastDecision）。
  function renderDetail() {
    if (selected === "host") {
      return <DecisionView decision={state.decisions.at(-1)} />;
    }
    if (selected && selected !== "output") {
      const id = selected as RoleId;
      const decision = [...state.decisions]
        .reverse()
        .find((d) => d.action === "call_on" && d.speaker === id);
      const speech = [...state.transcript]
        .reverse()
        .find((t) => t.speaker === id)?.text;
      return <DecisionView decision={decision} speech={speech} />;
    }
    // 未选中：实时当前决策
    return <DecisionView decision={state.lastDecision} />;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-subtle">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-text-primary">
          AI 智能体如何协作
        </span>
        <span className="text-xs text-text-muted">
          {open ? "收起 ▲" : "展开 ▼"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5">
          {/* 调度流向图：实时高亮 + 可点击回看 */}
          <div className="flex flex-wrap items-center gap-3">
            <Node label="你的问题" active={false} />
            <Arrow />
            <Node
              label="主持人"
              sub="调度分工"
              active={active === "host"}
              selected={selected === "host"}
              clickable={hostHasContent}
              onClick={() => toggle("host")}
            />
            <Arrow />
            <div className="flex flex-col gap-2">
              {experts.map((id) => (
                <Node
                  key={id}
                  label={getRole(id).name}
                  sub={getRole(id).title}
                  active={active === id}
                  selected={selected === id}
                  clickable={expertHasContent(id)}
                  onClick={() => toggle(id)}
                />
              ))}
            </div>
            <Arrow />
            <Node
              label="综合输出"
              sub="最佳答案"
              active={active === "output"}
            />
          </div>

          {/* 决策详情：回看选中节点 / 实时当前 */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-text-muted">
              {selected ? "回看：该角色的调度决策与发言" : "主持人本轮调度决策"}
            </p>
            {renderDetail()}
          </div>

          {/* 阶段讲解（静态） */}
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-xs font-medium text-text-muted">
              一场讨论的四个阶段
            </p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {[
                ["01 理解问题", "主持人梳理议题、明确目标与讨论议程"],
                ["02 展开探索", "各专家从不同视角发言、贡献信息与洞察"],
                ["03 交叉辩论", "审稿人挑战假设，团队完善与深化想法"],
                ["04 综合生成", "总结 Agent 汇总共识，产出最终答案"],
              ].map(([title, desc]) => (
                <li
                  key={title}
                  className="rounded-md border border-border bg-background px-3 py-2"
                >
                  <p className="text-sm font-medium text-text-primary">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs leading-[1.6] text-text-muted">
                    {desc}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* 能力小卡（静态） */}
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["记忆与上下文", "transcript 跨轮传递，每个 Agent 都看得到历史"],
              ["路由逻辑", "主持人结构化决策，动态点名下一个发言者"],
              ["质量护栏", "决策 JSON 合法性校验 + 调用限流与预算保护"],
              ["工具与数据", "规划中：接入检索 / 文件 / 数据库"],
            ].map(([title, desc]) => (
              <div
                key={title}
                className="rounded-md border border-border bg-background px-3 py-2"
              >
                <p className="text-sm font-medium text-text-primary">{title}</p>
                <p className="mt-0.5 text-xs leading-[1.6] text-text-muted">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
