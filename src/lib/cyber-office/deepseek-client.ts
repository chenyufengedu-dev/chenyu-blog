import "server-only";
import OpenAI from "openai";

// 模型名从环境变量读取，方便将来从 deepseek-v4-flash 切到别的模型时不用改代码。
export const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-flash";

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
