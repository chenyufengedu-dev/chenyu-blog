import type { Role, RoleId } from "./types";

// 预设角色库。P5 才做"轻量自定义"，本阶段用固定数据。
export const PRESET_ROLES: Record<RoleId, Role> = {
  host: {
    id: "host",
    name: "主持人",
    title: "分配发言、推动讨论",
    color: "#ea580c",
  },
  pm: {
    id: "pm",
    name: "产品经理",
    title: "把握目标与用户价值",
    color: "#2563eb",
  },
  frontend: {
    id: "frontend",
    name: "前端工程师",
    title: "可视化与实现可行性",
    color: "#0d9488",
  },
  bio: {
    id: "bio",
    name: "生信研究员",
    title: "数据与科学严谨性",
    color: "#7c3aed",
  },
  reviewer: {
    id: "reviewer",
    name: "审稿人",
    title: "挑刺与查漏补缺",
    color: "#db2777",
  },
  recorder: {
    id: "recorder",
    name: "记录员",
    title: "整理要点",
    color: "#64748b",
  },
  summarizer: {
    id: "summarizer",
    name: "总结 Agent",
    title: "汇总产出结论",
    color: "#ca8a04",
  },
};

// 按 id 取出某个角色。
// ?? 是"空值兜底"——如果 PRESET_ROLES[id] 是 undefined（没找到），就用 ?? 右边那个临时对象，保证函数永远返回一个 Role，渲染时不会因 undefined 崩溃。
export function getRole(id: RoleId): Role {
  return PRESET_ROLES[id] ?? { id, name: id, title: "", color: "#9ca3af" };
}
