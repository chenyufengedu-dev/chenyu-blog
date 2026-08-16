import type { RoleId } from "./types";
import { getRole } from "./roles";
// ModeratorDecision 已移到 types.ts（它要在事件流/状态里流动）；这里重新导出，保持旧引用路径可用。
export type { ModeratorDecision } from "./types";

export interface TranscriptTurn {
  // 记录每一轮是谁说了什么，后续主持人/角色/总结都要看这份历史。
  speaker: RoleId;
  text: string;
}

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
    "发言控制在 60 个中文字符以内，一到两句话讲完。",
    "要把观点讲清楚：给出判断和理由，别只抛结论。",
    "但不要铺垫、不要复述别人说过的话、不要客套。",
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
    "几位专家刚围绕用户的问题开完一场圆桌会议，现在由你收口，产出一份能直接用的方案。",
    "",
    "严格按以下 Markdown 结构输出，标题原样保留：",
    "",
    "## 结论",
    "一到两句话直接回答用户的问题。不要铺垫，不要复述问题。",
    "",
    "## 为什么",
    "2-3 条关键判断。每条注明是哪位专家的视角，例如「（生信研究员）」。",
    "",
    "## 争议点",
    "讨论中出现的分歧与取舍，写清楚各方在争什么、代价是什么。",
    "若确实没有分歧，写「本次讨论未出现明显分歧」，不要编造。",
    "",
    "## 怎么做",
    "3-5 条具体可执行的步骤，要有对象和动作，不要写「加强」「优化」这类空话。",
    "",
    "## 先做这一件",
    "从上面挑出成本最低、能最快验证方向的那一步，一句话说清。",
    "",
    // 有输出长度上限，写太长会被从中间硬截断。宁可精炼，也必须五段都写完。
    "全文控制在 700 字以内，五个部分都要写完，不要写到一半停下。",
    "结论必须建立在上面的讨论记录之上，不要引入讨论里没出现过的新主张。",
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

  return [
    `用户的问题：${topic}`,
    "专家们的完整讨论记录：",
    history,
    "请基于以上讨论，按规定结构给出方案，直接回答用户的问题。",
  ].join("\n\n");
}
