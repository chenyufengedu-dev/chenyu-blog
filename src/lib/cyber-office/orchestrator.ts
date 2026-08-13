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
import { LIVE_MEETING_LIMITS } from "./limits";

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
    options?: { maxTokens?: number },
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
