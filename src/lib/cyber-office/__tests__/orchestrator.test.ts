import { describe, expect, it } from "vitest";
import { parseModeratorDecision } from "@/lib/cyber-office/orchestrator";

describe("parseModeratorDecision", () => {
  it("解析 call_on 决策", () => {
    const decision = parseModeratorDecision(
      '{"action":"call_on","speaker":"bio","prompt":"请讲科学问题","hostText":"先请生信研究员说说。"}',
      ["host", "pm", "bio"],
    );

    expect(decision).toEqual({
      action: "call_on",
      speaker: "bio",
      prompt: "请讲科学问题",
      hostText: "先请生信研究员说说。",
    });
  });

  it("解析 summarize 决策", () => {
    const decision = parseModeratorDecision(
      '{"action":"summarize","hostText":"进入总结。"}',
      ["host", "pm", "bio"],
    );

    expect(decision.action).toBe("summarize");
    expect(decision.hostText).toBe("进入总结。");
  });

  it("拒绝不存在的 speaker", () => {
    expect(() =>
      parseModeratorDecision(
        '{"action":"call_on","speaker":"frontend","prompt":"请说","hostText":"请前端说。"}',
        ["host", "pm", "bio"],
      ),
    ).toThrow("Invalid moderator speaker");
  });
});
