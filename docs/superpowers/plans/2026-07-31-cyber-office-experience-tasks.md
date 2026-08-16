# Cyber Office 体验改进 · 交互轨实现教程

> **教程说明（给 Chenyu）**：这是"照着一步步敲"的实现教程，配合改进方案
> [`2026-07-31-cyber-office-experience-overhaul.md`](./2026-07-31-cyber-office-experience-overhaul.md) 使用。
> 每个 Task 标了改哪个文件、怎么改、贴出带注释的代码、末尾给提交命令。做完一个提交后把 commit hash 发记录员 AI。步骤用 `- [ ]` 勾选跟踪。
> 桌面优先；手机端仅保留现有 `overflow-x-auto` 兜底，真·响应式留后期。

**范围（本文件持续追加）**：会议可读性一组——发言者高亮、单一字幕、进度状态条、入口修复……素材（画风统一/角色/桌子）走美术轨，不在本文件。

**Architecture:** 全部只改**展示层**，不动 `applyEvent` 事件流 / reducer / 回放逻辑（除非某 Task 明确说明）。

---

### Task 1: 发言者高亮 + 说话小气泡

**目标**：让"谁在发言"一眼可见——发言者全彩 + 头顶像素小气泡，其余人压暗降饱和。

**Files:**
- Modify: `src/components/cyber-office/character.tsx`
- Modify: `src/components/cyber-office/office-scene.tsx`

> 原理：`Character` 只知道自己的 `status`，不知道"别人是不是在说"。所以由 `office-scene`（它有 `state.activeSpeaker`）算出"有人在说且不是我"传进来，`Character` 据此压暗自己。

- [x] **Step 1: `character.tsx` 接口加 `dimmed`**

把 `CharacterProps` 改成：

```tsx
interface CharacterProps {
  id: RoleId;
  name: string;
  status: RoleStatus;
  dimmed?: boolean; // 有人在发言、但不是我 → 压暗，突出发言者
}
```

- [x] **Step 2: `character.tsx` 解构 `dimmed` 并应用到最外层**

把函数签名改成：

```tsx
export default function Character({ id, name, status, dimmed }: CharacterProps) {
```

把最外层那个 `<div className="flex flex-col items-center gap-1" aria-label={name}>` 加上 `style`（压暗 + 降饱和 + 平滑过渡）：

```tsx
    <div
      className="flex flex-col items-center gap-1"
      aria-label={name}
      style={{
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "saturate(0.55)" : "none",
        transition: "opacity .35s ease, filter .35s ease",
      }}
    >
```

- [x] **Step 3: `character.tsx` 加"说话中"像素小气泡**

在内层"呼吸/说话动画"那个 `<div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>` **之前**，插入一个仅发言时显示的小气泡（像素风：直角硬边、不用圆角软阴影）：

```tsx
        {/* 说话中：头顶像素小气泡做“正在发言”指示（完整台词在下方字幕） */}
        {status === "speaking" && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 border-2 border-accent bg-background px-1 text-[10px] leading-none text-accent">
            ●●●
          </span>
        )}
```

- [x] **Step 4: `office-scene.tsx` 把 `dimmed` 传进去**

在 `participants.map(...)` 里渲染 `<Character .../>` 的地方，加一行 `dimmed`（`state.activeSpeaker` 已在 state 中）：

```tsx
              <Character
                id={id}
                name={role.name}
                status={runtime?.status ?? "idle"}
                dimmed={
                  state.activeSpeaker != null && state.activeSpeaker !== id
                }
              />
```

- [x] **Step 5: 验证**

Run: `npm run dev`，播放样本会议。
Expected：发言者全彩 + 头顶 `●●●` 小气泡；其余角色明显变暗、降饱和；没人发言（idle/默认）时所有人正常不压暗。

- [x] **Step 6: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/character.tsx src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 发言者高亮，其余角色压暗"
```

---

### Task 2: 合并成单一字幕条（去掉上下双字幕）

**目标**：现在"场景上方主持词 + 场景下方发言卡片"是两处字幕，视线来回跳。合并成**场景下方唯一一条字幕**，始终显示"谁在说 + 说什么"（主持人串场也走这条）。

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

> 优先级：错误 > 当前发言者 > 主持人串场 > 不显示。这样一处就能覆盖所有情况。

- [x] **Step 1: 新增 SubtitleBar 组件**

在 `cyber-office.tsx` 里，把原来的 `HostLine` 组件整段**替换**为下面的 `SubtitleBar`（它顶部已 import 了 `getRole` 和 `MeetingState`，无需再加）：

```tsx
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
```

- [x] **Step 2: 替换渲染处**

在 `CyberOffice` 的 `return (...)` 里，把这三段：

```tsx
      <HostLine state={state} />
      <OfficeScene state={state} />

      {/* 发言字幕：完整显示当前发言者的话，不再挤在头顶 */}
      {state.activeSpeaker && state.roles[state.activeSpeaker]?.bubble && (
        <div className="rounded-lg border border-border bg-bg-subtle px-5 py-4">
          <p className="mb-1.5 text-xs font-medium text-accent">
            {getRole(state.activeSpeaker).name}
          </p>
          <p className="text-sm leading-[1.7] text-text-secondary">
            {state.roles[state.activeSpeaker].bubble}
          </p>
        </div>
      )}
```

替换为：

```tsx
      <OfficeScene state={state} />
      <SubtitleBar state={state} />
```

- [x] **Step 3: 验证**

Run: `npm run dev`，播放样本会议。
Expected：场景**上方不再有**主持词那一行；场景**下方只有一条**字幕，主持人串场、角色发言、错误都在这一条里显示，带发言者名字。

- [x] **Step 4: 校验 + 提交**

> 若 `npm run lint` 报 `HostLine` 未使用，说明你只删了调用没删定义——把 `HostLine` 函数整段删掉即可。

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 合并为单一字幕条，去掉上下双字幕"
```

---

### Task 3: 新增 `moderator_decision` 事件（编排面板的数据地基）

> ⚠️ **本 Task 明确要动事件流**（types / reducer / orchestrator / 样本），不是纯展示层。这是"⭐编排逻辑面板"的地基：让主持人每轮的**真实调度决策**（点谁、给什么指令）能从后端流到前端，供面板展示。做完后前端才有"真决策"可渲染。
>
> **原理**：现在 `orchestrator.ts` 里 `parseModeratorDecision` 算出决策 `{action, speaker, prompt, hostText}` 后，只把 `hostText`/`speaker` 拆成 `host_speak`/`call_on` 发出去，那个最有价值的 `prompt`（主持人给角色的具体指令）用完就丢了。本 Task 加一个新事件把**完整决策**原样带给前端。

**Files:**
- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/prompts.ts`
- Modify: `src/lib/cyber-office/reducer.ts`
- Modify: `src/lib/cyber-office/orchestrator.ts`
- Modify: `src/lib/cyber-office/sample-meeting.ts`

- [x] **Step 1: `types.ts` —— 把 `ModeratorDecision` 定义搬进来**

`ModeratorDecision` 原本在 `prompts.ts`。因为它现在要作为事件/状态的一部分流动，搬到 `types.ts` 更合理，也避免 `types` 和 `prompts` 互相 import 形成循环。

在 `types.ts` 里 `RoleStatus` 定义**之后**，新增：

```ts
// 主持人每轮的「调度决策」。原本在 prompts.ts，现在移到这里——
// 因为它既是编排逻辑的产物，也要作为事件 / 状态在前后端之间流动。
export type ModeratorDecision =
  | {
      // call_on = 继续点名某个角色；这个分支必须有 speaker。
      action: "call_on";
      speaker: RoleId;
      prompt: string; // 主持人给该角色的具体发言指令
      hostText: string; // 主持人这轮的串场台词
    }
  | {
      // summarize = 讨论够了，进入总结；不需要 speaker。
      action: "summarize";
      hostText: string;
    };
```

- [x] **Step 2: `types.ts` —— `OfficeEvent` 加一个事件分支**

在 `OfficeEvent` 联合类型里（建议放在 `summary` 那行**之前**），加一行：

```ts
  | { type: "moderator_decision"; decision: ModeratorDecision } // 主持人本轮调度决策（编排面板展示用）
```

- [x] **Step 3: `types.ts` —— `MeetingState` 存一份"最近决策"**

在 `MeetingState` 接口里 `summary` 那行**之后**，加一个字段：

```ts
  lastDecision: ModeratorDecision | null; // 主持人最近一次调度决策；编排面板展示用
```

- [x] **Step 4: `prompts.ts` —— 删掉本地定义，改成重新导出**

把 `prompts.ts` 里原来那整段 `export type ModeratorDecision = ... ;`（`call_on` / `summarize` 两分支）**整段删掉**，在文件顶部 `import` 附近替换为一行重新导出（这样 `orchestrator.ts` 里 `from "./prompts"` 的旧引用照样能用）：

```ts
// ModeratorDecision 已移到 types.ts（它要在事件流/状态里流动）；这里重新导出，保持旧引用路径可用。
export type { ModeratorDecision } from "./types";
```

> `prompts.ts` 内部没用到 `ModeratorDecision`（只是导出给别处），所以删定义不会报错。`TranscriptTurn` 保持留在 `prompts.ts` 不动。

- [x] **Step 5: `reducer.ts` —— 初始状态 + 新 case**

① 在 `createInitialState()` 返回对象里，`summary: null,` 那行**之后**加：

```ts
    lastDecision: null,
```

② 在 `applyEvent` 的 `switch` 里，`case "summary":` **之前**加一个新分支：

```ts
    case "moderator_decision":
      // 只记录主持人最近一次调度决策，供编排面板展示；不改任何小人动画状态。
      return { ...state, lastDecision: event.decision };
```

- [x] **Step 6: `orchestrator.ts` —— 把真实决策也 yield 出去**

在 `runMeeting` 的 `for` 循环里，`const decision = parseModeratorDecision(...)` **之后**、`yield { type: "host_speak", ... }` **之前**，插入一行：

```ts
    // 把主持人这一轮的真实决策原样发给前端，编排面板据此展示“AI 如何调度”。
    yield { type: "moderator_decision", decision };
```

> 注意 `orchestrator.ts` 顶部 `import type { ModeratorDecision, TranscriptTurn } from "./prompts";` **不用改**——`ModeratorDecision` 现在由 `prompts.ts` 重新导出，路径不变。

- [x] **Step 7: `sample-meeting.ts` —— 让样本回放也带决策事件**

回放走的是写死的事件数组，所以也要补 `moderator_decision`，否则样本模式下编排面板没数据。在每个 `{ type: "host_speak", ... }` / `call_on` 组合**之前**，加一条对应的决策事件。把 `SAMPLE_MEETING` 数组改成下面这样（新增行已标注）：

```ts
export const SAMPLE_MEETING: OfficeEvent[] = [
  {
    type: "meeting_start",
    topic: "讨论一个空间转录组可视化的博客选题，并产出文章大纲",
    participants: ["host", "pm", "frontend", "bio", "reviewer"],
  },
  // ↓ 新增：主持人先做决策，再串场、点名
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "bio",
      prompt: "请从生信角度谈谈现有空间转录组可视化的痛点。",
      hostText: "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。",
    },
  },
  {
    type: "host_speak",
    text: "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。",
  },
  { type: "call_on", speaker: "bio" },
  ...speak("bio", "现有工具画的空间图太花，读者看不懂细胞分布的生物学意义。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "frontend",
      prompt: "从前端可视化角度提出具体改进方案。",
      hostText: "前端来说说可视化上能怎么改进。",
    },
  },
  { type: "host_speak", text: "前端来说说可视化上能怎么改进。" },
  { type: "call_on", speaker: "frontend" },
  ...speak("frontend", "可以用交互式热力图叠加组织切片，hover 显示基因表达。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "pm",
      prompt: "从读者价值/传播角度评估这个选题。",
      hostText: "产品经理从读者价值角度补充一下。",
    },
  },
  { type: "host_speak", text: "产品经理从读者价值角度补充一下。" },
  { type: "call_on", speaker: "pm" },
  ...speak("pm", "选题要落在'看懂一张空间图'，面向入门读者更有传播力。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "reviewer",
      prompt: "从严谨性角度挑战前面的方案。",
      hostText: "审稿人有没有要挑刺的？",
    },
  },
  { type: "host_speak", text: "审稿人有没有要挑刺的？" },
  { type: "call_on", speaker: "reviewer" },
  ...speak("reviewer", "别只讲炫技，要交代数据来源和局限，否则不严谨。"),
  // ↓ 新增：主持人决定收口
  {
    type: "moderator_decision",
    decision: {
      action: "summarize",
      hostText: "讨论充分了，进入总结。",
    },
  },
  { type: "host_speak", text: "讨论充分了，进入总结。" },
  {
    type: "summary",
    outline:
      "# 选题：如何读懂一张空间转录组图\n\n1. 为什么空间信息重要（生信视角）\n2. 现有可视化的问题\n3. 交互式热力图 + 切片叠加的改进\n4. 数据来源与局限\n5. 给入门读者的阅读指南",
  },
  { type: "meeting_end" },
];
```

- [x] **Step 8: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

Expected：类型全过；`reducer` 单测全绿。
> 若某个 `reducer` 单测断言了"初始状态的完整形状"（比如 `toEqual({...})`），它会因为新增 `lastDecision` 字段而失败——把该断言里补上 `lastDecision: null` 即可。这是预期内的、正确的改动。

- [x] **Step 9: 提交**

```bash
git add src/lib/cyber-office/types.ts src/lib/cyber-office/prompts.ts src/lib/cyber-office/reducer.ts src/lib/cyber-office/orchestrator.ts src/lib/cyber-office/sample-meeting.ts
git commit -m "feat(cyber-office): 新增 moderator_decision 事件，透出主持人真实调度决策"
```

> 做完把 commit hash 发记录员 AI。下一个 Task（Task 4）我会写"⭐编排面板 UI"，消费你这一步存下的 `state.lastDecision` + `state.activeSpeaker`，把调度流向图和真实决策 JSON 画出来。

---

### Task 4: ⭐ 编排逻辑面板 UI（王牌区）

> **目标**：把设计图底部「AI 智能体如何协作」建出来——一个可折叠面板，展示**调度流向图**（你的问题 → 主持人 → 专家 → 综合输出，当前节点实时高亮）+ **主持人本轮真实决策**（消费 Task 3 存下的 `state.lastDecision`）。这是评审说"加分大于所有动画之和"的那块。
>
> **数据全部现成**（Task 3 已备好）：`state.activeSpeaker`（当前谁发言）、`state.lastDecision`（主持人真实决策）、`state.summary` / `state.phase`（是否已收口）、`state.participants`（动态算出专家节点）。**本 Task 只改展示层。**

**Files:**
- Create: `src/components/cyber-office/orchestration-panel.tsx`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 新建 `orchestration-panel.tsx`**

新建文件，整段贴入。注释解释了"当前走到哪个节点"的推断逻辑：

```tsx
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

export default function OrchestrationPanel({ state }: { state: MeetingState }) {
  const [open, setOpen] = useState(true);
  const active = activeNode(state);
  // 专家节点 = 参会者去掉主持人（动态，之后加自定义角色也自动适配）。
  const experts = state.participants.filter((id) => id !== "host");

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
            <span className="text-text-muted">→</span>
            <Node label="主持人" sub="调度分工" active={active === "host"} />
            <span className="text-text-muted">→</span>
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
            <span className="text-text-muted">→</span>
            <Node label="综合输出" sub="最佳答案" active={active === "output"} />
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
```

- [x] **Step 2: 挂进 `cyber-office.tsx`**

① 顶部 import 区加一行：

```tsx
import OrchestrationPanel from "./orchestration-panel";
```

② 在 `return (...)` 里，把 `<SummaryPanel summary={state.summary} />` 那行**下面**加一行（面板放结论区之后）：

```tsx
      <SummaryPanel summary={state.summary} />

      <OrchestrationPanel state={state} />
```

- [x] **Step 3: 验证**

Run: `npm run dev`，播放样本会议。
Expected：
- 页面底部出现「AI 智能体如何协作」可折叠面板。
- 播放过程中，流向图节点**跟着高亮**：主持人决策时"主持人"亮 → 某专家发言时该专家节点亮 → 结束时"综合输出"亮。
- 面板下方**实时显示主持人本轮决策**：一句人话 + 原始 JSON（`action`/`speaker`/`prompt`/`hostText`）。
- 折叠/展开正常；没开始会议时显示占位提示。

- [x] **Step 4: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/orchestration-panel.tsx src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 新增编排逻辑面板，展示调度流向图与主持人真实决策"
```

> 做完把 commit hash 发记录员 AI。这是功能版王牌；视觉打磨（对齐设计图的连线箭头、阶段说明、四能力小卡）放后续 Task，先把"真数据+可折叠+实时高亮"跑通。

---

### Task 5: 控制区去黑话 + 示例议题 + 清晰双入口

> **目标**：把控制区从"技术黑话按钮"改成"用户看得懂的两个入口"。三件事：① 按钮去掉 `DeepSeek` 黑话；② 加一排**可点击的示例议题** chip（点了填入输入框）；③ 两个入口文案层级分明（看演示 vs 用我的议题）。
>
> 注意：`page.tsx` 已经干净嵌在博客里（无需处理假导航/页脚，那是设计出图 AI 脑补的）。本 Task 只改 `cyber-office.tsx` 控制区。

**Files:**

- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 加示例议题常量**

在 `LIVE_PARTICIPANTS` 常量**下面**，新增：

```tsx
// 示例议题：点击 chip 直接填进输入框，降低"不知道输入什么"的门槛。
const EXAMPLE_TOPICS = [
  "AI 对产品经理的工作有哪些实际影响？",
  "如何建立一个高质量的数据指标体系？",
  "空间转录组可视化，怎么让入门读者看懂？",
];
```

- [x] **Step 2: 替换整个控制区**

把 `return (...)` 里最上面那个控制区 `<div>`（从 `<div className="flex flex-col gap-4 rounded-lg border ...">` 开始，到它对应的 `</div>` 结束，也就是包住"议题 textarea + helperText + 三个按钮"的那一整块）**整段替换**为下面这版：

```tsx
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

        <p className="text-sm leading-[1.7] text-text-secondary">{helperText}</p>

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
```

> 改动说明：① label 文案更口语；② 新增示例 chip 行；③ **把"用我的议题开始"提为主按钮（橙色强调），"看一场演示"降为次按钮**——引导用户用真实功能，同时保留零门槛入口；④ 所有 `DeepSeek` 字样去掉。逻辑（`live.start` / `replay.start` / `live.cancel`）和原来完全一致，只改了文案、顺序、样式和新增 chip。

- [x] **Step 3: 验证**

Run: `npm run dev`。
Expected：

- 输入框上方文案变口语，下方出现 3 个示例议题 chip，点击任一 chip → 输入框被填入该议题。
- 主按钮「用我的议题开始」（橙色），次按钮「看一场演示」；点「看一场演示」照常回放样本。
- 会议进行中时按钮禁用、出现「停止会议」；全程无 `DeepSeek` 字样。

- [x] **Step 4: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 控制区去黑话，加示例议题，理顺主次入口"
```

> 做完把 commit hash 发记录员 AI。

---

### Task 6: 编排面板视觉精修（对齐设计图）

> **目标**：把 Task 4 的功能版面板，往设计图那个精致样子靠：① 用样式化连接线替代文字箭头 `→`；② 加一段 **01–04 阶段静态讲解**（理解问题→展开探索→交叉辩论→综合生成）；③ 底部加**四个能力小卡**（记忆与上下文 / 路由逻辑 / 质量护栏 / 工具与数据）。
>
> 设计取舍：**流向图 = 实时高亮（已做）；阶段讲解 + 能力小卡 = 静态说明**。静态部分文案一律用你**真实实现**的说法，不吹没有的功能。

**Files:**

- Modify: `src/components/cyber-office/orchestration-panel.tsx`

- [x] **Step 1: 加一个连接线小组件**

在 `orchestration-panel.tsx` 里 `Node` 组件**下面**，新增一个 `Arrow`（横向细线 + 尖角，取代文字 `→`）：

```tsx
// 流程连接线：一条细线 + 末端尖角，比文字“→”更像流程图。
function Arrow() {
  return (
    <span className="flex items-center text-text-muted" aria-hidden>
      <span className="h-px w-5 bg-border" />
      <span className="-ml-1 text-xs">▸</span>
    </span>
  );
}
```

- [x] **Step 2: 把流向图里的 `<span>→</span>` 换成 `<Arrow />`**

在流向图那块，把三处 `<span className="text-text-muted">→</span>` 全部替换为 `<Arrow />`。

- [x] **Step 3: 决策 JSON 下面，加"阶段讲解 + 能力小卡"**

在决策 JSON 那个 `</div>`（`{/* 主持人本轮真实决策… */}` 整块的结尾）**之后**、面板最外层 `</div>` 之前，插入下面两块：

```tsx
          {/* 阶段讲解（静态）：这场讨论的四个概念阶段 */}
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

          {/* 能力小卡（静态）：这套编排背后的四个能力，文案对应真实实现 */}
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
```

- [x] **Step 4: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/orchestration-panel.tsx
git commit -m "style(cyber-office): 编排面板加连接线、阶段讲解与能力小卡"
```

Expected：面板里流向图用细线连接；下方多出"四个阶段"列表和"四个能力"小卡；深浅色都协调。

---

### Task 7: 会议进度状态条

> **目标**：舞台上方加一条轻量状态条：会议未开始 / 讨论中（显示当前发言者）/ 已完成。让人看懂"会议在进行、有终点"。
>
> 数据来自 `state.phase`（idle/running/ended）+ `state.activeSpeaker`，**纯展示层**。

**Files:**

- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 新增 `StatusBar` 组件**

在 `cyber-office.tsx` 里 `SubtitleBar` 组件**下面**，新增：

```tsx
function StatusBar({ state }: { state: MeetingState }) {
  // 三种阶段用不同文案；讨论中额外显示当前发言者。
  let label = "";
  if (state.phase === "running") {
    const who = state.activeSpeaker ? getRole(state.activeSpeaker).name : "主持人";
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
```

- [x] **Step 2: 挂到舞台上方**

在 `return (...)` 里，把 `<OfficeScene state={state} />` 那行**上面**加一行：

```tsx
      <StatusBar state={state} />
      <OfficeScene state={state} />
```

- [x] **Step 3: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 加会议进度状态条"
```

Expected：未开始无状态条；播放中显示橙点 +「讨论中 · 当前：X」；结束显示「会议完成 ✓」。

---

### Task 8: 思考等待态 + 错误重试

> **目标**：实时会议 API 慢或报错时，不再是"僵住的静止画"。① 等待中显示「AI 正在思考…」；② 报错时在字幕区给一个**重试**按钮。
>
> 用现有信号：`live.isRunning`（实时请求进行中）、`state.activeSpeaker`（有没有人正在说）、`state.error`。

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 思考态——给 `StatusBar` 或独立提示**

在 `CyberOffice` 组件里，`return` 之前算一个布尔值（放在 `busy` 等变量附近）：

```tsx
  // 实时模式下：请求在跑、但暂时没人发言、也没出结论 → 视为“正在思考下一步”。
  const thinking =
    mode === "live" &&
    live.isRunning &&
    !state.activeSpeaker &&
    !state.summary &&
    !state.error;
```

在 `<StatusBar state={state} />` **下面**加一行（思考时才显示）：

```tsx
      {thinking && (
        <p className="text-sm text-text-muted">AI 正在思考下一步…</p>
      )}
```

- [x] **Step 2: 错误重试——在 `SubtitleBar` 下方加重试按钮**

在 `return` 里 `<SubtitleBar state={state} />` **下面**加：

```tsx
      {state.error && mode === "live" && !live.isRunning && (
        <button
          onClick={() => live.start(topic, LIVE_PARTICIPANTS)}
          className="self-start rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
        >
          重试
        </button>
      )}
```

- [x] **Step 3: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 加思考等待态与错误重试"
```

Expected：实时会议等待模型响应时显示「AI 正在思考下一步…」；报错时字幕下方出现「重试」按钮，点击重跑同一议题。

---

### Task 9: 发言记录 Transcript（可折叠）

> ⚠️ **本 Task 要动数据层**。原因：`state.roles[id].bubble` 每次 `speaking_start` 会被清空，**历史发言不保留在 state 里**。要做完整发言记录，得在 `MeetingState` 里加一个 `transcript` 数组，`speaking_end` 时把这轮完整发言压进去。
>
> 目标：舞台下方加一个可折叠的完整发言记录（谁、说了什么），支持回看。

**Files:**
- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/reducer.ts`
- Create: `src/components/cyber-office/transcript-panel.tsx`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: `types.ts` —— `MeetingState` 加 `transcript`**

在 `MeetingState` 里 `lastDecision` 那行**之后**加：

```ts
  transcript: { speaker: RoleId; text: string }[]; // 已完成的发言记录（按时间顺序）
```

- [x] **Step 2: `reducer.ts` —— 初始化 + 在 `speaking_end` 时压入**

① `createInitialState()` 里 `lastDecision: null,` 之后加：

```ts
    transcript: [],
```

② 把 `case "speaking_end":` 改成——在回到 idle 的同时，把这轮完整发言追加进 transcript：

```ts
    case "speaking_end": {
      // 这轮的完整发言就是该角色当前 bubble；说完时归档进 transcript。
      const finished = state.roles[event.speaker]?.bubble ?? "";
      const nextState = patchRole(
        { ...state, activeSpeaker: null },
        event.speaker,
        { status: "idle" },
      );
      return {
        ...nextState,
        transcript: finished
          ? [...nextState.transcript, { speaker: event.speaker, text: finished }]
          : nextState.transcript,
      };
    }
```

> 若 `reducer` 单测断言了初始状态整体形状，补上 `transcript: []`。

- [x] **Step 3: 新建 `transcript-panel.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { MeetingState } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";

export default function TranscriptPanel({ state }: { state: MeetingState }) {
  const [open, setOpen] = useState(false);
  if (state.transcript.length === 0) return null; // 没有发言就不显示

  return (
    <div className="rounded-lg border border-border bg-bg-subtle">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium text-text-primary">
          发言记录（{state.transcript.length}）
        </span>
        <span className="text-xs text-text-muted">
          {open ? "收起 ▲" : "展开 ▼"}
        </span>
      </button>

      {open && (
        <ol className="border-t border-border px-5 py-4">
          {state.transcript.map((turn, i) => (
            <li key={i} className="mb-3 last:mb-0">
              <p className="mb-1 text-xs font-medium text-accent">
                {i + 1}. {getRole(turn.speaker).name}
              </p>
              <p className="text-sm leading-[1.7] text-text-secondary">
                {turn.text}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
```

- [x] **Step 4: 挂进 `cyber-office.tsx`**

顶部 import：

```tsx
import TranscriptPanel from "./transcript-panel";
```

在 `<OrchestrationPanel state={state} />` **上面**加：

```tsx
      <TranscriptPanel state={state} />
      <OrchestrationPanel state={state} />
```

- [x] **Step 5: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint && npm run test
git add src/lib/cyber-office/types.ts src/lib/cyber-office/reducer.ts src/components/cyber-office/transcript-panel.tsx src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 加可折叠发言记录 transcript"
```

Expected：会议有发言后，出现「发言记录（N）」折叠面板，展开可回看每轮完整发言。

---

### Task 10: 结论区升级（分条 + 复制 + 导出 Markdown）

> **目标**：现有 `SummaryPanel` 只 `<pre>` 平铺纯文本。升级为：保留原文渲染 + 加「复制」「导出 Markdown」两个按钮。
>
> 说明：总结 Agent 已输出 Markdown（见 `buildSummarySystemPrompt`）。**先不强行解析成结构化条目**（那要改 prompt、可能不稳定），本 Task 只加复制/导出，把"能带走结论"这个价值点补上；分条渲染留作后续可选。

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 升级 `SummaryPanel`**

把现有 `SummaryPanel` 整个函数替换为：

```tsx
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
      <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-secondary">
        {summary}
      </pre>
    </div>
  );
}
```

- [x] **Step 2: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 结论区加复制与导出 Markdown"
```

Expected：结论区右上出现「复制」「导出 Markdown」；点复制进剪贴板，点导出下载 `.md` 文件。

---

### Task 11（进阶）: 回放暂停/继续 + 打字机点击跳过

> **范围说明**：原计划的三项里，"**回看**"已被 Task 9（发言记录）+ Task 14（点节点回看决策与发言）覆盖，本 Task 不重复做。剩下两项——**暂停/继续**、**打字机点击跳过**——需要改造 `use-replay.ts`，本 Task 写实。
> **只对回放模式开放**：实时模式（`use-live-meeting`）是网络流，天然无法"暂停未来的 token"，所以这些控件仅在 `mode === "replay"` 且回放中显示。
> **建议排期**：放在 Task 15 之后、Task 16（整页布局）之前——这样 16 排版时能把"暂停/跳过"控件一起摆到位。

**Files:**
- Modify: `src/components/cyber-office/use-replay.ts`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 整体替换 `use-replay.ts`**

在现有基础上加：`isPaused` 状态、`pause/resume`、`skip`（一次性播完当前发言剩余 token）。整份替换最稳：

```tsx
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

// 不同事件的播放间隔（毫秒）。token 很短，营造逐字打字感；说完后停顿久一点。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token":
      return 40;
    case "host_speak":
      return 900;
    case "call_on":
      return 700;
    case "speaking_start":
      return 250;
    case "speaking_end":
      return 450;
    case "summary":
      return 1000;
    default:
      return 500;
  }
}

export function useReplay(events: OfficeEvent[]) {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false); // 新增：是否暂停
  const indexRef = useRef(0);
  const [tick, setTick] = useState(0);

  const start = useCallback(() => {
    dispatch({ type: "reset" });
    indexRef.current = 0;
    setTick(0);
    setIsPaused(false); // 开新回放时清掉暂停
    setIsPlaying(true);
  }, []);

  // 暂停：置 isPaused=true → 下面 effect 依赖变化 → 清掉待播定时器并提前 return。
  const pause = useCallback(() => setIsPaused(true), []);
  // 继续：解除暂停并 bump tick，重新唤醒 effect 排下一条。
  const resume = useCallback(() => {
    setIsPaused(false);
    setTick((n) => n + 1);
  }, []);

  // 点击跳过打字机：把"当前这段发言剩余的 token"一次性 dispatch 完，直接显示整句，
  // 然后从下一条（speaking_end）继续正常播放。只在正逐字播 token 时有效。
  const skip = useCallback(() => {
    let i = indexRef.current;
    let advanced = false;
    while (i < events.length && events[i].type === "token") {
      dispatch(events[i]);
      i++;
      advanced = true;
    }
    if (advanced) {
      indexRef.current = i;
      setTick((n) => n + 1); // 唤醒 effect，从 speaking_end 继续
    }
  }, [events]);

  useEffect(() => {
    if (!isPlaying || isPaused) return; // 没播或暂停：不排下一条
    if (indexRef.current >= events.length) return;

    const event = events[indexRef.current];
    const timer = setTimeout(() => {
      dispatch(event);
      const nextIndex = indexRef.current + 1;
      indexRef.current = nextIndex;
      if (nextIndex >= events.length) {
        setIsPlaying(false);
      } else {
        setTick((n) => n + 1);
      }
    }, delayFor(event));
    return () => clearTimeout(timer);
  }, [isPlaying, isPaused, tick, events]);

  return { state, isPlaying, isPaused, start, pause, resume, skip };
}
```

> 原理提醒：`pause` 改了 effect 依赖 `isPaused` → 触发 cleanup 清掉正在等待的 `setTimeout`，再进 effect 时因 `isPaused` 提前 return，播放就停住了；`resume` / `skip` 都靠 `setTick(n=>n+1)` 把 effect "叫醒"继续。`skip` 手动 dispatch 的那条 token 与被 cleanup 取消的待播定时器不会重复触发。

- [x] **Step 2: `cyber-office.tsx` —— 加「暂停/继续」按钮**

现有 `const replay = useReplay(SAMPLE_MEETING);` 现在多了 `isPaused/pause/resume/skip`，无需改解构（用 `replay.xxx` 调）。

在控制区那排入口按钮的 `<div className="flex flex-wrap gap-3">` 里、`停止会议` 按钮**附近**，加一个暂停/继续按钮（仅回放中显示）：

```tsx
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
```

- [x] **Step 3: `cyber-office.tsx` —— 加「跳过打字机」**

在 `return` 里 `<SubtitleBar state={state} />` **下面**加一个跳过按钮（仅回放中、且有角色正在逐字发言时显示）：

```tsx
      {mode === "replay" && replay.isPlaying && state.activeSpeaker && (
        <button
          onClick={replay.skip}
          className="self-start text-xs text-text-muted transition-colors hover:text-accent"
        >
          跳过打字机 ⏭
        </button>
      )}
```

> 说明：`state.activeSpeaker` 为真 = 有被点名的角色正在发言（主持人串场 `host_speak` 不产生 token、activeSpeaker 为 null，所以不会显示跳过，符合预期）。

- [x] **Step 4: 验证**

Run: `npm run dev`，点「看一场演示」。
Expected：
- 回放中出现「暂停」按钮，点击后画面停住（打字、换人都停）；变成「继续」，点击接着播。
- 某角色逐字发言时，下方出现「跳过打字机 ⏭」，点击→当前这句立即整句显示，然后正常继续下一步。
- 实时模式（用我的议题开始）**不出现**这些控件。

- [x] **Step 5: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/use-replay.ts src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 回放支持暂停/继续与打字机点击跳过"
```

> 做完把 commit hash 发记录员 AI。

---

## 美术轨补充（不在本代码教程内，走美术流水线）

- **深色版舞台窗景改日景**：当前设计图深色版窗外是赛博朋克霓虹城市，偏离"现代简约办公室"方向。属美术资产重出，走 `scripts/` 流水线 + 出图 prompt（见美术资产 spec），不在本文件的代码 Task 里。

---

> 全部交互轨任务（Task 1–11）已列全。每个标 ⚠️ 动数据层的 Task 请照其 Step 跑 `npm run test`；纯展示层的跑 `tsc + lint` 即可。做完一个提交一个，commit hash 发记录员 AI。

---

# 打磨阶段（Task 12–16）

> 背景：Task 1–10 完成后走查发现一批质量/观感问题。本阶段按"根因归组 + 依赖关系"排成 5 波，**先定型组件、最后统一排版**，避免返工。执行顺序：12 → 13 → 14 → 15 → 16。

### Task 12: 动画打磨（去抽搐 / 去椅子浮动）

> **修的现象**：①所有角色上下呼吸浮动、连椅子一起动；②待机动作（产品经理摆手、生信写字）"一抽一抽"。
> **根因**：①`.pixel-idle` 用 `translateY` 让"含椅子的整张精灵图"上下位移；②待机动作只有 `act1↔act2` 两帧、且换帧偏快偏频繁。

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/cyber-office/character.tsx`

- [x] **Step 1: `globals.css` —— 去掉呼吸浮动**

把 `.pixel-idle` 规则（约在 `@keyframes pixel-idle` 下方）改成不做位移动画：

```css
  /* 呼吸浮动会带着"含椅子的整张精灵图"一起上下位移，观感差；去掉。
     角色的"活着感"改由偶发眨眼 / 动作提供（见 character.tsx）。 */
  .pixel-idle {
    animation: none;
  }
```

> `@keyframes pixel-idle` 保留不删也无妨（没人再引用它）。`pixel-talk` 不动。

- [x] **Step 2: `character.tsx` —— 待机动作降频、放慢、以眨眼为主**

在待机 `useEffect` 的 `loop` 里，把这三处数值改掉：

```tsx
      const wait = 5000 + Math.random() * 5000; // 原 3200+4000，隔更久才动一次
      timers.push(
        setTimeout(() => {
          if (cancelled) return;
          const isAct = Math.random() < 0.35; // 原 0.55，多数时候只眨眼，少数才做动作
          const frames = isAct
            ? ["act1", "act2", "act1", "sitting"]
            : ["blink", "sitting"];
          const step = isAct ? 500 : 130; // 动作帧原 320，放慢到 500 减轻"一抽一抽"
          frames.forEach((f, i) => set(f, i * step));
          timers.push(setTimeout(loop, frames.length * step + 200));
        }, wait),
      );
```

> 说明：2 帧动作天生就有"翻页感"，放慢 + 降频 + 更多眨眼是当前素材下的最优解。若某角色仍难看，后续可单独把该角色 `isAct` 概率调 0（只眨眼）。

- [x] **Step 3: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/app/globals.css src/components/cyber-office/character.tsx
git commit -m "style(cyber-office): 去掉呼吸浮动，待机动作放慢降频"
```

Expected：角色和椅子不再整体上下浮动；待机偶尔眨眼、少量放慢的小动作，不再频繁抽动。

---

### Task 13: 数据层修正（主持人动作 + 主持人进记录 + 决策历史）

> ⚠️ **动数据层**。一次修三处根因：
> ① 主持人说话时干坐着 —— 因为 `host_speak` 只更新 `hostText`，从不把主持人设成 `speaking`；
> ② 发言记录里没有主持人 —— 因为 transcript 只在 `speaking_end` 归档角色，`host_speak` 不写；
> ③ 编排面板只存 `lastDecision`（单个被覆盖）—— 回看需要**决策历史 `decisions[]`**（为 Task 14 铺路）。

**Files:**

- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/reducer.ts`

- [x] **Step 1: `types.ts` —— `MeetingState` 加 `decisions` 历史**

在 `lastDecision` 那行**之后**加：

```ts
  decisions: ModeratorDecision[]; // 主持人历次调度决策（编排面板回看用）
```

- [x] **Step 2: `reducer.ts` —— `createInitialState` 初始化**

在 `lastDecision: null,` 之后加：

```ts
    decisions: [],
```

- [x] **Step 3: `reducer.ts` —— 改写 `host_speak`（主持人有动作 + 进记录）**

把 `case "host_speak":` 整段替换为：

```tsx
    case "host_speak": {
      // 主持人串场：① 更新 hostText；② 让主持人小人进入 speaking（有说话动作）；
      // ③ 把这句归档进发言记录（之前漏了主持人）。activeSpeaker 置空 = 台上没有"被点名的角色"。
      const withHost = patchRole(
        { ...state, hostText: event.text, activeSpeaker: null },
        "host",
        { status: "speaking", bubble: event.text },
      );
      return {
        ...withHost,
        transcript: [
          ...withHost.transcript,
          { speaker: "host", text: event.text },
        ],
      };
    }
```

- [x] **Step 4: `reducer.ts` —— `call_on` 时让主持人坐下**

主持人上一句说完后要坐回去。把 `case "call_on":` 替换为：

```tsx
    case "call_on":
      // 点名：先让主持人小人坐下（结束他的说话动作），再把被点名者设为发言者并举手。
      return patchRole(
        patchRole({ ...state, activeSpeaker: event.speaker }, "host", {
          status: "idle",
        }),
        event.speaker,
        { status: "raising_hand" },
      );
```

- [x] **Step 5: `reducer.ts` —— `meeting_end` 时主持人坐下**

会议结束时若主持人还停在起身姿势会很怪。把 `case "meeting_end":` 替换为：

```tsx
    case "meeting_end":
      // 会议结束：主持人坐下，台上无人。
      return patchRole(
        { ...state, phase: "ended", activeSpeaker: null },
        "host",
        { status: "idle" },
      );
```

- [x] **Step 6: `reducer.ts` —— `moderator_decision` 存进历史**

把 `case "moderator_decision":` 替换为：

```tsx
    case "moderator_decision":
      // 记录本轮决策：既更新"最近一次"（现有面板用），也追加进历史（Task 14 回看用）。
      return {
        ...state,
        lastDecision: event.decision,
        decisions: [...state.decisions, event.decision],
      };
```

- [x] **Step 7: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

> 若 `reducer` 单测断言了初始状态整体形状，补上 `decisions: []`。发言记录相关单测若断言了"host 不入 transcript"，按新行为更新。

```bash
git add src/lib/cyber-office/types.ts src/lib/cyber-office/reducer.ts
git commit -m "feat(cyber-office): 主持人有说话动作并进发言记录，新增决策历史"
```

Expected：播放样本会议 —— 主持人串场时小人有说话动作、说完坐下；发言记录里出现主持人的每句串场；state 里 `decisions` 累积每一轮决策。

---

### Task 14: 编排面板回看 MVP（点节点看该角色那一轮）

> **目标**：把 Task 6 的编排面板从"只显示当前这一轮"升级为"**可回看**"——点击一个**已发言**的节点，下方展示该角色**最近一轮**的调度决策 JSON + 它的发言；不点则跟随当前实时进度。没轮到的节点点不动。
> 依赖 Task 13 的 `state.decisions`。**纯展示层。**

**Files:**
- Modify: `src/components/cyber-office/orchestration-panel.tsx`

- [ ] **Step 1: 整体替换 `orchestration-panel.tsx`**

改动较集中，整份替换最不易错（在 Task 6 版本上增加：可点击节点 + 选中态 + 回看详情）。用下面这份覆盖：

```tsx
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
        highlight ? "border-accent bg-accent-subtle" : "border-border bg-bg-subtle"
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
            <Node label="综合输出" sub="最佳答案" active={active === "output"} />
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
```

- [ ] **Step 2: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/orchestration-panel.tsx
git commit -m "feat(cyber-office): 编排面板支持点击节点回看该角色决策与发言"
```

Expected：播放会议后，已发言的节点（主持人 / 各专家）可点击，点击→下方回看该角色最近一轮的决策 JSON + 发言；再点一次取消、回到实时；没轮到的节点点不动。

---

### Task 15: 结论区 Markdown 渲染（含表格）

> **修的现象**：结论里的 Markdown / 表格不解析。**根因**：`SummaryPanel` 只 `<pre>` 平铺纯文本。
> 方案：引入 `react-markdown + remark-gfm`，用 `.prose` 渲染（typography 插件已在 `globals.css` 启用）。

**Files:**
- `package.json`（装依赖）
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [ ] **Step 1: 安装依赖**

```bash
npm install react-markdown remark-gfm
```

- [ ] **Step 2: `cyber-office.tsx` 顶部加 import**

```tsx
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
```

- [ ] **Step 3: 升级 `SummaryPanel` 的正文渲染**

把 `SummaryPanel` 里那段 `<pre>...{summary}...</pre>` 替换为 `.prose` + ReactMarkdown（复制 / 导出按钮那部分不动）：

```tsx
      <div className="prose prose-sm max-w-none leading-[1.7] dark:prose-invert prose-headings:font-semibold prose-a:text-accent prose-table:block prose-table:overflow-x-auto">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{summary}</ReactMarkdown>
      </div>
```

> `prose-table:block prose-table:overflow-x-auto` 让宽表格能横向滚动、不撑破布局。`dark:prose-invert` 保证深色模式排版颜色正确。

- [ ] **Step 4: 验证**

Run: `npm run dev`，播放样本会议看结论。
Expected：结论里的标题、列表、**表格**都正常渲染排版；深浅色都正常；复制 / 导出 Markdown 仍可用。
> 若 `.prose` 样式没生效（文字挤在一起），确认 `globals.css` 顶部有 `@plugin "@tailwindcss/typography";`（本项目已有）。

- [ ] **Step 5: 提交**

```bash
npx tsc --noEmit && npm run lint
git add package.json package-lock.json src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 结论区用 react-markdown 渲染，支持表格"
```

---

### Task 16: 整页布局大改（对齐设计图：双栏 Hero + 分区重构）

> **修的现象**：真实页面是 `max-w-3xl` 里一堆等宽卡片竖着堆（"一列卡片"），跟选定设计图（双栏 Hero + 有节奏的分区）没对齐 —— 这是"丑"的总根源。
> **目标**：① 页面加宽容纳双栏；② Hero 做成**桌面双栏**（左：标题+副标题+控制区；右：舞台+状态+字幕），移动端塌成单列；③ 结论 / 编排 / 发言记录三块独立分区、用大留白拉出节奏。
> 守红线：圆角 ≤ `rounded-lg`、唯一橙色、字重 ≤ 600、深浅色都验。**只改布局，不改逻辑。**

**Files:**
- Modify: `src/app/cyber-office/page.tsx`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [ ] **Step 1: `page.tsx` —— 加宽容器，标题移交给组件**

标题要进 Hero 左栏（跟控制区对齐），所以把 `page.tsx` 里那段可见的 `<header>` 删掉，容器从 `max-w-3xl` 放宽到 `max-w-5xl`。整个文件改成：

```tsx
import type { Metadata } from "next";
import CyberOffice from "@/components/cyber-office/cyber-office";

export const metadata: Metadata = {
  title: "Cyber Office | Chenyu",
  description: "一个嵌入网站的多 Agent 协作实验室",
};

export default function CyberOfficePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-20 md:px-8 md:py-24">
      <CyberOffice />
    </div>
  );
}
```

- [ ] **Step 2: `cyber-office.tsx` —— 整块替换 `return (...)`**

把 `CyberOffice` 组件里 `return (` 到最外层 `);` 之间**整段替换**为下面这版。改动只是**重新排布**（外层 gap-8→gap-12、包一层双栏 grid、把标题/控制放左栏、舞台放右栏、三个面板独立分区），内部逻辑与各控件**一字未改**：

```tsx
  return (
    <div className="flex flex-col gap-12">
      {/* ===== Hero：桌面双栏（左控制 / 右舞台），移动端单列 ===== */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr] lg:items-start">
        {/* 左栏：标题 + 副标题 + 控制区 */}
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Cyber <span className="text-accent">Office</span>
            </h1>
            <p className="mt-3 text-base leading-[1.7] text-text-secondary">
              一个多 Agent 协作实验室。给一个议题，角色们围坐圆桌轮流发言、由主持人动态调度，最后产出结论。
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

            {/* 示例议题 chip */}
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
```

> 说明：外层 `gap-12` 拉出分区节奏；`lg:items-start` 让两栏顶部对齐；`lg` 以下自动单列（控制在上、舞台在下）。
>
> ⚠️ **栅格写法有坑（踩过）**：必须写 `lg:grid-cols-[380px_minmax(0,1fr)]`。
> 若写成 `lg:grid-cols-[minmax(0,380px)_1fr]`，`1fr` 实为 `minmax(auto,1fr)`——**其最小值是内容宽度**，而舞台内层是固定 `width: 760px`（`office-scene.tsx`），于是右栏死咬 760px、左栏（最小值 0）被压成一条 ~180px 的窄缝，整个 Hero 塌掉。
> 记法：**要能被压缩的栏用 `minmax(0,1fr)`，不能被压的栏给固定值。** 舞台自带 ResizeObserver 会等比缩放，右栏变窄不会溢出。
> 另：页面容器用 `max-w-6xl`（见 Step 1），给 380px 左栏 + 舞台留足空间。

- [ ] **Step 3: 验证**

Run: `npm run dev`。
- 桌面：左栏标题+控制、右栏舞台+字幕并排；分区之间留白明显、不再是"一列等宽卡片"。
- 缩到手机宽度：塌成单列（控制在上、舞台在下），无横向滚动。
- 深色 / 浅色都切一遍，橙色强调、圆角、对比都正常。

- [ ] **Step 4: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/app/cyber-office/page.tsx src/components/cyber-office/cyber-office.tsx
git commit -m "style(cyber-office): 整页改双栏 Hero + 分区重构"
```

> 这版是"结构对齐设计图"的第一刀。之后若想更贴设计图（区块小标题、卡片质感、舞台占比微调），我们对着截图再细调——布局骨架先立住。

---

> **打磨阶段（12–16）总览**：12 去抽搐/浮动（美术观感）→ 13 数据层修 host/记录/决策历史 → 14 编排回看 → 15 结论 Markdown → 16 整页双栏布局。做完 12–16 再回头评估 Task 11（暂停/跳过），很可能只剩两小项。
