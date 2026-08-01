# 交接文档（续）：Cyber Office 美术/动画/场景总设计师

> 给接手的新窗口 AI：你是 Chenyu 网站的**总设计师**。先读根 `docs/superpowers/HANDOFF-cyber-office.md`（角色、团队分工、设计红线、项目全貌）再读本文。本文接续**当前正在做的 P4-ART：把 Cyber Office 场景做成"精美像素圆桌会议"**这条深线，让你零成本继续。

---

## 0. 一句话现状

Cyber Office 的 P0–P3（回放/编排/安全）早已完成。当前主战场是**视觉大改造**：把占位方块 → 精美像素角色围坐 3/4 俯视会议室圆桌，含个性化待机动画、发言起身说话。**美术资产已基本齐、场景渲染已成型、动画系统已写好**，剩下主要是**交互层任务**和细节打磨。

## 1. Chenyu 的工作方式（务必遵守）

- **他手写代码学习**（不是你直接改一切）。你产出：**照着敲的教程文档** + **出图 prompt**。但**布局/动画的数值微调、脚本、素材切图**这类由你直接做更高效，他也接受你直接改 `office-scene.tsx`/`character.tsx` 常量。
- **视觉效果第一**：他反复强调"宁可多做素材、多花时间，也不能牺牲观感"。**不要给"省事的简化版"**，缺什么素材就补什么。
- **每个 Task 逐个提交**，commit hash 发记录员 AI 写 Obsidian 日志。
- 反馈非常细致（比例、穿模、朝向、流畅度），要一条条认真对待。

## 2. 美术资产现状（都在仓库里）

**角色**：`host` `pm` `frontend` `bio` `reviewer`（5 个入座；`recorder`/`summarizer` 暂不入座）。
- 源图（绿幕、每张 **7 帧**）：`public/sprites/_src/<id>-poses.png`。
  - 7 帧顺序：`sitting(静坐) / act1 / act2（个性化待机动作）/ blink（眨眼）/ raising（举手）/ standing（起身闭嘴）/ talking（起身张嘴）`。
  - 朝向：host 正面；pm ¾正面右转；frontend ¾正面左转；bio ¾背面右转；reviewer ¾背面左转。**发言(standing/talking)时都转正面朝用户**。个性化动作：host 喝咖啡、pm 看平板点头、frontend 扶耳机、bio 写字、reviewer 点红笔。
  - ⚠️ `reviewer` 的源图当初存成了 `recorder-poses.png`？——现已是 `reviewer-poses.png`，别混淆。
- 切好的上线精灵：`public/sprites/<id>-{sitting,act1,act2,blink,raising,standing,talking}.png`（同角色各帧**同尺寸**、按脚/椅底对齐）。
- 每个角色**自带办公椅**（起身帧里空椅子仍在正后方）。

**桌子（无椅版）**：`public/cyber-office/table.png`（3/4 俯视圆桌 + 桌面道具，透明底）。源图 `_src/table.png`。
**背景**：`public/cyber-office/backdrop.png`（3/4 俯视会议室，源 `_src/office-scene.png`）。
**小猫**：`public/sprites/cat-{sit,happy,blink}.png`（源 `_src/cat-poses.png`）。

## 3. 美术流水线脚本（关键工具）

- `scripts/split-poses.mjs <大图> <前缀> <目标高度> <帧名,逗号>`：把一张多帧大图**去底 + 切分 + 对齐**。
  - **自动识别绿幕**（四角是绿色→键出绿色，最干净）；灰底则泛洪去底（会留灰边，故一律用绿幕）。
  - **按"脚/椅底"锚点水平对齐**所有帧（角色做动作时脚不动、不左右跳）。
  - 帧粘连（动作手臂跨进间隙）→ 检测不到间隔时**退化为等分硬切**（会误切，靠生成时拉开间距避免）。
  - 例：`node scripts/split-poses.mjs public/sprites/_src/bio-poses.png bio 340 sitting,act1,act2,blink,raising,standing,talking`
- `scripts/cutout.mjs <输入> <输出> <目标高度>`：单物体去底（桌子）。
- **出图规格 + 每角色完整 prompt** 见 `docs/superpowers/plans/2026-07-31-cyber-office-art-assets-spec.md`（绿幕、7 帧、拉开间距、原地站起、闭嘴/张嘴、个性化动作）。

## 4. 场景渲染（`src/components/cyber-office/office-scene.tsx`）

设计画布 `SCENE_W=760 × SCENE_H=480`（扁画幅电影感），整体用 `ResizeObserver` **等比缩放**到列宽（`transform: scale`），避免横向滚动、`select-none` 防选中。

层次（从后到前）：
1. `backdrop.png` 背景（`backgroundPosition: center top` 露全窗户）+ 薄浅色蒙版压亮度。
2. `table.png` 无椅圆桌（zIndex≈`TABLE_CY`）。
3. 小猫（桌面正中，zIndex 略高于桌）。
4. **角色**：按 `SEATS[]`（每座位 `{x,y}` 脚落点）绝对定位，`seatScale(y)` 近大远小，`zIndex=round(y)`（近侧盖桌、远侧被桌挡）。近侧角色**发言(站立)时 zIndex 提到 500**（越过前桌沿，避免被切穿）。
5. **前桌沿层**：再画一张 `table.png` 用 `clipPath: inset(62%)` 只留下前沿、zIndex 430，**盖住近侧坐着角色的膝盖**（解决"人穿过桌子"）。
6. **名字层**（zIndex 400，永远可见）：远侧 3 人放**头顶上方**、近侧 2 人放脚下；别人发言时非发言者名字变淡。

## 5. 角色组件（`src/components/cyber-office/character.tsx`）

- 状态→帧：`idle/thinking`=待机（**偶发**：平时静坐，隔 3–7s 随机做一次 act1→act2→act1→sitting 或 blink→sitting；动作帧步 320ms、眨眼 130ms；按 id 错峰）；`raising_hand`=raising；`speaking`=standing↔talking **嘴型循环**(180ms)。
- **发言者聚焦**：其他人 `opacity 0.55`、发言者身后暖光聚光 + 脚下橙光。
- 温和呼吸 `pixel-idle`（错峰）。全部动画**尊重 `prefers-reduced-motion`**。
- `onError` 缺帧回退 `sitting`。**曾试过 crossfade 淡出→出现"重影"，已废弃**（相邻帧是不同姿势，不能叠）。

## 6. 可调常量（对着画面眼调）

`office-scene.tsx`：`SEATS`（各座位 x/y）、`TABLE_W/TABLE_CY`、`seatScale`、前桌沿 `clipPath: inset(62%)`（调小=盖更多）、蒙版透明度。
`character.tsx`：`CHAR_DISPLAY_H=150`（整体大小）、待机 `wait`/`step` 时长、`mouthOpen` 180ms、`dimmed 0.55`。

## 7. 关键设计决策 / 踩过的坑

- **真圆桌 + 近侧¾背面、发言转正面**（不是全员正对镜头）。近侧背对听、被点名转正面汇报。"镜头穿越到发言者"是**后期优化**，现在用高亮+聚光+字幕替代。
- **绿幕出图**（不用灰底：白大褂/灰椅≈灰底抠不净）。
- **脚点对齐**修"做动作时位置偏移"。**7 帧要拉开间距**否则切图误切。
- **待机用偶发动作**（不是持续循环，那样机械）。**不要 crossfade**（重影）。
- **画风统一**：桌子/背景重做成与角色同精细度的像素插画（3/4 透视）。
- **Turbopack 偶发崩溃**（`globals.css`/PostCSS，os error 10054）：停 dev → `Remove-Item -Recurse -Force .next` → 重启。PowerShell 语法（不是 `rm -rf`）。

## 8. 剩余工作（按优先级）

**交互轨**（教程写在 `docs/superpowers/plans/2026-07-31-cyber-office-experience-tasks.md`，Task 1/2 已完成：发言者高亮、单一字幕条）：
- 会议**进度状态条**（`讨论中·3/5·当前：X` + 结束"会议完成"）。
- 修**假交互 + 入口**（拆"看演示"vs"用我的议题开始"、样本锁议题、去 `DeepSeek` 黑话）。
- **发言记录(transcript) + 暂停/回看**、打字机点击跳过。
- **思考/等待态 + 错误重试态**。
- ⭐ **「查看编排逻辑」开关**（露出多 Agent 编排流程/依赖/耗时）——评审说"这一个开关加分大于所有动画之和"，作品集价值最高。

**美术/场景打磨**：近侧角色轻微穿桌可再调 `SEATS`/`clipPath`；reviewer 坐姿朝右略朝外可考虑重出朝左版；移动端真·响应式（现仅缩放兜底）。

**方案依据**：完整改进方案（含两轮外部评审意见）在 `docs/superpowers/plans/2026-07-31-cyber-office-experience-overhaul.md`。

## 9. 相关计划文档

- `plans/2026-07-31-cyber-office-experience-overhaul.md` —— 体验改进总方案（P0/P1/P2 优先级 + 评审共识）。
- `plans/2026-07-31-cyber-office-experience-tasks.md` —— 交互轨"照着敲"教程（持续追加 Task）。
- `plans/2026-07-31-cyber-office-art-assets-spec.md` —— 美术资产规格 + 每角色完整出图 prompt。
- `plans/2026-07-12-cyber-office-p4-pixel-art.md` —— 旧的 PixelMap 路线（**已废弃**，顶部有说明，勿执行）。
- `specs/2026-06-14-cyber-office-design.md` + `plans/2026-06-14/29/07-04-*` —— P0–P3 设计与实现。

## 10. 环境 / 命令

- Node 20.11、Next.js 16（Turbopack）、vitest@2 锁定。路径别名 `@/`→`src/`。本地 `D:\myBlog\chenyu-blog`（Windows/PowerShell）。
- `npm run dev`（localhost:3000）/ `npm run test` / `npx tsc --noEmit` / `npm run lint` / `npm run build`。
- 预览面板在本机常渲染不出（截图靠 Chenyu），改完让他刷新截图确认。
- 提交规范：`类型: 中文描述`，结尾带 Co-Authored-By。

> 心法不变：**你是总设计师**——出图纸、定标准、把方向、盯细节；Chenyu 手写实现 + 拍板 + 出图。视觉效果第一，别打折。
