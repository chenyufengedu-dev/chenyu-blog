import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { OfficeEvent, RoleId } from "./types";
import {
  buildModeratorSystemPrompt,
  buildModeratorUserPrompt,
  buildRoleSystemPrompt,
  buildRoleUserPrompt,
  buildSummarySystemPrompt,
  buildSummaryUserPrompt,
} from "./prompts";
import type { ModeratorDecision, TranscriptTurn } from "./prompts";
import { LIVE_MEETING_LIMITS, LIVE_MEETING_MESSAGES } from "./limits";

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
  // JSON.parse 后 TypeScript 还不知道里面有什么字段，所以先当成 Partial 再逐项检查。
  const value = extractJsonObject(text) as {
    action?: unknown;
    speaker?: unknown;
    prompt?: unknown;
    hostText?: unknown;
  };

  if (value.action !== "call_on" && value.action !== "summarize") {
    throw new Error("Invalid moderator action");
  }

  if (
    typeof value.hostText !== "string" ||
    value.hostText.trim().length === 0
  ) {
    throw new Error("Invalid moderator hostText");
  }

  if (value.action === "summarize") {
    // summarize 不需要 speaker，因为下一步不是点名，而是交给总结 Agent。
    return {
      action: "summarize",
      hostText: value.hostText.trim(),
    };
  }

  if (
    typeof value.speaker !== "string" ||
    !roleIds.has(value.speaker as RoleId)
  ) {
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
  complete(
    messages: ChatCompletionMessageParam[],
    // responseFormat: "json" 会让底层开启 JSON 模式，强制模型只输出合法 JSON。
    options?: { maxTokens?: number; responseFormat?: "json" },
  ): Promise<string>;
  // stream 用于角色发言：边生成边吐 token，前端气泡才能逐字出现。
  stream(messages: ChatCompletionMessageParam[]): AsyncIterable<string>;
}

export interface RunOneTurnOptions {
  topic: string;
  participants: RoleId[];
  model: ChatModel;
  transcript: TranscriptTurn[]; // 已有会议历史；主持人和角色都要读它
  turn: number; // 当前是第几轮，从 0 开始
  maxTurns?: number;
  decision?: ModeratorDecision; // 可选：直接指定本轮决策，跳过"问主持人"（人在回路用）
}

// 问主持人要本轮的调度决策。
//
// 大模型的输出天生不保证格式，实测遇到过两种失败：
//   ① 返回空字符串 —— DeepSeek 官方文档承认 JSON 模式偶发返回空内容；
//   ② JSON 写到一半被截断 —— max_tokens 不够（已在 limits.ts 调到 700）。
//
// 对策是"换策略重试"：第 2 次尝试**关掉 JSON 模式**改用普通模式。
// 之所以可行，是因为 parseModeratorDecision 用的 extractJsonObject 是
// "从第一个 { 找到最后一个 }"，纯文本里夹着 JSON 它照样能解析出来。
// 这样两种失败模式互为备份，不会一条路走到黑。
async function askModeratorDecision(
  model: ChatModel,
  topic: string,
  participants: RoleId[],
  transcript: TranscriptTurn[],
): Promise<ModeratorDecision> {
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildModeratorSystemPrompt(participants) },
    { role: "user", content: buildModeratorUserPrompt(topic, transcript) },
  ];

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    // 第 2 次（attempt === 1）故意不用 JSON 模式，对冲"JSON 模式返回空"。
    const useJsonMode = attempt !== 1;

    const text = await model.complete(messages, {
      maxTokens: LIVE_MEETING_LIMITS.moderatorMaxTokens,
      responseFormat: useJsonMode ? "json" : undefined,
    });

    try {
      return parseModeratorDecision(text, participants);
    } catch (error) {
      lastError = error;
      // 打印模型到底返回了什么，方便排查；截断避免刷屏。
      console.warn("[cyber-office] 主持人输出不合法，重试", {
        attempt,
        jsonMode: useJsonMode,
        text: text.slice(0, 200),
      });
    }
  }

  throw lastError;
}

/**
 * 主持人彻底失灵时的兜底调度。
 *
 * 为什么需要：主持人只是"调度器"，它抖一下不该让整场会议崩掉。
 * 之前一失败就抛异常 → 路由发 error → 前端中断，用户只能重来，
 * 而重来同样可能在第二三轮再挂一次。
 *
 * 规则很笨但绝对可靠：还有没发过言的人就点他；都发过了（或已到轮数上限）就收口。
 * 返回值必须满足和模型输出一样的约束——speaker 必须是本场参会者且不能是主持人。
 */
function fallbackDecision(
  participants: RoleId[],
  transcript: TranscriptTurn[],
  turn: number,
  maxTurns: number,
): ModeratorDecision {
  const spoken = new Set(transcript.map((t) => t.speaker));
  const next = participants.find((id) => id !== "host" && !spoken.has(id));

  if (!next || turn >= maxTurns - 1) {
    return { action: "summarize", hostText: "时间差不多了，我们收个尾。" };
  }

  return {
    action: "call_on",
    speaker: next,
    prompt: "请从你的角色视角说说你的判断。",
    hostText: "接下来听听你的看法。",
  };
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
    try {
      decision = await askModeratorDecision(
        model,
        topic,
        participants,
        transcript,
      );
    } catch (error) {
      // 主持人三次都没给出可用决策 —— 不让它拖垮整场会议，退回确定性调度。
      // 这里只降级、不中断；真正的故障（网络、鉴权、角色发言失败）仍会照常抛出。
      console.warn(
        "[cyber-office] 主持人连续失败，改用兜底调度继续会议",
        error,
      );
      decision = fallbackDecision(participants, transcript, turn, maxTurns);
    }
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
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: buildSummarySystemPrompt() },
    { role: "user", content: buildSummaryUserPrompt(topic, transcript) },
  ];
  const options = { maxTokens: LIVE_MEETING_LIMITS.summaryMaxTokens };

  let summary = await model.complete(messages, options);

  // 空返回是偶发的（和主持人那边是同一个毛病），重试一次基本就好了。
  if (!summary) {
    console.warn("[cyber-office] 总结返回空，重试一次");
    summary = await model.complete(messages, options);
  }

  if (!summary) {
    // 关键：不能发一个 outline 为空的 summary 事件就当成功了。
    // 那样前端的 SummaryPanel 拿到空字符串会静默不渲染，
    // 用户看到的是"会议完成 ✓ + 下面什么都没有"，完全不知道出了什么事。
    yield { type: "error", message: LIVE_MEETING_MESSAGES.deepseekFailed };
    return;
  }

  yield { type: "summary", outline: summary };
  yield { type: "meeting_end" };
}

export interface RunMeetingOptions {
  topic: string;
  participants: RoleId[];
  model: ChatModel;
  maxTurns?: number;
}
//function*（带有星号的 function）用来声明一个生成器函数: 可以暂停执行并随时恢复。它可以在执行过程中通过 yield 关键字，分批次地、多次地“吐出”（返回）多个值。
export async function* runMeeting({
  topic,
  participants,
  model,
  maxTurns = 6,
}: RunMeetingOptions): AsyncGenerator<OfficeEvent> {
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
}
