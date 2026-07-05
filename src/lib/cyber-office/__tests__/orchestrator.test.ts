import type { ChatModel } from "@/lib/cyber-office/orchestrator";
import { runMeeting } from "@/lib/cyber-office/orchestrator";
import { describe, it, expect } from "vitest";

class FakeModel implements ChatModel {
  private completions = [
    '{"action":"call_on","speaker":"bio","prompt":"请讲科学问题","hostText":"先请生信研究员说说。"}',
    '{"action":"summarize","hostText":"讨论足够了，进入总结。"}',
    "## 核心结论\n这是一场测试总结。",
  ];

  async complete() {
    const value = this.completions.shift();
    if (!value) throw new Error("No fake complete response");
    return value;
  }

  async *stream() {
    yield "空间图";
    yield "需要";
    yield "讲清楚。";
  }
}

describe("runMeeting", () => {
  it("产出完整会议事件流", async () => {
    const events = [];

    for await (const event of runMeeting({
      topic: "讨论空间转录组可视化文章",
      participants: ["host", "bio"],
      model: new FakeModel(),
      maxTurns: 3,
    })) {
      events.push(event);
    }

    expect(events[0]).toEqual({
      type: "meeting_start",
      topic: "讨论空间转录组可视化文章",
      participants: ["host", "bio"],
    });
    expect(events).toContainEqual({ type: "call_on", speaker: "bio" });
    expect(events).toContainEqual({ type: "speaking_start", speaker: "bio" });
    expect(events).toContainEqual({
      type: "token",
      speaker: "bio",
      delta: "空间图",
    });
    expect(events).toContainEqual({ type: "speaking_end", speaker: "bio" });
    expect(events.at(-1)).toEqual({ type: "meeting_end" });
  });
});
