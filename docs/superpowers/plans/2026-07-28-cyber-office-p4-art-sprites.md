# Cyber Office P4-ART 精灵图接入实现计划

> **教程说明（给 Chenyu）：** 这份是"照着一步步敲"的教程。美术资产（角色/桌子/猫/背景精灵图）已全部产出并放好，本文只写**代码接入**。每个 Task 标了改哪个文件、怎么改、贴出带注释的代码、末尾给提交命令。做完一个 Task 提交后，把 commit hash 发给记录员 AI 生成 Obsidian 日志。步骤用 `- [ ]` 勾选跟踪。

**Goal:** 把圆桌上代码画的粗像素占位，换成手绘精灵图（6 角色 × 3 姿势）；放大舞台、铺固定背景、换现代简约桌子、小猫多帧互动、发言改下方字幕面板。

**Architecture:** 守住"换内脏不换接口"——`Character` 对外仍是 `{ id, name, color, status }`，`OfficeScene` 仍只消费 `MeetingState`，事件流 / 回放 / 实时逻辑全不动。本阶段只替换渲染层：`<canvas>` 画 PixelMap → 改成贴 `<img>` 精灵图。

**Tech Stack:** React、Next.js 16（App Router）、普通 `<img>`（不用会重编码的优化组件，避免糊图）、CSS transform 动效（沿用 `globals.css` 的 `pixel-idle` / `pixel-talk` / `cat-hop`，尊重 `prefers-reduced-motion`）。

---

## 设计边界

- **不做深浅色自适应**：舞台自带固定背景图，用户切黑夜模式时 office 内部不变色。
- **不做多帧帧动画**：呼吸/发言/起身用 CSS transform；姿势切换是离散换图。嘴巴开合等留待以后。
- **角色 6 个**：host/pm/frontend/bio/reviewer/recorder。总结 Agent(summarizer) 不入座，本阶段不做形象。

## 前置：美术资产已就位（无需再动手）

```txt
public/sprites/
  <id>-standing.png / <id>-raising.png / <id>-sitting.png   # 6 角色 × 3 姿势 = 18 张
  cat-sit.png / cat-happy.png / cat-blink.png               # 小猫 3 帧
public/cyber-office/
  table.png        # 现代简约白圆桌（透明底）
  backdrop.png     # 会议室背景（整张铺底）
```

> 这些图由"AI 生成多帧大图 + `scripts/split-poses.mjs` / `scripts/cutout.mjs` 切齐去底"产出。流水线和出图 prompt 见文末附录，本阶段用不到。

## 状态 → 姿势映射（本阶段的核心约定）

| RoleStatus | 显示姿势 | 含义 |
|---|---|---|
| `idle` / `thinking` | `sitting` | 平时坐着 |
| `raising_hand` | `raising` | 被点名，举手 |
| `speaking` | `standing` | 起身发言 |

## 文件结构

本阶段涉及的文件：

```txt
src/components/cyber-office/
  character.tsx      # 改：内部换成 <img> 精灵，按 status 选姿势
  office-scene.tsx   # 改：放大舞台、铺背景、换桌子、脚底定位、去头顶气泡
  cat.tsx            # 改：粗像素 → 3 帧精灵切换
  cyber-office.tsx   # 改：加发言字幕面板
  pixel-character.tsx / pixel-sprite.tsx / speech-bubble.tsx   # 删：不再使用
src/lib/cyber-office/
  character-atlas.ts # 删：不再使用
src/app/globals.css  # 无需改（已有 pixel-idle/talk、cat-hop）
```

---

### Task 1: Character 换成精灵图

**Files:**
- Modify: `src/components/cyber-office/character.tsx`

> `Character` 对外接口不变，只把内部"canvas 画 PixelMap"换成一张 `<img>`，按 `status` 选 `sitting/raising/standing`。P4.2 的外层动画（呼吸/发言橙光/举手上移/思考省略号）全部保留。

- [x] **Step 1: 整体替换 character.tsx**

Replace `src/components/cyber-office/character.tsx` with:

```tsx
import type { RoleId, RoleStatus } from "@/lib/cyber-office/types";

// 每种状态显示哪张姿势精灵：闲置/思考=坐，被点名=举手，发言=起身。
const POSE: Record<RoleStatus, "standing" | "raising" | "sitting"> = {
  idle: "sitting",
  thinking: "sitting",
  raising_hand: "raising",
  speaking: "standing",
};

// 角色在场景里的显示高度（px）。所有精灵原生 320 高、宽度略有差异，
// 这里统一按“高度”缩放、宽度自动，保证 6 个角色一样高、脚在同一条线。
// office-scene 定位也用这个值，所以 export 出去共用。
export const CHAR_DISPLAY_H = 112;

interface CharacterProps {
  id: RoleId;
  name: string;
  color: string;
  status: RoleStatus;
}

export default function Character({ id, name, color, status }: CharacterProps) {
  // 举手或发言时，名字用橙色高亮，突出“当前在场上的人”
  const isActive = status === "speaking" || status === "raising_hand";
  const pose = POSE[status];

  return (
    // aria-label 让读屏能报出角色名；下面 <img alt=""> 避免重复播报
    <div className="flex flex-col items-center gap-1" aria-label={name}>
      {/* 外层：举手/发言时整体轻微上移，做出“起身”感 */}
      <div
        className="relative transition-transform duration-300"
        style={{ transform: isActive ? "translateY(-4px)" : "none" }}
      >
        {/* 发言时脚下橙色微光，强化“当前发言者” */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}

        {/* 内层：呼吸/说话动画（来自 globals.css，尊重 reduced-motion） */}
        <div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>
          <img
            src={`/sprites/${id}-${pose}.png`}
            alt=""
            style={{ height: CHAR_DISPLAY_H, width: "auto", display: "block" }}
            draggable={false}
          />
        </div>

        {/* 思考省略号：仅 thinking 状态显示，浮在头顶 */}
        {status === "thinking" && (
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm text-text-muted">
            …
          </span>
        )}
      </div>

      {/* 名字 */}
      <span
        className="text-[11px] font-medium"
        style={{ color: isActive ? "#ea580c" : "var(--text-muted)" }}
      >
        {name}
      </span>
    </div>
  );
}
```

- [x] **Step 2: 类型检查**

> 这一步会暂时报错（office-scene 里 `<SpeechBubble/>`、`character-atlas` 相关引用还在），Task 2 改完 office-scene 后就消失。先确认没有 character.tsx 自身的语法错。

Run:

```bash
npx tsc --noEmit
```

Expected: 仅剩与 office-scene / 待删文件相关的报错，character.tsx 本身无错。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/character.tsx
git commit -m "feat(cyber-office): 角色改用精灵图渲染"
```

---

### Task 2: 放大舞台 + 固定背景 + 换桌子 + 脚底定位

**Files:**
- Modify: `src/components/cyber-office/office-scene.tsx`

> 一次把“舞台”做到位：场景放大、铺 `backdrop.png`、中央换成 `table.png`、角色按“脚落座位点”定位、去掉头顶气泡（发言改到 Task 4 的字幕面板）。

- [x] **Step 1: 整体替换 office-scene.tsx**

Replace `src/components/cyber-office/office-scene.tsx` with:

```tsx
"use client"; // 随状态变化，标记为客户端组件

import type { MeetingState } from "@/lib/cyber-office/types";
import { computeSeatPositions } from "@/lib/cyber-office/seats";
import { getRole } from "@/lib/cyber-office/roles";
import Character, { CHAR_DISPLAY_H } from "./character";
import Cat from "./cat";

const SCENE = 560; // 场景边长（放大自 340）
const CENTER = SCENE / 2; // 视觉圆心 280
const RADIUS = 175; // 座位环半径
const SEAT_CY = CENTER + 15; // 座位环圆心略下移，避免顶排的头被裁掉

// 只负责“把 state 画出来”，不含任何逻辑——纯展示。
export default function OfficeScene({ state }: { state: MeetingState }) {
  // 根据参会人数算出每个座位的坐标（圆心用 SEAT_CY，比视觉中心略低）
  const seats = computeSeatPositions(
    state.participants.length,
    RADIUS,
    CENTER,
    SEAT_CY,
  );

  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-border"
      style={{
        width: SCENE,
        height: SCENE,
        maxWidth: "100%", // 窄屏时不横向溢出（等比缩放见 Task 5）
        // 固定背景：不随网站深浅色变化
        backgroundImage: "url(/cyber-office/backdrop.png)",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* 现代简约白圆桌，居中略偏下 */}
      <img
        src="/cyber-office/table.png"
        alt=""
        className="pointer-events-none absolute"
        style={{
          width: RADIUS * 1.7,
          height: "auto",
          left: CENTER - (RADIUS * 1.7) / 2,
          top: CENTER - RADIUS * 0.5,
          zIndex: 1,
        }}
      />

      {/* 桌上的小猫（zIndex 高于桌子） */}
      <div
        className="absolute"
        style={{
          left: CENTER,
          top: CENTER - RADIUS * 0.28,
          transform: "translateX(-50%)",
          zIndex: 6,
        }}
      >
        <Cat />
      </div>

      {/* 一圈角色：遍历参会者，按座位坐标绝对定位 */}
      {state.participants.map((id, i) => {
        const seat = seats[i]; // 第 i 个人的座位坐标
        const runtime = state.roles[id]; // 运行时状态（状态/气泡）
        const role = getRole(id); // 静态信息（名字/颜色）
        return (
          <div
            key={id}
            className="absolute"
            style={{
              left: seat.x,
              top: seat.y - CHAR_DISPLAY_H, // 让“脚”落在座位点
              transform: "translateX(-50%)", // 宽度不一也水平居中
              zIndex: Math.round(seat.y), // 越靠下越前，盖住后排
            }}
          >
            <Character
              id={id}
              name={role.name}
              color={role.color}
              // ?. 与 ?? 双保险：runtime 不存在就当 idle，避免崩溃
              status={runtime?.status ?? "idle"}
            />
          </div>
        );
      })}
    </div>
  );
}
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 仅剩 cat.tsx（还在用 PixelSprite）与待删文件相关报错，office-scene 本身无错。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 放大舞台、铺背景、换现代简约桌子"
```

---

### Task 3: 小猫换成 3 帧精灵切换

**Files:**
- Modify: `src/components/cyber-office/cat.tsx`

> 点击时切到 `cat-happy`（眯眼抬爪）+ `cat-hop`（CSS 蹦）+ 随机气泡，1.6s 后切回 `cat-sit`。三帧同画布对齐，直接换 `src` 不会跳。

- [x] **Step 1: 整体替换 cat.tsx**

Replace `src/components/cyber-office/cat.tsx` with:

```tsx
"use client";

import { useRef, useState } from "react";

// 小猫在场景里的显示高度（px）
const CAT_DISPLAY_H = 66;

// 点一下随机蹦一句
const REACTIONS = ["喵~", "呼噜呼噜~", "喵呜！", "……（打了个哈欠）"];

export default function Cat() {
  const [frame, setFrame] = useState<"sit" | "happy">("sit"); // 当前显示哪一帧
  const [reaction, setReaction] = useState<string | null>(null);
  const [hopping, setHopping] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = () => {
    setReaction(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    setFrame("happy"); // 切到开心抬爪帧
    setHopping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setReaction(null);
      setFrame("sit"); // 切回平静坐姿
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
      {/* 点击时套上 cat-hop 动画类（来自 globals.css） */}
      <span className={hopping ? "block cat-hop" : "block"}>
        <img
          src={`/sprites/cat-${frame}.png`}
          alt=""
          style={{ height: CAT_DISPLAY_H, width: "auto", display: "block" }}
          draggable={false}
        />
      </span>
    </button>
  );
}
```

> 可选增强（先不做也行）：用 `setInterval` 每隔几秒把 `frame` 短暂切到 `"blink"` 一帧再切回，让 idle 时也有眨眼。要做的话再把 `frame` 类型加上 `"blink"`。

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 仅剩待删文件（pixel-sprite/character-atlas/pixel-character/speech-bubble）相关报错，业务组件本身无错。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/cat.tsx
git commit -m "feat(cyber-office): 小猫改用 3 帧精灵切换"
```

---

### Task 4: 发言字幕面板

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

> 头顶气泡已在 Task 2 去掉。轮流发言（同一时刻只一人说），最佳做法是把发言文字放到场景下方一个固定可读的字幕面板里，完整显示“谁在说 + 说了什么”。

- [x] **Step 1: 顶部加 import**

Modify `src/components/cyber-office/cyber-office.tsx` 顶部 import 区，加入：

```tsx
import { getRole } from "@/lib/cyber-office/roles";
```

- [x] **Step 2: 在场景下方插入字幕面板**

把 `return (...)` 里这一行：

```tsx
      <OfficeScene state={state} />
      <SummaryPanel summary={state.summary} />
```

改成：

```tsx
      <OfficeScene state={state} />

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

      <SummaryPanel summary={state.summary} />
```

- [x] **Step 3: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 仅剩待删文件相关报错。

- [x] **Step 4: 提交**

```bash
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 发言改用下方字幕面板"
```

---

### Task 5: 窄屏舞台不溢出

**Files:**

- Modify: `src/components/cyber-office/office-scene.tsx`

> 舞台固定 560px，手机上会撑破页面。最稳的兜底：外面包一层容器，窄屏时让舞台可横向滚动查看，不影响整页布局。（真正的“整体等比缩小”体验属于增强项，留到以后，别在这卡住。）

- [x] **Step 1: 给舞台包一层滚动容器**

Modify `src/components/cyber-office/office-scene.tsx`，把 `return (` 里那个带 `backgroundImage` 的舞台 `<div>`（连同它所有子元素）整块用一层容器包起来。即把：

```tsx
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-lg border border-border"
      style={{ width: SCENE, height: SCENE, maxWidth: "100%", ... }}
    >
      {/* 桌子 / 猫 / 角色 */}
    </div>
  );
```

改成外层再套一层（注意舞台 div 的 `mx-auto` 移到外层容器，并去掉 `maxWidth`，因为改由外层控制）：

```tsx
  return (
    // 外层：窄屏时可横向滚动，不撑破整页
    <div className="mx-auto w-fit max-w-full overflow-x-auto">
      <div
        className="relative overflow-hidden rounded-lg border border-border"
        style={{
          width: SCENE,
          height: SCENE,
          backgroundImage: "url(/cyber-office/backdrop.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        {/* 桌子 / 猫 / 角色（Task 2 的子元素原样保留） */}
      </div>
    </div>
  );
```

- [x] **Step 2: 浏览器验证窄屏**

Run: `npm run dev`，用浏览器开发者工具切到手机宽度看 `/cyber-office`。
Expected: 舞台不撑破页面（窄屏可横向滚动），桌面宽度下正常居中。

- [x] **Step 3: 提交**

```bash
git add src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 窄屏舞台不溢出T"
```

---

### Task 6: 删除不再使用的旧渲染代码

**Files:**
- Delete: `src/components/cyber-office/pixel-character.tsx`
- Delete: `src/components/cyber-office/pixel-sprite.tsx`
- Delete: `src/components/cyber-office/speech-bubble.tsx`
- Delete: `src/lib/cyber-office/character-atlas.ts`

> 角色/猫改用 `<img>` 后，canvas 渲染器、PixelMap 图谱、SVG 版小人、头顶气泡都没人引用了。删掉保持代码干净。

- [x] **Step 1: 删除文件**

```bash
git rm src/components/cyber-office/pixel-character.tsx src/components/cyber-office/pixel-sprite.tsx src/components/cyber-office/speech-bubble.tsx src/lib/cyber-office/character-atlas.ts
```

- [x] **Step 2: 类型检查 + lint（确认没有残留引用）**

Run:

```bash
npx tsc --noEmit
npm run lint
```

Expected: 全绿。若报“找不到模块/未使用引用”，按提示删掉对应 import。

- [x] **Step 3: 提交**

```bash
git commit -m "chore(cyber-office): 删除精灵图接入后不再使用的旧渲染代码"
```

---

### Task 7: 完整验证 P4-ART

**Files:**
- No code changes unless previous tasks fail.

- [x] **Step 1: 全量校验**

Run:

```bash
npm run test
npx tsc --noEmit
npm run lint
npm run build
```

Expected: 全部通过，路由列表仍含 `/cyber-office`。

- [x] **Step 2: 浏览器验证**

Run: `npm run dev`，打开 `http://localhost:3000/cyber-office`，点「播放样本会议」。
Expected:

- 圆桌周围是**精灵角色**，坐姿闲置；
- 被点名者**举手**并整体上移；
- 发言者**起身**、脚下橙光、下方**字幕面板**完整显示其发言；
- 中央是现代简约白桌，桌上小猫；**点小猫**会蹦一下、切到开心帧、冒气泡；
- 背景是会议室，切换网站深/浅色时 office **不变**；
- 系统开启“减少动态效果”后刷新，呼吸/抖动/猫蹦**静止**。

- [x] **Step 3: 收尾**

Step 1–2 全过则无需额外提交（前面每步已提交）。若某项不对，回到对应 Task 修正后重跑本 Task。

> 🎨 **美术微调**：座位环 `RADIUS`、桌子 `width` 与 `top`、小猫位置、`CHAR_DISPLAY_H` 这些数字是起步值，`npm run dev` 里对着实际画面眼调到舒服即可，改完并入 Task 2/3 的提交或单独提交。

---

## 理解检查点

做完 P4-ART，合上代码回答：

1. 为什么 `Character` 的对外接口 `{id, name, color, status}` 从 P4.1 到现在一直没变，只换内部实现？这体现了什么设计原则？

   *体现**开闭原则 / 关注点分离**：`OfficeScene` 和事件流只依赖 `{id,name,status}`，渲染方式从"代码画"升级到"精灵图"时它们一行都不用改；也方便将来再换实现（换素材/换回代码）都不波及上层。*

   

2. 为什么 6 个角色精灵在代码里统一按“高度”缩放（`height` 固定、`width: auto`），而不是按宽度？如果按固定宽度会出什么问题？

    *6 张精灵原生都是 320 高、但宽度各不同。固定**高度**、宽度自动，能保证所有角色**一样高、脚在同一水平线**，围坐才整齐。若固定**宽度**，因每张宽不同，等比后**高度就会参差**，角色忽高忽矮、脚线对不齐。*

   

3. 定位角色时为什么用 `top: seat.y - CHAR_DISPLAY_H`（脚落座位点）而不是几何中心？`zIndex: Math.round(seat.y)` 又解决了什么？

   ***`top: seat.y - CHAR_DISPLAY_H`** 让**脚**落在座位点（而非几何中心），这样不同姿势/身高的角色都"站/坐"在座位上、不悬空。**`zIndex: Math.round(py)`** 让越靠下（前排）层级越高，**盖住后排**，形成近大远小的前后遮挡。*

   

4. 发言为什么从“头顶气泡”改成“下方字幕面板”？（想想轮流发言、可读性、气泡重叠）

   **头顶气泡→下方字幕** → 轮流发言同一刻只一人说；气泡挤头顶会**重叠、盖桌子、截断看不全**；下方固定字幕面板**完整可读、位置稳定**，也更像"字幕"

   

5. 精灵图丢失了“深浅色自适应”，为什么本项目可以接受？（提示：舞台固定背景 + 已确认的产品决策）

   **精灵图丢深浅色自适应却可接受** → 因为舞台**自带固定背景**、且产品上已决定 office 内部不随网站主题变色。角色固定配色正好和固定背景匹配，无需自适应。

---

## 完成标准

- [x] 圆桌角色为手绘精灵图，坐/举手/起身随 status 切换，切换不跳
- [x] idle 呼吸、举手上移、发言抖动+橙光、思考省略号均正常
- [x] 现代简约白桌 + 固定会议室背景，切换网站深浅色 office 不变
- [x] 桌上小猫点击切到开心帧 + 蹦 + 冒气泡
- [x] 发言走下方字幕面板，无头顶气泡重叠
- [x] `prefers-reduced-motion` 开启时所有循环动画静止
- [x] 窄屏舞台不横向溢出
- [x] 旧渲染文件（pixel-character/pixel-sprite/speech-bubble/character-atlas）已删除
- [x] `npm run test`、`npx tsc --noEmit`、`npm run lint`、`npm run build` 全部通过

> 下一阶段 P5：轻量自定义角色（改名 + 一句话人设）、总结导出 Markdown、导航栏加入口、构建历史时间轴。

---

## 附录：美术流水线（参考，本阶段用不到）

素材已产出。此处留档，日后要重做/新增角色时照用。

### 脚本
- `scripts/split-poses.mjs <大图> <前缀> [目标高度] [帧名,逗号]` —— 把一张多帧大图去底、切分、按脚底对齐到同画布。
  - 角色：`node scripts/split-poses.mjs public/sprites/_src/bio-poses.png bio 320`
  - 小猫：`node scripts/split-poses.mjs public/sprites/_src/cat-poses.png cat 130 sit,happy,blink`
- `scripts/cutout.mjs <输入> <输出> [目标高度]` —— 单物体去底裁紧（桌子）。
  - `node scripts/cutout.mjs public/sprites/_src/table.png public/cyber-office/table.png 260`

### 出图 prompt

风格锚（每段都带上）：
```
clean modern pixel art, minimalist contemporary office aesthetic, soft shading, muted neutral palette (white / light gray / warm wood / soft blue accents), soft top lighting, subtle outline, no anti-aliasing noise, no text, no watermark
```

**角色三姿势**（把 `<角色描述>` 换成对应角色）：
```
Three full-body poses of the SAME single pixel-art character in one image, evenly spaced left-to-right on a plain flat light-gray background, all at the same size and standing on the same ground line:
pose 1 standing straight, arms at sides;
pose 2 standing and raising ONE hand straight above the head;
pose 3 sitting on a chair, hands on knees.
The character: <角色描述>. Keep the face, hair, clothing and colors identical across all three poses.
[风格锚]. No text, no furniture except the chair in pose 3.
```
角色描述参考：host=`a facilitator wearing a headset`；pm=`a product manager with a tie`；frontend=`a frontend engineer in a hoodie with headphones`；bio=`a bioinformatics researcher, long black hair, round glasses, white lab coat over a blue shirt, khaki pants`；reviewer=`a reviewer with reading glasses holding a red pen`；recorder=`a note-taker holding a small notebook`。

**小猫三帧**：
```
Three poses of the SAME single chibi orange tabby cat in one image, evenly spaced left-to-right on a plain flat light-gray background, all the same size sitting on the same ground line:
pose 1 sitting calm, eyes open, facing forward;
pose 2 sitting with eyes closed in a happy content smile, one front paw raised waving;
pose 3 sitting with eyes closed (blinking), facing forward.
Keep the fur pattern, colors and shape identical across all three. [风格锚]. No text, no shadow baked in.
```

**桌子**：
```
A modern round office meeting table seen from a top-down, slightly tilted angle, elliptical matte white / light-gray tabletop with a thin clean edge, sleek minimalist single pedestal base, subtle soft shadow. Contemporary clean style, NOT wooden. [风格锚]. Centered, isolated object on a plain flat light-gray background, no chairs, no items.
```

**背景**：
```
A minimalist modern office meeting room interior as a soft background scene, gentle high-angle view, warm light wood floor, one large bright window with soft daylight, a small potted plant, calm contemporary aesthetic, muted and low-contrast so foreground characters stand out. [风格锚]. NO table and NO people in the center, empty central floor area, no text.
```
