# Cyber Office P4 实现计划（像素小人 + 动效）

> ⚠️ **状态：P4.1–P4.3 + P4.4 Task 8–12 已完成；Task 13/14/15 已废弃，不再执行。**
> 本文档采用"**代码画 PixelMap**"路线。P4.4 美术精修阶段经设计评估后**转向"AI 精灵图"路线**，
> 后续实现见 [`2026-07-28-cyber-office-p4art-sprites.md`](./2026-07-28-cyber-office-p4art-sprites.md)。
> - Task 13（PNG→PixelMap 脚本）：作废（改用精灵图，不再走 PixelMap）。
> - Task 14（放大场景）/ Task 15（字幕面板）：已由新文档 Task 2 / Task 4 用精灵图方式重新覆盖。
> 这次转向是真实的设计权衡记录：先做代码 PixelMap 版，评估精致度后 pivot 到手绘精灵图版。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把圆桌上的彩色方块占位替换成像素小人，并加上闲置微动、点名举手、发言、思考等轻量动效。守住博客设计红线（像素风只在小人身上，外壳 UI 仍走极简橙色系）。

**Architecture:** 保持 `Character` 组件对外接口 `{name, color, status}` 不变（"换内脏不换接口"），`office-scene.tsx` 几乎不用改。P4 分两层推进：先用**代码画的 SVG 像素小人**（零素材、立刻可见、天然适配深浅色）打好渲染与动画系统；等系统稳了，P4.3 再把真实 CC0 精灵图接进来，SVG 版本作为永久 fallback。

**Tech Stack:** React、内联 SVG（`shape-rendering: crispEdges`）、CSS `@keyframes` 动画、`prefers-reduced-motion`。P4.3 起引入 PNG 精灵图 + CSS `background-position` + `steps()`。

> 📖 **阅读说明**：P4.1 / P4.2 是**现在就能照做**的完整步骤（不依赖任何外部素材）。P4.3 需要先和总设计师一起选定 CC0 素材，本文给出结构和代码骨架，最终帧参数到时补。P4.4 / P4.5 给出方案与关键代码。

---

## 文件结构

```txt
src/components/cyber-office/
  pixel-character.tsx     # 新增：代码画的 SVG 像素小人（按 color/status 渲染）
  character.tsx           # 改：内部改用 <PixelCharacter/>，保留 name 标签与状态提示
  pixel-sprite.tsx        # P4.3 新增：canvas 像素渲染器（吃图层数组）
  office-scene.tsx        # P4.4 微调：座位偏移、z 轴遮挡

src/lib/cyber-office/
  character-atlas.ts      # P4.3 新增：调色板 + 角色像素图谱 + 组装函数

src/app/globals.css       # 新增像素动画 keyframes（idle/talk），含 reduced-motion 降级
```

---

# 阶段 P4.1：SVG 像素小人渲染基座

目标：把方块换成一个能认出是"人"的 SVG 像素小人，按角色色染衣服，深浅色都好看。先静态，无动画。

---

### Task 1: 新建 PixelCharacter 组件

**Files:**
- Create: `src/components/cyber-office/pixel-character.tsx`

> 我们用一张 16×20 的"像素网格"当画布（viewBox），用一堆 `<rect>` 拼出小人：头发、脸、眼睛、身体（角色色）、手臂。`shape-rendering: crispEdges` 让边缘不做抗锯齿，保持像素锐利。举手状态下右臂抬高——这样"举手"是真的抬手，而不是贴一个 emoji。

- [x] **Step 1: 创建组件**

Create `src/components/cyber-office/pixel-character.tsx`:

```tsx
import type { RoleStatus } from "@/lib/cyber-office/types";

// 所有角色共用的肤色/发色/眼睛色；只有"衣服"用角色自己的 color，做出区分。
const SKIN = "#f1c9a5";
const HAIR = "#3a2e28";
const EYE = "#222222";

// 一个 SVG 像素小人。viewBox 是 16×20 的像素网格，每个 <rect> 就是若干像素块。
export default function PixelCharacter({
  color,
  status,
}: {
  color: string;
  status: RoleStatus;
}) {
  const raising = status === "raising_hand"; // 举手时右臂抬高

  return (
    <svg
      width={40}
      height={50}
      viewBox="0 0 16 20"
      shapeRendering="crispEdges" // 关键：像素边缘不抗锯齿，保持锐利
      style={{ imageRendering: "pixelated" }}
      role="img"
      aria-hidden // 名字标签已表达身份，SVG 本身对读屏无额外信息
    >
      {/* 头发 */}
      <rect x={4} y={1} width={8} height={3} fill={HAIR} />
      {/* 脸 */}
      <rect x={5} y={3} width={6} height={5} fill={SKIN} />
      {/* 眼睛（两个 1×1 像素） */}
      <rect x={6} y={5} width={1} height={1} fill={EYE} />
      <rect x={9} y={5} width={1} height={1} fill={EYE} />
      {/* 身体：用角色色，这就是每个角色的视觉区分 */}
      <rect x={4} y={8} width={8} height={7} fill={color} />
      {/* 左臂 + 左手 */}
      <rect x={3} y={8} width={1} height={5} fill={color} />
      <rect x={3} y={13} width={1} height={1} fill={SKIN} />
      {/* 右臂：举手时整条抬到头顶高度，否则自然下垂 */}
      {raising ? (
        <>
          <rect x={12} y={3} width={1} height={5} fill={color} />
          <rect x={12} y={2} width={1} height={1} fill={SKIN} />
        </>
      ) : (
        <>
          <rect x={12} y={8} width={1} height={5} fill={color} />
          <rect x={12} y={13} width={1} height={1} fill={SKIN} />
        </>
      )}
    </svg>
  );
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/pixel-character.tsx
git commit -m "feat(cyber-office): 新增 SVG 像素小人组件"
```

---

### Task 2: Character 改用 PixelCharacter

**Files:**
- Modify: `src/components/cyber-office/character.tsx`

> `Character` 对外接口不变（`office-scene.tsx` 不用动），只把内部的"色块"换成 `<PixelCharacter/>`，并保留名字标签、思考省略号。原来的 ✋ emoji 删掉——现在举手由 SVG 真实抬臂表达。

- [x] **Step 1: 替换 character.tsx**

Replace `src/components/cyber-office/character.tsx` with:

```tsx
import type { RoleStatus } from "@/lib/cyber-office/types";
import PixelCharacter from "./pixel-character";

interface CharacterProps {
  name: string;
  color: string;
  status: RoleStatus;
}

export default function Character({ name, color, status }: CharacterProps) {
  // 举手或发言时，名字用橙色高亮，突出"当前在场上的人"
  const isActive = status === "speaking" || status === "raising_hand";

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 外层：举手时整体轻微上移，做出"起身"的感觉 */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: status === "raising_hand" ? "translateY(-6px)" : "none",
        }}
      >
        <PixelCharacter color={color} status={status} />

        {/* 思考省略号：仅在 thinking 状态显示，浮在头顶 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      {/* 名字 */}
      <span
        className="text-[10px] font-medium"
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
```

- [x] **Step 2: 浏览器验证**

Run: `npm run dev`，打开 `http://localhost:3000/cyber-office`，点「▶ 播放样本会议」
Expected:

- 圆桌周围是**像素小人**（深色头发、肤色脸、两只眼睛、角色色衣服），不再是纯色方块；
- 被点名的小人**右臂抬起**并整体上移；
- 深色模式下也清晰可见。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/character.tsx
git commit -m "feat(cyber-office): 圆桌小人改用像素渲染"
```

---

### 🧠 P4.1 理解检查点

1. 为什么 P4 要保持 `Character` 的 `{name, color, status}` 接口不变？这对 `office-scene.tsx` 和后面接真实美术有什么好处？

   ***解耦与开闭原则**：这贯彻了“换内脏不换接口”的设计思路。`office-scene.tsx` 负责业务逻辑与场景的排布，它只需向下传递核心状态数据。保持接口不变，意味着外层场景**完全不需要修改代码**就能直接获得底层的视觉升级。*  

   ***无缝对接真实美术**：在后续 P4.3 接入真实美术时，新开发的 `SpriteCharacter` 组件同样只需要接收这三个状态即可工作。这样可以在 `Character` 内部灵活做路由分发（有素材就渲染 Sprite，无素材就 fallback 到 SVG），业务层毫无感知。*

   

2. `shape-rendering="crispEdges"` 解决了什么问题？如果不加会怎样？

   ***解决抗锯齿问题**：该属性强制浏览器在渲染 SVG 形状时关闭边缘的抗锯齿（Anti-aliasing）平滑处理。*  

   ***不加的后果**：如果不加该属性，浏览器的图形引擎会默认对 `<rect>` 的边缘进行羽化处理以求视觉平滑。这会导致像素块边缘发虚、模糊，完全破坏了像素画（Pixel Art）要求的“锐利、硬朗”的颗粒感。*

   

3. 为什么"举手"用 SVG 真实抬臂，而不是继续贴 ✋ emoji？（提示：想想 P4.3 换成真实精灵图后，emoji 和角色风格搭不搭。）

   ***消除视觉割裂感**：emoji 的外观完全由用户当前的操作系统和字体决定，通常是高清、圆润的矢量图。在一个复古像素网格世界中贴上原生 emoji，会产生极强的风格冲突与违和感。*  

   ***统一美术体系**：通过修改 SVG 内部 `<rect>` 的坐标来实现抬臂，是将行为表达收拢回像素画风体系内。这为 P4.3 奠定了正确的方向：后续换成真实精灵图后，角色的动作将由专门绘制的帧来展现，从而保证整体视觉的高度统一。* 

---

# 阶段 P4.2：状态 → 动效

目标：给小人加"活着"的感觉——闲置轻微呼吸浮动、发言时更快抖动、举手已在 P4.1 完成。所有动画尊重 `prefers-reduced-motion`。

---

### Task 3: 新增像素动画 keyframes

**Files:**

- Modify: `src/app/globals.css`

> 把动画定义放在全局 CSS，用 `@media (prefers-reduced-motion: no-preference)` 包起来——只有用户没开"减少动态效果"时才播放，晕动效的用户会看到静止画面。这是无障碍基本功。

- [ ] **Step 1: 在 globals.css 末尾追加**

Append to `src/app/globals.css`:

```css
/* ===== Cyber Office 像素小人动效 ===== */
/* 只有用户没有开启"减少动态效果"时才播放，尊重无障碍偏好 */
@media (prefers-reduced-motion: no-preference) {
  /* 闲置：缓慢上下呼吸浮动 */
  @keyframes pixel-idle {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-1px);
    }
  }

  /* 发言：更快更明显的抖动，像在说话 */
  @keyframes pixel-talk {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-1.5px);
    }
  }

  .pixel-idle {
    animation: pixel-idle 2.4s ease-in-out infinite;
  }

  .pixel-talk {
    animation: pixel-talk 0.32s ease-in-out infinite;
  }
}
```

- [x] **Step 2: 类型检查（CSS 不影响，跑一下确保没手滑）**

Run:

```bash
npx tsc --noEmit
```

Expected: 无错误。

- [x] **Step 3: 提交**

```bash
git add src/app/globals.css
git commit -m "feat(cyber-office): 新增像素小人 idle/talk 动画"
```

---

### Task 4: Character 按状态挂动画 + 发言高亮

**Files:**
- Modify: `src/components/cyber-office/character.tsx`

> 注意分层：**外层 div** 负责"举手上移"（`transform`），**内层 div** 负责"呼吸/说话"动画（也是 `transform`）。分两层是因为同一个元素上两个 `transform` 会互相覆盖。

- [x] **Step 1: 给内层加动画 class，并加发言高亮**

Modify `src/components/cyber-office/character.tsx`，把 `return (...)` 内部结构改为：

```tsx
  return (
    <div className="flex flex-col items-center gap-1">
      {/* 外层：举手时整体上移 */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: status === "raising_hand" ? "translateY(-6px)" : "none",
        }}
      >
        {/* 发言时脚下一抹橙色微光，强化"当前发言者" */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}

        {/* 内层：呼吸/说话动画。发言用 pixel-talk，其余用 pixel-idle */}
        <div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>
          <PixelCharacter color={color} status={status} />
        </div>

        {/* 思考省略号 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      <span
        className="text-[10px] font-medium"
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
```

- [x] **Step 2: 浏览器验证**

Run: `npm run dev`，打开 `/cyber-office` 播放样本会议
Expected:

- 所有小人平时**轻微上下呼吸**；
- 发言者**抖动更快**、脚下有**橙色微光**、头顶气泡逐字出字；
- 举手者抬臂 + 上移；
- 在系统里打开"减少动态效果"后刷新，小人**静止不动**（动画被 media query 关掉）。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/character.tsx
git commit -m "feat(cyber-office): 小人按状态播放呼吸/发言动效"
```

---

### 🧠 P4.2 理解检查点

1. 为什么"举手上移"和"呼吸动画"要分外层/内层两个 div，而不能写在同一个元素上？

   *因为**两者都用 `transform`，而一个元素只能有一个 `transform`**。如果写在同一个元素上，CSS 动画的 `transform: translateY(-1px)` 会和内联的 `transform: translateY(-6px)` **互相覆盖**——动画一播放，举手的 -6px 就被吃掉了。拆成嵌套两层后：外层专管"举手偏移"、内层专管"呼吸动画"，两个 transform 各自独立、**叠加而不打架**。这也是"关注点分离"：状态位移 vs 持续动画各管各的。*

   

2. `@media (prefers-reduced-motion: no-preference)` 包住动画，对哪类用户有意义？不包会有什么问题？

   *对**开启了系统"减少动态效果"的用户**——前庭功能障碍、晕动症、偏头痛、注意力敏感的人群。用这个 media query 包住动画，等于"只有没要求减少动态的用户才播放动画"。**不包的后果**：这些用户会被迫看到不断浮动/抖动的画面，可能引发头晕、恶心、不适——这是无障碍(a11y)缺陷，也是专业前端的基本素养。*

   

3. 发言高亮为什么选"脚下橙色微光"而不是给整个小人套一圈边框？（提示：想想设计红线和像素风的协调。）

   *三个原因：① **设计红线**——橙色是唯一强调色，一圈硬边框会像"UI 选中框"，和像素画风冲突；② **形状不匹配**——小人是不规则像素剪影，套一个矩形边框会露出难看的包围盒；③ **叙事更自然**——脚下一抹柔光像"聚光灯/舞台光"，读作"此刻这个人站在台上发言"，比生硬描边更克制、更融入场景。*

   

---

# 阶段 P4.3：像素图谱（pixel-map）精修角色

**目标**：把 P4.1 的简易 SVG 小人升级成**多色阶、有描边、可精修**的像素角色，达到确认过的高级感基准。做法不是手写几百个 `<rect>`，而是用**像素图谱（pixel-map）**：每个角色 = 一张字符网格（像 ASCII 画，每个字符对应调色板里一种颜色）+ 一份调色板。一个小渲染器把网格画成清晰像素。

**为什么用 pixel-map**：高精度不靠手搓；角色只是"网格 + 调色板"；衣服三色阶由角色主色自动推导；举手用"抬手臂图层"切换。干净、可维护、可无限堆细节。

**Files:**
- Create: `src/lib/cyber-office/character-atlas.ts`（调色板 + 角色像素图谱 + 组装函数）
- Create: `src/components/cyber-office/pixel-sprite.tsx`（canvas 像素渲染器）
- Modify: `src/components/cyber-office/character.tsx`、`office-scene.tsx`（改用 PixelSprite）

> 📌 **关于美术精度**：本阶段先落地**渲染系统 + 一套"起步版"角色形状**，让像素角色真实跑起来。之后**每个角色的精修图谱（眼镜/耳机/领带、四色阶阴影等）由总设计师逐个给你**——你贴进 `character-atlas.ts`、本地一跑、截图给我，我们实时调到位。像素画就是这样迭代出来的。

---

### Task 5: 角色图谱与调色板

**Files:**
- Create: `src/lib/cyber-office/character-atlas.ts`

> 这里定义：① `PixelMap` 类型（网格 + 调色板）；② `shade()` 把一个颜色调亮/调暗；③ `buildPalette()` 用角色主色推导整套配色；④ 共享的身体/手臂形状网格；⑤ `getCharacterLayers()` 把它们组装成"图层数组"。

- [x] **Step 1: 创建 character-atlas.ts**

Create `src/lib/cyber-office/character-atlas.ts`:

```ts
import type { RoleId, RoleStatus } from "./types";

// 一张像素图谱：rows 是网格（每个字符=一种颜色的 key），palette 是 key→颜色。
// 字符 '.' 或空格 = 透明。
export interface PixelMap {
  rows: string[];
  palette: Record<string, string>;
}

// 把 hex 颜色调亮(pct>0)或调暗(pct<0)，pct 取 -1~1。
// 原理：把每个通道朝白色(255)或黑色(0)按比例混合。
function shade(hex: string, pct: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const target = pct < 0 ? 0 : 255;
  const p = Math.abs(pct);
  const mix = (c: number) => Math.round(c + (target - c) * p);
  const hx = (c: number) => mix(c).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
}

// 由角色主色生成整套调色板：肤色/发色固定，衣服三色阶由主色推导。
function buildPalette(bodyColor: string): Record<string, string> {
  return {
    h: "#6b4a2f", // 头发基色
    H: "#916b45", // 头发高光
    g: "#48311f", // 头发暗部
    s: "#e9b78e", // 皮肤基色
    w: "#f6d3ac", // 皮肤高光
    k: "#c78f68", // 皮肤暗部
    e: "#2a2333", // 眼睛
    o: "#2e2a38", // 描边
    b: bodyColor, // 衣服基色（角色主色）
    B: shade(bodyColor, 0.28), // 衣服高光
    d: shade(bodyColor, -0.28), // 衣服暗部
    c: shade(bodyColor, 0.45), // 领口
  };
}

// 共享的角色形状（12×14 起步版；每个字符对应上面调色板里的一种颜色）
const BODY_ROWS = [
  "............",
  "...hhhhhh...",
  "..hhhhhhhh..",
  "..hhsssshh..",
  "..hssssssh..",
  "..hsessesh..",
  "..hssssssh..",
  "..hsskkssh..",
  "....ssss....",
  "..bbbbbbbb..",
  "..bbbccbbb..",
  "..bbbbbbbb..",
  "..bbbbbbbb..",
  "..dddddddd..",
];

// 手臂单独成图层：垂手 / 举手 两套，切换即可，不用改身体网格。
const ARMS_DOWN = [
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  "............",
  ".b........b.",
  ".b........b.",
  ".b........b.",
  ".s........s.",
  "............",
];

const ARMS_UP = [
  "............",
  "............",
  "............",
  "............",
  "..........s.",
  "..........b.",
  "..........b.",
  "..........b.",
  "..........b.",
  ".b..........",
  ".b..........",
  ".b..........",
  ".s..........",
  "............",
];

// 每个角色的"配件层"（眼镜/耳机/领带…）。起步先留空，
// 之后由总设计师逐个给你精修图谱，往这里加。
const ACCESSORIES: Partial<Record<RoleId, PixelMap>> = {};

// 把某个角色组装成"图层数组"：身体 → 手臂 →（可选）配件，后画的盖在先画的上面。
export function getCharacterLayers(
  id: RoleId,
  color: string,
  status: RoleStatus,
): PixelMap[] {
  const palette = buildPalette(color);
  const arms = status === "raising_hand" ? ARMS_UP : ARMS_DOWN;
  const accessory = ACCESSORIES[id];
  return [
    { rows: BODY_ROWS, palette },
    { rows: arms, palette },
    ...(accessory ? [accessory] : []),
  ];
}
```

- [x] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/lib/cyber-office/character-atlas.ts
git commit -m "feat(cyber-office): 新增像素角色图谱与调色板"
```

---

### Task 6: 像素渲染器

**Files:**
- Create: `src/components/cyber-office/pixel-sprite.tsx`

> 用 `<canvas>` 把图层数组画出来：每个非透明像素画一个 1×1 方块，再靠 CSS 放大 + `image-rendering: pixelated` 保持锐利。canvas 比"几百个 DOM 方块"性能好得多。

- [x] **Step 1: 创建 pixel-sprite.tsx**

Create `src/components/cyber-office/pixel-sprite.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { PixelMap } from "@/lib/cyber-office/character-atlas";

const CELL = 4; // 每个像素放大成 4×4 屏幕像素（想让小人更大就调大）

export default function PixelSprite({ layers }: { layers: PixelMap[] }) {
  const ref = useRef<HTMLCanvasElement>(null);

  // 画布的逻辑尺寸 = 网格列数 × 行数（取所有图层里最大的范围）
  const cols = Math.max(
    ...layers.map((l) => Math.max(...l.rows.map((r) => r.length))),
  );
  const rows = Math.max(...layers.map((l) => l.rows.length));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false; // 不做平滑，保持硬像素
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 一层一层画：body → arms →（可选）配件，后面的盖在前面的上
    for (const layer of layers) {
      for (let y = 0; y < layer.rows.length; y++) {
        const row = layer.rows[y];
        for (let x = 0; x < row.length; x++) {
          const color = layer.palette[row[x]];
          if (!color) continue; // '.'、空格、未定义 = 透明，跳过
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1); // 先按 1:1 画，再靠 CSS 放大
        }
      }
    }
  }, [layers]);

  return (
    <canvas
      ref={ref}
      width={cols}
      height={rows}
      aria-hidden
      style={{
        width: cols * CELL,
        height: rows * CELL,
        imageRendering: "pixelated", // 放大保持像素锐利
        display: "block",
      }}
    />
  );
}
```

- [x] **Step 2: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/cyber-office/pixel-sprite.tsx
git commit -m "feat(cyber-office): 新增 canvas 像素渲染器"
```

---

### Task 7: 接入 Character 与场景

**Files:**
- Modify: `src/components/cyber-office/office-scene.tsx`
- Modify: `src/components/cyber-office/character.tsx`

> `Character` 要按角色 id 取图谱，所以先给它补 `id`；然后内部把 `<PixelCharacter/>` 换成 `<PixelSprite/>`。P4.2 的外层动画（呼吸/发言/举手上移/橙光）全部保留。

- [x] **Step 1: office-scene 把 id 传给 Character**

Modify `src/components/cyber-office/office-scene.tsx`，找到渲染 `<Character .../>` 的地方，加上 `id={id}`：

```tsx
              <Character
                id={id}
                name={role.name}
                color={role.color}
                status={runtime?.status ?? "idle"}
              />
```

- [x] **Step 2: 用 PixelSprite 重写 Character**

Replace `src/components/cyber-office/character.tsx` with:

```tsx
import type { RoleId, RoleStatus } from "@/lib/cyber-office/types";
import { getCharacterLayers } from "@/lib/cyber-office/character-atlas";
import PixelSprite from "./pixel-sprite";

interface CharacterProps {
  id: RoleId;
  name: string;
  color: string;
  status: RoleStatus;
}

export default function Character({ id, name, color, status }: CharacterProps) {
  const isActive = status === "speaking" || status === "raising_hand";
  // 组装该角色的像素图层（身体 + 手臂 + 配件）
  const layers = getCharacterLayers(id, color, status);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* 外层：举手时整体轻微上移，做出"起身"感 */}
      <div
        className="relative transition-transform duration-300"
        style={{
          transform: status === "raising_hand" ? "translateY(-4px)" : "none",
        }}
      >
        {/* 发言时脚下橙色微光 */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-8 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}

        {/* 内层：呼吸/说话动画（来自 P4.2 的 globals.css） */}
        <div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>
          <PixelSprite layers={layers} />
        </div>

        {/* 思考省略号 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      <span
        className="text-[10px] font-medium"
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
```

> `PixelCharacter`（P4.1 的 SVG 版）现在不再被引用。可以保留它作为参考/备用，也可以删掉——都不影响构建。

- [x] **Step 3: 类型检查 + 提交**

```bash
npx tsc --noEmit
git add src/components/cyber-office/character.tsx src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 角色改用像素图谱渲染"
```

---

### Task 8: 验证

- [x] **Step 1: 浏览器验证**

Run: `npm run dev`，打开 `/cyber-office` 播放样本会议
Expected:

- 圆桌上是**像素角色**（头发/皮肤/衣服有阴影层次），每个角色衣服颜色不同（来自角色主色三色阶）；
- 被点名的角色**右臂抬起**（ARMS_UP 图层）+ 整体上移；
- 呼吸、发言橙光、思考省略号照常（来自 P4.2 外层动画）；
- 开启"减少动态效果"后刷新，角色静止（P4.2 的 media query 生效）。

- [x] **Step 2: 全量校验 + 提交**

```bash
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: 全部通过，`/cyber-office` 仍在路由列表里。若都绿，本任务无需额外提交（前面每步已提交）。

---

### 美术工作流：角色如何精修到位

Task 5–8 跑通后，圆桌上已经是"起步版"像素角色。接下来把它们**逐个精修到高级感基准**，流程是迭代式的：

1. **总设计师给图谱**：我把某个角色的精修 `PixelMap`（更高分辨率网格 + 四色阶 + 配件，如生信的眼镜、前端的耳机、审稿人的红笔）发给你。
2. **你贴进 atlas**：把它加进 `character-atlas.ts`——放进 `ACCESSORIES[角色id]`（配件层），或替换 `BODY_ROWS`（若是整体升级）。
3. **本地跑 + 截图**：`npm run dev` 看效果，截图发我。
4. **实时微调**：我根据截图调色/调形，再给你更新版。像素画就是这样一轮轮抠出来的。

> 这一步没有"一次写完的代码"，是**你我协作的美术迭代**。你只负责"贴图谱 + 截图 + 反馈"，图谱由总设计师产出。等所有角色定稿，再统一提交。

**建议起步顺序**：先精修 1 个角色（比如生信研究员）走通"我给图谱→你贴→截图→我调"的闭环，顺了再批量做其余角色。

---

### 🧠 P4.3 理解检查点

1. pixel-map 用"网格 + 调色板"表示角色，比手写几百个 `<rect>` 好在哪？（想想加细节、换色、复用时的成本）
2. `buildPalette` 为什么只靠角色的一个主色，就能生成衣服的高光/基色/暗部三色阶？`shade()` 做了什么？
3. 举手为什么用"切换 `ARMS_UP` 图层"实现，而不是去改 `BODY_ROWS`？分层（body / arms / 配件）带来什么好处？

---

# 阶段 P4.4：场景打磨 + 桌子 + 小猫

**目标**：让圆桌画面像"一桌人围坐 + 一只猫在桌上"，而不是"贴在圆上的图标"。

> 📌 **git / Obsidian 记录**：每个 Task 末尾都有 commit。做完一个，把"阶段 · Task 号 · commit hash"给记录员 AI，它按统一格式写 Obsidian 日志（见交接文档）。

---

### Task 9: 座位对齐 + 前后遮挡

**Files:** Modify `src/components/cyber-office/office-scene.tsx`

> 像素角色比原来的方块高，要让小人"坐"在座位点上；再按屏幕纵向给 z-index，做出近大远小的前后遮挡。

- [x] **Step 1: 调整小人定位与层级**

在 `office-scene.tsx` 顶部尺寸常量区，把 `CHAR` 拆成宽高（按 PixelSprite 实际尺寸 12×14 格 × CELL 4 = 48×56）：

```tsx
const CHAR_W = 48; // 像素角色宽（12 格 × 4）
const CHAR_H = 56; // 像素角色高（14 格 × 4）
```

把渲染每个小人的外层 `<div ... style={{ left: seat.x - CHAR / 2, top: seat.y - CHAR / 2 }}>` 改成：

```tsx
          <div
            key={id}
            className="absolute"
            style={{
              left: seat.x - CHAR_W / 2,
              top: seat.y - CHAR_H * 0.72, // 让"脚"落在座位点，而不是几何中心
              zIndex: Math.round(seat.y), // 越靠下层级越高 → 盖住后排
            }}
          >
```

- [x] **Step 2: 验证 + 提交**

`npm run dev` 看小人是否像坐在圈上、前排盖住后排。

```bash
npx tsc --noEmit
git add src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 座位对齐与前后遮挡"
```

---

### Task 10: 精修桌子（木质圆桌）

**Files:** Modify `src/components/cyber-office/office-scene.tsx`

> 把中央那个灰色 CSS 圆盘换成有厚度的木质圆桌：椭圆桌面 + 底部暗边（桌沿）+ 顶部高光。

- [x] **Step 1: 替换圆桌 div**

把现在中央圆桌那个 `<div className="absolute rounded-full ...">` 换成：

```tsx
      {/* 木质圆桌：椭圆桌面 + 桌沿厚度 + 顶部高光 */}
      <div
        className="absolute rounded-full"
        style={{
          width: RADIUS * 1.5,
          height: RADIUS * 0.95, // 压扁成椭圆，做出俯视透视
          left: CENTER - (RADIUS * 1.5) / 2,
          top: CENTER - (RADIUS * 0.95) / 2,
          background: "#b98a52", // 木色
          boxShadow:
            "inset 0 -6px 0 #8f6538, inset 0 5px 0 #c9a06a, 0 4px 0 #6f4f2a", // 桌沿暗边 + 顶部高光 + 底部厚度
          imageRendering: "pixelated",
          zIndex: 1,
        }}
      />
```

- [x] **Step 2: 验证 + 提交**

```bash
git add src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 精修中央木质圆桌"
```

---

### Task 11: 桌上小猫（渲染）

**Files:**
- Create: `src/components/cyber-office/cat.tsx`
- Modify: `src/components/cyber-office/office-scene.tsx`

- [x] **Step 1: 创建 Cat 组件**

Create `src/components/cyber-office/cat.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import PixelSprite from "./pixel-sprite";
import type { PixelMap } from "@/lib/cyber-office/character-atlas";

// 一只坐着的橘猫（10×8 起步版，之后可精修）
const CAT_LAYER: PixelMap = {
  palette: {
    c: "#e8a24a", // 身体
    f: "#f4c07a", // 脸/浅色
    e: "#2a2333", // 眼睛
    p: "#e88a94", // 鼻子（粉）
    w: "#f8ead6", // 胸口白
  },
  rows: [
    "..c....c..",
    ".cccccccc.",
    ".ceffffec.",
    ".cfppppfc.",
    ".cffffffc.",
    "..cccccc..",
    "..cwwwwc..",
    "..cc..cc..",
  ],
};

// 点一下随机蹦一句
const REACTIONS = ["喵~", "呼噜呼噜~", "喵呜！", "……（打了个哈欠）"];

export default function Cat() {
  const [reaction, setReaction] = useState<string | null>(null);
  const [hopping, setHopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    setHopping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReaction(null);
      setHopping(false);
    }, 1600);
  };

  return (
    <button
      type="button"
      onClick={poke}
      aria-label="逗一逗桌上的小猫"
      className="relative block cursor-pointer border-0 bg-transparent p-0"
    >
      {/* 反应气泡 */}
      {reaction && (
        <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-background px-2 py-0.5 text-[10px] text-text-secondary shadow-sm">
          {reaction}
        </span>
      )}
      {/* 点击时套上 cat-hop 动画类 */}
      <span className={hopping ? "block cat-hop" : "block"}>
        <PixelSprite layers={[CAT_LAYER]} />
      </span>
    </button>
  );
}
```

- [x] **Step 2: 把猫放到桌子中央**

在 `office-scene.tsx` 顶部 import：

```tsx
import Cat from "./cat";
```

在圆桌 `<div>` 之后、小人 `map` 之前（或之后都行，靠 zIndex 控层级）插入：

```tsx
      {/* 桌上的小猫，zIndex 高于桌子、低于前排小人 */}
      <div
        className="absolute"
        style={{ left: CENTER - 20, top: CENTER - 30, zIndex: 20 }}
      >
        <Cat />
      </div>
```

- [x] **Step 3: 验证 + 提交**

`npm run dev` 看猫是否坐在桌上。

```bash
npx tsc --noEmit
git add src/components/cyber-office/cat.tsx src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 桌上新增像素小猫"
```

---

### Task 12: 小猫互动动画

**Files:** Modify `src/app/globals.css`

- [x] **Step 1: 在 `@media (prefers-reduced-motion: no-preference)` 块内追加**

```css
  /* 小猫被点击时蹦一下 */
  @keyframes cat-hop {
    0%,
    100% {
      transform: translateY(0);
    }
    35% {
      transform: translateY(-6px);
    }
  }

  .cat-hop {
    animation: cat-hop 0.4s ease;
  }
```

- [x] **Step 2: 验证 + 提交**

点小猫应蹦一下 + 冒随机气泡；开启"减少动态效果"时不蹦（气泡仍在）。

```bash
git add src/app/globals.css
git commit -m "feat(cyber-office): 小猫点击互动动画"
```

---

### Task 13: PNG → PixelMap 脚本（美术流水线，可选）

## ① 先定一个"风格总纲"（每次都带上，保证统一）

```
clean modern pixel art, minimalist contemporary office aesthetic,
flat muted neutral palette (white, light gray, soft accent), clean chunky pixels,
limited colors, soft top lighting, front-facing, plain background, no anti-aliasing, no text
```

## ② 角色：一次生成一整排（强烈推荐）

图像 AI **记不住同一个角色**，分开生成会风格不一。所以**用一张图出全部角色**，风格才统一：

```
A character sheet of 6 cozy pixel-art office workers, front-facing, evenly spaced
in one row, each a distinct person with a clear accessory:
1) a facilitator wearing a headset,
2) a product manager with a tie,
3) a frontend engineer in a hoodie with headphones,
4) a bioinformatics researcher with round glasses and a white lab coat,
5) a reviewer with reading glasses holding a red pen,
6) a note-taker holding a small notebook.
[粘上面的风格总纲]. Small sprite characters, plain background, no text.
```

## ③ 小猫

```
A single cute chibi orange tabby cat, sitting upright and facing forward, big round eyes, small pink nose, white chest patch, tail curled to one side, tiny and adorable. [风格锚]. Centered, isolated on a plain flat light-gray background, sprite-sized, no shadow baked in.
```

## ④ 桌子

```
A modern round office meeting table seen from a top-down, slightly tilted angle, elliptical matte white / light-gray tabletop with a thin clean edge showing slight thickness, sleek minimalist single pedestal base, subtle soft shadow underneath. Contemporary clean office style, NOT wooden, NOT rustic. [风格锚]. Centered, isolated object on a plain flat light-gray background, no chairs, no people, no items on the table.
```

## ⑤ 整体场景（当"氛围标杆"用）

```
A minimalist modern office meeting room interior as a soft background scene, gentle high-angle view, warm light wood floor, one large bright window with soft daylight on one side, a small potted plant in a corner, clean neutral walls, calm contemporary aesthetic, muted and low-contrast so foreground characters stand out. [风格锚]. NO table and NO people in the center (they are added separately), empty central floor area, no text.
```



**Files:**

- Create: `scripts/png-to-pixelmap.mjs`

> 用于把 Piskel/像素编辑器导出的**干净 PNG**确定性地转成 PixelMap（网格 + 调色板），贴进 `character-atlas.ts`。**比让 AI"看图抄网格"可靠得多。**

- [x] **Step 1: 安装 PNG 解码依赖**

```bash
npm install -D pngjs
```

- [ ] **Step 2: 创建脚本**

Create `scripts/png-to-pixelmap.mjs`:

```js
// 用法：node scripts/png-to-pixelmap.mjs 你的图.png
import fs from "fs";
import { PNG } from "pngjs";

const file = process.argv[2];
if (!file) {
  console.error("用法: node scripts/png-to-pixelmap.mjs <input.png>");
  process.exit(1);
}

const png = PNG.sync.read(fs.readFileSync(file));
const keys = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const colorToKey = {};
const palette = {};
let ki = 0;
const rows = [];

for (let y = 0; y < png.height; y++) {
  let row = "";
  for (let x = 0; x < png.width; x++) {
    const i = (png.width * y + x) << 2;
    const r = png.data[i];
    const g = png.data[i + 1];
    const b = png.data[i + 2];
    const a = png.data[i + 3];
    if (a < 128) {
      row += "."; // 透明像素
      continue;
    }
    const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
    if (!(hex in colorToKey)) {
      colorToKey[hex] = keys[ki++];
      palette[colorToKey[hex]] = hex;
    }
    row += colorToKey[hex];
  }
  rows.push(row);
}

// 直接打印成能贴进 character-atlas.ts 的形状
console.log(JSON.stringify({ rows, palette }, null, 2));
```

- [ ] **Step 3: 试跑 + 提交**

```bash
node scripts/png-to-pixelmap.mjs public/cyber-office/some.png
git add package.json package-lock.json scripts/png-to-pixelmap.mjs
git commit -m "chore(cyber-office): 新增 PNG 转 PixelMap 脚本"
```

---

### Task 14: 放大场景，协调整体比例

**Files:**
- Modify: `src/components/cyber-office/pixel-sprite.tsx`
- Modify: `src/components/cyber-office/office-scene.tsx`

> 现在场景 340px、角色 CELL=4，缩在一大片空白里太小。整体等比放大一档。

- [ ] **Step 1: 角色像素放大**

`pixel-sprite.tsx` 里 `const CELL = 4;` 改成：

```tsx
const CELL = 5; // 每个像素 5×5，让角色/小猫更大
```

- [ ] **Step 2: 场景与常量放大**

`office-scene.tsx` 顶部常量改为：

```tsx
const SCENE = 480; // 场景边长（原 340）
const CENTER = SCENE / 2; // 240
const RADIUS = 170; // 座位环半径（原 120）
const CHAR_W = 60; // 角色宽 = 12 格 × CELL 5
const CHAR_H = 70; // 角色高 = 14 格 × CELL 5
```

> 桌子尺寸用 `RADIUS` 推导，会自动跟着变大；小猫位置在 Task 11 用了 `CENTER - 20 / CENTER - 30`，放大后改成 `CENTER - 25`（猫宽 10×5=50）、`top: CENTER - 40`，让它坐正在桌面上。

- [ ] **Step 3: 验证 + 提交**

`npm run dev` 看整体是否更饱满、居中协调。

```bash
npx tsc --noEmit
git add src/components/cyber-office/pixel-sprite.tsx src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 放大场景与角色，协调整体比例"
```

---

### Task 15: 发言字幕面板（解决气泡重叠/截断）

**Files:**
- Modify: `src/components/cyber-office/office-scene.tsx`
- Modify: `src/components/cyber-office/cyber-office.tsx`

> 头顶小气泡挤在一起、盖住桌子、看不全。因为是**轮流发言（同一时刻只有一人说）**，最佳做法是把发言文字放到场景下方一个**固定可读的字幕面板**里，完整显示"谁在说 + 说了什么"。头顶气泡去掉，避免重叠。

- [ ] **Step 1: 去掉头顶气泡**

在 `office-scene.tsx` 里删掉渲染 `<SpeechBubble ... />` 的那一行（连同不再需要的 `SpeechBubble` import）。小人的"发言中"仍由抖动 + 脚下橙光 + 下面的字幕面板表达。

- [ ] **Step 2: 加字幕面板**

在 `cyber-office.tsx` 顶部 import：

```tsx
import { getRole } from "@/lib/cyber-office/roles";
```

在渲染 `<OfficeScene state={...} />` 的**紧下方**，用同一个 `state` 加一个面板（把下面的 `state` 换成你传给 OfficeScene 的那个状态变量）：

```tsx
      {/* 发言字幕：完整显示当前发言者的话，不再挤在头顶 */}
      {state.activeSpeaker && state.roles[state.activeSpeaker]?.bubble && (
        <div className="rounded-lg border border-border bg-bg-subtle px-5 py-4">
          <p className="mb-1.5 text-xs font-medium text-accent">
            {getRole(state.activeSpeaker).name}
          </p>
          <p className="text-sm leading-[1.7] text-text-secondary">
            {state.roles[state.activeSpeaker].bubble}
          </p>
        </div>
      )}
```

- [ ] **Step 3: 验证 + 提交**

发言时下方字幕**完整可读**、不重叠；主持人串场仍在场景上方那行。

```bash
npx tsc --noEmit
git add src/components/cyber-office/office-scene.tsx src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 发言改用字幕面板，去掉重叠气泡"
```

> 想保留"头顶冒泡"的趣味也行——那就把气泡宽度放宽、只在 `activeSpeaker` 上显示、并等 Task 14 放大后再看是否还挤。但**可读性优先，推荐字幕面板**。

---

### 角色形象精修工作流（贯穿 P4.4）

角色/小猫的"高级感精修"是迭代的，两条路任选：

- **路线 A（推荐，最可控）**：你提不满意的点 → 我或另一个 AI **直接改 PixelMap 网格**（就是文本，改某几个格子的字符/加配件层）→ 你贴进 `character-atlas.ts` 截图 → 再调。
- **路线 B（想用画的）**：在 **Piskel**（免费网页像素编辑器）画/改在干净网格上 → 导出 PNG → 跑 **Task 13 的脚本** → 得到精确 PixelMap → 贴进 atlas。

> ⚠️ 不建议"ChatGPT 生成像素图 → AI 转 PixelMap"：图像生成不在整齐网格上、AI 逐像素抄网格不准，结果噪。要么直接改网格（A），要么走脚本（B）。

---

# 阶段 P4.5：无障碍与响应式收尾

**目标**：动画尊重偏好（P4.2 已做大半）、场景在窄屏能缩放、小人有可访问名称。

**Files:** Modify `office-scene.tsx`、`cyber-office.tsx`

要点与做法：

1. **场景自适应缩放**：现在场景固定 `340px`，窄屏可能挤。做法：给场景外层包一个容器，用 `width: min(340px, 100%)` + 等比缩放（`aspect-square` + 内部按容器宽度百分比定位，或用 `transform: scale()` 配合 `transform-origin`）。目标：手机上圆桌整体缩小、不溢出。

2. **减少动态效果全局兜底**：确认 P4.2 的 media query 覆盖了所有循环动画（idle/talk/sprite）。

3. **可访问名称**：给每个小人容器加 `aria-label={role.name}`，读屏能报出角色名。

4. **最终验收**：`npm run test && npx tsc --noEmit && npm run lint && npm run build` 全绿；桌面/移动、深/浅色、开/关 reduced-motion 四个维度各扫一遍。

---

## 完成标准（P4 整体）

- [ ] 圆桌小人为 pixel-map 像素角色（多色阶阴影，每角色可精修）
- [ ] idle 呼吸、举手抬臂上移、发言抖动+橙色微光、思考省略号均正常
- [ ] 木质圆桌 + 桌上小猫，点小猫会蹦一下并冒气泡
- [ ] `prefers-reduced-motion` 开启时所有循环动画静止
- [ ] 深/浅色、桌面/窄屏均可用
- [ ] `npm run test`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 全部通过

> P4.3 的真实素材、P4.4/P4.5 的细节可在 P4.1/P4.2 跑通、你熟悉了渲染层之后再逐步推进。下一阶段 P5：轻量自定义角色、总结导出、导航栏入口、构建历史时间轴。
