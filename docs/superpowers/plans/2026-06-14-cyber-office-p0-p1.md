# Cyber Office P0+P1 实现计划（静态场景 + 回放引擎）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在博客中新增 `/cyber-office` 路由，先做出一个纯前端、可演示的圆桌会议场景：占位小人围坐圆桌，点击「播放」后按一段写死的事件流演出"点名→举手→气泡逐字发言→坐下→总结"。

**Architecture:** 前端用一套 `OfficeEvent` 事件流驱动。纯函数 `applyEvent(state, event)` 把事件归约成 `MeetingState`，React 组件只渲染 state。本阶段事件来自写死的样本数组（回放），与未来的后端实时流共用同一套消费逻辑——这就是设计文档里"演/算解耦"的落点。

**Tech Stack:** TypeScript、Next.js（App Router）、Tailwind v4、Vitest（仅用于纯逻辑单测）。

> 📖 **给作者的阅读说明**：本文每段代码都加了逐行中文注释；遇到 TypeScript / React 的语法点会用「💡 新手提示」单独解释。照着敲的时候，先读注释理解再写，不要纯复制。

---

## 文件结构

本阶段新建的文件及职责：

```
src/lib/cyber-office/
  types.ts            # 所有类型：Role / OfficeEvent / MeetingState（单一事实来源）
  roles.ts            # 预设角色数据（名称、职责、占位颜色）
  seats.ts            # 纯函数：计算圆桌座位坐标（可单测）
  reducer.ts          # 纯函数：applyEvent(state, event) → newState（回放/实时共用，可单测）
  sample-meeting.ts   # 写死的一段 OfficeEvent[]，用于 P1 回放

src/components/cyber-office/
  character.tsx       # 单个占位小人（按 status 变样式）
  speech-bubble.tsx   # 头顶气泡（显示流式文字）
  office-scene.tsx    # 圆桌 + 座位 + 小人布局，纯展示，吃 MeetingState
  use-replay.ts       # 回放 hook：把 OfficeEvent[] 按时间喂给 reducer
  cyber-office.tsx    # 顶层客户端组件：场景 + 播放按钮 + 总结面板

src/app/cyber-office/
  page.tsx            # 路由页（服务端组件），渲染 <CyberOffice/>

src/lib/cyber-office/__tests__/
  seats.test.ts
  reducer.test.ts

vitest.config.ts      # 测试配置（新增）
```

---

# 阶段 P0：静态场景

目标：跑通 `/cyber-office`，看到圆桌 + 一圈静止的占位小人。无交互、无状态。

---

### Task 1: 引入 Vitest 测试框架

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`（scripts 增加 `test`）

> Vitest 是一个测试工具：你写一段"断言"（比如"这个函数输入 4 应该返回 5 个座位"），它帮你自动验证代码对不对。后面纯逻辑的函数都会配测试，这样你改完能立刻知道有没有改坏。

- [ ] **Step 1: 安装依赖**

Run:
```bash
npm install -D vitest
```
Expected: 安装成功，`package.json` 的 devDependencies 出现 `vitest`。

- [ ] **Step 2: 创建 Vitest 配置**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

// defineConfig 只是帮你把配置对象包一层，让编辑器有类型提示
export default defineConfig({
  test: {
    // 我们测的都是纯逻辑（不涉及浏览器 DOM），所以用最轻量的 node 环境
    environment: "node",
  },
  resolve: {
    alias: {
      // 让测试文件里也能用 "@/..." 这种路径（等价于 src/...）
      // 否则测试里 import "@/lib/..." 会找不到文件
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: 加 test 脚本**

Modify `package.json` 的 `"scripts"`，增加一行：
```json
"test": "vitest run"
```
（`vitest run` 表示"跑一次就退出"，而不是一直盯着文件变化。）

- [ ] **Step 4: 写一个临时冒烟测试**

Create `src/lib/cyber-office/__tests__/smoke.test.ts`:
```ts
// 这只是验证"测试框架本身能跑"的临时文件，下一步就删
import { describe, it, expect } from "vitest";

// describe = 一组相关测试的分组名；it = 一条具体测试；expect = 断言
describe("smoke", () => {
  it("1 + 1 = 2", () => {
    expect(1 + 1).toBe(2); // 断言：1+1 的结果应当等于 2
  });
});
```

- [ ] **Step 5: 运行测试确认框架可用**

Run: `npm run test`
Expected: PASS，1 passed。

- [ ] **Step 6: 删除冒烟测试并提交**

Run:
```bash
rm src/lib/cyber-office/__tests__/smoke.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: 引入 Vitest 测试框架

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: 定义核心类型

**Files:**
- Create: `src/lib/cyber-office/types.ts`

> 这个文件只定义"数据长什么样"，不产生任何运行代码。TypeScript 的类型像"模具"——规定每种数据必须有哪些字段、是什么类型，写错了编辑器会立刻标红。

- [ ] **Step 1: 写类型定义**

Create `src/lib/cyber-office/types.ts`:
```ts
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
  // 💡 新手提示：Record<string, RoleRuntime> 表示"一个对象，键是字符串、值是 RoleRuntime"。
  //    我们用角色 id 当键，像查字典一样 roles["pm"] 拿到产品经理的状态。
  roles: Record<string, RoleRuntime>;
  activeSpeaker: RoleId | null; // 当前发言者；没人发言时是 null
  hostText: string; // 主持人最近一句话
  summary: string | null; // 总结产物；还没总结时是 null
  error: string | null;
}
```

- [ ] **Step 2: 类型检查通过即提交**

Run: `npx tsc --noEmit`（只检查类型、不生成文件）
Expected: 无报错。

```bash
git add src/lib/cyber-office/types.ts
git commit -m "feat(cyber-office): 定义事件流与会议状态类型

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 预设角色数据

**Files:**
- Create: `src/lib/cyber-office/roles.ts`

- [ ] **Step 1: 写角色数据**

Create `src/lib/cyber-office/roles.ts`:
```ts
import type { Role, RoleId } from "./types";

// 预设角色库。P5 才做"轻量自定义"，本阶段用固定数据。
// 💡 新手提示：Record<RoleId, Role> 要求"每个 RoleId 都必须有一条对应的 Role"，
//    少写一个角色 TypeScript 就会报错——帮你避免漏配。
export const PRESET_ROLES: Record<RoleId, Role> = {
  host: { id: "host", name: "主持人", title: "分配发言、推动讨论", color: "#ea580c" },
  pm: { id: "pm", name: "产品经理", title: "把握目标与用户价值", color: "#2563eb" },
  frontend: { id: "frontend", name: "前端工程师", title: "可视化与实现可行性", color: "#0d9488" },
  bio: { id: "bio", name: "生信研究员", title: "数据与科学严谨性", color: "#7c3aed" },
  reviewer: { id: "reviewer", name: "审稿人", title: "挑刺与查漏补缺", color: "#db2777" },
  recorder: { id: "recorder", name: "记录员", title: "整理要点", color: "#64748b" },
  summarizer: { id: "summarizer", name: "总结 Agent", title: "汇总产出结论", color: "#ca8a04" },
};

// 按 id 取出某个角色。
// 💡 新手提示：?? 是"空值兜底"——如果 PRESET_ROLES[id] 是 undefined（没找到），
//    就用 ?? 右边那个临时对象，保证函数永远返回一个 Role，渲染时不会因 undefined 崩溃。
export function getRole(id: RoleId): Role {
  return PRESET_ROLES[id] ?? { id, name: id, title: "", color: "#9ca3af" };
}
```

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/lib/cyber-office/roles.ts
git commit -m "feat(cyber-office): 新增预设角色数据

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: 座位几何（纯函数 + TDD）

**Files:**
- Create: `src/lib/cyber-office/seats.ts`
- Test: `src/lib/cyber-office/__tests__/seats.test.ts`

> 这是 TDD（测试驱动）：先写测试（描述"我期望它怎么表现"），跑一次看它失败，再写实现让它变绿。好处是你一上来就把"对的标准"定下来了。

- [ ] **Step 1: 先写失败的测试**

Create `src/lib/cyber-office/__tests__/seats.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeSeatPositions } from "@/lib/cyber-office/seats";

describe("computeSeatPositions", () => {
  it("返回与人数相同数量的座位", () => {
    // 5 个人、半径 100、圆心 (170,170)
    const seats = computeSeatPositions(5, 100, 170, 170);
    expect(seats).toHaveLength(5); // 应当返回 5 个座位
  });

  it("第一个座位在正上方（圆心正上 radius 处）", () => {
    const seats = computeSeatPositions(4, 100, 170, 170);
    // 起始角度 -90°（正上方）：x 不变 ≈170，y 比圆心高 radius ≈170-100=70
    // 💡 toBeCloseTo 用于浮点数比较（避免 0.0000001 误差），第二个参数是精度
    expect(seats[0].x).toBeCloseTo(170, 5);
    expect(seats[0].y).toBeCloseTo(70, 5);
  });

  it("座位均匀分布（4 人时第二个在正右方）", () => {
    const seats = computeSeatPositions(4, 100, 170, 170);
    // 4 个人每隔 90°，第二个在正右方：x ≈170+100=270，y ≈170
    expect(seats[1].x).toBeCloseTo(270, 5);
    expect(seats[1].y).toBeCloseTo(170, 5);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL，提示找不到 `computeSeatPositions` / 模块不存在。（这是好事，说明测试在真正检查。）

- [ ] **Step 3: 实现座位计算**

Create `src/lib/cyber-office/seats.ts`:
```ts
// 一个座位的位置信息
export interface SeatPosition {
  x: number;
  y: number;
  angle: number; // 该座位在圆周上的角度（弧度），预留给将来朝向用
}

// 把 count 个座位均匀排在以 (cx,cy) 为圆心、radius 为半径的圆周上。
// 从正上方（-90°）开始，顺时针依次排列。
export function computeSeatPositions(
  count: number,
  radius: number,
  cx: number,
  cy: number,
): SeatPosition[] {
  const seats: SeatPosition[] = [];
  for (let i = 0; i < count; i++) {
    // 第 i 个座位的角度：从 -90° 起，每个间隔 360/count 度
    const deg = -90 + (360 / count) * i;
    // 三角函数用的是弧度，所以把角度乘 π/180 转成弧度
    const angle = (deg * Math.PI) / 180;
    // 圆周上一点的坐标公式：x = 圆心x + 半径·cos(角度)，y = 圆心y + 半径·sin(角度)
    seats.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      angle,
    });
  }
  return seats;
}
```

> 💡 **为什么这里要懂一点三角**：圆桌座位本质是"把人均匀放在一个圆上"。`cos` 管水平、`sin` 管垂直，角度从 -90°（正上）开始转一圈。你不用会推导，记住"圆周布点 = 圆心 + 半径×(cos, sin)"这个套路即可。

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，3 passed。

- [ ] **Step 5: 提交**

```bash
git add src/lib/cyber-office/seats.ts src/lib/cyber-office/__tests__/seats.test.ts
git commit -m "feat(cyber-office): 圆桌座位几何计算（含单测）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 占位小人组件

**Files:**
- Create: `src/components/cyber-office/character.tsx`

- [ ] **Step 1: 写组件**

Create `src/components/cyber-office/character.tsx`:
```tsx
import type { RoleStatus } from "@/lib/cyber-office/types";

// 💡 新手提示：interface 在这里定义"这个组件接收哪些 props（外部传入的参数）"。
interface CharacterProps {
  name: string;
  color: string;
  status: RoleStatus; // idle / thinking / raising_hand / speaking
}

// 一个角色小人。P0/P1 用纯色方块占位（设计文档选项 c），P4 再换成像素 sprite。
// 💡 { name, color, status } 是"解构"——直接从传入的 props 对象里把这三个字段拆出来用。
export default function Character({ name, color, status }: CharacterProps) {
  // 举手或正在说话时，名字用橙色高亮，突出"当前在场上的人"
  const isActive = status === "speaking" || status === "raising_hand";

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 小人方块本体 */}
      <div
        className="relative flex h-11 w-11 items-center justify-center rounded-[3px] text-white text-xs font-mono transition-transform duration-300"
        // 动态样式（颜色、位移、描边随状态变）写在 style 里，因为值是计算出来的
        style={{
          backgroundColor: color,
          // 举手时整个小人轻微上移 6px，做出"站起来"的感觉
          transform: status === "raising_hand" ? "translateY(-6px)" : "none",
          // 说话时加一圈橙色描边（box-shadow 当描边用），表示"麦克风在他手上"
          boxShadow: status === "speaking" ? "0 0 0 2px #ea580c" : "none",
        }}
      >
        {/* 方块里显示名字前两个字当头像占位，如"产品" */}
        {name.slice(0, 2)}

        {/* 举手图标：仅在 raising_hand 状态显示 */}
        {/* 💡 {条件 && <JSX>} 是 React 常用写法：条件为真才渲染后面的元素 */}
        {status === "raising_hand" && (
          <span className="absolute -top-4 text-sm">✋</span>
        )}

        {/* 思考省略号：仅在 thinking 状态显示 */}
        {status === "thinking" && (
          <span className="absolute -top-4 text-sm text-text-muted">…</span>
        )}
      </div>

      {/* 名字 */}
      <span
        className="text-[10px] font-medium"
        // 活跃时橙色，否则用次要文字色（CSS 变量来自你的设计系统）
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/components/cyber-office/character.tsx
git commit -m "feat(cyber-office): 占位小人组件（按状态变样式）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 圆桌场景 + 路由页（静态可见）

**Files:**
- Create: `src/components/cyber-office/office-scene.tsx`
- Create: `src/app/cyber-office/page.tsx`

- [ ] **Step 1: 写场景组件**

Create `src/components/cyber-office/office-scene.tsx`:
```tsx
"use client"; // 这个组件后面会随状态变化，标记为客户端组件

import type { MeetingState } from "@/lib/cyber-office/types";
import { computeSeatPositions } from "@/lib/cyber-office/seats";
import { getRole } from "@/lib/cyber-office/roles";
import Character from "./character";

// 一组写死的尺寸常量（单位 px），方便统一调整布局
const SCENE = 340; // 场景边长（正方形）
const CENTER = SCENE / 2; // 圆心坐标（场景正中，170）
const RADIUS = 120; // 座位环半径
const CHAR = 44; // 小人方块尺寸，用于把小人"中心"对准座位点

// 这个组件只负责"把 state 画出来"，不含任何逻辑——纯展示。
export default function OfficeScene({ state }: { state: MeetingState }) {
  // 根据参会人数算出每个座位的坐标
  const seats = computeSeatPositions(
    state.participants.length,
    RADIUS,
    CENTER,
    CENTER,
  );

  return (
    <div
      className="relative mx-auto rounded-lg border border-border bg-bg-subtle"
      style={{ width: SCENE, height: SCENE }}
    >
      {/* 中央圆桌：一个绝对定位、居中的圆 */}
      <div
        className="absolute rounded-full border border-border bg-background"
        style={{
          width: RADIUS * 1.1,
          height: RADIUS * 1.1,
          // 让圆桌正好居中：左上角 = 圆心 - 自身一半
          left: CENTER - (RADIUS * 1.1) / 2,
          top: CENTER - (RADIUS * 1.1) / 2,
        }}
      />

      {/* 一圈小人：遍历参会者，每个按座位坐标绝对定位 */}
      {/* 💡 .map() 把数组里每一项变成一个 JSX 元素；key 帮 React 区分谁是谁 */}
      {state.participants.map((id, i) => {
        const seat = seats[i]; // 第 i 个人的座位坐标
        const runtime = state.roles[id]; // 这个人的运行时状态（状态/气泡）
        const role = getRole(id); // 这个人的静态信息（名字/颜色）
        return (
          <div
            key={id}
            className="absolute"
            // 把小人的中心对准座位点：左上角 = 座位坐标 - 小人尺寸一半
            style={{ left: seat.x - CHAR / 2, top: seat.y - CHAR / 2 }}
          >
            <Character
              name={role.name}
              color={role.color}
              // ?. 和 ?? 双保险：runtime 万一不存在，就当 idle，避免崩溃
              status={runtime?.status ?? "idle"}
            />
          </div>
        );
      })}
    </div>
  );
}
```

> 💡 **为什么小人用 `position: absolute` 而不是 flex 排成一行**：flex 只能把元素排成行/列，而我们要把人摆在"圆周上的任意 (x, y) 点"。绝对定位 + 计算好的 `left/top` 才能精确控制每个人的位置。

- [ ] **Step 2: 写路由页（先用一个临时静态 state 让场景显示出来）**

Create `src/app/cyber-office/page.tsx`:
```tsx
import type { Metadata } from "next";
import type { MeetingState } from "@/lib/cyber-office/types";
import OfficeScene from "@/components/cyber-office/office-scene";

export const metadata: Metadata = {
  title: "Cyber Office | Chenyu",
  description: "一个嵌入网站的多 Agent 协作实验室",
};

// P0 临时静态状态：所有人 idle，只为把场景画出来。P1 会换成真实回放状态。
const staticState: MeetingState = {
  phase: "idle",
  topic: "",
  participants: ["host", "pm", "frontend", "bio", "reviewer", "recorder"],
  roles: {
    host: { id: "host", status: "idle", bubble: "" },
    pm: { id: "pm", status: "idle", bubble: "" },
    frontend: { id: "frontend", status: "idle", bubble: "" },
    bio: { id: "bio", status: "idle", bubble: "" },
    reviewer: { id: "reviewer", status: "idle", bubble: "" },
    recorder: { id: "recorder", status: "idle", bubble: "" },
  },
  activeSpeaker: null,
  hostText: "",
  summary: null,
  error: null,
};

export default function CyberOfficePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      <header className="mb-12">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Cyber Office
        </h1>
        <p className="text-lg leading-[1.7] text-text-secondary">
          一个嵌入网站的多 Agent 协作实验室。给一个议题，角色们围坐圆桌轮流发言、由主持人调度，最后产出结论。
        </p>
      </header>
      <OfficeScene state={staticState} />
    </div>
  );
}
```

- [ ] **Step 3: 启动 dev server 在浏览器验证**

Run: `npm run dev`，浏览器打开 `http://localhost:3000/cyber-office`
Expected: 看到一个方形场景，中央有圆桌，6 个彩色方块小人均匀围在圆桌四周，每个下面有名字，全部静止。

- [ ] **Step 4: 提交**

```bash
git add src/components/cyber-office/office-scene.tsx src/app/cyber-office/page.tsx
git commit -m "feat(cyber-office): 圆桌静态场景与路由页

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 🧠 P0 理解检查点

做完 P0，合上代码，用自己的话回答（答不上来就回去重读对应文件）：

1. `computeSeatPositions` 为什么是一个**纯函数**、放在 `lib` 里而不是写在组件里？这样做对"可测试"有什么好处？（对照 `seats.test.ts` 想）
2. `OfficeScene` 里小人为什么用 `position: absolute` + 计算出的 `left/top` 来摆，而不是用 flex 排成一行？
3. `page.tsx` 里那个 `staticState` 是临时的——它扮演了 P1 里"真实状态"的替身。你能说出 `MeetingState` 里每个字段分别会在动画里控制什么吗？

---

# 阶段 P1：回放引擎

目标：点「播放」后，场景按一段写死的事件流动起来——主持人点名、小人举手、气泡逐字蹦字、说完坐下、最后出总结。**不接任何 API。**

---

### Task 7: 会议状态 reducer（纯函数 + TDD）

**Files:**
- Create: `src/lib/cyber-office/reducer.ts`
- Test: `src/lib/cyber-office/__tests__/reducer.test.ts`

> **这是 P1 最核心、也最值得吃透的文件。** "reducer"就是一个函数：给它「当前状态 + 一个事件」，它返回「新状态」。整场会议 = 从空状态开始，把一串事件一个个喂进去，状态就一步步演变。回放和将来真实 API 都只是"事件来源不同"，这个函数完全复用。

- [ ] **Step 1: 先写失败的测试**

Create `src/lib/cyber-office/__tests__/reducer.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

describe("applyEvent", () => {
  it("meeting_start 初始化参会者且所有人 idle", () => {
    // createInitialState() 给一个空白起点，再喂一个 meeting_start 事件
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
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npm run test`
Expected: FAIL，找不到 `reducer` 模块。

- [ ] **Step 3: 实现 reducer**

Create `src/lib/cyber-office/reducer.ts`:
```ts
import type {
  MeetingState,
  OfficeEvent,
  RoleId,
  RoleRuntime,
} from "./types";

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
    error: null,
  };
}

// 小工具：修改"某一个角色"的运行时状态，返回一个全新的 MeetingState。
// 💡 新手提示：这里全程不直接改旧对象，而是用 {...旧的, 要改的字段} 复制出新对象。
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
// 💡 switch (event.type) 按事件种类分别处理。因为 OfficeEvent 是"可辨识联合"，
//    在每个 case 分支里 TypeScript 能自动知道 event 还有哪些字段（如 event.speaker）。
export function applyEvent(
  state: MeetingState,
  event: OfficeEvent,
): MeetingState {
  switch (event.type) {
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

    case "host_speak":
      // 主持人说话：只更新 hostText
      return { ...state, hostText: event.text };

    case "call_on":
      // 点名：把当前发言者设为他，并让他举手
      return patchRole(
        { ...state, activeSpeaker: event.speaker },
        event.speaker,
        { status: "raising_hand" },
      );

    case "speaking_start":
      // 开始说话：状态变 speaking，并清空气泡（准备逐字填）
      return patchRole({ ...state, activeSpeaker: event.speaker }, event.speaker, {
        status: "speaking",
        bubble: "",
      });

    case "token": {
      // 收到一个字：把它追加到该角色现有气泡后面
      const prev = state.roles[event.speaker];
      return patchRole(state, event.speaker, {
        bubble: (prev?.bubble ?? "") + event.delta,
      });
    }

    case "speaking_end":
      // 说完：回到 idle，台上没人了
      return patchRole({ ...state, activeSpeaker: null }, event.speaker, {
        status: "idle",
      });

    case "summary":
      // 总结产物落到 summary 字段
      return { ...state, summary: event.outline };

    case "meeting_end":
      return { ...state, phase: "ended", activeSpeaker: null };

    case "error":
      return { ...state, phase: "ended", error: event.message };

    default:
      // 未知事件：原样返回，不报错（向前兼容）
      return state;
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npm run test`
Expected: PASS，全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/lib/cyber-office/reducer.ts src/lib/cyber-office/__tests__/reducer.test.ts
git commit -m "feat(cyber-office): 会议状态 reducer（含单测）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 气泡组件

**Files:**
- Create: `src/components/cyber-office/speech-bubble.tsx`

- [ ] **Step 1: 写组件**

Create `src/components/cyber-office/speech-bubble.tsx`:
```tsx
// 头顶气泡。文字由外部传入（来自 state.roles[id].bubble）。
// 本组件不关心"流式"——文字是逐字追加还是一次给完，它都照样显示。
export default function SpeechBubble({ text }: { text: string }) {
  // 没文字就不渲染气泡（提前 return，React 里返回 null = 什么都不画）
  if (!text) return null;

  return (
    <div className="absolute bottom-full left-1/2 mb-1 w-40 -translate-x-1/2 rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] leading-snug text-text-secondary shadow-sm">
      {text}
      {/* 气泡下方的小三角尾巴：用一个旋转 45° 的小方块伪装 */}
      <span className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 -translate-y-1 rotate-45 border-b border-r border-border bg-background" />
    </div>
  );
}
```

> 💡 这些 Tailwind 类大多是定位：`absolute bottom-full` 把气泡顶到小人正上方，`left-1/2 -translate-x-1/2` 是经典的"水平居中"组合。看不懂具体类名没关系，知道它整体是"在小人头顶画一个带尾巴的对话框"即可。

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/components/cyber-office/speech-bubble.tsx
git commit -m "feat(cyber-office): 发言气泡组件

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: 场景接入气泡

**Files:**
- Modify: `src/components/cyber-office/office-scene.tsx`

- [ ] **Step 1: 在小人上方挂气泡**

Modify `src/components/cyber-office/office-scene.tsx`：先在顶部 import 处加一行：
```tsx
import SpeechBubble from "./speech-bubble";
```

然后把渲染单个小人的那个 `<div>`（带 `style={{ left: seat.x - CHAR / 2, ... }}` 的）替换成下面这版——多包一层 `relative` 容器，把气泡放在小人上方：
```tsx
          <div
            key={id}
            className="absolute"
            style={{ left: seat.x - CHAR / 2, top: seat.y - CHAR / 2 }}
          >
            {/* relative 让气泡能相对这个小人定位（气泡内部是 absolute bottom-full） */}
            <div className="relative">
              <SpeechBubble text={runtime?.bubble ?? ""} />
              <Character
                name={role.name}
                color={role.color}
                status={runtime?.status ?? "idle"}
              />
            </div>
          </div>
```

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 场景中小人头顶挂发言气泡

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: 写死一段样本会议

**Files:**
- Create: `src/lib/cyber-office/sample-meeting.ts`

> 这就是 P1 回放的"剧本"——一串事件，喂给 reducer 就能演一场完整会议。将来 P2 接真实 API 后，这串事件会改由后端实时生成，但前端播放逻辑完全不变。

- [ ] **Step 1: 写样本事件数组**

Create `src/lib/cyber-office/sample-meeting.ts`:
```ts
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
  { type: "host_speak", text: "今天我们来定一个空间转录组可视化的选题。先请生信研究员谈谈痛点。" },
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
```

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/lib/cyber-office/sample-meeting.ts
git commit -m "feat(cyber-office): 写死样本会议事件流

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: 回放 hook

**Files:**
- Create: `src/components/cyber-office/use-replay.ts`

> hook（以 `use` 开头的函数）是 React 里"把一段带状态的逻辑打包复用"的方式。这个 `useReplay` 负责：把样本事件按不同的时间间隔，一条一条喂给 reducer，从而让场景动起来。

- [ ] **Step 1: 写 hook**

Create `src/components/cyber-office/use-replay.ts`:
```ts
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { OfficeEvent } from "@/lib/cyber-office/types";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";

// 不同事件的播放间隔（毫秒）。token 很短，营造逐字打字感；说完后停顿久一点。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token":
      return 40; // 每个字 40ms，像打字机
    case "host_speak":
      return 900;
    case "call_on":
      return 700;
    case "speaking_start":
      return 250;
    case "speaking_end":
      return 450;
    case "summary":
      return 1000;
    default:
      return 500;
  }
}

export function useReplay(events: OfficeEvent[]) {
  // 💡 useReducer：React 内置 hook。把 reducer 交给它管理状态。
  //    第三个参数 createInitialState 是"惰性初始化"——首次渲染时调用它得到初始 state。
  const [state, dispatch] = useReducer(applyEvent, undefined, createInitialState);

  const [isPlaying, setIsPlaying] = useState(false); // 是否正在播放
  const indexRef = useRef(0); // 当前播到第几条事件（用 ref 存，改它不触发重渲染）
  const [tick, setTick] = useState(0); // 每播一条事件 +1，专门用来"再次唤醒"下面的 effect

  // start：从头开始播放。useCallback 让这个函数引用稳定，避免不必要的重建。
  const start = useCallback(() => {
    indexRef.current = 0;
    setTick(0);
    setIsPlaying(true);
  }, []);

  // 核心：每当 isPlaying 或 tick 变化，就安排"播放下一条事件"。
  useEffect(() => {
    if (!isPlaying) return; // 没在播就什么都不做
    if (indexRef.current >= events.length) {
      setIsPlaying(false); // 播完了，停下
      return;
    }
    const event = events[indexRef.current];
    // setTimeout：等 delayFor(event) 毫秒后，再处理这条事件
    const timer = setTimeout(() => {
      dispatch(event); // 把事件喂给 reducer → state 更新 → 场景重渲染
      indexRef.current += 1; // 指针前移
      setTick((n) => n + 1); // 改 tick → 触发本 effect 再跑一次 → 安排下一条
    }, delayFor(event));
    // 清理函数：如果在等待期间组件卸载/重跑，取消这个定时器，避免重复触发
    return () => clearTimeout(timer);
  }, [isPlaying, tick, events]);

  return { state, isPlaying, start };
}
```

> 💡 **这里最绕的是 `tick` 这个技巧，重点理解一下：**
> `useEffect` 只在它的依赖（`[isPlaying, tick, events]`）变化时才重新运行。我们想"播完一条立刻安排下一条"，于是每播一条就 `setTick(+1)`——`tick` 变了，effect 就再跑一次，于是用 `setTimeout` 安排下一条。如此一条接一条，像多米诺骨牌。
> 如果**去掉 `tick`**，effect 只在开始播放时跑一次、只播第一条，就停住了——因为没有任何东西再触发它。

- [ ] **Step 2: 类型检查并提交**

Run: `npx tsc --noEmit`
Expected: 无报错。

```bash
git add src/components/cyber-office/use-replay.ts
git commit -m "feat(cyber-office): 事件回放 hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: 顶层组件 + 接入页面（完整回放可玩）

**Files:**
- Create: `src/components/cyber-office/cyber-office.tsx`
- Modify: `src/app/cyber-office/page.tsx`

- [ ] **Step 1: 写顶层客户端组件**

Create `src/components/cyber-office/cyber-office.tsx`:
```tsx
"use client";

import OfficeScene from "./office-scene";
import { useReplay } from "./use-replay";
import { SAMPLE_MEETING } from "@/lib/cyber-office/sample-meeting";

// 顶层组件：把"回放逻辑（hook）"和"画面（场景/按钮/总结）"组装到一起。
export default function CyberOffice() {
  // 从 hook 里拿到当前状态、是否在播、以及开始播放的函数
  const { state, isPlaying, start } = useReplay(SAMPLE_MEETING);

  return (
    <div className="flex flex-col gap-8">
      {/* 议题 + 播放控制 */}
      <div className="flex flex-col gap-4 rounded-lg border border-border bg-bg-subtle p-5">
        <p className="text-sm text-text-secondary">
          {/* state.topic 有值就显示议题，否则显示提示语 */}
          {state.topic || "点击下方按钮，回放一场样本会议。"}
        </p>
        <button
          onClick={start}
          disabled={isPlaying} // 播放中禁用按钮，防止重复点击
          className="w-fit rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPlaying ? "会议进行中…" : "▶ 播放样本会议"}
        </button>
      </div>

      {/* 主持人当前发言（hostText 有值才显示） */}
      {state.hostText && (
        <p className="text-center text-sm italic text-text-muted">
          主持人：{state.hostText}
        </p>
      )}

      {/* 圆桌场景 */}
      <OfficeScene state={state} />

      {/* 总结产物（summary 有值才显示） */}
      {state.summary && (
        <div className="rounded-lg border border-border bg-bg-subtle p-5">
          <h3 className="mb-3 font-mono text-sm uppercase tracking-widest text-text-muted">
            Summary
          </h3>
          {/* pre 保留换行；whitespace-pre-wrap 让长行也能自动折行 */}
          <pre className="whitespace-pre-wrap font-sans text-sm leading-[1.7] text-text-secondary">
            {state.summary}
          </pre>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 改路由页，用 CyberOffice 替换静态场景**

Replace `src/app/cyber-office/page.tsx` 全文为：
```tsx
import type { Metadata } from "next";
import CyberOffice from "@/components/cyber-office/cyber-office";

export const metadata: Metadata = {
  title: "Cyber Office | Chenyu",
  description: "一个嵌入网站的多 Agent 协作实验室",
};

export default function CyberOfficePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-20 md:px-8 md:py-24">
      <header className="mb-12">
        <h1 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Cyber Office
        </h1>
        <p className="text-lg leading-[1.7] text-text-secondary">
          一个嵌入网站的多 Agent 协作实验室。给一个议题，角色们围坐圆桌轮流发言、由主持人调度，最后产出结论。
        </p>
      </header>
      <CyberOffice />
    </div>
  );
}
```

> 注意：路由页是**服务端组件**（没有 `"use client"`），它只负责静态外壳；真正带状态的交互都在 `<CyberOffice/>` 这个客户端组件里。这是 Next.js App Router 的常见分层。

- [ ] **Step 3: 浏览器验证完整回放**

Run: `npm run dev`，打开 `http://localhost:3000/cyber-office`，点「▶ 播放样本会议」
Expected:
- 场景出现 5 个小人围坐圆桌；
- 主持人台词在场景上方依次出现；
- 被点名的小人冒「✋」并轻微上移，随后描边变橙、头顶气泡逐字蹦出文字；
- 说完气泡消失、小人坐下；
- 最后下方出现 Summary 文章大纲；
- 播放期间按钮显示"会议进行中…"且禁用，结束后可再次播放。

- [ ] **Step 4: 跑一遍测试 + 构建确认整体没坏**

Run: `npm run test && npm run build`
Expected: 测试全过；构建成功，路由列表里出现 `/cyber-office`。

- [ ] **Step 5: 提交**

```bash
git add src/components/cyber-office/cyber-office.tsx src/app/cyber-office/page.tsx
git commit -m "feat(cyber-office): 接入回放，完成 P1 可演示版本

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### 🧠 P1 理解检查点

做完 P1，合上代码回答：

1. `applyEvent` 是个**纯函数**（输入旧 state + 事件 → 输出新 state，不碰外部）。为什么这种写法让"回放"和"将来接真实 API"能共用同一套代码？（提示：API 流式返回的也是 `OfficeEvent`）
2. `useReplay` 里为什么要用 `tick` 这个 state？如果去掉它，`useEffect` 还会一条接一条地播放吗？
3. `token` 事件为什么要一个字一个字地发，而不是一次把整句话塞进气泡？这跟将来真实大模型的"流式输出"有什么对应关系？
4. 现在导航栏还没有 Cyber Office 的入口——你知道要改哪个文件、加什么吗？（提示：回顾 `src/components/layout/navbar.tsx` 的 `navLinks`。这一步留到 P5 收尾，先想清楚。）

---

## 完成标准（P0+P1）

- [ ] `/cyber-office` 路由可访问，圆桌 + 小人正确渲染
- [ ] 点击播放后完整演出一场会议（点名→举手→逐字气泡→坐下→总结）
- [ ] `npm run test` 全部通过（seats + reducer）
- [ ] `npm run build` 成功
- [ ] 全程未调用任何外部 API、未消耗任何 token

下一份计划（P2）将把写死的 `SAMPLE_MEETING` 换成后端真实的主持人/角色/总结 Agent 编排，通过 SSE 把真实 `OfficeEvent` 流推给同一套前端。
