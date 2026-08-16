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
  // ↓ 新增：主持人先做决策，再串场、点名
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "bio",
      prompt: "请从生信角度谈谈现有空间转录组可视化的痛点。",
      hostText:
        "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。",
    },
  },
  {
    type: "host_speak",
    text: "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。",
  },
  { type: "call_on", speaker: "bio" },
  ...speak("bio", "现有工具画的空间图太花，读者看不懂细胞分布的生物学意义。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "frontend",
      prompt: "从前端可视化角度提出具体改进方案。",
      hostText: "前端来说说可视化上能怎么改进。",
    },
  },
  { type: "host_speak", text: "前端来说说可视化上能怎么改进。" },
  { type: "call_on", speaker: "frontend" },
  ...speak("frontend", "可以用交互式热力图叠加组织切片，hover 显示基因表达。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "pm",
      prompt: "从读者价值/传播角度评估这个选题。",
      hostText: "产品经理从读者价值角度补充一下。",
    },
  },
  { type: "host_speak", text: "产品经理从读者价值角度补充一下。" },
  { type: "call_on", speaker: "pm" },
  ...speak("pm", "选题要落在'看懂一张空间图'，面向入门读者更有传播力。"),
  // ↓ 新增
  {
    type: "moderator_decision",
    decision: {
      action: "call_on",
      speaker: "reviewer",
      prompt: "从严谨性角度挑战前面的方案。",
      hostText: "审稿人有没有要挑刺的？",
    },
  },
  { type: "host_speak", text: "审稿人有没有要挑刺的？" },
  { type: "call_on", speaker: "reviewer" },
  ...speak("reviewer", "别只讲炫技，要交代数据来源和局限，否则不严谨。"),
  // ↓ 新增：主持人决定收口
  {
    type: "moderator_decision",
    decision: {
      action: "summarize",
      hostText: "讨论充分了，进入总结。",
    },
  },
  { type: "host_speak", text: "讨论充分了，进入总结。" },
  {
    type: "summary",
    outline: [
      "## 结论",
      "选题定为「如何读懂一张空间转录组图」，面向入门读者讲清空间信息的意义，而不是展示炫技。",
      "",
      "## 为什么",
      "- （生信研究员）现有工具画得太花，读者看不懂细胞分布背后的生物学意义。",
      "- （产品经理）落在「看懂一张图」这个动作上，比讲工具更有传播力。",
      "- （前端工程师）交互式热力图叠加切片，能把抽象表达量变成可感知的空间分布。",
      "",
      "## 争议点",
      "审稿人认为只讲可视化会失之轻浮，坚持必须交代数据来源与局限；前端则担心加太多方法学细节会劝退入门读者。折中方案是正文保持轻量，把数据来源和局限收进单独一节。",
      "",
      "## 怎么做",
      "1. 选定一个公开数据集的单张切片作为全文贯穿案例。",
      "2. 先用一张对比图讲清「有空间信息」和「没有空间信息」的差别。",
      "3. 做一版交互式热力图叠加组织切片，hover 显示基因表达。",
      "4. 单独一节交代数据来源、预处理步骤与已知局限。",
      "5. 结尾给入门读者一份「看图三步走」的阅读指南。",
      "",
      "## 先做这一件",
      "先把那张「有无空间信息」的对比图做出来——它最能验证这个选题讲不讲得通。",
    ].join("\n"),
  },
  { type: "meeting_end" },
];
