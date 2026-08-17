import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatModel } from "./orchestrator";
import { LIVE_MEETING_LIMITS } from "./limits";

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
    async complete(
      messages: ChatCompletionMessageParam[],
      options?: { maxTokens?: number; responseFormat?: "json" },
    ) {
      // complete 用在“主持人决策”和“最终总结”，所以不需要 stream。
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.4,
        max_tokens:
          options?.maxTokens ?? LIVE_MEETING_LIMITS.moderatorMaxTokens,
        // 主持人决策必须是 JSON。只靠提示词“请求”模型输出 JSON 并不可靠，
        // 它偶尔会多写一句解释甚至返回空；开启 JSON 模式由 API 层面强制保证格式。
        ...(options?.responseFormat === "json"
          ? { response_format: { type: "json_object" as const } }
          : {}),
      });

      // SDK 返回 choices 数组；P2 只取第一个候选答案。
      return response.choices[0]?.message?.content?.trim() || "";
    },

    async *stream(messages: ChatCompletionMessageParam[]) {
      // stream 用在角色发言：DeepSeek 会不断返回 chunk，页面气泡才能同步增长。
      const stream = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        // 角色发言要有个性，温度调高让措辞和视角散开。
        // 主持人的 complete 保持低温（0.4）——它要输出稳定的 JSON，不能发挥。
        temperature: 0.8,
        max_tokens: LIVE_MEETING_LIMITS.roleMaxTokens,
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
