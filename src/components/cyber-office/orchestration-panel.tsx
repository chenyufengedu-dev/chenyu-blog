"use client";

import { useState } from "react";
import type { MeetingState, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";

// 推断编排流程"现在走到哪个节点"，返回一个标识：
//   "host"（主持人调度中）| 某个专家 RoleId（该专家发言中）| "output"（已收口）| null（还没开始）
// 优先级：已总结 > 有人发言 > 主持人刚决策 > 无。
function activeNode(state: MeetingState): "host" | "output" | RoleId | null {
  if (state.summary || state.phase === "ended") return "output";
  if (state.activeSpeaker) return state.activeSpeaker;
  if (state.lastDecision) return "host";
  return null;
}

// 单个流程节点：active 时用橙色描边 + 浅橙底高亮。
function Node({
  label,
  sub,
  active,
}: {
  label: string;
  sub?: string;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-center transition-colors ${
        active ? "border-accent bg-accent-subtle" : "border-border bg-bg-subtle"
      }`}
    >
      <p
        className={`text-sm font-medium ${
          active ? "text-accent" : "text-text-primary"
        }`}
      >
        {label}
      </p>
      {sub && <p className="mt-0.5 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

// 流程连接线：一条细线 + 末端尖角，比文字“<Arrow />”更像流程图。
function Arrow() {
  return (
    <span className="flex items-center text-text-muted" aria-hidden>
      <span className="h-px w-5 bg-border" />
      <span className="-ml-1 text-xs">▸</span>
    </span>
  );
}

// 会议还没开始 / 异常结束时 state.participants 为空；用这份默认名单兜底，
// 让流向图任何时候都显示完整的专家列，而不是塌成"主持人 → 综合输出"。
const DEFAULT_EXPERTS: RoleId[] = ["pm", "frontend", "bio", "reviewer"];

export default function OrchestrationPanel({ state }: { state: MeetingState }) {
  const [open, setOpen] = useState(true);
  const active = activeNode(state);
  // 专家节点 = 参会者去掉主持人（动态，之后加自定义角色也自动适配）；
  // 参会者为空时退回默认名单，保证流向图完整。
  const participants =
    state.participants.length > 0 ? state.participants : DEFAULT_EXPERTS;
  const experts = participants.filter((id) => id !== "host");

  return (
    <div className="rounded-lg border border-border bg-bg-subtle">
      {/* 折叠开关 */}
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
          {/* 调度流向图：当前节点高亮 */}
          <div className="flex flex-wrap items-center gap-3">
            <Node label="你的问题" active={false} />
            <Arrow />
            <Node label="主持人" sub="调度分工" active={active === "host"} />
            <Arrow />
            <div className="flex flex-col gap-2">
              {experts.map((id) => (
                <Node
                  key={id}
                  label={getRole(id).name}
                  sub={getRole(id).title}
                  active={active === id}
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

          {/* 主持人本轮真实决策：先一句人话，再附原始 JSON（证明是真调度） */}
          <div className="mt-5">
            <p className="mb-2 text-xs font-medium text-text-muted">
              主持人本轮调度决策
            </p>
            {state.lastDecision ? (
              <>
                <p className="mb-2 text-sm leading-[1.7] text-text-secondary">
                  {state.lastDecision.action === "call_on"
                    ? `点名「${getRole(state.lastDecision.speaker).name}」发言 —— 指令：${state.lastDecision.prompt}`
                    : "判断讨论已充分，转入总结。"}
                </p>
                <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs leading-[1.6] text-text-secondary">
                  {JSON.stringify(state.lastDecision, null, 2)}
                </pre>
              </>
            ) : (
              <p className="text-sm text-text-muted">
                会议开始后，这里会实时显示主持人每一轮的调度决策。
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
