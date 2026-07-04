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
