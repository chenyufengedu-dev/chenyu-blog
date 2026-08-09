import type { MeetingState, OfficeEvent, RoleId, RoleRuntime } from "./types";

// 返回一个"空白会议"。每次开始回放/实时，第一个 meeting_start 事件会基于它重建。
export function createInitialState(): MeetingState {
  return {
    phase: "idle",
    topic: "",
    participants: [],
    roles: {},
    activeSpeaker: null,
    hostText: "",
    summary: null,
    lastDecision: null,
    decisions: [],
    transcript: [],
    error: null,
  };
}

// 小工具：修改"某一个角色"的运行时状态，返回一个全新的 MeetingState。
// 这里全程不直接改旧对象，而是用 {...旧的, 要改的字段} 复制出新对象。
//    这叫"不可变更新"——React 靠"对象引用变了没"来判断要不要重渲染，
//    如果你偷偷改旧对象，React 可能察觉不到、界面不更新。
function patchRole(
  state: MeetingState,
  id: RoleId,
  patch: Partial<RoleRuntime>, // Partial 表示"RoleRuntime 的字段都可选"，只传想改的
): MeetingState {
  // 取出这个角色现有状态；万一没有就给个默认值
  const prev = state.roles[id] ?? { id, status: "idle", bubble: "" };
  return {
    ...state, // 复制整个 state
    roles: {
      ...state.roles, // 复制所有角色
      [id]: { ...prev, ...patch }, // 只覆盖这一个角色里被 patch 指定的字段
    },
  };
}

// 核心纯函数：输入旧 state + 一个事件，输出新 state。
//  switch (event.type) 按事件种类分别处理。因为 OfficeEvent 是"可辨识联合"，
//    在每个 case 分支里 TypeScript 能自动知道 event 还有哪些字段（如 event.speaker）。
export function applyEvent(
  state: MeetingState,
  event: OfficeEvent,
): MeetingState {
  switch (event.type) {
    case "reset":
      return createInitialState();

    case "meeting_start": {
      // 为每个参会者建一条初始 runtime（都 idle、气泡为空）
      const roles: Record<string, RoleRuntime> = {};
      for (const id of event.participants) {
        roles[id] = { id, status: "idle", bubble: "" };
      }
      return {
        ...createInitialState(), // 先回到空白，清掉上一场残留
        phase: "running",
        topic: event.topic,
        participants: event.participants,
        roles,
      };
    }

    case "host_speak": {
      // 主持人串场：① 更新 hostText；② 让主持人小人进入 speaking（有说话动作）；
      // ③ 把这句归档进发言记录（之前漏了主持人）。activeSpeaker 置空 = 台上没有"被点名的角色"。
      const withHost = patchRole(
        { ...state, hostText: event.text, activeSpeaker: null },
        "host",
        { status: "speaking", bubble: event.text },
      );
      return {
        ...withHost,
        transcript: [
          ...withHost.transcript,
          { speaker: "host", text: event.text },
        ],
      };
    }

    case "call_on":
      // 点名：先让主持人小人坐下（结束他的说话动作），再把被点名者设为发言者并举手。
      return patchRole(
        patchRole({ ...state, activeSpeaker: event.speaker }, "host", {
          status: "idle",
        }),
        event.speaker,
        { status: "raising_hand" },
      );

    case "speaking_start":
      // 开始说话：状态变 speaking，并清空气泡（准备逐字填）
      return patchRole(
        { ...state, activeSpeaker: event.speaker },
        event.speaker,
        {
          status: "speaking",
          bubble: "",
        },
      );

    case "token": {
      // 收到一个字：把它追加到该角色现有气泡后面
      const prev = state.roles[event.speaker];
      return patchRole(state, event.speaker, {
        bubble: (prev?.bubble ?? "") + event.delta,
      });
    }

    case "speaking_end": {
      // 这轮的完整发言就是该角色当前 bubble；说完时归档进 transcript。
      const finished = state.roles[event.speaker]?.bubble ?? "";
      const nextState = patchRole(
        { ...state, activeSpeaker: null },
        event.speaker,
        { status: "idle" },
      );
      return {
        ...nextState,
        transcript: finished
          ? [
              ...nextState.transcript,
              { speaker: event.speaker, text: finished },
            ]
          : nextState.transcript,
      };
    }

    case "moderator_decision":
      // 记录本轮决策：既更新"最近一次"（现有面板用），也追加进历史（Task 14 回看用）。
      return {
        ...state,
        lastDecision: event.decision,
        decisions: [...state.decisions, event.decision],
      };

    case "summary":
      // 总结产物落到 summary 字段
      return { ...state, summary: event.outline };

    case "meeting_end":
      // 会议结束：主持人坐下，台上无人。
      return patchRole(
        { ...state, phase: "ended", activeSpeaker: null },
        "host",
        { status: "idle" },
      );

    case "error":
      return { ...state, phase: "ended", error: event.message };

    default:
      // 未知事件：原样返回，不报错（向前兼容）
      return state;
  }
}
