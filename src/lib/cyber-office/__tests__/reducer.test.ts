import { describe, it, expect } from "vitest";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

describe("applyEvent", () => {
  it("meeting_start 初始化参会者且所有人 idle", () => {
    const s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "测试议题",
      participants: ["host", "pm"],
    });
    expect(s.phase).toBe("running");
    expect(s.topic).toBe("测试议题");
    expect(s.roles["pm"].status).toBe("idle");
  });

  it("call_on 让被点名者举手并成为 activeSpeaker", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "t",
      participants: ["host", "pm"],
    });
    s = applyEvent(s, { type: "call_on", speaker: "pm" });
    expect(s.roles["pm"].status).toBe("raising_hand");
    expect(s.activeSpeaker).toBe("pm");
  });

  it("token 把文字逐段追加进气泡", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "t",
      participants: ["host", "pm"],
    });
    s = applyEvent(s, { type: "speaking_start", speaker: "pm" });
    s = applyEvent(s, { type: "token", speaker: "pm", delta: "你" });
    s = applyEvent(s, { type: "token", speaker: "pm", delta: "好" });
    expect(s.roles["pm"].bubble).toBe("你好"); // 两个 token 拼起来
    expect(s.roles["pm"].status).toBe("speaking");
  });

  it("speaking_end 让发言者回到 idle", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "t",
      participants: ["host", "pm"],
    });
    s = applyEvent(s, { type: "speaking_start", speaker: "pm" });
    s = applyEvent(s, { type: "speaking_end", speaker: "pm" });
    expect(s.roles["pm"].status).toBe("idle");
  });

  it("summary 与 meeting_end 正确收尾", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "t",
      participants: ["host"],
    });
    s = applyEvent(s, { type: "summary", outline: "## 大纲" });
    s = applyEvent(s, { type: "meeting_end" });
    expect(s.summary).toBe("## 大纲");
    expect(s.phase).toBe("ended");
  });

  it("reset 会回到空白初始状态", () => {
    let s = applyEvent(createInitialState(), {
      type: "meeting_start",
      topic: "旧议题",
      participants: ["host", "pm"],
    });
    s = applyEvent(s, { type: "host_speak", text: "旧主持人台词" });
    s = applyEvent(s, { type: "summary", outline: "旧总结" });

    const reset = applyEvent(s, { type: "reset" });

    expect(reset).toEqual(createInitialState());
  });
});
