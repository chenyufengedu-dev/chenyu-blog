# 气泡化改造：把发言搬回角色头顶

> 配套方案：[`specs/2026-08-15-cyber-office-experience-roadmap.md`](../specs/2026-08-15-cyber-office-experience-roadmap.md)
>
> **要解决的问题**：舞台在上、字幕在下隔着几百像素，而人本能地会去读字。结果全程盯着下方文字框，**上面的角色动画根本没人看**——像素场景的存在意义被字幕吃掉了。
>
> **历史背景**：项目早期有气泡，Task 2 把它合并成了单一字幕条，理由是"上下两处字幕、视线来回跳"。那个理由没错，**错的是位置**。正确结论是「只保留一处字幕，而且这一处要贴着角色」——当时只做对了前半句。

## 关键前提：发言要变短，但不能短到说不清

现在角色发言上限是 **80 个中文字**。塞进头顶气泡会变成挡住半间屋子的公告栏。但砍太狠又会让专家说不出完整观点——所以尺寸要按画布算，不能拍脑袋。

**几何验算**（设计画布 760×480，气泡文字 14px）：

| 气泡宽度 | 每行字数 | 60 字占几行 | 气泡总高 | 放在最高的座位（主持人）时顶部位置 |
|---|---|---|---|---|
| 220px | ~15 | 4 行 | ~115px | y=15，**快顶出画布** |
| **300px** | ~20 | **3 行** | ~93px | y=37，安全 |

水平方向也验过：最边上的座位 `x=226` / `x=534`，300px 居中展开 ±150 → 左 76、右 684，都在 760 内，**不需要边界回收逻辑**。

**结论：气泡宽 300px，发言上限 60 字。** 够讲清一个完整观点，又只占 3 行。

同时把 `maxTurns` 从 4 提到 6：

```
发言 80→60 字，轮数 4→6 → 总消耗接近，但四段独白变成六次交锋
                        → 更像真人 ✅  总结素材更丰富 ✅  单句渲染压力更小 ✅
```

---

## Task B1：气泡化

**Files:**
- Create: `src/components/cyber-office/speech-bubble.tsx`（Step 1）
- Modify: `src/components/cyber-office/office-scene.tsx`（Step 2、Step 3）
- Modify: `src/components/cyber-office/cyber-office.tsx`（Step 4、Step 5）
- Modify: `src/lib/cyber-office/limits.ts`（Step 6）
- Modify: `src/lib/cyber-office/prompts.ts`（Step 7）

---

- [ ] **Step 1: 新建 `src/components/cyber-office/speech-bubble.tsx`**

```tsx
"use client";

import { memo } from "react";

/**
 * 角色头顶的发言气泡。
 *
 * 定位约定：调用方把它放在「角色头顶正上方那个点」，组件内部用
 * translate(-50%, -100%) 把自己的**底边中点**对齐到该点。
 * 这样逐字打字时气泡是向上生长的，底部的小尾巴始终钉在角色头顶不动——
 * 如果反过来按顶部定位，打字时整个气泡会往下爬，非常晃眼。
 */
function SpeechBubble({
  name,
  text,
  x,
  y,
}: {
  name: string;
  text: string;
  x: number; // 设计坐标：角色水平中心
  y: number; // 设计坐标：气泡底边（角色头顶上方一点）
}) {
  if (!text) return null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -100%)",
        // 300px：够 60 字排成 3 行（再窄就要 4 行，主持人的气泡会顶出画布）；
        // 各座位居中展开 ±150 后仍在 760 画布内，不需要边界回收逻辑。
        width: "max-content",
        maxWidth: 300,
        zIndex: 600, // 高于前桌沿(430)与名字层(400)
      }}
    >
      <div className="rounded-md border border-border bg-background/95 px-3 py-2 shadow-sm">
        <p className="mb-1 text-[11px] font-medium leading-none text-accent">
          {name}
        </p>
        {/* 14px：场景整体会被缩放到列宽（约 0.9），14px 落地约 12.5px，仍清晰。
            再小就吃力了。 */}
        <p className="text-[14px] leading-[1.6] text-text-primary">{text}</p>
      </div>

      {/* 指向角色的小尾巴：一个旋转 45° 的方块，只露出下半个角 */}
      <span
        className="absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-b border-r border-border bg-background"
        style={{ bottom: -4 }}
      />
    </div>
  );
}

// 和 Character 同理：打字时父层每个字都会重渲染，但没在说话的角色
// 气泡内容没变，memo 让它们跳过。
export default memo(SpeechBubble);
```

---

- [ ] **Step 2: `src/components/cyber-office/office-scene.tsx` —— 渲染气泡层**

① 顶部 import 加一行：

```tsx
import SpeechBubble from "./speech-bubble";
```

② 在「名字」那一段 `{participants.map((id, i) => { ... })}` **之后**（也就是名字层的收尾 `})}` 后面），插入气泡层：

```tsx
        {/* 发言气泡层：谁在说就在谁头顶冒。放在最顶层，盖过桌沿和名字。
            主持人串场时同样有气泡——因为 reducer 也把 host 设成了 speaking。 */}
        {participants.map((id, i) => {
          const seat = SEATS[i];
          if (!seat) return null;

          const runtime = state.roles[id];
          if (runtime?.status !== "speaking" || !runtime.bubble) return null;

          // 角色实际显示高度（含近大远小的缩放），用来算头顶位置
          const charH = CHAR_DISPLAY_H * seatScale(seat.y);

          return (
            <SpeechBubble
              key={`bubble-${id}`}
              name={getRole(id).name}
              text={runtime.bubble}
              x={seat.x}
              y={seat.y - charH - 8} // 头顶再往上留 8px
            />
          );
        })}
```

---

- [ ] **Step 3: `src/components/cyber-office/office-scene.tsx` —— 名牌避让气泡**

> **为什么必须处理**：按坐标验算过，**近侧角色说话时气泡会压住远侧的名牌**。
> 例：生信研究员（近侧左，x=226）的气泡覆盖 x 76–376、y 157–250；而产品经理的名牌在 x 212–260、y 161–177 —— 正好落在气泡范围内。
> 这个碰撞靠调位置解决不了（场景就这么挤），所以改用"让位"策略。

在名字层的 `map` 里，`const active = state.activeSpeaker === id;` **之后**，加入下面三行：

```tsx
          // ① 正在说话的人由气泡带名字，这里不再画浮动名牌，避免重叠
          if (state.roles[id]?.status === "speaking") return null;

          // ② 场上是否有人在说话。注意不能只看 activeSpeaker——
          //    主持人串场时 activeSpeaker 是 null，但他确实在说话。
          const anyoneSpeaking = participants.some(
            (p) => state.roles[p]?.status === "speaking",
          );
```

然后把下面这行原有的 `someoneElseSpeaking` 定义**替换**掉：

```tsx
          const someoneElseSpeaking =
            state.activeSpeaker != null && !active;
```

替换为：

```tsx
          const someoneElseSpeaking = anyoneSpeaking;
```

最后把名牌的透明度从 `0.5` 调到 `0.25`：

```tsx
                opacity: someoneElseSpeaking ? 0.25 : 1,
```

> 淡到 0.25 的用意：万一某个名牌被气泡压住，读起来是"刻意的层次关系"，而不是"两个元素撞在一起"。

---

- [ ] **Step 4: `src/components/cyber-office/cyber-office.tsx` —— 删掉字幕条**

① 把整个 `SubtitleBar` 函数**整段删除**（从 `function SubtitleBar({` 到它的收尾 `}`）。

② 在 `return` 里，把这段调用**整段删除**：

```tsx
          <SubtitleBar
            state={state}
            onSkip={
              mode === "replay" && replay.isPlaying && state.activeSpeaker
                ? replay.skip
                : undefined
            }
          />
```

> 全文不会丢：「发言记录」面板里一条不少。

---

- [ ] **Step 5: `src/components/cyber-office/cyber-office.tsx` —— 错误提示和跳过按钮换地方**

字幕条原本承担了"显示错误"和"跳过打字机"两件事，删掉后要补回来。

在右栏 `<StatusBar state={state} />` **之后**、`<OfficeScene ... />` **之前**，把原来那段 `{state.error && mode === "live" && ...}` 的重试按钮**替换**为下面这整块：

```tsx
          {/* 错误提示：原本在字幕条里，字幕条删掉后挪到状态区 */}
          {state.error && (
            <div className="rounded-lg border border-border bg-bg-subtle px-4 py-3">
              <p className="mb-1 text-xs font-medium text-accent">系统</p>
              <p className="text-sm leading-[1.7] text-text-secondary">
                {state.error}
              </p>
              {mode === "live" && !live.isRunning && (
                <button
                  onClick={() => live.start(topic, LIVE_PARTICIPANTS, approval)}
                  className="mt-2 rounded-md border border-accent/25 bg-accent-subtle px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/15"
                >
                  重试
                </button>
              )}
            </div>
          )}

          {/* 跳过打字机：原本在字幕条右上角 */}
          {mode === "replay" && replay.isPlaying && state.activeSpeaker && (
            <button
              onClick={replay.skip}
              className="self-start text-xs text-text-muted transition-colors hover:text-accent"
            >
              跳过打字机 ⏭
            </button>
          )}
```

> 如果你还没做 S5（逐轮审批），上面 `live.start(topic, LIVE_PARTICIPANTS, approval)` 里的 `, approval` 要去掉。

---

- [ ] **Step 6: `src/lib/cyber-office/limits.ts` —— 短发言、多轮次**

把这两个值改掉：

```ts
  // 发言变短是气泡化的前提：80 字塞进头顶气泡会挡住半间屋子。
  // 但也不能太短，否则专家说不清观点——60 字（气泡里 3 行）是算过的平衡点。
  // 句子短了就能多跑几轮，讨论从"四段独白"变成"六次交锋"。
  maxTurns: 6,
```

```ts
  roleMaxTokens: 140, // 约 60 个中文字 + 余量
```

> `STEPS_PER_MEETING` 是按 `maxTurns` 算的，会自动跟着变，不用手动改。

---

- [ ] **Step 7: `src/lib/cyber-office/prompts.ts` —— 让角色说人话、说短话**

在 `buildRoleSystemPrompt` 里，把这一行：

```ts
    "发言要具体、简洁，最多 80 个中文字符。",
```

替换为：

```ts
    // 60 字是气泡（3 行）装得下的上限，也够把一个观点讲完整。
    "发言控制在 60 个中文字符以内，一到两句话讲完。",
    "要把观点讲清楚：给出判断和理由，别只抛结论。",
    "但不要铺垫、不要复述别人说过的话、不要客套。",
```

---

- [ ] **Step 8: 校验**

```bash
npx tsc --noEmit && npm run lint && npm run test
```

---

- [ ] **Step 9: 实机验证**

先看回放（不花钱、内容固定，最适合验证布局）：

```bash
npm run dev
```

点「看一场演示」，对照检查：
1. 说话的人**头顶冒出气泡**，气泡里有名字和逐字出现的文字；
2. 打字时气泡**向上生长**，底部小尾巴钉在头顶不动；
3. 气泡**盖在桌子和其他角色之上**，不被切掉；
4. 说话的人**没有重复的浮动名牌**（名字只在气泡里）；
5. 页面下方**不再有字幕条**；
6. 眼睛可以一直停在舞台上，不用往下看。

再跑一次实时会议，重点看：**发言是不是变成了短句**、轮数是不是多了、气泡有没有被撑得过大。

> 若某个角色的气泡顶到画布上沿被切掉，说明那句话太长了——检查 prompt 是否生效，或把 `maxWidth` 从 220 调到 260（变宽 → 行数变少 → 更矮）。

---

- [ ] **Step 10: 提交**

```bash
npx tsc --noEmit && npm run build
git add src/components/cyber-office/speech-bubble.tsx src/components/cyber-office/office-scene.tsx src/components/cyber-office/cyber-office.tsx src/lib/cyber-office/limits.ts src/lib/cyber-office/prompts.ts
git commit -m "feat(cyber-office): 发言改为角色头顶气泡，去掉下方字幕条，缩短发言并增加轮次"
git push
```

---

## 下一个任务（B2）：让结论真正成为一份方案

**产品原则**：即便"真拿它干活"的场景少，**一场不出方案的讨论在体验上也是失败的**——起承转合缺了"合"，用户看完会有"所以呢？"的落空感。

现在总结 Agent 的提示词要的是"核心结论 + 文章大纲 + 下一步行动"，这是个**通用模板**。对「如何让单细胞空间转录组可视化更好」这类问题，它应该产出一份**真正的方案**：问题拆到哪几个层面、各方分歧在哪、怎么权衡、具体怎么做、先做什么。

B1 做完后单独写。
