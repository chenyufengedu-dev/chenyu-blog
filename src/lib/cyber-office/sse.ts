import type { OfficeEvent } from "./types";

import type { OfficeEvent } from "./types";

export function encodeSseEvent(event: OfficeEvent): string {
  // SSE 规定每条消息用空行结尾；data: 后面放我们真正要传的 JSON。
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function parseSseChunk(chunk: string): OfficeEvent[] {
  const events: OfficeEvent[] = [];
  // 网络流可能一次给半条、也可能一次给多条；这里先按行拆开，再只处理 data: 行。
  const lines = chunk.split(/\r?\n/);

  for (const line of lines) {
    // SSE 里可以有注释行、空行、event: 行；P2 只需要 data: 行。
    if (!line.startsWith("data:")) continue;

    // 去掉 data: 前缀，剩下的就是 JSON 字符串。
    const json = line.slice("data:".length).trim();
    if (!json) continue;

    // 这里断言成 OfficeEvent，是因为 JSON.parse 运行时只能返回 unknown/object；
    // 真正的事件形状由后端 encodeSseEvent 保证。
    events.push(JSON.parse(json) as OfficeEvent);
  }

  return events;
}
