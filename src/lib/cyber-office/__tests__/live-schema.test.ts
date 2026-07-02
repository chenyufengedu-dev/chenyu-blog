import { describe, expect, it } from "vitest";
import { parseRunMeetingRequest } from "@/lib/cyber-office/live-schema";

describe("parseRunMeetingRequest", () => {
  it("接受合法议题和角色", () => {
    const result = parseRunMeetingRequest({
      topic: "讨论空间转录组可视化文章大纲",
      participants: ["host", "pm", "frontend", "bio", "reviewer"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.topic).toBe("讨论空间转录组可视化文章大纲");
      expect(result.data.participants).toContain("host");
    }
  });

  it("拒绝过短议题", () => {
    const result = parseRunMeetingRequest({
      topic: "短",
      participants: ["host", "pm"],
    });

    expect(result.ok).toBe(false);
  });

  it("自动补上 host，并去掉重复角色", () => {
    const result = parseRunMeetingRequest({
      topic: "讨论一个足够长的博客选题",
      participants: ["pm", "pm", "bio"],
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.participants).toEqual(["host", "pm", "bio"]);
    }
  });
});
