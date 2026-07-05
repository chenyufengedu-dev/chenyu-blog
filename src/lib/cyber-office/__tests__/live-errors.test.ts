import { describe, expect, it } from "vitest";
import {
  PublicLiveMeetingError,
  toPublicLiveMeetingError,
} from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";

describe("live meeting public errors", () => {
  it("保留已经是 PublicLiveMeetingError 的错误", () => {
    const error = new PublicLiveMeetingError({
      code: "rate_limited",
      message: LIVE_MEETING_MESSAGES.rateLimited,
      status: 429,
      retryAfter: 60,
    });

    expect(toPublicLiveMeetingError(error)).toBe(error);
  });

  it("把缺少 DeepSeek Key 的内部错误转成配置错误", () => {
    const error = toPublicLiveMeetingError(
      new Error("Missing DEEPSEEK_API_KEY"),
    );

    expect(error.status).toBe(503);
    expect(error.code).toBe("config_missing");
    expect(error.message).toBe(LIVE_MEETING_MESSAGES.configMissing);
  });

  it("普通异常不会把原始 message 暴露给前端", () => {
    const error = toPublicLiveMeetingError(
      new Error("Redis token leaked detail"),
    );

    expect(error.status).toBe(502);
    expect(error.code).toBe("provider_failed");
    expect(error.message).toBe(LIVE_MEETING_MESSAGES.deepseekFailed);
  });
});
