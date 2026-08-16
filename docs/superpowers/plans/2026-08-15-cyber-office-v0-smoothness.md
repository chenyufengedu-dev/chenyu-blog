# V0 · 止损：先修真卡顿

> 配套方案：[`specs/2026-08-15-cyber-office-experience-roadmap.md`](../specs/2026-08-15-cyber-office-experience-roadmap.md)
>
> **这一步在做什么**：不动任何美术资产，先把"技术性卡顿"修掉——切帧闪烁、聚光突现、字幕硬切、打字机机械感。
> **为什么必须先做**：你说的"卡顿"其实是两回事。①**帧数太少**导致动作跳跃（加帧能解决）；②**换图时才去加载**导致闪烁（加帧反而更糟）。所以要先修 ②，否则 V1 做出的几十帧动画会比现在更卡。
>
> 成本：一个下午。改 4 个文件，不碰美术。

---

### Step 1: `character.tsx` —— 预加载全部角色帧

> **病灶**：现在 `<img src={...}>` 在换 pose 时才让浏览器去取那张图。第一次切到 `act1`/`talking`/`raising` 时，图还没下载完，就会闪一下或短暂空白。
> **解法**：组件挂载时把这个角色的 7 张帧全部预先下载进浏览器缓存。之后所有切换都是瞬时的。

在 `character.tsx` 里，`CHAR_DISPLAY_H` 常量**之后**，加一个帧名列表：

```ts
// 这个角色会用到的全部帧。用于挂载时预加载，避免切帧时才去下载导致闪烁。
const ALL_POSES = [
  "sitting",
  "act1",
  "act2",
  "blink",
  "raising",
  "standing",
  "talking",
] as const;
```

然后在组件里，"待机偶发动作"那个 `useEffect` **之前**，插入一个预加载 effect：

```tsx
  // 预加载：把这个角色的所有帧提前塞进浏览器缓存。
  // 不这么做的话，第一次切到某个动作时才开始下载，画面会闪一下。
  // new Image() 只是触发下载，不需要放进 DOM。
  useEffect(() => {
    for (const pose of ALL_POSES) {
      const img = new Image();
      img.src = `/sprites/${id}-${pose}.png`;
    }
  }, [id]);
```

---

### Step 2: `character.tsx` —— 聚光改成渐隐渐现

> **病灶**：发言时的暖光和脚下橙光是 `{status === "speaking" && ...}` 条件渲染——说话瞬间"啪"地出现、说完"啪"地消失。这是"发言者切换瞬间"最刺眼的跳变来源。
> **解法**：改成**一直渲染、用透明度过渡**。视觉上就变成柔和的亮起/暗下。

把这两段：

```tsx
        {/* 发言时身后一圈柔和暖光聚光，把视线引到发言者身上 */}
        {status === "speaking" && (
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: 150,
              height: 190,
              background:
                "radial-gradient(circle, rgba(234,88,12,0.28) 0%, rgba(234,88,12,0) 68%)",
              filter: "blur(4px)",
              zIndex: -1,
            }}
          />
        )}
        {/* 发言时脚下一抹橙色微光 */}
        {status === "speaking" && (
          <span className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px]" />
        )}
```

**整段替换**为：

```tsx
        {/* 发言时身后一圈柔和暖光。一直渲染、只改透明度，
            这样亮起/暗下是渐变的，不会在切换发言者时"啪"地跳一下。 */}
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500 ease-out"
          style={{
            width: 150,
            height: 190,
            background:
              "radial-gradient(circle, rgba(234,88,12,0.28) 0%, rgba(234,88,12,0) 68%)",
            filter: "blur(4px)",
            zIndex: -1,
            opacity: status === "speaking" ? 1 : 0,
          }}
        />
        {/* 发言时脚下一抹橙色微光，同样用透明度过渡 */}
        <span
          className="pointer-events-none absolute -bottom-1 left-1/2 h-1.5 w-10 -translate-x-1/2 rounded-full bg-accent/25 blur-[1px] transition-opacity duration-500 ease-out"
          style={{ opacity: status === "speaking" ? 1 : 0 }}
        />
```

---

### Step 3: `globals.css` + `cyber-office.tsx` —— 字幕淡入

> **病灶**：换人说话时，字幕条的内容是瞬间整体替换的，很硬。
> **解法**：给字幕内容加一个轻微的淡入上移。用 `key` 强制换人时重新挂载，动画就会重放。

**① `globals.css`**：找到 `@media (prefers-reduced-motion: no-preference) {` 这个块，在里面（和 `pixel-idle` 那些放一起）加：

```css
  /* 字幕换人时轻微淡入上移，避免内容硬切 */
  @keyframes subtitle-in {
    from {
      opacity: 0;
      transform: translateY(4px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  .subtitle-in {
    animation: subtitle-in 0.28s ease-out;
  }
```

**② `cyber-office.tsx`**：在 `SubtitleBar` 里，把最外层 `<div>` 内部的两块内容（顶行 + 正文）包进一个带 `key` 的容器。找到：

```tsx
    <div className="rounded-lg border border-border bg-bg-subtle px-5 py-4">
      {/* 顶行：左边发言者名，右边（可选）跳过按钮，同一行更有归属感 */}
      <div className="mb-1.5 flex items-center justify-between gap-3">
```

把第一行**之后**插入一个包裹层（注意末尾要补一个 `</div>`，见下）：

```tsx
    <div className="rounded-lg border border-border bg-bg-subtle px-5 py-4">
      {/* key 换人时变化 → React 重新挂载这块 → 淡入动画重放。
          这是"用 key 触发动画"的常见手法，比手动管理动画状态简单得多。 */}
      <div key={speaker} className="subtitle-in">
        {/* 顶行：左边发言者名，右边（可选）跳过按钮，同一行更有归属感 */}
        <div className="mb-1.5 flex items-center justify-between gap-3">
```

然后在正文那一行 `<p className="text-sm leading-[1.7] text-text-secondary">{text}</p>` **之后**、最外层 `</div>` **之前**，补上包裹层的收尾 `</div>`：

```tsx
      <p className="text-sm leading-[1.7] text-text-secondary">{text}</p>
      </div>
    </div>
  );
```

> 如果括号对不上，最简单的检查方式：跑 `npx tsc --noEmit`，JSX 不闭合会直接报错。

---

### Step 4: `use-replay.ts` —— 打字机节奏去机械感

> **病灶**：每个字固定 40ms，均匀得像机器打字。真人说话有停顿、有快慢。
> **解法**：标点后停久一点，普通字带一点随机抖动。
> **注意**：这只影响**回放（看一场演示）**。实时会议的出字节奏由模型的流式输出决定，前端控制不了。

把 `delayFor` 函数**整段替换**为：

```ts
// 不同事件的播放间隔（毫秒）。
function delayFor(e: OfficeEvent): number {
  switch (e.type) {
    case "token": {
      // 逐字节奏：句末停顿最久、逗号次之，普通字带随机抖动。
      // 固定 40ms 会均匀得像机器打字，加了停顿和抖动才有人在说话的感觉。
      const ch = e.delta;
      if (/[。！？…]/.test(ch)) return 300;
      if (/[，、；：]/.test(ch)) return 170;
      return 32 + Math.random() * 28; // 32~60ms
    }
    case "host_speak":
      return 900;
    case "call_on":
      return 700;
    case "speaking_start":
      return 250;
    case "speaking_end":
      return 600; // 说完多留一点余韵，再进下一轮
    case "summary":
      return 1000;
    default:
      return 500;
  }
}
```

---

### Step 5: 校验

```bash
npx tsc --noEmit && npm run lint && npm run test
```

---

### Step 6: 实机验证

Run: `npm run dev`，点「看一场演示」，**完整看一遍**。

对照检查：
1. **换人说话时**：聚光是柔和亮起/暗下，不再"啪"地闪现；
2. **字幕换人时**：内容轻微淡入上移，不再硬切；
3. **角色做动作时**（眨眼、喝咖啡等）：不再有空白闪烁——这条最需要留意，因为它以前只在**第一次**播到某个动作时出现；
4. **打字节奏**：句号后有明显停顿，读起来像有人在讲话，不像机器打字。

> 第 3 条的验证技巧：改完后**硬刷新**（`Ctrl+Shift+R`）清掉缓存再看，否则旧缓存会掩盖问题。

---

### Step 7: 提交

```bash
git add src/components/cyber-office/character.tsx src/components/cyber-office/cyber-office.tsx src/components/cyber-office/use-replay.ts src/app/globals.css
git commit -m "perf(cyber-office): 预加载角色帧，聚光与字幕改为过渡，打字机节奏拟人化"
```

---

## 做完之后

V0 只是**止损**——它让现有素材播得顺，但不会让动作本身变丰富（那是 V1 的事：AI 出视频 → 切帧 → sprite sheet）。

做完 V0，两条线可以并行：
- **你**：试 V1 的出图流程，先拿 1 个角色试水；
- **我**：给 C1 的提示词优化方案（改善"发言内容像 AI"），完全不依赖美术。
