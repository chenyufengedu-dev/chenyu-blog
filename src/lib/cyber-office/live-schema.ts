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

//unknown 是 TypeScript 提供的一种安全隔离机制。它表示“我知道这里有个数据，但在我明确验明它的正身之前，系统绝对不允许我读取它的任何属性”。这强制开发者必须编写验证逻辑。
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
  const deduped = Array.from(
    new Set<RoleId>(["host", ...parsed.data.participants]),
  );
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
