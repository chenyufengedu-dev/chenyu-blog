// 角色 ID：用「联合类型」把允许的取值一个个列死。
// 💡 新手提示：a | b | c 读作"a 或 b 或 c"，表示这个值只能是这几个字符串之一，
//    写成 "hostt" 之类的拼写错误会被立刻报错。
export type RoleId =
  | "host" // 主持人
  | "pm" // 产品经理
  | "frontend" // 前端工程师
  | "bio" // 生信研究员
  | "reviewer" // 审稿人
  | "recorder" // 记录员
  | "summarizer"; // 总结 Agent

// 小人当前的动作状态，决定渲染成什么样式/动画
export type RoleStatus = "idle" | "thinking" | "raising_hand" | "speaking";

// 预设角色的「静态信息」（不会随会议变化的部分）
export interface Role {
  id: RoleId;
  name: string; // 显示名，如"产品经理"
  title: string; // 一句话职责
  color: string; // 占位方块颜色（P4 换成像素 sprite 前的临时视觉）
}

// 服务端/回放推给前端的「事件」。
// 💡 新手提示：这同样是联合类型，但每个分支是一个对象。它们都有 type 字段，
//    靠 type 区分是哪种事件——这叫"可辨识联合"，后面 reducer 里 switch(type) 就靠它。
export type OfficeEvent =
  | { type: "meeting_start"; topic: string; participants: RoleId[] }
  | { type: "host_speak"; text: string } // 主持人开场/串场
  | { type: "call_on"; speaker: RoleId } // 点名 → 小人举手
  | { type: "speaking_start"; speaker: RoleId } // 开始说 → 气泡出现并清空
  | { type: "token"; speaker: RoleId; delta: string } // 逐字追加到气泡
  | { type: "speaking_end"; speaker: RoleId } // 说完 → 坐下
  | { type: "summary"; outline: string } // 总结产物
  | { type: "meeting_end" }
  | { type: "error"; message: string };

// 单个角色的「运行时状态」（会随会议进程变化的部分）
export interface RoleRuntime {
  id: RoleId;
  status: RoleStatus;
  bubble: string; // 当前气泡文字（token 事件不断往后追加）
}

// 整场会议的运行时状态：reducer 算出它，组件渲染它。
export interface MeetingState {
  phase: "idle" | "running" | "ended"; // 会议处于哪个阶段
  topic: string;
  participants: RoleId[]; // 本场参会者（含 host）
  // Record<string, RoleRuntime> 表示"一个对象，键是字符串、值是 RoleRuntime"。
  roles: Record<string, RoleRuntime>;
  activeSpeaker: RoleId | null; // 当前发言者；没人发言时是 null
  hostText: string; // 主持人最近一句话
  summary: string | null; // 总结产物；还没总结时是 null
  error: string | null;
}
