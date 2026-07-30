# Cyber Office P2 DeepSeek Live Orchestration Implementation Plan

## 阶段 P2：真实 DeepSeek 后端编排

### Task 1: 为会议状态增加 reset 事件

**Files:**
- Modify: `src/lib/cyber-office/types.ts`
- Modify: `src/lib/cyber-office/reducer.ts`
- Modify: `src/lib/cyber-office/__tests__/reducer.test.ts`
- Modify: `src/components/cyber-office/use-replay.ts`

> P1 有一个小体验问题：第二次点击播放时，上一轮 Summary 会短暂残留到第一条 `meeting_start` 到来。P2 要接真实流，开始前更应该先清空旧状态，所以先补一个 `reset` 事件。

- [x] **Step 1: 先写失败测试**

Modify `src/lib/cyber-office/__tests__/reducer.test.ts`，在 `describe("applyEvent", () => { ... })` 内新增：

```ts
  it("reset 会回到空白初始状态", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "旧议题",
      participants: ["host", "pm"],
    });
    s = applyEvent(s, { type: "host_speak", text: "旧主持人台词" });
    s = applyEvent(s, { type: "summary", outline: "旧总结" });

    const reset = applyEvent(s, { type: "reset" });

    expect(reset).toEqual(createInitialState());
  });
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，TypeScript 或 Vitest 提示 `{ type: "reset" }` 不是合法 `OfficeEvent`，或 reducer 未处理该事件。

- [x] **Step 3: 扩展 OfficeEvent 类型**

Modify `src/lib/cyber-office/types.ts`，把 `OfficeEvent` 最后一段改为：

```ts
export type OfficeEvent =
  | { type: "reset" }
  | { type: "meeting_start"; topic: string; participants: RoleId[] }
  | { type: "host_speak"; text: string }
  | { type: "call_on"; speaker: RoleId }
  | { type: "speaking_start"; speaker: RoleId }
  | { type: "token"; speaker: RoleId; delta: string }
  | { type: "speaking_end"; speaker: RoleId }
  | { type: "summary"; outline: string }
  | { type: "meeting_end" }
  | { type: "error"; message: string };
```

- [x] **Step 4: reducer 支持 reset**

Modify `src/lib/cyber-office/reducer.ts`，在 `switch (event.type)` 第一段加入：

```ts
    case "reset":
      return createInitialState();
```

- [x] **Step 5: useReplay 开始前先 reset**

Modify `src/components/cyber-office/use-replay.ts` 的 `start`：

```ts
  const start = useCallback(() => {
    dispatch({ type: "reset" });
    indexRef.current = 0;
    setTick(0);
    setIsPlaying(true);
  }, []);
```

- [x] **Step 6: 运行测试**

Run:

```bash
npm run test
```

Expected: PASS，reducer 新增 reset 测试通过。

- [x] **Step 7: 提交**

```bash
git add src/lib/cyber-office/types.ts src/lib/cyber-office/reducer.ts src/lib/cyber-office/__tests__/reducer.test.ts src/components/cyber-office/use-replay.ts
git commit -m "feat(cyber-office): 支持重置会议状态"
```

---

### Task 2: 定义实时运行请求 schema

**Files:**
- Create: `src/lib/cyber-office/live-schema.ts`
- Create: `src/lib/cyber-office/__tests__/live-schema.test.ts`

> 前端传给后端的数据必须先约束住。P2 只开放议题和参会角色，角色自定义留到 P5。

- [ ] **Step 1: 写失败测试**

Create `src/lib/cyber-office/__tests__/live-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseRunMeetingRequest } from "@/lib/cyber-office/live-schema";

describe("parseRunMeetingRequest", () => {
  it("接受合法议题和角色", () => {
    const result = parseRunMeetingRequest({
      topic: "讨论空间转录组可视化文章大纲",
      participants: ["host", "pm", "frontend", "bio", "reviewer"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.topic).toBe("讨论空间转录组可视化文章大纲");
      expect(result.data.participants).toContain("host");
    }
  });

  it("拒绝过短议题", () => {
    const result = parseRunMeetingRequest({
      topic: "短",
      participants: ["host", "pm"],
    });

    expect(result.ok).toBe(false);
  });

  it("自动补上 host，并去掉重复角色", () => {
    const result = parseRunMeetingRequest({
      topic: "讨论一个足够长的博客选题",
      participants: ["pm", "pm", "bio"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.participants).toEqual(["host", "pm", "bio"]);
    }
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，找不到 `live-schema` 模块。

- [x] **Step 3: 写 schema 实现**

Create `src/lib/cyber-office/live-schema.ts`:

```ts
import { z } from "zod";
import type { RoleId } from "./types";

// 这份 schema 是后端的第一道门：任何从浏览器传来的角色 id，
// 都必须在这个白名单里，否则不能进入后面的 DeepSeek 调用。
const roleIdSchema = z.enum([
  "host",
  "pm",
  "frontend",
  "bio",
  "reviewer",
  "recorder",
  "summarizer",
]);

// z.object 描述“请求体应该长什么样”。
// topic 限制长度，避免用户提交空议题或超长文本；participants 限制人数，避免一次会议成本失控。
const runMeetingRequestSchema = z.object({
  topic: z.string().trim().min(6).max(240),
  participants: z.array(roleIdSchema).min(2).max(6),
});

export interface RunMeetingRequest {
  topic: string;
  participants: RoleId[];
}

export type ParseRunMeetingRequestResult =
  | { ok: true; data: RunMeetingRequest }
  | { ok: false; message: string };

export function parseRunMeetingRequest(
  input: unknown,
): ParseRunMeetingRequestResult {
  // safeParse 不会抛异常，而是返回 success true/false。
  // 这让 Route Handler 可以稳定返回 400，而不是让整个接口崩掉。
  const parsed = runMeetingRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "请输入 6-240 个字符的议题，并选择 2-6 个参会角色。",
    };
  }

  // host 是会议主持人，必须存在；Set 用来去重，避免 ["pm", "pm"] 这种重复角色。
  const deduped = Array.from(new Set<RoleId>(["host", ...parsed.data.participants]));
  // summarizer 是最后总结用的内部角色，P2 暂时不让它坐到圆桌参与发言。
  const participants = deduped.filter((id) => id !== "summarizer");

  return {
    ok: true,
    data: {
      topic: parsed.data.topic,
      participants,
    },
  };
}
```

- [x] **Step 4: 运行测试**

Run:

```bash
npm run test
```

Expected: PASS，新增 schema 测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/live-schema.ts src/lib/cyber-office/__tests__/live-schema.test.ts
git commit -m "feat(cyber-office): 定义实时会议请求校验"
```

---

### Task 3: 安装 OpenAI SDK 并配置 DeepSeek 客户端

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/cyber-office/deepseek-client.ts`

> DeepSeek API 兼容 OpenAI SDK。我们只在服务端创建客户端，前端不能 import 这个文件。

- [x] **Step 1: 安装依赖**

Run:

```bash
npm install openai
```

Expected: `package.json` 出现 `openai` 依赖。

- [x] **Step 2: 创建 DeepSeek 客户端**

Create `src/lib/cyber-office/deepseek-client.ts`:

```ts
import "server-only";
import OpenAI from "openai";

// 模型名从环境变量读取，方便将来从 deepseek-chat 切到别的模型时不用改代码。
export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

export function createDeepSeekClient() {
  // 这里没有 NEXT_PUBLIC_ 前缀，所以只会在服务端可用，不会被打包进浏览器 JS。
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  // DeepSeek 兼容 OpenAI SDK，但请求地址要改成 DeepSeek 的 baseURL。
  return new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
}
```

- [ ] **Step 3: 新建本地环境变量文件**

Create or update `.env.local` manually:

```bash
DEEPSEEK_API_KEY=你的_DeepSeek_API_Key
DEEPSEEK_MODEL=deepseek-chat
```

Expected: `.env.local` 不提交到 git。

- [x] **Step 4: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 5: 提交**

```bash
git add package.json package-lock.json src/lib/cyber-office/deepseek-client.ts
git commit -m "feat(cyber-office): 配置 DeepSeek 服务端客户端"
```

---

### Task 4: 定义 SSE 编码工具

**Files:**
- Create: `src/lib/cyber-office/sse.ts`
- Create: `src/lib/cyber-office/__tests__/sse.test.ts`

> SSE 的文本格式是 `data: JSON\n\n`。后端发这个格式，前端按这个格式解析。

- [x] **Step 1: 写失败测试**

Create `src/lib/cyber-office/__tests__/sse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { encodeSseEvent, parseSseChunk } from "@/lib/cyber-office/sse";

describe("SSE helpers", () => {
  it("把 OfficeEvent 编码成 SSE data 行", () => {
    const event: OfficeEvent = { type: "host_speak", text: "你好" };

    expect(encodeSseEvent(event)).toBe(
      'data: {"type":"host_speak","text":"你好"}\n\n',
    );
  });

  it("从 SSE chunk 解析 OfficeEvent", () => {
    const chunk = 'data: {"type":"token","speaker":"pm","delta":"你"}\n\n';

    expect(parseSseChunk(chunk)).toEqual([
      { type: "token", speaker: "pm", delta: "你" },
    ]);
  });

  it("忽略空行和非 data 行", () => {
    const chunk = ': keep-alive\n\ndata: {"type":"meeting_end"}\n\n';

    expect(parseSseChunk(chunk)).toEqual([{ type: "meeting_end" }]);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，找不到 `sse` 模块。

- [x] **Step 3: 写 SSE 工具**

Create `src/lib/cyber-office/sse.ts`:

```ts
import type { OfficeEvent } from "./types";

export function encodeSseEvent(event: OfficeEvent): string {
  // SSE 规定每条消息用空行结尾；data: 后面放我们真正要传的 JSON。
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseChunk(chunk: string): OfficeEvent[] {
  const events: OfficeEvent[] = [];
  // 网络流可能一次给半条、也可能一次给多条；这里先按行拆开，再只处理 data: 行。
  const lines = chunk.split(/\r?\n/);

  for (const line of lines) {
    // SSE 里可以有注释行、空行、event: 行；P2 只需要 data: 行。
    if (!line.startsWith("data:")) continue;

    // 去掉 data: 前缀，剩下的就是 JSON 字符串。
    const json = line.slice("data:".length).trim();
    if (!json) continue;

    // 这里断言成 OfficeEvent，是因为 JSON.parse 运行时只能返回 unknown/object；
    // 真正的事件形状由后端 encodeSseEvent 保证。
    events.push(JSON.parse(json) as OfficeEvent);
  }

  return events;
}
```

- [x] **Step 4: 运行测试**

Run:

```bash
npm run test
```

Expected: PASS，SSE helper 测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/sse.ts src/lib/cyber-office/__tests__/sse.test.ts
git commit -m "feat(cyber-office): 新增 SSE 事件编码工具"
```

---

### Task 5: 编写 Agent prompts

**Files:**
- Create: `src/lib/cyber-office/prompts.ts`

> P2 的 Agent 不是 DeepSeek 的平台级 Agent，而是“同一个模型 + 不同 system prompt + 不同上下文”。这正是多 Agent 编排最容易理解的第一版。

- [x] **Step 1: 创建 prompts 文件**

Create `src/lib/cyber-office/prompts.ts`:

```ts
import type { RoleId } from "./types";
import { getRole } from "./roles";

export interface TranscriptTurn {
  // 记录每一轮是谁说了什么，后续主持人/角色/总结都要看这份历史。
  speaker: RoleId;
  text: string;
}

export type ModeratorDecision =
  | {
      // call_on = 继续点名某个角色；这个分支必须有 speaker。
      action: "call_on";
      speaker: RoleId;
      prompt: string;
      hostText: string;
    }
  | {
      // summarize = 讨论够了，进入总结；这个分支不需要 speaker。
      action: "summarize";
      hostText: string;
    };

export function buildModeratorSystemPrompt(participants: RoleId[]): string {
  // 把参会角色转成文字名单，让主持人知道它只能点名这些人。
  const roleList = participants
    .filter((id) => id !== "host")
    .map((id) => {
      const role = getRole(id);
      return `- ${id}: ${role.name}，${role.title}`;
    })
    .join("\n");

  return [
    "你是 Cyber Office 的主持人 Agent。",
    "你负责推动一场多 Agent 圆桌讨论。",
    // 这里强制 JSON，是为了让程序能解析主持人的“调度指令”。
    // 如果主持人自由发挥，后端就不知道下一步该点谁。
    "你必须只输出 JSON，不要输出 Markdown，不要输出解释。",
    "JSON 格式只能是：",
    '{"action":"call_on","speaker":"pm","prompt":"请从产品价值角度发言","hostText":"我想先请产品经理说说用户价值。"}',
    "或：",
    '{"action":"summarize","hostText":"讨论已经充分，现在进入总结。"}',
    "可选 speaker 只能来自以下参会角色：",
    roleList,
  ].join("\n");
}

export function buildModeratorUserPrompt(
  topic: string,
  transcript: TranscriptTurn[],
): string {
  // transcript 是当前会议记忆；没有它，主持人每轮都会像第一次进会一样。
  const history = transcript
    .map((turn) => `${getRole(turn.speaker).name}: ${turn.text}`)
    .join("\n");

  return [
    `议题：${topic}`,
    "已有讨论：",
    history || "尚未开始。",
    "请决定下一步：继续点名某个角色，或进入总结。",
  ].join("\n\n");
}

export function buildRoleSystemPrompt(roleId: RoleId): string {
  const role = getRole(roleId);

  return [
    // 同一个 DeepSeek 模型，通过不同 system prompt 临时“扮演”不同 Agent。
    `你是${role.name}。`,
    `你的职责：${role.title}。`,
    "你正在参加一个多 Agent 圆桌讨论。",
    "你只能从自己的角色视角发言。",
    "发言要具体、简洁，最多 80 个中文字符。",
    "不要自称 AI，不要输出 Markdown 标题。",
  ].join("\n");
}

export function buildRoleUserPrompt(
  topic: string,
  transcript: TranscriptTurn[],
  instruction: string,
): string {
  // 角色发言时也要看到历史，这样它才能补充/反驳前面的人，而不是孤立回答。
  const history = transcript
    .map((turn) => `${getRole(turn.speaker).name}: ${turn.text}`)
    .join("\n");

  return [
    `议题：${topic}`,
    "已有讨论：",
    history || "尚未开始。",
    `主持人点名要求：${instruction}`,
    "请直接给出你的发言。",
  ].join("\n\n");
}

export function buildSummarySystemPrompt(): string {
  return [
    "你是 Cyber Office 的总结 Agent。",
    "你负责把多 Agent 圆桌讨论整理成清晰的 Markdown 结论。",
    "输出必须包含：核心结论、文章大纲、下一步行动。",
    "文字要适合放在 Chenyu 的个人技术博客作品集中。",
  ].join("\n");
}

export function buildSummaryUserPrompt(
  topic: string,
  transcript: TranscriptTurn[],
): string {
  // 总结 Agent 不参与中间发言，只在最后读取完整 transcript 后收口。
  const history = transcript
    .map((turn) => `${getRole(turn.speaker).name}: ${turn.text}`)
    .join("\n");

  return [`议题：${topic}`, "完整讨论记录：", history].join("\n\n");
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/lib/cyber-office/prompts.ts
git commit -m "feat(cyber-office): 编写 DeepSeek 多 Agent prompts"
```

---

### Task 6: 实现主持人 JSON 解析

**Files:**
- Modify: `src/lib/cyber-office/orchestrator.ts`
- Test: `src/lib/cyber-office/__tests__/orchestrator.test.ts`

> 主持人必须输出 JSON，但真实模型偶尔会包一层文字。这里先做一个小解析器，把 JSON 从文本中取出来，并校验 action/speaker。

- [x] **Step 1: 写失败测试**

Create `src/lib/cyber-office/__tests__/orchestrator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseModeratorDecision } from "@/lib/cyber-office/orchestrator";

describe("parseModeratorDecision", () => {
  it("解析 call_on 决策", () => {
    const decision = parseModeratorDecision(
      '{"action":"call_on","speaker":"bio","prompt":"请讲科学问题","hostText":"先请生信研究员说说。"}',
      ["host", "pm", "bio"],
    );

    expect(decision).toEqual({
      action: "call_on",
      speaker: "bio",
      prompt: "请讲科学问题",
      hostText: "先请生信研究员说说。",
    });
  });

  it("解析 summarize 决策", () => {
    const decision = parseModeratorDecision(
      '{"action":"summarize","hostText":"进入总结。"}',
      ["host", "pm", "bio"],
    );

    expect(decision.action).toBe("summarize");
    expect(decision.hostText).toBe("进入总结。");
  });

  it("拒绝不存在的 speaker", () => {
    expect(() =>
      parseModeratorDecision(
        '{"action":"call_on","speaker":"frontend","prompt":"请说","hostText":"请前端说。"}',
        ["host", "pm", "bio"],
      ),
    ).toThrow("Invalid moderator speaker");
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，找不到 `orchestrator` 模块。

- [x] **Step 3: 写解析器骨架**

Create `src/lib/cyber-office/orchestrator.ts`:

```ts
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { OfficeEvent, RoleId } from "./types";
import type { ModeratorDecision, TranscriptTurn } from "./prompts";

// 运行时再准备一份 Set，是为了校验模型返回的 speaker 字符串是否真的是合法角色。
const roleIds = new Set<RoleId>([
  "host",
  "pm",
  "frontend",
  "bio",
  "reviewer",
  "recorder",
  "summarizer",
]);

function extractJsonObject(text: string): unknown {
  // 模型有时会输出“好的，{...}”之类的包裹文本。
  // 这里用第一个 { 到最后一个 } 之间的内容，尽量取出真正的 JSON。
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Moderator did not return JSON");
  }

  return JSON.parse(text.slice(start, end + 1));
}

export function parseModeratorDecision(
  text: string,
  participants: RoleId[],
): ModeratorDecision {
  // JSON.parse 后 TypeScript 还不知道里面有什么字段，所以先当成未知字段对象再逐项检查。
  const value = extractJsonObject(text) as {
    action?: unknown;
    speaker?: unknown;
    prompt?: unknown;
    hostText?: unknown;
  };

  if (value.action !== "call_on" && value.action !== "summarize") {
    throw new Error("Invalid moderator action");
  }

  if (typeof value.hostText !== "string" || value.hostText.trim().length === 0) {
    throw new Error("Invalid moderator hostText");
  }

  if (value.action === "summarize") {
    // summarize 不需要 speaker，因为下一步不是点名，而是交给总结 Agent。
    return {
      action: "summarize",
      hostText: value.hostText.trim(),
    };
  }

  if (typeof value.speaker !== "string" || !roleIds.has(value.speaker as RoleId)) {
    throw new Error("Invalid moderator speaker");
  }

  const speaker = value.speaker as RoleId;

  if (!participants.includes(speaker) || speaker === "host") {
    // 主持人不能点一个没参会的人，也不能点自己。
    throw new Error("Invalid moderator speaker");
  }

  return {
    action: "call_on",
    speaker,
    prompt:
      typeof value.prompt === "string" && value.prompt.trim()
        ? value.prompt.trim()
        : "请从你的角色视角补充。",
    hostText: value.hostText.trim(),
  };
}

export interface ChatModel {
  // complete 用于主持人决策和最终总结：一次性拿完整文本。
  complete(messages: ChatCompletionMessageParam[]): Promise<string>;
  // stream 用于角色发言：边生成边吐 token，前端气泡才能逐字出现。
  stream(messages: ChatCompletionMessageParam[]): AsyncGenerator<string>;
}

export interface RunMeetingOptions {
  topic: string;
  participants: RoleId[];
  model: ChatModel;
  maxTurns?: number;
}

export async function* runMeeting(
  _options: RunMeetingOptions,
): AsyncGenerator<OfficeEvent> {
  throw new Error("runMeeting is implemented in the next task");
}
```

- [x] **Step 4: 运行测试**

Run:

```bash
npm run test
```

Expected: PASS，解析器测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/orchestrator.ts src/lib/cyber-office/__tests__/orchestrator.test.ts
git commit -m "feat(cyber-office): 解析主持人调度决策"
```

---

### Task 7: 实现 Orchestrator 事件生成

**Files:**
- Modify: `src/lib/cyber-office/orchestrator.ts`
- Modify: `src/lib/cyber-office/__tests__/orchestrator.test.ts`

> 这是 P2 的核心。Orchestrator 不直接碰 React，也不直接碰 Route Handler。它只产出 `OfficeEvent`。这样前后端仍然干净分离。

- [x] **Step 1: 写 Orchestrator 测试**

Append to `src/lib/cyber-office/__tests__/orchestrator.test.ts`:

```ts
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatModel } from "@/lib/cyber-office/orchestrator";
import { runMeeting } from "@/lib/cyber-office/orchestrator";
import { describe, it, expect } from "vitest";

class FakeModel implements ChatModel {
  private completions = [
    '{"action":"call_on","speaker":"bio","prompt":"请讲科学问题","hostText":"先请生信研究员说说。"}',
    '{"action":"summarize","hostText":"讨论足够了，进入总结。"}',
    "## 核心结论\n这是一场测试总结。",
  ];

  async complete(_messages: ChatCompletionMessageParam[]) {
    const next = this.completions.shift();
    if (!next) throw new Error("No fake completion left");
    return next;
  }

  async *stream(_messages: ChatCompletionMessageParam[]) {
    yield "空间图";
    yield "需要";
    yield "讲清楚。";
  }
}

describe("runMeeting", () => {
  it("产出完整会议事件流", async () => {
    const events = [];

    for await (const event of runMeeting({
      topic: "讨论空间转录组可视化文章",
      participants: ["host", "bio"],
      model: new FakeModel(),
      maxTurns: 3,
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "meeting_start",
      topic: "讨论空间转录组可视化文章",
      participants: ["host", "bio"],
    });
    expect(events).toContainEqual({ type: "call_on", speaker: "bio" });
    expect(events).toContainEqual({ type: "speaking_start", speaker: "bio" });
    expect(events).toContainEqual({
      type: "token",
      speaker: "bio",
      delta: "空间图",
    });
    expect(events).toContainEqual({ type: "speaking_end", speaker: "bio" });
    expect(events.at(-1)).toEqual({ type: "meeting_end" });
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，`runMeeting is implemented in the next task`。

- [x] **Step 3: 实现 runMeeting**

Modify `src/lib/cyber-office/orchestrator.ts`，补齐 imports：

```ts
import {
  buildModeratorSystemPrompt,
  buildModeratorUserPrompt,
  buildRoleSystemPrompt,
  buildRoleUserPrompt,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
} from "./prompts";
import type { ModeratorDecision, TranscriptTurn } from "./prompts";
```

Replace `runMeeting` with:

```ts
export async function* runMeeting({
  topic,
  participants,
  model,
  maxTurns = 6,
}: RunMeetingOptions): AsyncGenerator<OfficeEvent> {
  // transcript 是服务端会议记录，只存角色发言；主持人每轮会参考它来决定下一步。
  const transcript: TranscriptTurn[] = [];

  // 第一个事件负责初始化前端状态：议题、参会者、小人列表。
  yield { type: "meeting_start", topic, participants };

  for (let turn = 0; turn < maxTurns; turn++) {
    // 1. 先问主持人：根据议题和已有讨论，下一步点谁，还是进入总结？
    const moderatorText = await model.complete([
      { role: "system", content: buildModeratorSystemPrompt(participants) },
      { role: "user", content: buildModeratorUserPrompt(topic, transcript) },
    ]);

    const decision = parseModeratorDecision(moderatorText, participants);
    // host_speak 只更新页面上的主持人台词，不属于某个小人的气泡。
    yield { type: "host_speak", text: decision.hostText };

    if (decision.action === "summarize") {
      break;
    }

    const speaker = decision.speaker;
    // 2. 点名事件先让小人举手，再进入 speaking 状态。
    yield { type: "call_on", speaker };
    yield { type: "speaking_start", speaker };

    let fullText = "";
    // 这次角色发言的 prompt = 角色身份 + 会议历史 + 主持人的具体点名要求。
    const roleMessages: ChatCompletionMessageParam[] = [
      { role: "system", content: buildRoleSystemPrompt(speaker) },
      {
        role: "user",
        content: buildRoleUserPrompt(topic, transcript, decision.prompt || ""),
      },
    ];

    // 3. 模型每吐出一段 delta，就立刻 yield 一个 token 事件给前端。
    for await (const delta of model.stream(roleMessages)) {
      fullText += delta;
      yield { type: "token", speaker, delta };
    }

    // fullText 用来保存完整发言，下一轮主持人和其他角色要读它。
    transcript.push({ speaker, text: fullText });
    yield { type: "speaking_end", speaker };
  }

  // 4. 循环结束后，不管是主持人主动总结还是达到 maxTurns，都进入总结 Agent。
  const summary = await model.complete([
    { role: "system", content: buildSummarySystemPrompt() },
    { role: "user", content: buildSummaryUserPrompt(topic, transcript) },
  ]);

  yield { type: "summary", outline: summary };
  yield { type: "meeting_end" };
}
```

- [x] **Step 4: 运行测试**

Run:

```bash
npm run test
```

Expected: PASS，Orchestrator 事件流测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/orchestrator.ts src/lib/cyber-office/__tests__/orchestrator.test.ts
git commit -m "feat(cyber-office): 实现多 Agent 会议编排器"
```

---

### Task 8: 把 DeepSeek 包装成 ChatModel

**Files:**
- Modify: `src/lib/cyber-office/deepseek-client.ts`

> Orchestrator 依赖 `ChatModel` 接口，而不是直接依赖 SDK。这让测试可以用假模型，真实运行才用 DeepSeek。

- [x] **Step 1: 修改 DeepSeek 客户端**

Modify `src/lib/cyber-office/deepseek-client.ts`:

```ts
import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatModel } from "./orchestrator";

// 所有 DeepSeek 调用都集中在这个文件，避免 API Key 和 SDK 细节散落到别处。
export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL?.trim() || "deepseek-chat";

export function createDeepSeekClient() {
  // process.env 只能在服务端安全读取；这个文件顶部的 server-only 会阻止客户端误 import。
  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.deepseek.com",
  });
}

export function createDeepSeekChatModel(): ChatModel {
  const client = createDeepSeekClient();

  return {
    async complete(messages: ChatCompletionMessageParam[]) {
      // complete 用在“主持人决策”和“最终总结”，所以不需要 stream。
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: 600,
      });

      // SDK 返回 choices 数组；P2 只取第一个候选答案。
      return response.choices[0]?.message?.content?.trim() || "";
    },

    async *stream(messages: ChatCompletionMessageParam[]) {
      // stream 用在角色发言：DeepSeek 会不断返回 chunk，页面气泡才能同步增长。
      const stream = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 220,
        stream: true,
      });

      for await (const chunk of stream) {
        // OpenAI-compatible 流式响应里，新增文字通常放在 delta.content。
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      }
    },
  };
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/lib/cyber-office/deepseek-client.ts
git commit -m "feat(cyber-office): 封装 DeepSeek ChatModel"
```

---

### Task 9: 创建 SSE Route Handler

**Files:**

- Create: `src/app/api/cyber-office/run/route.ts`

> Next.js 16 的 Route Handler 使用 Web `Request`/`Response`。这里用 `ReadableStream` 手写 SSE，保证每个 `OfficeEvent` 立即推给浏览器。

- [ ] **Step 1: 创建 route.ts**

Create `src/app/api/cyber-office/run/route.ts`:

```ts
import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { parseRunMeetingRequest } from "@/lib/cyber-office/live-schema";
import { runMeeting } from "@/lib/cyber-office/orchestrator";
import { encodeSseEvent } from "@/lib/cyber-office/sse";
import type { OfficeEvent } from "@/lib/cyber-office/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// TextEncoder 把字符串转成 Uint8Array，ReadableStream 只能 enqueue 字节数据。
const encoder = new TextEncoder();

function streamEvent(controller: ReadableStreamDefaultController, event: OfficeEvent) {
  // 每个 OfficeEvent 都先变成 SSE 文本，再编码成字节推给浏览器。
  controller.enqueue(encoder.encode(encodeSseEvent(event)));
}

export async function POST(request: Request) {
  // request.json() 可能因为非法 JSON 失败；catch 后交给 schema 统一返回 400。
  const body = await request.json().catch(() => null);
  const parsed = parseRunMeetingRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // 真正的 DeepSeek client 只在请求开始后、服务端内部创建。
        const model = createDeepSeekChatModel();

        // runMeeting 是异步生成器：每生成一个 OfficeEvent，就立刻写入 SSE。
        for await (const event of runMeeting({
          topic: parsed.data.topic,
          participants: parsed.data.participants,
          model,
          maxTurns: 6,
        })) {
          streamEvent(controller, event);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "DeepSeek meeting failed";

        // 即使后端出错，也尽量用 OfficeEvent 的 error 事件告诉前端，而不是直接断流。
        streamEvent(controller, { type: "error", message });
      } finally {
        // close 告诉浏览器：这场会议的 SSE 流结束了。
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      // text/event-stream 是 SSE 必需的 Content-Type。
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 无 Key 情况下手动验证错误路径**

Temporarily remove `DEEPSEEK_API_KEY` from `.env.local` or rename it, then run:

```bash
npm run dev
```

Open another terminal:

```bash
curl -N -X POST http://localhost:3000/api/cyber-office/run ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\":\"讨论空间转录组可视化文章大纲\",\"participants\":[\"host\",\"bio\",\"pm\"]}"
```

Expected: SSE 返回一条 error 事件，包含 `Missing DEEPSEEK_API_KEY`。

- [x] **Step 4: 恢复 Key 并验证真实流**

Put `DEEPSEEK_API_KEY` back into `.env.local`，重启 dev server，再运行同一个 curl。

Expected: 终端持续输出多条：

```txt
data: {"type":"meeting_start",...}
data: {"type":"host_speak",...}
data: {"type":"call_on",...}
data: {"type":"token",...}
```

- [x] **Step 5: 提交**

```bash
git add src/app/api/cyber-office/run/route.ts
git commit -m "feat(cyber-office): 新增 DeepSeek 实时会议 API"
```

---

### Task 10: 前端实现 useLiveMeeting

**Files:**
- Create: `src/components/cyber-office/use-live-meeting.ts`

> 不能用浏览器原生 `EventSource`，因为它只适合 GET；我们需要 POST 议题，所以用 `fetch` 读取 `ReadableStream`。

- [x] **Step 1: 创建 hook**

Create `src/components/cyber-office/use-live-meeting.ts`:

```ts
"use client";

import { useCallback, useReducer, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import type { RoleId } from "@/lib/cyber-office/types";
import { parseSseChunk } from "@/lib/cyber-office/sse";

export function useLiveMeeting() {
  // 实时会议和回放一样，也用同一个 reducer 消费 OfficeEvent。
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  // isRunning 只控制按钮禁用/文案，不存会议内容；会议内容都在 state 里。
  const [isRunning, setIsRunning] = useState(false);

  const start = useCallback(async (topic: string, participants: RoleId[]) => {
    // 开新会前清空旧会，避免上一场 summary 或气泡残留。
    dispatch({ type: "reset" });
    setIsRunning(true);

    try {
      // 这里用 POST，因为要把用户输入的 topic 和 participants 放进请求体。
      const response = await fetch("/api/cyber-office/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, participants }),
      });

      if (!response.ok || !response.body) {
        dispatch({
          type: "error",
          message: "实时会议启动失败，请稍后再试。",
        });
        return;
      }

      // response.body 是浏览器拿到的流；reader 可以一段一段读后端推来的字节。
      const reader = response.body.getReader();
      // TextDecoder 把 Uint8Array 字节还原成字符串。
      const decoder = new TextDecoder();
      // buffer 保存“还没凑成完整 SSE 消息”的半截文本。
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        // stream: true 表示这不是最后一段，decoder 要保留跨 chunk 的字符状态。
        buffer += decoder.decode(value, { stream: true });
        // SSE 每条消息用空行分隔，所以按 \n\n 切。
        const parts = buffer.split("\n\n");
        // 最后一段可能是不完整消息，先放回 buffer，等下一次网络 chunk 补齐。
        buffer = parts.pop() || "";

        for (const part of parts) {
          for (const event of parseSseChunk(`${part}\n\n`)) {
            // 每解析出一个 OfficeEvent，就交给 reducer 更新画面。
            dispatch(event);
          }
        }
      }

      if (buffer.trim()) {
        // 流结束时如果 buffer 里还剩最后一条消息，也要解析掉。
        for (const event of parseSseChunk(buffer)) {
          dispatch(event);
        }
      }
    } catch {
      dispatch({
        type: "error",
        message: "网络连接中断，请稍后再试。",
      });
    } finally {
      setIsRunning(false);
    }
  }, []);

  return { state, isRunning, start };
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/use-live-meeting.ts
git commit -m "feat(cyber-office): 前端消费实时会议 SSE"
```

---

### Task 11: 顶层组件接入回放和实时两种模式

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

> P2 页面有两个入口：播放样本会议用于零成本演示；实时运行用于本地/受控体验。P3 再处理默认回放和正式上线限流。

- [x] **Step 1: 替换 CyberOffice 组件**

Replace `src/components/cyber-office/cyber-office.tsx` with:

```tsx
"use client";

import { useMemo, useState } from "react";
import OfficeScene from "./office-scene";
import { useReplay } from "./use-replay";
import { useLiveMeeting } from "./use-live-meeting";
import { SAMPLE_MEETING } from "@/lib/cyber-office/sample-meeting";
import type { MeetingState, RoleId } from "@/lib/cyber-office/types";

// P2 先固定参会角色；P5 再做用户自定义角色。
const LIVE_PARTICIPANTS: RoleId[] = ["host", "pm", "frontend", "bio", "reviewer"];

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

function HostLine({ state }: { state: MeetingState }) {
  // error 也走 MeetingState，这样后端错误能显示在同一套 UI 里。
  if (state.error) {
    return (
      <p className="text-center text-sm text-accent">
        {state.error}
      </p>
    );
  }

  if (!state.hostText) return null;

  return (
    <p className="text-center text-sm italic text-text-muted">
      主持人：{state.hostText}
    </p>
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
  const canRunLive = topic.trim().length >= 6 && !busy;

  const helperText = useMemo(() => {
    // useMemo 只是避免每次渲染都重新算这段提示文字；这里不是必须，但语义清楚。
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
              setMode("replay");
              replay.start();
            }}
            disabled={busy}
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
        </div>
      </div>

      <HostLine state={state} />
      <OfficeScene state={state} />
      <SummaryPanel summary={state.summary} />
    </div>
  );
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 接入实时 DeepSeek 会议入口"
```

---

### Task 12: 本地完整验证

**Files:**
- No code changes unless a previous task fails.

- [x] **Step 1: 跑单元测试**

Run:

```bash
npm run test
```

Expected: 全部测试通过。

- [x] **Step 2: 跑类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 跑生产构建**

Run:

```bash
npm run build
```

Expected: 构建成功，路由列表包含 `/cyber-office` 和 `/api/cyber-office/run`。

- [x] **Step 4: 浏览器验证样本回放**

Run:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/cyber-office
```

Expected:
- 点击「播放样本会议」仍能完整回放 P1 剧本。
- 第二次点击不会残留上一轮 Summary。

- [x] **Step 5: 浏览器验证实时会议**

Ensure `.env.local` has:

```bash
DEEPSEEK_API_KEY=你的_DeepSeek_API_Key
DEEPSEEK_MODEL=deepseek-chat
```

Restart dev server, open `/cyber-office`，输入：

```txt
帮我讨论一篇面向生信初学者的空间转录组可视化博客大纲
```

Click:

```txt
实时运行 DeepSeek 会议
```

Expected:
- 主持人台词出现。
- 被点名角色举手。
- 角色气泡逐字出现真实 DeepSeek 生成内容。
- 至少 1-3 个角色发言后出现 Summary。
- API Key 不出现在浏览器 DevTools 的请求 payload 或页面源码中。

- [x] **Step 6: 提交验证修复**

If this task required fixes:

```bash
git add <fixed-files>
git commit -m "fix(cyber-office): 修复 P2 实时会议验证问题"
```

If no fixes were needed, no commit is required.

---

## P2 理解检查点

做完 P2 后，合上代码回答：

1. 为什么前端不能直接调用 DeepSeek API？API Key 如果放到客户端会发生什么？

   *浏览器环境（客户端）对用户是完全透明的。如果将 API Key 打包进前端代码，任何人都可以通过按 F12 打开开发者工具，在源码（Bundle）或网络请求（Network）抓包中轻易提取出该 Key。 API Key 本质上是计费和权限的无记名凭证。一旦泄露，恶意攻击者可以盗用你的额度进行高并发请求，导致你的账户资金被刷爆或因滥用被封禁。因此，鉴权与外部 API 调用必须在受控的受信任环境（服务器端）进行。*

   

2. 为什么 P2 继续用 `OfficeEvent`，而不是让后端直接返回一大段 Markdown？

   *这本质上是**状态管理与视图渲染的解耦（关注点分离）**。 后端返回 Markdown 仅仅是传递了最终的“死文本”，前端只能做纯静态展示。而 `OfficeEvent` 是一个结构化的状态机事件流（如 `host_speak`、`speaking_start`、`token`）。前端需要这些细粒度的语义事件来驱动复杂的 UI 交互，例如：触发对应角色的高亮、控制像素小人的举手动画、实现打字机效果等。用 Markdown 会直接抹杀掉对前端 UI 进行动态微操的可能性。*

   

3. 为什么原生 `EventSource` 不适合这里，而 `fetch + ReadableStream` 更合适？

   *原生 `EventSource` 不适合大模型流式场景，核心原因只有三个：*

   1. ***仅支持 GET 请求**：启动会议需要传递长文本议题和角色数组，标准做法是用 `POST` 放在请求体（Body）中。`EventSource` 强行用 GET 把复杂数据塞入 URL，极易超出网关长度限制。*
   2. ***致命的自动重连机制**：一旦网络闪断，`EventSource` 会静默发起重连。在 LLM 场景下，这会引发后端**重复执行模型推理**，导致前端文本错乱叠加，并白白浪费大量 Token。`fetch` 则是一次性的，将异常处理权交还给代码。*
   3. ***无法自定义 Header**：`EventSource` 无法携带自定义鉴权头（如 `Authorization`），这让后续系统做 API 保护和限流变得极其困难；而 `fetch` 拥有 100% 的网络控制权。*

   

4. Orchestrator 为什么依赖 `ChatModel` 接口，而不是直接 import DeepSeek client？、

   *遵循**依赖倒置原则（Dependency Inversion Principle）**。 如果直接 import DeepSeek SDK，业务核心（编排器）就被死死绑定在了某一个具体的外部基础设施上。引入 `ChatModel` 接口有两大直接价值：*

   1. ***测试隔离**：在运行单元测试时，可以注入一个完全不需要消耗真实网络和 token 费用的 `FakeModel`，保证测试的快速与稳定。*

   2. ***架构可扩展**：未来如果要切换到 OpenAI、Claude 或是本地部署的开源模型，只需要新增一个实现了 `ChatModel` 接口的客户端类即可，编排器的核心代码一行都不用改。*

      

5. 主持人 Agent 输出 JSON 的意义是什么？如果主持人自由发挥，会给编排器带来什么问题？

   *这是为了弥合**大模型的不确定性（随机性）与代码逻辑的确定性**之间的鸿沟。 编排器是一个严格的有限状态机，它必须明确知道“下一步该谁发言”或“是否进入总结”。大语言模型默认输出自然语言，如果让其自由发挥，它可能输出“接下来请产品经理解释一下”或“PM，轮到你了”。由于缺乏严格的结构，系统需要使用脆弱的正则表达式（脏补丁）去猜测其意图，极易发生崩溃或死循环。 强制输出 JSON，就是给 LLM 施加强契约。通过校验 `action` 和 `speaker` 字段，编排器可以安全、确定地反序列化数据并执行后续的调度逻辑。*

---

## 完成标准

- [x] `/cyber-office` 仍能播放 P1 样本回放。
- [x] `/api/cyber-office/run` 能返回 SSE 格式的真实 `OfficeEvent`。
- [x] 点击「实时运行 DeepSeek 会议」能看到真实生成的圆桌讨论。
- [x] DeepSeek API Key 只在服务端读取，不进入客户端 bundle。
- [x] `npm run test` 通过。
- [x] `npx tsc --noEmit` 通过。
- [x] `npm run build` 通过。
- [x] 没有引入 P3 范围的限流、每日预算、KV 依赖。

下一阶段 P3 再做：回放默认、实时按钮受限流保护、单 IP/每日预算、额度耗尽时自动降级回放。
