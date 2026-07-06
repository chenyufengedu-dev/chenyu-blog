import { describe, expect, it } from "vitest";
import {
  consumeDailyLiveRunBudget,
  getClientIp,
  getUtcDateKey,
  secondsUntilNextUtcDay,
} from "@/lib/cyber-office/rate-limit";

describe("rate-limit helpers", () => {
  it("优先从 x-forwarded-for 取第一个 IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });

    expect(getClientIp(request)).toBe("1.1.1.1");
  });

  it("没有代理头时使用 anonymous", () => {
    const request = new Request("https://example.com");

    expect(getClientIp(request)).toBe("anonymous");
  });

  it("生成 UTC 日期 key", () => {
    const date = new Date("2026-07-04T23:30:00.000Z");

    expect(getUtcDateKey(date)).toBe("2026-07-04");
  });

  it("计算距离下一个 UTC 零点的秒数", () => {
    const date = new Date("2026-07-04T23:59:30.000Z");

    expect(secondsUntilNextUtcDay(date)).toBe(30);
  });

  it("每日预算第一次计数时设置过期时间", async () => {
    const calls: string[] = [];
    const store = {
      async incr(key: string) {
        calls.push(`incr:${key}`);
        return 1;
      },
      async expire(key: string, seconds: number) {
        calls.push(`expire:${key}:${seconds}`);
        return 1;
      },
    };

    const result = await consumeDailyLiveRunBudget(
      store,
      new Date("2026-07-04T23:59:30.000Z"),
      30,
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
    expect(calls).toEqual([
      "incr:cyber-office:live:daily:2026-07-04",
      "expire:cyber-office:live:daily:2026-07-04:30",
    ]);
  });
});
