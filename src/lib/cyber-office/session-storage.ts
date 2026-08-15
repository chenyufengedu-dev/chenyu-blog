import type { MeetingState, RoleId } from "./types";

// key 带版本号 v1：以后数据结构变了，换成 v2 即可，旧数据自然被忽略，
// 不会出现"旧格式把新页面搞崩"的情况。
const KEY = "cyber-office:live-session:v1";

// 继续开会所需要的进度（就是 use-live-meeting 里那个进度对象）。
export interface SavedProgress {
  topic: string;
  participants: RoleId[];
  transcript: { speaker: RoleId; text: string }[];
  turn: number;
  discussionDone: boolean;
}

export interface SavedSession {
  state: MeetingState; // 画面状态：用来还原"看到的东西"
  progress: SavedProgress; // 会议进度：用来"接着往下开"
}

export function saveSession(session: SavedSession) {
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // 无痕模式、存储配额满等情况下 localStorage 会抛错。
    // 存不下就算了——会议本身照常进行，只是失去"刷新可恢复"这个便利。
  }
}

export function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SavedSession;

    // 最低限度的形状校验：不认识的数据一律当作没有，避免把页面搞崩。
    if (!parsed?.state?.phase || !parsed?.progress?.topic) return null;
    // 已经开完的会议没有恢复的必要。
    if (parsed.state.phase === "ended") return null;

    return parsed;
  } catch {
    return null;
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 同上，失败不影响主流程
  }
}
