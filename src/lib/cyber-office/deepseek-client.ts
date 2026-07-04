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
