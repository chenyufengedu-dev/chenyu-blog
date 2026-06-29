import type { OfficeEvent, RoleId } from "./types";

// 小工具：把"某人说一句话"展开成三段事件：开始说 → 逐字 token → 说完。
// 这样播放时就有"一个字一个字蹦出来"的流式打字效果。
function speak(speaker: RoleId, text: string): OfficeEvent[] {
  const events: OfficeEvent[] = [{ type: "speaking_start", speaker }];
  // 把整句话拆成单个字符，每个字符生成一个 token 事件
  for (const ch of text) {
    events.push({ type: "token", speaker, delta: ch });
  }
  events.push({ type: "speaking_end", speaker });
  return events;
}

// 一场写死的样本会议（议题贴合本人方向）。
// 💡 ...speak(...) 里的 ... 是"展开"：把 speak() 返回的那一串事件，
//    平铺进这个大数组里（而不是塞成嵌套数组）。
export const SAMPLE_MEETING: OfficeEvent[] = [
  {
    type: "meeting_start",
    topic: "讨论一个空间转录组可视化的博客选题，并产出文章大纲",
    participants: ["host", "pm", "frontend", "bio", "reviewer"],
  },
  {
    type: "host_speak",
    text: "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。",
  },
  { type: "call_on", speaker: "bio" },
  ...speak("bio", "现有工具画的空间图太花，读者看不懂细胞分布的生物学意义。"),
  { type: "host_speak", text: "前端来说说可视化上能怎么改进。" },
  { type: "call_on", speaker: "frontend" },
  ...speak("frontend", "可以用交互式热力图叠加组织切片，hover 显示基因表达。"),
  { type: "host_speak", text: "产品经理从读者价值角度补充一下。" },
  { type: "call_on", speaker: "pm" },
  ...speak("pm", "选题要落在'看懂一张空间图'，面向入门读者更有传播力。"),
  { type: "host_speak", text: "审稿人有没有要挑刺的？" },
  { type: "call_on", speaker: "reviewer" },
  ...speak("reviewer", "别只讲炫技，要交代数据来源和局限，否则不严谨。"),
  { type: "host_speak", text: "讨论充分了，进入总结。" },
  {
    type: "summary",
    outline:
      "# 选题：如何读懂一张空间转录组图\n\n1. 为什么空间信息重要（生信视角）\n2. 现有可视化的问题\n3. 交互式热力图 + 切片叠加的改进\n4. 数据来源与局限\n5. 给入门读者的阅读指南",
  },
  { type: "meeting_end" },
];
