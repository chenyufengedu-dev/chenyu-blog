# Cyber Office 体验改进 · 交互轨实现教程

> **教程说明（给 Chenyu）**：这是"照着一步步敲"的实现教程，配合改进方案
> [`2026-07-31-cyber-office-experience-overhaul.md`](./2026-07-31-cyber-office-experience-overhaul.md) 使用。
> 每个 Task 标了改哪个文件、怎么改、贴出带注释的代码、末尾给提交命令。做完一个提交后把 commit hash 发记录员 AI。步骤用 `- [ ]` 勾选跟踪。
> 桌面优先；手机端仅保留现有 `overflow-x-auto` 兜底，真·响应式留后期。

**范围（本文件持续追加）**：会议可读性一组——发言者高亮、单一字幕、进度状态条、入口修复……素材（画风统一/角色/桌子）走美术轨，不在本文件。

**Architecture:** 全部只改**展示层**，不动 `applyEvent` 事件流 / reducer / 回放逻辑（除非某 Task 明确说明）。

---

### Task 1: 发言者高亮 + 说话小气泡

**目标**：让"谁在发言"一眼可见——发言者全彩 + 头顶像素小气泡，其余人压暗降饱和。

**Files:**
- Modify: `src/components/cyber-office/character.tsx`
- Modify: `src/components/cyber-office/office-scene.tsx`

> 原理：`Character` 只知道自己的 `status`，不知道"别人是不是在说"。所以由 `office-scene`（它有 `state.activeSpeaker`）算出"有人在说且不是我"传进来，`Character` 据此压暗自己。

- [x] **Step 1: `character.tsx` 接口加 `dimmed`**

把 `CharacterProps` 改成：

```tsx
interface CharacterProps {
  id: RoleId;
  name: string;
  status: RoleStatus;
  dimmed?: boolean; // 有人在发言、但不是我 → 压暗，突出发言者
}
```

- [x] **Step 2: `character.tsx` 解构 `dimmed` 并应用到最外层**

把函数签名改成：

```tsx
export default function Character({ id, name, status, dimmed }: CharacterProps) {
```

把最外层那个 `<div className="flex flex-col items-center gap-1" aria-label={name}>` 加上 `style`（压暗 + 降饱和 + 平滑过渡）：

```tsx
    <div
      className="flex flex-col items-center gap-1"
      aria-label={name}
      style={{
        opacity: dimmed ? 0.45 : 1,
        filter: dimmed ? "saturate(0.55)" : "none",
        transition: "opacity .35s ease, filter .35s ease",
      }}
    >
```

- [x] **Step 3: `character.tsx` 加"说话中"像素小气泡**

在内层"呼吸/说话动画"那个 `<div className={status === "speaking" ? "pixel-talk" : "pixel-idle"}>` **之前**，插入一个仅发言时显示的小气泡（像素风：直角硬边、不用圆角软阴影）：

```tsx
        {/* 说话中：头顶像素小气泡做“正在发言”指示（完整台词在下方字幕） */}
        {status === "speaking" && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 border-2 border-accent bg-background px-1 text-[10px] leading-none text-accent">
            ●●●
          </span>
        )}
```

- [x] **Step 4: `office-scene.tsx` 把 `dimmed` 传进去**

在 `participants.map(...)` 里渲染 `<Character .../>` 的地方，加一行 `dimmed`（`state.activeSpeaker` 已在 state 中）：

```tsx
              <Character
                id={id}
                name={role.name}
                status={runtime?.status ?? "idle"}
                dimmed={
                  state.activeSpeaker != null && state.activeSpeaker !== id
                }
              />
```

- [x] **Step 5: 验证**

Run: `npm run dev`，播放样本会议。
Expected：发言者全彩 + 头顶 `●●●` 小气泡；其余角色明显变暗、降饱和；没人发言（idle/默认）时所有人正常不压暗。

- [x] **Step 6: 校验 + 提交**

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/character.tsx src/components/cyber-office/office-scene.tsx
git commit -m "feat(cyber-office): 发言者高亮，其余角色压暗"
```

---

### Task 2: 合并成单一字幕条（去掉上下双字幕）

**目标**：现在"场景上方主持词 + 场景下方发言卡片"是两处字幕，视线来回跳。合并成**场景下方唯一一条字幕**，始终显示"谁在说 + 说什么"（主持人串场也走这条）。

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

> 优先级：错误 > 当前发言者 > 主持人串场 > 不显示。这样一处就能覆盖所有情况。

- [x] **Step 1: 新增 SubtitleBar 组件**

在 `cyber-office.tsx` 里，把原来的 `HostLine` 组件整段**替换**为下面的 `SubtitleBar`（它顶部已 import 了 `getRole` 和 `MeetingState`，无需再加）：

```tsx
function SubtitleBar({ state }: { state: MeetingState }) {
  // 一处字幕搞定三种情况：错误 / 当前发言者 / 主持人串场
  let speaker = "";
  let text = "";
  let accent = false; // 发言者/错误用橙色名，主持人串场用灰色名

  if (state.error) {
    speaker = "系统";
    text = state.error;
    accent = true;
  } else if (state.activeSpeaker && state.roles[state.activeSpeaker]?.bubble) {
    speaker = getRole(state.activeSpeaker).name;
    text = state.roles[state.activeSpeaker].bubble;
    accent = true;
  } else if (state.hostText) {
    speaker = getRole("host").name;
    text = state.hostText;
  }

  if (!text) return null; // 没内容就不占位

  return (
    <div className="border-2 border-border bg-bg-subtle px-5 py-4">
      <p
        className="mb-1.5 text-xs font-medium"
        style={{ color: accent ? "#ea580c" : "var(--text-muted)" }}
      >
        {speaker}
      </p>
      <p className="text-sm leading-[1.7] text-text-secondary">{text}</p>
    </div>
  );
}
```

- [x] **Step 2: 替换渲染处**

在 `CyberOffice` 的 `return (...)` 里，把这三段：

```tsx
      <HostLine state={state} />
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
```

替换为：

```tsx
      <OfficeScene state={state} />
      <SubtitleBar state={state} />
```

- [x] **Step 3: 验证**

Run: `npm run dev`，播放样本会议。
Expected：场景**上方不再有**主持词那一行；场景**下方只有一条**字幕，主持人串场、角色发言、错误都在这一条里显示，带发言者名字。

- [x] **Step 4: 校验 + 提交**

> 若 `npm run lint` 报 `HostLine` 未使用，说明你只删了调用没删定义——把 `HostLine` 函数整段删掉即可。

```bash
npx tsc --noEmit && npm run lint
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 合并为单一字幕条，去掉上下双字幕"
```

---

> 下面的任务（会议进度状态条、入口/假交互修复、发言记录与暂停、思考·错误态、编排可见开关……）我会在你做完上面两个后**继续追加到本文件**，保证每步代码都对着当时的真实代码写准。
