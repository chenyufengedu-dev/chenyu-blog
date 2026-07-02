import { describe, expect, it } from "vitest";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { encodeSseEvent, parseSseChunk } from "@/lib/cyber-office/sse";

describe("SSE helpers", () => {
  it("把 OfficeEvent 编码成 SSE data 行", () => {
    const event: OfficeEvent = { type: "host_speak", text: "你好" };
    // 明确后端的输出格式: SSE 规范要求每个事件都以 data: 开头，后面跟 JSON 字符串，最后以两个换行符结尾。
    expect(encodeSseEvent(event)).toBe(
      'data: {"type":"host_speak","text":"你好"}\n\n',
    );
  });

  it("从 SSE chunk 解析 OfficeEvent", () => {
    const chunk = 'data: {"type":"token","speaker":"pm","delta":"你"}\n\n';
    //基础解析：明确前端的输入解析, SSE chunk 可能包含多行 data 行，每行都是一个 JSON 字符串，解析时需要把它们合并成一个数组。
    expect(parseSseChunk(chunk)).toEqual([
      { type: "token", speaker: "pm", delta: "你" },
    ]);
  });

  it("忽略空行和非 data 行", () => {
    const chunk = ': keep-alive\n\ndata: {"type":"meeting_end"}\n\n';
    // 容错处理：隔离控制信号与脏数据, 验证解析器在遇到非业务数据（如 : keep-alive\n\n）时的鲁棒性。
    expect(parseSseChunk(chunk)).toEqual([{ type: "meeting_end" }]);
  });
});
