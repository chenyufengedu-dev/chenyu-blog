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
    // 把主持人这一轮的真实决策原样发给前端，编排面板据此展示“AI 如何调度”。
    yield { type: "moderator_decision", decision };

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
