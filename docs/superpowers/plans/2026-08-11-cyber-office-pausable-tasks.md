# Cyber Office 可暂停会议 · 实现教程

> 配套设计文档：[`specs/2026-08-11-cyber-office-pausable-orchestration.md`](../specs/2026-08-11-cyber-office-pausable-orchestration.md)
>
> **这条线在做什么（一句话）**：现在实时会议一旦开始，后台就一口气跑到底，中途只能"整场作废"。改造后，会议**一轮一轮地跑**，想暂停就"不发起下一轮"——真正停止调用大模型、零成本、随时可继续。
>
> 教程约定同 `2026-07-31-cyber-office-experience-tasks.md`：每个 Task 标明改哪个文件、贴带注释的代码、末尾给提交命令，步骤用 `- [ ]` 跟踪。

**分期**：S1-A（拆出单步编排）→ S1-B（新增 /step 接口 + 限流按步计量）→ S2（前端改逐轮驱动）→ S3（真暂停）→ S4（刷新可恢复）→ S5（人在回路）。
本文件先给 **S1-A / S1-B**，做完后我对着当时代码继续追加。

---

## Task S1-A：后端拆出"单步"编排

> **目标**：把 `runMeeting` 里"跑一轮"的逻辑抽成独立函数 `runOneTurn`，"做总结"抽成 `runSummary`。
> **为什么**：只有先有了"能单独执行一轮"的能力，前端才可能一轮一轮地驱动、并在轮次之间暂停。
> **安全性**：`runMeeting` 改成调用这两个新函数，对外行为**完全不变**，现有 `/run` 接口和前端一行都不用动。

**Files:**
- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/reducer.ts`
- Modify: `src/lib/cyber-office/orchestrator.ts`

- [x] **Step 1: `types.ts` —— 新增 `step_end` 事件**

在 `OfficeEvent` 联合类型里，`summary` 那行**之前**加一行：

```ts
  | { type: "step_end"; nextTurn: number; done: boolean } // 单步接口：本轮跑完，告诉前端下一轮编号 / 是否该收口
```

> 这是一个**控制类事件**：不改变会议画面，只是后端告诉前端"这一轮结束了，接下来是第几轮 / 还是该总结了"。前端的逐轮循环靠它决定下一步。

- [x] **Step 2: `reducer.ts` —— 显式忽略它**

在 `applyEvent` 的 `switch` 里，`case "summary":` **之前**加：

```ts
    case "step_end":
      // 控制类事件：只给前端的逐轮驱动循环看，不影响会议状态。
      // 显式列出来（而不是落到 default）是为了表明"这是有意忽略的"。
      return state;
```

- [x] **Step 3: `orchestrator.ts` —— 新增 `runOneTurn`**

在 `RunMeetingOptions` 接口**之前**，插入下面这段（新的选项接口 + 单轮生成器）：

```ts
export interface RunOneTurnOptions {
  topic: string;
  participants: RoleId[];
  model: ChatModel;
  transcript: TranscriptTurn[]; // 已有会议历史；主持人和角色都要读它
  turn: number; // 当前是第几轮，从 0 开始
  maxTurns?: number;
  decision?: ModeratorDecision; // 可选：直接指定本轮决策，跳过"问主持人"（人在回路用）
}

// 只执行「一轮」：问主持人 → 点名 → 角色发言。
// 不含 meeting_start / summary —— 那些由调用方决定什么时候发。
// 这样这个函数就是"给定会议历史，往前走一步"的纯粹一步，既能被整场循环复用，
// 也能被单步接口直接调用。
export async function* runOneTurn({
  topic,
  participants,
  model,
  transcript,
  turn,
  maxTurns = LIVE_MEETING_LIMITS.maxTurns,
  decision: givenDecision,
}: RunOneTurnOptions): AsyncGenerator<OfficeEvent> {
  // 1. 本轮决策：调用方给了就直接用；没给就问主持人。
  let decision: ModeratorDecision;
  if (givenDecision) {
    decision = givenDecision;
  } else {
    const moderatorText = await model.complete([
      { role: "system", content: buildModeratorSystemPrompt(participants) },
      { role: "user", content: buildModeratorUserPrompt(topic, transcript) },
    ]);
    decision = parseModeratorDecision(moderatorText, participants);
  }

  yield { type: "moderator_decision", decision };
  yield { type: "host_speak", text: decision.hostText };

  // 2. 主持人认为讨论够了 → 本轮到此为止，并告诉调用方"该总结了"。
  if (decision.action === "summarize") {
    yield { type: "step_end", nextTurn: turn, done: true };
    return;
  }

  // 3. 点名 → 该角色流式发言
  const speaker = decision.speaker;
  yield { type: "call_on", speaker };
  yield { type: "speaking_start", speaker };

  const roleMessages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildRoleSystemPrompt(speaker) },
    {
      role: "user",
      content: buildRoleUserPrompt(topic, transcript, decision.prompt || ""),
    },
  ];

  for await (const delta of model.stream(roleMessages)) {
    yield { type: "token", speaker, delta };
  }

  yield { type: "speaking_end", speaker };

  // 4. 本轮结束。到达轮数上限就标记 done，让调用方去收口。
  const nextTurn = turn + 1;
  yield { type: "step_end", nextTurn, done: nextTurn >= maxTurns };
}
```

> 注意：`runOneTurn` **不再自己维护 transcript**——它只负责"跑一轮"，历史由调用方持有。这正是让前端能接管会议进度的关键。

- [x] **Step 4: `orchestrator.ts` —— 新增 `runSummary`**

紧接着 `runOneTurn` 之后加：

```ts
export interface RunSummaryOptions {
  topic: string;
  transcript: TranscriptTurn[];
  model: ChatModel;
}

// 收口：读完整会议记录，产出结论。同样抽成独立函数，供整场循环和单步接口共用。
export async function* runSummary({
  topic,
  transcript,
  model,
}: RunSummaryOptions): AsyncGenerator<OfficeEvent> {
  const summary = await model.complete(
    [
      { role: "system", content: buildSummarySystemPrompt() },
      { role: "user", content: buildSummaryUserPrompt(topic, transcript) },
    ],
    { maxTokens: LIVE_MEETING_LIMITS.summaryMaxTokens },
  );

  yield { type: "summary", outline: summary };
  yield { type: "meeting_end" };
}
```

- [x] **Step 5: `orchestrator.ts` —— 让 `runMeeting` 改用这两个函数**

把现有 `runMeeting` 的函数体（从 `const transcript` 到最后 `yield { type: "meeting_end" };`）**整段替换**为：

```ts
  // transcript 是服务端会议记录；逐轮累积，主持人和角色都靠它了解上下文。
  const transcript: TranscriptTurn[] = [];

  yield { type: "meeting_start", topic, participants };

  for (let turn = 0; turn < maxTurns; turn++) {
    let pending = ""; // 本轮发言逐字攒起来，说完写进 transcript
    let done = false;

    for await (const event of runOneTurn({
      topic,
      participants,
      model,
      transcript,
      turn,
      maxTurns,
    })) {
      if (event.type === "token") {
        pending += event.delta;
      }

      if (event.type === "speaking_end") {
        transcript.push({ speaker: event.speaker, text: pending });
        pending = "";
      }

      if (event.type === "step_end") {
        // step_end 只服务于单步接口；整场模式自己就知道进度，
        // 不把它推给前端，保证 /run 的事件流和改造前一模一样。
        done = event.done;
        continue;
      }

      yield event;
    }

    if (done) break;
  }

  // 循环结束（主持人主动收口，或达到轮数上限）→ 总结。
  yield* runSummary({ topic, transcript, model });
```

> `yield*` 的意思是"把另一个生成器产出的事件，原样一个个转发出去"。

- [x] **Step 6: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

Expected：全绿。`/run` 行为未变，样本回放与实时会议都应和之前完全一致。
> 若单测断言了初始 state 的整体形状，本 Task 没加 state 字段，不受影响。

- [x] **Step 7: 提交**

```bash
git add src/lib/cyber-office/types.ts src/lib/cyber-office/reducer.ts src/lib/cyber-office/orchestrator.ts
git commit -m "refactor(cyber-office): 拆出单步编排 runOneTurn 与 runSummary"
```

---

## Task S1-B：新增 `/step` 接口 + 限流按步计量

> **目标**：加一个"执行一步"的后端接口，让前端以后能一轮一轮地调。
> ⚠️ **必须同时改限流**：现在 `guardLiveMeetingRequest` 把**每个请求算作一场会议**。改成逐轮后，一场会议要发约 5 次请求（4 轮 + 1 次总结），而每 IP 每小时只允许 3 次 —— **第一场会议跑到第 4 轮就会被自己的限流拦死**。所以要给"按步"单独一套额度。

**Files:**
- Modify: `src/lib/cyber-office/limits.ts`
- Modify: `src/lib/cyber-office/rate-limit.ts`
- Modify: `src/lib/cyber-office/live-schema.ts`
- Create: `src/app/api/cyber-office/step/route.ts`

- [ ] **Step 1: `limits.ts` —— 加一套"按步"额度**

在 `LIVE_MEETING_LIMITS` 定义**之后**加：

```ts
// 逐轮驱动后，一场会议 ≈ maxTurns 轮 + 1 次总结 = 这么多次请求。
export const STEPS_PER_MEETING = LIVE_MEETING_LIMITS.maxTurns + 1;

// 按"步"限流时，把原来按"场"的额度乘以每场步数，
// 这样总成本口径和改造前保持一致（还是约等于每 IP 每小时 3 场会议）。
export const LIVE_STEP_LIMITS = {
  perIpHourlyLimit: LIVE_MEETING_LIMITS.perIpHourlyLimit * STEPS_PER_MEETING,
  perIpHourlyWindow: LIVE_MEETING_LIMITS.perIpHourlyWindow,
  globalMinuteLimit: LIVE_MEETING_LIMITS.globalMinuteLimit * STEPS_PER_MEETING,
  globalMinuteWindow: LIVE_MEETING_LIMITS.globalMinuteWindow,
  dailyBudget: LIVE_MEETING_LIMITS.dailyLiveRunBudget * STEPS_PER_MEETING,
} as const;
```

- [ ] **Step 2: `rate-limit.ts` —— 让限流器区分"场"和"步"**

① 顶部 import 补上新常量：

```ts
import {
  LIVE_MEETING_LIMITS,
  LIVE_MEETING_MESSAGES,
  LIVE_STEP_LIMITS,
} from "./limits";
```

② 把这三行模块级缓存变量：

```ts
let perIpLimiter: Ratelimit | null | undefined;
let globalLimiter: Ratelimit | null | undefined;
```

替换为（按 scope 分别缓存）：

```ts
// 两套额度：meeting = 老的"整场"接口 /run；step = 新的"单步"接口 /step。
export type GuardScope = "meeting" | "step";

const perIpLimiters = new Map<GuardScope, Ratelimit>();
const globalLimiters = new Map<GuardScope, Ratelimit>();

function limitsFor(scope: GuardScope) {
  if (scope === "step") {
    return {
      perIp: LIVE_STEP_LIMITS.perIpHourlyLimit,
      perIpWindow: LIVE_STEP_LIMITS.perIpHourlyWindow,
      global: LIVE_STEP_LIMITS.globalMinuteLimit,
      globalWindow: LIVE_STEP_LIMITS.globalMinuteWindow,
      daily: LIVE_STEP_LIMITS.dailyBudget,
    };
  }
  return {
    perIp: LIVE_MEETING_LIMITS.perIpHourlyLimit,
    perIpWindow: LIVE_MEETING_LIMITS.perIpHourlyWindow,
    global: LIVE_MEETING_LIMITS.globalMinuteLimit,
    globalWindow: LIVE_MEETING_LIMITS.globalMinuteWindow,
    daily: LIVE_MEETING_LIMITS.dailyLiveRunBudget,
  };
}
```

③ 把 `getPerIpLimiter` / `getGlobalLimiter` 两个函数**整体替换**为带 scope 版本：

```ts
function getPerIpLimiter(scope: GuardScope) {
  const client = getRedis();
  if (!client) return null;

  const cached = perIpLimiters.get(scope);
  if (cached) return cached;

  const l = limitsFor(scope);
  const limiter = new Ratelimit({
    redis: client,
    // meeting 保持原来的 prefix，避免改动影响已有计数；step 用独立 key。
    prefix: scope === "meeting" ? "cyber-office:live:ip" : "cyber-office:live:ip:step",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.slidingWindow(l.perIp, l.perIpWindow),
  });

  perIpLimiters.set(scope, limiter);
  return limiter;
}

function getGlobalLimiter(scope: GuardScope) {
  const client = getRedis();
  if (!client) return null;

  const cached = globalLimiters.get(scope);
  if (cached) return cached;

  const l = limitsFor(scope);
  const limiter = new Ratelimit({
    redis: client,
    prefix:
      scope === "meeting"
        ? "cyber-office:live:global"
        : "cyber-office:live:global:step",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.fixedWindow(l.global, l.globalWindow),
  });

  globalLimiters.set(scope, limiter);
  return limiter;
}
```

④ `consumeDailyLiveRunBudget` 加一个 scope 参数（**默认值保持原行为，老调用和单测不受影响**）：

```ts
export async function consumeDailyLiveRunBudget(
  store: DailyBudgetStore,
  date = new Date(),
  // ⚠️ 必须显式写 `: number`。limits.ts 用了 `as const`，
  // 所以 dailyLiveRunBudget 的类型是字面量 30 而不是 number；
  // 不标注的话这个参数会被推断成 30，传"按步额度"时报
  // TS2345: Argument of type 'number' is not assignable to parameter of type '30'。
  budget: number = LIVE_MEETING_LIMITS.dailyLiveRunBudget,
  scope: GuardScope = "meeting",
) {
  // meeting 沿用原来的 key 格式；step 用带后缀的独立 key，两者预算互不干扰。
  const scopeSuffix = scope === "meeting" ? "" : `${scope}:`;
  const key = `cyber-office:live:daily:${scopeSuffix}${getUtcDateKey(date)}`;
  const used = await store.incr(key);

  if (used === 1) {
    await store.expire(key, secondsUntilNextUtcDay(date));
  }

  return {
    allowed: used <= budget,
    used,
    remaining: Math.max(0, budget - used),
  };
}
```

⑤ `guardLiveMeetingRequest` 接受 scope 并往下传，**同时给本地开发开一个放行口**：

```ts
export async function guardLiveMeetingRequest(
  request: Request,
  scope: GuardScope = "meeting",
): Promise<GuardResult> {
  // ⚠️ 本地开发直接放行：限流额度是给线上访客准备的，不该在自己调试时被消耗。
  // 逐轮驱动后一场会议要发 5 次请求，按线上额度（每 IP 每小时 15 次）调试三场
  // 就会把自己拦死，之后一小时内所有实时会议都返回 429，且"重试"也没用。
  // 这一条必须加，否则功能一上手就被自己的限流卡住。
  if (!isProductionRuntime()) return { allowed: true };


函数体里三处调用改成带 scope：

```ts
  const perIp = await getPerIpLimiter(scope)?.limit(ip);
```
```ts
  const global = await getGlobalLimiter(scope)?.limit("all");
```
```ts
  const daily = await consumeDailyLiveRunBudget(
    client,
    new Date(),
    limitsFor(scope).daily,
    scope,
  );
```

> 其余逻辑（Redis 缺失兜底、错误对象、返回值）一律不动。

- [ ] **Step 3: `live-schema.ts` —— 新增单步请求校验**

在文件末尾追加：

```ts
// 单步接口的请求体：比整场多了 transcript（会议历史）和 turn（第几轮）。
// 会议历史由前端持有并回传，所以必须严格校验长度，避免有人塞超大 payload。
const transcriptTurnSchema = z.object({
  speaker: roleIdSchema,
  text: z.string().max(2000),
});

const stepRequestSchema = z.object({
  topic: z.string().trim().min(6).max(240),
  participants: z.array(roleIdSchema).min(2).max(6),
  transcript: z.array(transcriptTurnSchema).max(20).default([]),
  turn: z.number().int().min(0).max(20).default(0),
  // turn = 跑一轮讨论；summarize = 收口做总结。
  mode: z.enum(["turn", "summarize"]).default("turn"),
});

export interface StepRequest {
  topic: string;
  participants: RoleId[];
  transcript: { speaker: RoleId; text: string }[];
  turn: number;
  mode: "turn" | "summarize";
}

export type ParseStepRequestResult =
  | { ok: true; data: StepRequest }
  | { ok: false; message: string };

export function parseStepRequest(input: unknown): ParseStepRequestResult {
  const parsed = stepRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: LIVE_MEETING_MESSAGES.invalidRequest };
  }

  // 和整场接口同样的规则：强制带上 host，去掉 summarizer。
  const deduped = Array.from(
    new Set<RoleId>(["host", ...parsed.data.participants]),
  );
  const participants = deduped.filter((id) => id !== "summarizer");

  return { ok: true, data: { ...parsed.data, participants } };
}
```

顶部 import 补上错误文案：

```ts
import { LIVE_MEETING_MESSAGES } from "./limits";
```

- [ ] **Step 4: 新建 `src/app/api/cyber-office/step/route.ts`**

```ts
import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { toPublicLiveMeetingError } from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_LIMITS } from "@/lib/cyber-office/limits";
import { parseStepRequest } from "@/lib/cyber-office/live-schema";
import { runOneTurn, runSummary } from "@/lib/cyber-office/orchestrator";
import { guardLiveMeetingRequest } from "@/lib/cyber-office/rate-limit";
import { encodeSseEvent } from "@/lib/cyber-office/sse";
import type { OfficeEvent } from "@/lib/cyber-office/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const encoder = new TextEncoder();

// 「单步」接口：一次只跑一轮讨论（或一次总结），跑完就结束。
// 会议进度由前端持有（topic + transcript + turn 每次回传），
// 所以服务端不需要记住任何东西 —— 前端想暂停，不发下一次请求就行。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseStepRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  // 注意传 "step"：单步接口用的是按步换算过的额度，别和整场接口共用计数。
  const guard = await guardLiveMeetingRequest(request, "step");

  if (!guard.allowed) {
    return Response.json(
      {
        code: guard.error.code,
        message: guard.error.message,
        retryAfter: guard.error.retryAfter,
      },
      { status: guard.error.status },
    );
  }

  let clientGone = false;

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (event: OfficeEvent) => {
        if (clientGone) return;
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event)));
        } catch {
          clientGone = true;
        }
      };

      try {
        const model = createDeepSeekChatModel();
        const { topic, participants, transcript, turn, mode } = parsed.data;

        // 二选一：跑一轮讨论，或收口总结。两者都能在 60 秒内跑完。
        const events =
          mode === "summarize"
            ? runSummary({ topic, transcript, model })
            : runOneTurn({
                topic,
                participants,
                model,
                transcript,
                turn,
                maxTurns: LIVE_MEETING_LIMITS.maxTurns,
              });

        for await (const event of events) {
          if (clientGone) break;
          safeEnqueue(event);
        }
      } catch (error) {
        if (!clientGone) {
          const publicError = toPublicLiveMeetingError(error);
          console.error("[cyber-office] step failed", error);
          safeEnqueue({ type: "error", message: publicError.message });
        }
      } finally {
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            // 已经关了就忽略
          }
        }
      }
    },
    cancel() {
      clientGone = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 5: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

Expected：全绿，`/api/cyber-office/step` 出现在构建产物的路由列表里。

> **暂时不用真的调它**。本 Task 只是把接口建好；真正跑通要等 S2 把前端改成逐轮驱动。
> 如果你本地配了 `DEEPSEEK_API_KEY` 想提前试，可以在 `npm run dev` 后用一个临时脚本 POST 一次 `/api/cyber-office/step`，请求体形如：
> `{"topic":"讨论一个空间转录组可视化的博客选题","participants":["host","pm","frontend","bio","reviewer"],"transcript":[],"turn":0}`
> 正常应返回一串 SSE 事件，以 `step_end` 结尾。

- [ ] **Step 6: 提交**

```bash
git add src/lib/cyber-office/limits.ts src/lib/cyber-office/rate-limit.ts src/lib/cyber-office/live-schema.ts src/app/api/cyber-office/step/route.ts
git commit -m "feat(cyber-office): 新增单步会议接口，限流按步计量"
```

---

---

## Task S2：前端改成逐轮驱动

> **目标**：把 `useLiveMeeting` 从"发一次请求、等服务端跑完整场"改成"**前端自己循环，一轮一轮地调 `/step`**"。
> **本 Task 结束时行为和现在完全一样**——还没有暂停按钮。但会议的"方向盘"已经从服务端交到前端手里，S3 才可能加暂停。
> **对外接口不变**：仍然导出 `{ state, isRunning, start, cancel }`，所以 `cyber-office.tsx` **一行都不用改**。

**Files:**
- Modify: `src/components/cyber-office/use-live-meeting.ts`

### 改造思路（先看懂再敲）

```
改造前： start() ──POST /run 一次──► 服务端跑完整场 ──SSE──► 前端只管收
改造后： start() 里有个 while 循环：
           ┌─► POST /step (topic, transcript, turn) ──► 服务端只跑一轮 ──SSE──► 收
           │                                                                  │
           └──── 拿到 step_end{nextTurn, done}，没 done 就再来一轮 ◄───────────┘
         循环结束 → 再发一次 /step (mode: "summarize") 收口
```

两个关键点：
1. **会议历史由前端持有**。前端维护一个 `transcript` 数组，每轮说完就把完整发言存进去，下一轮请求时带给服务端。服务端因此不需要记住任何东西。
2. **`meeting_start` 由前端本地发**。它只是初始化画面（不调模型），服务端的 `/step` 不再负责它。

- [ ] **Step 1: 整份替换 `use-live-meeting.ts`**

改动集中且相互关联，整份替换最不容易出错。用下面这份覆盖原文件：

```ts
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";
import { parseSseChunk } from "@/lib/cyber-office/sse";
import type { OfficeEvent, RoleId } from "@/lib/cyber-office/types";

interface LiveErrorResponse {
  message?: string;
}

// 前端侧的安全阀：正常情况下服务端会在 maxTurns 时把 done 置 true，
// 这里再兜一层，防止任何异常导致无限循环狂发请求。
const CLIENT_MAX_TURNS = 12;

type TranscriptTurn = { speaker: RoleId; text: string };

// 一步跑完后的结果：下一轮编号、是否该收口、有没有失败。
interface StepResult {
  nextTurn: number;
  done: boolean;
  failed: boolean;
}

async function readErrorMessage(response: Response) {
  const body = (await response
    .json()
    .catch(() => null)) as LiveErrorResponse | null;
  return body?.message || LIVE_MEETING_MESSAGES.deepseekFailed;
}

/**
 * 发一次 /step 请求，把服务端流式推来的事件边收边 dispatch 到画面上。
 * 同时把本轮的完整发言攒进 transcript —— 下一轮请求要把它带回给服务端当上下文。
 */
async function runStep(params: {
  body: unknown;
  signal: AbortSignal;
  dispatch: (event: OfficeEvent) => void;
  transcript: TranscriptTurn[];
}): Promise<StepResult> {
  const { body, signal, dispatch, transcript } = params;

  const response = await fetch("/api/cyber-office/step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    dispatch({ type: "error", message: await readErrorMessage(response) });
    return { nextTurn: 0, done: true, failed: true };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let pending = ""; // 本轮发言逐字攒起来
  // 默认 done: true —— 万一流意外结束（没收到 step_end），循环就停下而不是空转。
  let result: StepResult = { nextTurn: 0, done: true, failed: false };

  const handle = (event: OfficeEvent) => {
    if (event.type === "step_end") {
      // 控制事件：只用来记录进度，不往画面上送。
      result = { nextTurn: event.nextTurn, done: event.done, failed: false };
      return;
    }

    if (event.type === "error") {
      result.failed = true;
    }

    if (event.type === "token") {
      pending += event.delta;
    }

    if (event.type === "speaking_end") {
      // 这一轮说完了，把完整发言归档进会议历史。
      transcript.push({ speaker: event.speaker, text: pending });
      pending = "";
    }

    dispatch(event);
  };

  // SSE 按 \n\n 分隔消息；网络可能一次给半条，所以尾巴要留到下次拼。
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() || "";

    for (const part of parts) {
      for (const event of parseSseChunk(`${part}\n\n`)) {
        handle(event);
      }
    }
  }

  if (buffer.trim()) {
    for (const event of parseSseChunk(buffer)) {
      handle(event);
    }
  }

  return result;
}

export function useLiveMeeting() {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    // 只发取消信号；清理 running 状态放在各自请求的 finally 里，
    // 避免旧请求误关掉刚启动的新请求。
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      cancel(); // 保证同一时刻只有最新一场会议在跑
      dispatch({ type: "reset" });
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      // 会议历史由前端持有：每一步都带给服务端，服务端自己不记任何东西。
      // 这也是之后"暂停后还能继续"的基础——进度就在这个数组里。
      const transcript: TranscriptTurn[] = [];

      try {
        // meeting_start 只是初始化画面、不调模型，前端本地发一条即可。
        dispatch({ type: "meeting_start", topic, participants });

        let turn = 0;
        let done = false;

        // 逐轮驱动。以后的"暂停"，就是在这个循环里不再发起下一轮请求。
        while (!done && turn < CLIENT_MAX_TURNS) {
          const result = await runStep({
            body: { topic, participants, transcript, turn, mode: "turn" },
            signal: controller.signal,
            dispatch,
            transcript,
          });

          if (result.failed) return; // 错误事件已经 dispatch 过，直接收工
          turn = result.nextTurn;
          done = result.done;
        }

        // 讨论结束 → 收口做总结（同一个接口，换个 mode）。
        await runStep({
          body: { topic, participants, transcript, turn, mode: "summarize" },
          signal: controller.signal,
          dispatch,
          transcript,
        });
      } catch (error) {
        // 用户主动取消：静默退出，不当成错误。
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        dispatch({
          type: "error",
          message: LIVE_MEETING_MESSAGES.networkFailed,
        });
      } finally {
        // 竞态防御：只有当全局控制器仍是自己创建的那个，才清理状态。
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [cancel],
  );

  // 组件卸载时取消在途请求，避免内存泄漏和幽灵请求。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, start, cancel };
}
```

- [ ] **Step 2: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

- [ ] **Step 3: 实机验证（需要本地配好 `DEEPSEEK_API_KEY`）**

Run: `npm run dev`，点「用我的议题开始」。

Expected：**和改造前看起来一模一样**——主持人串场 → 点名 → 角色逐字发言 → 下一轮 → 最后出结论。
差别只在看不见的地方：打开浏览器开发者工具的 Network 面板，会看到**多次 `/api/cyber-office/step` 请求**（每轮一次 + 最后一次总结），而不是以前那一条长长的 `/run`。

> 若本地没配 DeepSeek key，跳过这步；改动本身已被类型检查和构建覆盖。
> ⚠️ 轮次之间会有轻微停顿（每轮要重新建一次连接），这是逐轮驱动的正常代价。

- [ ] **Step 4: 提交**

```bash
git add src/components/cyber-office/use-live-meeting.ts
git commit -m "refactor(cyber-office): 实时会议改为前端逐轮驱动"
```

---

---

## Task S3：真暂停（pause / resume）

> **目标**：实时会议出现「暂停会议 / 继续会议」按钮。暂停后**不再向大模型发任何请求**（真省钱、可无限期停），点继续从原处接着开。
> **这是这条线的收获时刻** —— S1 把服务端拆成单步、S2 把方向盘交给前端，都是为了这一步。

### 暂停语义（重要，先想清楚再敲）

点「暂停」后，**当前正在说的这个人会把话说完**，然后停在轮次边界。

这不是偷懒，是**唯一正确的做法**：这句话的模型调用已经发出去了，中途掐断只会白花钱又丢内容。所以暂停的准确含义是"**本轮结束后暂停**"，UI 文案也要这么写，别让用户以为卡住了。

```
… 角色发言中 ──► 说完 ──► [检查是否暂停] ──► 暂停：停在这里，不发下一轮请求
                                    └──► 未暂停：继续下一轮
```

### 需要解决的技术问题

暂停后要能继续，就必须把"会议进度"存在**能跨越多次调用存活**的地方。S2 里 `transcript` 和 `turn` 是 `start()` 函数内部的局部变量，函数一返回就没了。所以 S3 要把它们提升成 `useRef` 持有的**进度对象**。

**Files:**
- Modify: `src/components/cyber-office/use-live-meeting.ts`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [ ] **Step 1: `use-live-meeting.ts` —— 替换 `useLiveMeeting` 函数**

文件上半部分（`runStep`、`readErrorMessage`、常量、类型）**保持不动**，只把 `export function useLiveMeeting() { ... }` 整个函数替换为下面这版：

```ts
// 会议进度：暂停后要靠它从原处接着跑，所以必须存在 ref 里跨调用存活。
interface MeetingProgress {
  topic: string;
  participants: RoleId[];
  transcript: TranscriptTurn[];
  turn: number;
  discussionDone: boolean; // 讨论阶段是否已结束（接下来该收口总结）
}

export function useLiveMeeting() {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 用 ref 而不是 state 存"是否暂停"：异步循环里要读到**最新**的值，
  // 而 state 在闭包里会是旧快照。isPaused 那个 state 只负责驱动按钮文案。
  const pausedRef = useRef(false);
  const progressRef = useRef<MeetingProgress | null>(null);

  const cancel = useCallback(() => {
    // 彻底终止：清空进度，之后不能再 resume。
    pausedRef.current = false;
    setIsPaused(false);
    progressRef.current = null;
    abortRef.current?.abort();
  }, []);

  // 会议主循环：从 progressRef 的当前进度接着跑。start 和 resume 都调它。
  const runLoop = useCallback(async (controller: AbortController) => {
    const progress = progressRef.current;
    if (!progress) return;

    setIsRunning(true);

    try {
      while (!progress.discussionDone && progress.turn < CLIENT_MAX_TURNS) {
        // ★ 暂停检查点：就在这里。已暂停就直接退出循环，
        //   不发起下一次请求 —— 这就是"真暂停"的全部秘密。
        if (pausedRef.current) return;

        const result = await runStep({
          body: {
            topic: progress.topic,
            participants: progress.participants,
            transcript: progress.transcript,
            turn: progress.turn,
            mode: "turn",
          },
          signal: controller.signal,
          dispatch,
          transcript: progress.transcript,
        });

        if (result.failed) return; // 错误事件已 dispatch，收工
        progress.turn = result.nextTurn;
        progress.discussionDone = result.done;
      }

      // 讨论跑完了，但如果用户刚好在这时按了暂停，总结也先别做。
      if (pausedRef.current) return;

      await runStep({
        body: {
          topic: progress.topic,
          participants: progress.participants,
          transcript: progress.transcript,
          turn: progress.turn,
          mode: "summarize",
        },
        signal: controller.signal,
        dispatch,
        transcript: progress.transcript,
      });

      progressRef.current = null; // 会议真正结束，没有可恢复的进度了
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return; // 用户主动取消，静默退出
      }

      dispatch({
        type: "error",
        message: LIVE_MEETING_MESSAGES.networkFailed,
      });
    } finally {
      // 竞态防御：只有全局控制器仍是自己创建的那个，才清理状态。
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsRunning(false);
      }
    }
  }, []);

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      cancel(); // 保证同一时刻只有最新一场会议
      dispatch({ type: "reset" });

      pausedRef.current = false;
      setIsPaused(false);

      const controller = new AbortController();
      abortRef.current = controller;

      // 全新会议：进度从零开始。
      progressRef.current = {
        topic,
        participants,
        transcript: [],
        turn: 0,
        discussionDone: false,
      };

      // meeting_start 只初始化画面、不调模型，前端本地发。
      dispatch({ type: "meeting_start", topic, participants });

      await runLoop(controller);
    },
    [cancel, runLoop],
  );

  // 暂停：只是把旗子插上。当前这一轮会自然说完，循环在下一个检查点停住。
  const pause = useCallback(() => {
    pausedRef.current = true;
    setIsPaused(true);
  }, []);

  // 继续：带着保存下来的进度，重新进入主循环。
  const resume = useCallback(async () => {
    if (!progressRef.current) return; // 没有可恢复的会议

    pausedRef.current = false;
    setIsPaused(false);

    const controller = new AbortController();
    abortRef.current = controller;

    await runLoop(controller);
  }, [runLoop]);

  // 组件卸载时取消在途请求，避免内存泄漏和幽灵请求。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, isPaused, start, pause, resume, cancel };
}
```

> 为什么 `pausedRef` 用 ref 不用 state：异步循环跑起来后，闭包里捕获的 state 是**当时那一刻的旧值**，用户后来点的暂停它读不到。ref 永远指向同一个盒子，读到的总是最新值。而 `isPaused` 这个 state 存在的唯一意义是**让按钮文案重新渲染**。

- [ ] **Step 2: `cyber-office.tsx` —— busy 把暂停也算上**

找到：

```tsx
  const busy = replay.isPlaying || live.isRunning;
```

改成：

```tsx
  // 暂停中的会议也算"占用中"：此时不允许改议题或另起一场，避免状态打架。
  const busy = replay.isPlaying || live.isRunning || live.isPaused;
```

- [ ] **Step 3: `cyber-office.tsx` —— 「停止会议」按钮在暂停时也要能点**

把：

```tsx
          {live.isRunning && (
            <button
              onClick={live.cancel}
```

改成：

```tsx
          {(live.isRunning || live.isPaused) && (
            <button
              onClick={live.cancel}
```

- [ ] **Step 4: `cyber-office.tsx` —— 加「暂停 / 继续会议」按钮**

在上面那个「停止会议」按钮的 `)}` **之后**、回放的暂停按钮 `{mode === "replay" && ...}` **之前**，插入：

```tsx
          {/* 实时会议的暂停/继续。暂停后不再发起下一轮请求，真正停止调用大模型。 */}
          {mode === "live" && (live.isRunning || live.isPaused) && (
            <button
              onClick={() => (live.isPaused ? live.resume() : live.pause())}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
            >
              {live.isPaused ? "继续会议" : "暂停会议"}
            </button>
          )}
```

- [ ] **Step 5: `cyber-office.tsx` —— 状态提示说清"本轮结束后暂停"**

找到思考态那段：

```tsx
      {thinking && (
        <p className="text-sm text-text-muted">AI 正在思考下一步…</p>
      )}
```

替换为（暂停相关提示优先）：

```tsx
      {mode === "live" && live.isPaused && live.isRunning && (
        <p className="text-sm text-text-muted">
          本轮说完后暂停…（正在说的这句会讲完）
        </p>
      )}
      {mode === "live" && live.isPaused && !live.isRunning && (
        <p className="text-sm text-text-muted">
          会议已暂停 · 未在调用模型。点「继续会议」接着开。
        </p>
      )}
      {thinking && !live.isPaused && (
        <p className="text-sm text-text-muted">AI 正在思考下一步…</p>
      )}
```

- [ ] **Step 6: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

- [ ] **Step 7: 实机验证（要本地配好 `DEEPSEEK_API_KEY`）**

Run: `npm run dev`，点「用我的议题开始」，**在某个角色说话时点「暂停会议」**。

Expected：
1. 这个角色**把话说完**，期间提示「本轮说完后暂停…」；
2. 然后停住，提示变成「会议已暂停 · 未在调用模型」，按钮变成「继续会议」；
3. **打开开发者工具 Network 面板：暂停期间没有任何新的 `/step` 请求** —— 这就是"真暂停"的证据，也是它和"前端假装停一下"的本质区别；
4. 点「继续会议」，从下一轮无缝接着开，之前的发言记录都还在；
5. 暂停期间点「停止会议」可以彻底放弃这场。

- [ ] **Step 8: 提交**

```bash
git add src/components/cyber-office/use-live-meeting.ts src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 实时会议支持轮次边界暂停与继续"
```

---

---

## Task S4：刷新页面也能接着开会（检查点持久化）

> **目标**：把"没开完的会议"存进浏览器的 localStorage。**关掉页面、刷新、明天再来**，回到 `/cyber-office` 时上次的会议还在，点「继续会议」从原处接着开。
> **为什么做得到**：S2 已经把会议进度（`transcript` + `turn`）交给前端持有了。既然进度在前端手里，把它写进浏览器存储就是顺手的事——服务端依然什么都不用记。

### 存什么、怎么恢复

存两样东西：

| 存什么 | 用来干嘛 |
|---|---|
| `progress`（议题 / 参会者 / transcript / 第几轮） | **继续开会**要用：下一次请求得带上它 |
| `state`（整个会议画面状态） | **还原画面**要用：谁说过什么、结论、发言记录都在里面 |

恢复时不需要"重放"任何事件——直接把存下来的 `state` 整个塞回去就行。为此要给 reducer 加一个 `restore` 动作。

**Files:**
- Create: `src/lib/cyber-office/session-storage.ts`
- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/reducer.ts`
- Modify: `src/components/cyber-office/use-live-meeting.ts`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [ ] **Step 1: 新建 `src/lib/cyber-office/session-storage.ts`**

localStorage 的读写都集中在这个文件，外面不直接碰它。

```ts
import type { MeetingState, RoleId } from "./types";

// key 带版本号 v1：以后数据结构变了，换成 v2 即可，旧数据自然被忽略，
// 不会出现"旧格式把新页面搞崩"的情况。
const KEY = "cyber-office:live-session:v1";

// 继续开会所需要的进度（就是 use-live-meeting 里那个进度对象）。
export interface SavedProgress {
  topic: string;
  participants: RoleId[];
  transcript: { speaker: RoleId; text: string }[];
  turn: number;
  discussionDone: boolean;
}

export interface SavedSession {
  state: MeetingState; // 画面状态：用来还原"看到的东西"
  progress: SavedProgress; // 会议进度：用来"接着往下开"
}

export function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // 无痕模式、存储配额满等情况下 localStorage 会抛错。
    // 存不下就算了——会议本身照常进行，只是失去"刷新可恢复"这个便利。
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedSession;

    // 最低限度的形状校验：不认识的数据一律当作没有，避免把页面搞崩。
    if (!parsed?.state?.phase || !parsed?.progress?.topic) return null;
    // 已经开完的会议没有恢复的必要。
    if (parsed.state.phase === "ended") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上，失败不影响主流程
  }
}
```

- [ ] **Step 2: `types.ts` —— 加 `restore` 动作**

在 `OfficeEvent` 联合类型里，`reset` 那行**之后**加：

```ts
  | { type: "restore"; state: MeetingState } // 仅前端使用：把存下来的会议状态整个还原回去
```

> 说明：`OfficeEvent` 平时是"服务端推给前端的事件"，`restore` 是唯一一个**只在前端内部使用**的动作（服务端永远不会发它）。放在这里是因为 reducer 的动作类型就是它，加个注释说明即可。

- [ ] **Step 3: `reducer.ts` —— 处理 `restore`**

在 `applyEvent` 的 `switch` 里，`case "reset":` **之后**加：

```ts
    case "restore":
      // 直接用存下来的状态覆盖当前状态。不需要重放历史事件——
      // 因为 MeetingState 本身就是"当时画面的完整快照"。
      return event.state;
```

- [ ] **Step 4: `use-live-meeting.ts` —— 顶部 import + 删掉本地进度类型**

① 顶部 import 区加一行：

```ts
import {
  clearSession,
  loadSession,
  saveSession,
  type SavedProgress,
} from "@/lib/cyber-office/session-storage";
```

② 找到 S3 加的这段本地接口定义，**整段删掉**（改用 `session-storage.ts` 里那份，避免同一个结构定义两遍）：

```ts
// 会议进度：暂停后要靠它从原处接着跑，所以必须存在 ref 里跨调用存活。
interface MeetingProgress {
  topic: string;
  participants: RoleId[];
  transcript: TranscriptTurn[];
  turn: number;
  discussionDone: boolean;
}
```

③ 把用到它的那行（在 `useLiveMeeting` 里）：

```ts
  const progressRef = useRef<MeetingProgress | null>(null);
```

改成：

```ts
  // 会议进度：暂停/刷新后靠它从原处接着跑。类型复用 session-storage 里那份。
  const progressRef = useRef<SavedProgress | null>(null);
```

- [ ] **Step 5: `use-live-meeting.ts` —— 终止会议时清掉存档**

把 `cancel` 里加一行 `clearSession()`：

```ts
  const cancel = useCallback(() => {
    // 彻底终止：清空进度和存档，之后不能再 resume。
    pausedRef.current = false;
    setIsPaused(false);
    progressRef.current = null;
    clearSession();
    abortRef.current?.abort();
  }, []);
```

- [ ] **Step 6: `use-live-meeting.ts` —— 会议正常结束时也清掉存档**

在 `runLoop` 里找到这行：

```ts
      progressRef.current = null; // 会议真正结束，没有可恢复的进度了
```

改成：

```ts
      // 会议真正结束：进度和存档都清掉，下次进页面不会再弹出"继续"。
      progressRef.current = null;
      clearSession();
```

- [ ] **Step 7: `use-live-meeting.ts` —— 加"自动存档"和"开机恢复"两个 effect**

把 S3 那个卸载清理的 effect：

```ts
  // 组件卸载时取消在途请求，避免内存泄漏和幽灵请求。
  useEffect(() => {
    return () => cancel();
  }, [cancel]);
```

**整段替换**为下面三个 effect：

```ts
  // ① 自动存档：会议状态变化时把"画面 + 进度"写进 localStorage。
  //    只在"没人正在说话"的时刻写——否则逐字流式期间每个字都要写一次硬盘，太浪费。
  //    而"某人刚说完"正好就是最合适的检查点。
  useEffect(() => {
    if (!progressRef.current) return; // 没有进行中的会议，不用存
    if (state.activeSpeaker) return; // 正在说话中，等说完再存
    saveSession({ state, progress: progressRef.current });
  }, [state]);

  // ② 开机恢复：首次挂载时看看上次有没有没开完的会议。
  //    恢复出来的会议一律停在"暂停"态，等用户主动点「继续会议」，
  //    绝不自动开跑——否则用户一进页面就被扣掉 API 额度。
  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;

    progressRef.current = saved.progress;
    pausedRef.current = true;
    setIsPaused(true);
    dispatch({ type: "restore", state: saved.state });
  }, []);

  // ③ 组件卸载：只中断在途请求，不清理进度。
  //    ⚠️ 这里不能调 cancel()——它会清掉存档，而 React 开发模式会故意"挂载→卸载→再挂载"
  //    一次来暴露副作用问题，那样刚恢复出来的会议会被立刻删掉。
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);
```

- [ ] **Step 8: `cyber-office.tsx` —— 恢复时自动切到实时模式**

> ⚠️ 直觉写法是"用一个 `useEffect` 监听 `live.isPaused`，然后 `setMode("live")`"——**不要这么写**。
> React 19 的 lint 规则 `react-hooks/set-state-in-effect` 会直接报错：在 effect 里同步 setState 会触发级联渲染。
> 正解是**把 mode 变成推导值**：它本来就能由 `live` 的状态算出来，压根不需要 effect。

① 找到：

```tsx
  const [mode, setMode] = useState<"replay" | "live">("replay");
```

替换为：

```tsx
  // 用户手动选择的模式。
  const [modeChoice, setModeChoice] = useState<"replay" | "live">("replay");
  // 实际展示的模式：只要有实时会议在跑或被暂停（包括刷新后恢复出来的那场），
  // 页面就必然显示实时模式。用"算出来"代替在 effect 里 setState。
  const mode = live.isRunning || live.isPaused ? "live" : modeChoice;
```

> 因为推导值仍叫 `mode`，下面所有渲染逻辑**一个字都不用改**。

② 只改两个按钮里的 setter：「用我的议题开始」里的 `setMode("live")` → `setModeChoice("live")`；「看一场演示」里的 `setMode("replay")` → `setModeChoice("replay")`。

③ 恢复出来的会议议题，显示在暂停提示里（同样为了避开 setState in effect，不往输入框里塞）。把 S3 加的这段：

```tsx
      {mode === "live" && live.isPaused && !live.isRunning && (
        <p className="text-sm text-text-muted">
          会议已暂停 · 未在调用模型。点「继续会议」接着开。
        </p>
      )}
```

替换为：

```tsx
      {mode === "live" && live.isPaused && !live.isRunning && (
        <p className="text-sm text-text-muted">
          会议已暂停 · 未在调用模型
          {live.state.topic ? ` · 议题：${live.state.topic}` : ""}
          。点「继续会议」接着开。
        </p>
      )}
```

> 本 Step 不需要 `useEffect`，`cyber-office.tsx` 顶部的 import 保持 `import { useState } from "react";` 不变。

- [ ] **Step 9: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

- [ ] **Step 10: 实机验证（要本地配好 `DEEPSEEK_API_KEY`）**

Run: `npm run dev`

1. 开一场实时会议，跑两轮后点「暂停会议」；
2. **直接按 F5 刷新页面**；
3. Expected：页面回来后，**舞台、字幕、发言记录、编排面板里的内容都还在**，状态显示「会议已暂停 · 未在调用模型」，按钮是「继续会议」；
4. 点「继续会议」→ 从下一轮接着开，之前的发言都作为上下文带给了模型；
5. 会议开完（出结论）后再刷新 → **不再恢复**（已完成的会议没必要留着）；
6. 暂停时点「停止会议」再刷新 → 也不再恢复（存档已清）。

- [ ] **Step 11: 提交**

```bash
git add src/lib/cyber-office/session-storage.ts src/lib/cyber-office/types.ts src/lib/cyber-office/reducer.ts src/components/cyber-office/use-live-meeting.ts src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 会议进度持久化，刷新页面可继续"
```

---

---

## Task S5：人在回路（逐轮审批）

> **目标**：加一个「逐轮审批」开关。开启后，每轮**主持人的调度决策会先停下来给用户看**——用户可以改点名对象、改给这个角色的指令，也可以直接改成"进入总结"，确认后才真正执行。
> **本质**：把"AI 自己一路跑到底"变成"**AI 提议、人拍板**"。这也是暂停机制最有价值的用途。
>
> **为什么能顺利接上**：S1-A 里 `runOneTurn` 就预留了可选的 `decision` 参数——传了就直接用、不再问主持人。这一期只是把这条路接到前端。

### 流程对比

```
普通模式：  [问主持人 → 立刻执行] → [问主持人 → 立刻执行] → …
审批模式：  [问主持人] → 停下给你看 → 你确认/修改 → [执行这一轮] → [问主持人] → 停下 → …
```

注意：**模型调用次数没有增加**。审批模式只是把"问主持人"和"执行"拆成两次 HTTP 请求，中间插了个人。

**Files:**
- Modify: `src/lib/cyber-office/orchestrator.ts`
- Modify: `src/lib/cyber-office/limits.ts`
- Modify: `src/lib/cyber-office/live-schema.ts`
- Modify: `src/lib/cyber-office/session-storage.ts`
- Create: `src/app/api/cyber-office/plan/route.ts`
- Create: `src/components/cyber-office/decision-approval.tsx`
- Modify: `src/components/cyber-office/use-live-meeting.ts`
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [ ] **Step 1: `orchestrator.ts` —— 把"问主持人"导出**

`askModeratorDecision` 现在是文件内部函数，审批模式要单独调用它。只需在它前面加 `export`：

```ts
export async function askModeratorDecision(
```

（函数体和其它地方都不用动。）

- [ ] **Step 2: `limits.ts` —— 每场步数把审批算进去**

审批模式下每轮是两次请求（问一次 + 执行一次），额度要相应放宽。把：

```ts
export const STEPS_PER_MEETING = LIVE_MEETING_LIMITS.maxTurns + 1;
```

改成：

```ts
// 一场会议的请求数上限：审批模式下每轮要两次请求（先问主持人、再执行），
// 加上最后一次总结。按最坏情况算额度，免得开了审批就被自己限流拦住。
export const STEPS_PER_MEETING = LIVE_MEETING_LIMITS.maxTurns * 2 + 1;
```

- [ ] **Step 3: `live-schema.ts` —— 允许前端回传决策**

在 `stepRequestSchema` **之前**加一个决策的校验规则：

```ts
// 审批模式下，决策是用户改过的、从浏览器传来的——必须严格校验，
// 因为它会被直接塞进给模型的 prompt 里。
const moderatorDecisionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("call_on"),
    speaker: roleIdSchema,
    prompt: z.string().trim().max(500),
    hostText: z.string().trim().max(500),
  }),
  z.object({
    action: z.literal("summarize"),
    hostText: z.string().trim().max(500),
  }),
]);
```

在 `stepRequestSchema` 的对象里，`mode` 那行**之后**加一行：

```ts
  decision: moderatorDecisionSchema.optional(),
```

给 `StepRequest` 接口也加上对应字段（放在 `mode` 之后）：

```ts
  decision?:
    | { action: "call_on"; speaker: RoleId; prompt: string; hostText: string }
    | { action: "summarize"; hostText: string };
```

最后在 `parseStepRequest` 的 `return` **之前**，加一道安全检查——用户传来的点名对象必须是合法参会者：

```ts
  // 用户可以改点名对象，但只能改成本场真实存在的参会角色，且不能点主持人自己。
  const d = parsed.data.decision;
  if (d?.action === "call_on") {
    if (!participants.includes(d.speaker) || d.speaker === "host") {
      return { ok: false, message: LIVE_MEETING_MESSAGES.invalidRequest };
    }
  }
```

- [ ] **Step 4: `session-storage.ts` —— 进度里记住"是否开了审批"**

在 `SavedProgress` 接口里加一行（放在 `discussionDone` 之后）：

```ts
  approval: boolean; // 是否开启了逐轮审批（刷新恢复后要沿用同一模式）
}
```

- [ ] **Step 5: 新建 `src/app/api/cyber-office/plan/route.ts`**

这个接口只做一件事：问主持人下一步打算怎么安排，**不执行**。因为不需要流式输出，直接返回普通 JSON 即可。

```ts
import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { toPublicLiveMeetingError } from "@/lib/cyber-office/live-errors";
import { parseStepRequest } from "@/lib/cyber-office/live-schema";
import { askModeratorDecision } from "@/lib/cyber-office/orchestrator";
import { guardLiveMeetingRequest } from "@/lib/cyber-office/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// 「先问不做」接口：只拿主持人的调度决策，交给前端给用户确认。
// 不涉及流式发言，所以返回普通 JSON，不用 SSE。
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  // 复用 /step 的请求校验：字段要求完全一样（mode 用不到，忽略即可）。
  const parsed = parseStepRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  const guard = await guardLiveMeetingRequest(request, "step");

  if (!guard.allowed) {
    return Response.json(
      {
        code: guard.error.code,
        message: guard.error.message,
        retryAfter: guard.error.retryAfter,
      },
      { status: guard.error.status },
    );
  }

  try {
    const model = createDeepSeekChatModel();
    const { topic, participants, transcript } = parsed.data;

    const decision = await askModeratorDecision(
      model,
      topic,
      participants,
      transcript,
    );

    return Response.json({ decision });
  } catch (error) {
    const publicError = toPublicLiveMeetingError(error);
    console.error("[cyber-office] plan failed", error);
    return Response.json({ message: publicError.message }, { status: 500 });
  }
}
```

- [ ] **Step 6: 新建 `src/components/cyber-office/decision-approval.tsx`**

审批卡片。用户可以改点名对象和指令，也可以改成直接总结。

```tsx
"use client";

import { useState } from "react";
import type { ModeratorDecision, RoleId } from "@/lib/cyber-office/types";
import { getRole } from "@/lib/cyber-office/roles";

export default function DecisionApproval({
  decision,
  participants,
  onApprove,
}: {
  decision: ModeratorDecision;
  participants: RoleId[];
  onApprove: (decision: ModeratorDecision) => void;
}) {
  // 表单初值来自主持人的提议。父组件用 key 强制重新挂载，
  // 所以每一轮都会拿到一份全新的初值，不需要用 effect 去同步。
  const [speaker, setSpeaker] = useState<RoleId>(
    decision.action === "call_on" ? decision.speaker : "pm",
  );
  const [prompt, setPrompt] = useState(
    decision.action === "call_on" ? decision.prompt : "",
  );

  const experts = participants.filter((id) => id !== "host");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-bg-subtle p-4">
      <div>
        <p className="text-sm font-medium text-text-primary">
          主持人的安排 · 等你确认
        </p>
        <p className="mt-1 text-xs leading-[1.6] text-text-muted">
          可以改成别的人、改指令，或者直接收口总结。确认后才会真正调用模型。
        </p>
      </div>

      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        下一个发言的人
        <select
          value={speaker}
          onChange={(e) => setSpeaker(e.target.value as RoleId)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        >
          {experts.map((id) => (
            <option key={id} value={id}>
              {getRole(id).name} —— {getRole(id).title}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-text-secondary">
        给他的指令
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-[1.6] text-text-primary outline-none focus:border-accent"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() =>
            onApprove({
              action: "call_on",
              speaker,
              prompt: prompt.trim() || "请从你的角色视角补充。",
              hostText: decision.hostText,
            })
          }
          className="rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
        >
          按此执行
        </button>
        <button
          onClick={() =>
            onApprove({
              action: "summarize",
              hostText: "讨论到这里，我们进入总结。",
            })
          }
          className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
        >
          改为直接总结
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: `use-live-meeting.ts` —— 加审批支持**

① 顶部 import 补上决策类型：

```ts
import type {
  ModeratorDecision,
  OfficeEvent,
  RoleId,
} from "@/lib/cyber-office/types";
```

（把原来那行 `import type { OfficeEvent, RoleId } ...` 替换掉。）

② 在 `runStep` 函数**之后**、`export function useLiveMeeting()` **之前**，加一个"只问不做"的请求函数：

```ts
// 只问主持人下一步打算怎么安排，不执行。返回决策或错误文案。
async function fetchPlan(params: {
  body: unknown;
  signal: AbortSignal;
}): Promise<{ decision?: ModeratorDecision; message?: string }> {
  const response = await fetch("/api/cyber-office/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
    signal: params.signal,
  });

  const data = (await response.json().catch(() => null)) as {
    decision?: ModeratorDecision;
    message?: string;
  } | null;

  if (!response.ok || !data?.decision) {
    return { message: data?.message || LIVE_MEETING_MESSAGES.deepseekFailed };
  }

  return { decision: data.decision };
}
```

③ 在 `useLiveMeeting` 里，`progressRef` 那行**之后**加两个新东西：

```ts
  // 待用户确认的决策。不为 null 时，会议停在"等审批"状态。
  const [pendingDecision, setPendingDecision] =
    useState<ModeratorDecision | null>(null);
  // 用户确认后的决策：放进这个盒子，下一轮循环直接拿它执行、不再问主持人。
  const approvedRef = useRef<ModeratorDecision | null>(null);
```

④ `cancel` 里补两行清理（放在 `progressRef.current = null;` 之后）：

```ts
    approvedRef.current = null;
    setPendingDecision(null);
```

⑤ `runLoop` 的 while 循环里，把 `if (pausedRef.current) return;` **之后**到 `const result = await runStep({` **之前**的部分，改成下面这样（新增审批分支 + 把决策带进请求）：

```ts
        if (pausedRef.current) return;

        // 审批模式：先只问主持人"打算怎么安排"，把提议交给用户，本轮到此停住。
        if (progress.approval && !approvedRef.current) {
          const plan = await fetchPlan({
            body: {
              topic: progress.topic,
              participants: progress.participants,
              transcript: progress.transcript,
              turn: progress.turn,
            },
            signal: controller.signal,
          });

          if (!plan.decision) {
            dispatch({
              type: "error",
              message: plan.message ?? LIVE_MEETING_MESSAGES.deepseekFailed,
            });
            return;
          }

          setPendingDecision(plan.decision);
          return; // 等用户点「按此执行」，approve() 会重新进入本循环
        }

        // 用户确认过的决策（普通模式下是 undefined，服务端会自己问主持人）。
        const decision = approvedRef.current ?? undefined;
        approvedRef.current = null;

        const result = await runStep({
          body: {
            topic: progress.topic,
            participants: progress.participants,
            transcript: progress.transcript,
            turn: progress.turn,
            mode: "turn",
            decision,
          },
          signal: controller.signal,
          dispatch,
          transcript: progress.transcript,
        });
```

⑥ `start` 加一个参数，并把它写进进度：

```ts
  const start = useCallback(
    async (topic: string, participants: RoleId[], approval = false) => {
```

进度对象加一个字段：

```ts
      progressRef.current = {
        topic,
        participants,
        transcript: [],
        turn: 0,
        discussionDone: false,
        approval,
      };
```

⑦ 在 `resume` **之后**加一个 `approve`：

```ts
  // 用户确认（可能改过）的决策：存进盒子，重新进入主循环执行这一轮。
  const approve = useCallback(
    async (decision: ModeratorDecision) => {
      approvedRef.current = decision;
      setPendingDecision(null);

      const controller = new AbortController();
      abortRef.current = controller;

      await runLoop(controller);
    },
    [runLoop],
  );
```

⑧ 最后把新东西导出：

```ts
  return {
    state,
    isRunning,
    isPaused,
    pendingDecision,
    start,
    pause,
    resume,
    approve,
    cancel,
  };
```

- [ ] **Step 8: `cyber-office.tsx` —— 开关 + 审批卡片**

① 顶部加 import：

```tsx
import DecisionApproval from "./decision-approval";
```

② 加一个开关的 state（放在 `topic` 那个 useState 之后）：

```tsx
  // 逐轮审批：开启后每轮主持人的安排都要你确认才执行。
  const [approval, setApproval] = useState(false);
```

③ `mode` 和 `busy` 都要把"等审批"算进去：

```tsx
  const mode =
    live.isRunning || live.isPaused || live.pendingDecision
      ? "live"
      : modeChoice;
```

```tsx
  const busy =
    replay.isPlaying ||
    live.isRunning ||
    live.isPaused ||
    live.pendingDecision !== null;
```

④ 启动时把开关传进去。找到「用我的议题开始」的 onClick：

```tsx
              live.start(topic, LIVE_PARTICIPANTS);
```

改成：

```tsx
              live.start(topic, LIVE_PARTICIPANTS, approval);
```

> 下方"重试"按钮里那个 `live.start(topic, LIVE_PARTICIPANTS)` 也同样加上 `, approval`。

⑤ 在示例议题那块**之后**、按钮那排 `<div className="flex flex-wrap gap-3">` **之前**，插入开关：

```tsx
            {/* 人在回路：每轮先让你确认主持人的安排 */}
            <label className="flex items-start gap-2 text-xs leading-[1.6] text-text-secondary">
              <input
                type="checkbox"
                checked={approval}
                onChange={(e) => setApproval(e.target.checked)}
                disabled={busy}
                className="mt-0.5 accent-accent"
              />
              <span>
                逐轮审批
                <span className="text-text-muted">
                  （每轮先看主持人的安排，可改人选和指令，确认后才执行）
                </span>
              </span>
            </label>
```

⑥ 在右栏 `<StatusBar state={state} />` **之后**，插入审批卡片：

```tsx
          {live.pendingDecision && (
            <DecisionApproval
              // key 里带上已发言条数：每一轮都是一张全新的卡片，
              // 表单初值自然重置，不需要用 effect 去同步。
              key={state.transcript.length}
              decision={live.pendingDecision}
              participants={
                state.participants.length > 0
                  ? state.participants
                  : LIVE_PARTICIPANTS
              }
              onApprove={live.approve}
            />
          )}
```

- [ ] **Step 9: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build
```

- [ ] **Step 10: 实机验证**

Run: `npm run dev`

1. **勾上「逐轮审批」**，输入议题，点「用我的议题开始」；
2. Expected：舞台上方出现「主持人的安排 · 等你确认」卡片，显示它想点谁、给什么指令；此时 Network 面板只有一次 `plan` 请求，**没有任何发言在生成**；
3. 把下拉框改成**另一个角色**，指令也改几个字，点「按此执行」；
4. Expected：**被你改过的那个角色**上台发言，用的是你写的指令；说完后又弹出下一轮的审批卡片；
5. 任意一轮点「改为直接总结」→ 直接跳到结论；
6. **不勾**这个开关时，行为和以前完全一样（一路自动跑到底）。

- [ ] **Step 11: 提交**

```bash
git add src/lib/cyber-office/orchestrator.ts src/lib/cyber-office/limits.ts src/lib/cyber-office/live-schema.ts src/lib/cyber-office/session-storage.ts src/app/api/cyber-office/plan/route.ts src/components/cyber-office/decision-approval.tsx src/components/cyber-office/use-live-meeting.ts src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 加入逐轮审批，主持人决策可由用户修改后执行"
```

---

> **这条线到此完整**：S1 拆单步 → S2 逐轮驱动 → S3 真暂停 → S4 刷新可恢复 → S5 人在回路。
> 之后如果还想加，可以考虑：把审批卡片并进「AI 智能体如何协作」面板（现在它俩是分开的两块）、或者允许暂停期间修改后续议题。都属于锦上添花。
