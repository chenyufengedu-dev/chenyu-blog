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
  // JSON.parse 后 TypeScript 还不知道里面有什么字段，所以先当成 Partial 再逐项检查。
  const value = extractJsonObject(text) as Partial<ModeratorDecision>;

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

  if (!value.speaker || !roleIds.has(value.speaker)) {
    throw new Error("Invalid moderator speaker");
  }

  if (!participants.includes(value.speaker) || value.speaker === "host") {
    // 主持人不能点一个没参会的人，也不能点自己。
    throw new Error("Invalid moderator speaker");
  }

  return {
    action: "call_on",
    speaker: value.speaker,
    prompt: value.prompt?.trim() || "请从你的角色视角补充。",
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
