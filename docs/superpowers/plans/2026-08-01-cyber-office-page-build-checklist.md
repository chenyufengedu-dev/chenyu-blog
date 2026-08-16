# Cyber Office 整页落地清单（对着设计图拆）

> 用途：把设计 AI 出的高保真图，逐区块拆成"保留 / 删除 / 改动"，并标注**每块真实数据来自哪个 `OfficeEvent` / `MeetingState` 字段**，作为构建蓝图。
> 数据源事实核对自：`types.ts`（OfficeEvent / MeetingState）、`reducer.ts`（applyEvent）、`orchestrator.ts`（runMeeting）、`cyber-office.tsx`（现有组件）。

---

## 总原则

**保留设计图的"视觉工艺"（层次 / 光影 / 编排流程图），剥掉它的"假 SaaS 产品官网人设"。** 这是嵌在个人博客里的**一个展示页**，不是一家公司的落地页。

---

## 区块逐个拆

### A. 顶部导航栏 —— ❌ 大改
- 设计图里的 `产品 / 工作原理 / 应用场景 / 定价 / 文档 / 关于` + 「系统运行正常」绿点 + 右上「开始会议」按钮 + 独立 logo —— **全删**。
- 真相：本页嵌在博客里，用博客**现有的 `navbar.tsx`**。`定价` 尤其误导（demo 没有定价）。
- 保留：可以在页面内容区顶部放一个**页面级小标题条**（非全站导航），但不做成"公司官网导航"。

### B. Hero 标题区 —— ✅ 保留（微调）
- 保留：`Cyber Office` 大标题（橙色点缀 "Office"）+ 副标题「多个 AI 专家一起帮我讨论问题」+ 一句说明。
- 删：`AI 会议室` 那个胶囊小标签可留可去（留则守圆角红线）。
- 数据源：纯静态文案。

### C. 发起会议控制区 —— ✅ 保留（对接现有逻辑）
- 保留：议题输入框（`0/500` 字数）、`开始会议` 主按钮、`观看演示` 次按钮、4 个示例问题 chip。
- 对接现有代码（`cyber-office.tsx`）：
  - `观看演示` → 现有 `replay.start()`（样本模式）。
  - `开始会议` → 现有 `live.start(topic, LIVE_PARTICIPANTS)`。
  - 议题输入 → 现有 `topic` state；样本模式下应**锁定/禁用**输入框。
  - 示例 chip 点击 → `setTopic(该问题)`。
- 改：按钮文案去掉 `DeepSeek` 黑话（现有代码里 "实时运行 DeepSeek 会议" → 改"开始会议"）。
- 新增：暂停/继续/重新开始（需回放引擎支持，见"待确认"）。

### D. 中央像素会议室（舞台）—— ✅ 保留（这是主角）
- 保留：3/4 俯视像素会议室、5 角色围坐、当前发言者橙色高亮 + 头顶喇叭图标、角落道具。
- 改：**深色版窗外的赛博朋克霓虹城市 → 改成非霓虹日景**（守"现代简约办公室"美术方向）。
- 对接现有 `office-scene.tsx`（已实现：SEATS、发言者高亮、字幕）。
- 数据源：`state.roles[id].status`（idle/raising_hand/speaking）、`state.activeSpeaker`。

### E. 字幕条 —— ✅ 已实现（保留）
- 现有 `SubtitleBar`（`cyber-office.tsx:36`）已覆盖：错误 / 发言者 / 主持人串场三情况。
- 数据源：`state.error` / `state.activeSpeaker` + `state.roles[id].bubble` / `state.hostText`。
- 可加：打字机点击跳过（后续）。

### F. 会议结论区 —— 🔄 升级现有 SummaryPanel
- 设计图：`会议结论` 标题 + 逐条编号建议 + `复制结论 / 导出 PDF / 导出 Markdown`。
- 现有 `SummaryPanel`（`cyber-office.tsx:20`）只 `<pre>` 平铺 `state.summary` 字符串。
- 改：解析 `summary` 成条目列表渲染；加复制/导出按钮。
- 数据源：`state.summary`（来自 `summary` 事件的 `outline`）。⚠️ 现在是**整段纯文本**，要分条得约定总结 Agent 输出格式（见"待确认"）。

### G. ⭐ 编排逻辑面板「AI 智能体如何协作」—— 🆕 核心新建
> 王牌区。详见下方"编排面板专项拆解"。

### H. 页脚 —— ❌ 删
- 设计图的 `© 2024 Cyber Office 保留所有权利` + 社交图标（X/LinkedIn/GitHub）—— **假的，全删**。用博客现有页脚。

---

## ⭐ 编排面板专项拆解（对接真实数据）

设计图这块分三部分，逐一核对数据可行性：

### G1. 左侧「阶段流程」01–04（理解问题 / 展开探索 / 交叉辩论 / 综合生成）
- 性质：**静态讲解**（描述编排的四个概念阶段），不是逐事件驱动。
- 可选增强：按当前进度高亮到第几阶段——但**现有事件流没有"阶段"概念**（`state.phase` 只有 idle/running/ended）。
  - 方案：前端按启发式推断（有 summary→阶段4；有 activeSpeaker→阶段2/3…）。属"锦上添花"，先做静态版。

### G2. 中间「调度流向图」你的问题 → 主持者 → [各角色] → 综合输出
- **实时高亮节点**：完全可行，数据现成。
  - 当前 `state.activeSpeaker === 'pm'` → 高亮"策略师/产品"节点。
  - `activeSpeaker === null` 且刚 `host_speak` → 高亮"主持者"节点。
  - `state.summary != null` → 高亮"综合输出"节点。
- 数据源：`state.activeSpeaker`、`state.hostText`、`state.summary`、`state.phase`。**无需动后端。**

### G3. 下侧「主持人真实决策 JSON」—— ⚠️ 需加事件（见文首架构判断）
- 现状：决策 JSON 在 `orchestrator.ts` 里算完即丢，事件流不携带 `prompt` 字段。
- **决策（待 Chenyu 拍板）**：加新事件 `moderator_decision`，携带真实 `{action, speaker, prompt, hostText}`。
  - 改动点（约 4 处）：
    1. `types.ts`：`OfficeEvent` 加 `{ type: "moderator_decision"; decision: ModeratorDecision }`。
    2. `orchestrator.ts`：`parseModeratorDecision` 后 `yield { type:"moderator_decision", decision }`。
    3. `reducer.ts`：加 case，把最近一次决策存进 `MeetingState`（新增字段 `lastDecision`）。
    4. `MeetingState`：加 `lastDecision: ModeratorDecision | null`。
    5. 样本回放 `sample-meeting.ts`：补几条 `moderator_decision` 事件，回放也能演示。
- 价值：面板展示的是 **100% 真实调度决策**，作品集真实性拉满。

### G4. 底部「记忆与上下文 / 工具与数据 / 路由逻辑 / 质量护栏」四小卡
- 性质：**静态讲解**，介绍这套编排的四个能力维度。对应你真实实现：
  - 记忆与上下文 = `transcript` 跨轮传递（`orchestrator.ts` 的 transcript 数组）。
  - 路由逻辑 = 主持人动态点名（`ModeratorDecision.action`）。
  - 质量护栏 = `parseModeratorDecision` 的合法性校验 + P3 限流。
  - 工具与数据 = 目前是"规划中"，可诚实标注或暂去。
- 纯静态文案，最好用**你真实实现**的说法，别吹没有的功能。

---

## 待 Chenyu / 总设计师确认的点

1. **加 `moderator_decision` 事件？**（决定 G3 是"真决策"还是"前端伪造近似"）——**推荐：加。**
2. **总结输出格式**：要分条渲染结论（F 区），需让总结 Agent 输出结构化（如带编号/JSON）。改 `buildSummarySystemPrompt`。
3. **暂停/继续**：现有 `use-replay` 是否支持？没有则需加（C 区控制条依赖它）。
4. **导出 PDF**：设计图有，但 PDF 成本高；建议先只做**复制 + 导出 Markdown**，PDF 后期。

---

## 建议构建顺序

1. **剥壳**：删假导航/假页脚/假定价，接回博客 navbar（A、H）——最快见效、去 AI 感。
2. **⭐ 编排面板 G2 高亮流向图**（不动后端，先落地王牌可视化）。
3. **G3 加 `moderator_decision` 事件 + 面板下半真决策 JSON**（王牌变"真"）。
4. C 区文案去黑话 + 示例 chip + 样本锁议题。
5. F 区结论升级（分条 + 复制/导出 Markdown）。
6. G1/G4 静态讲解、G3 阶段高亮等打磨。

> 每块开工时我写成"照着敲"的 Task 教程（文件路径 + 注释代码 + 提交命令），你按 Task 记录。
