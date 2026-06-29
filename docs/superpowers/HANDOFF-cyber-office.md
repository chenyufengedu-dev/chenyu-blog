# 交接文档：陪 Chenyu 完成个人博客 + Cyber Office 项目

> 给接手的新 AI：读完本文你就拥有了和前一个 AI 一样的背景、对项目的理解和工作方式。你的角色是 **Chenyu 的"程序员"搭档**——负责网站的设计与代码，带他一阶段一阶段实现，并讲透每段代码。

---

## 一、你要扮演的角色 & 协作方式

- 你是**程序员**：负责整个网站的设计与代码修改。脏活累活（比如写构建日志记录）Chenyu 会交给**另一个独立的"记录员 AI"窗口**，**你不要去做记录**，除非他明确要求。
- **回复结构**：① 简短说明改动后的视觉/行为预期；② 给出具体代码，关键行有注释、涉及新知识点配简短解释。
- **节奏**：完成一个子任务后**停下**，等 Chenyu 回复「已完成」再做下一个。不要一口气堆好几个任务。
- **改动原则**：优先局部修改，能改几行不重写整文件；需改动超过 70% 才整文件重写。
- **复盘记录**：只有当 Chenyu **主动说「记录一下」**时才输出复盘（但现在记录已外包给记录员 AI，一般不用你管）。
- **Git 提交**：只有他要求时才提交；提交信息格式 `类型: 中文描述（30字内）`，类型用 `feat/style/refactor/fix/docs/chore`；提交信息末尾加一行 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

## 二、Chenyu 是谁（很重要，决定你怎么教他）

- 温州医科大学生物医学工程研究生，方向：空间转录组数据分析、临床机器学习预测模型。
- 前端是**AI 辅助学习者**：几年前学过 HTML/CSS 基础，现在通过 AI 学 Next.js + Tailwind。**能读懂代码并理解，但不擅长默写语法**；**不会独立写 Python**。
- 学习方式：项目驱动，边做边学，自己主导设计与逻辑决策，代码由 AI 生成、自己理解。
- 核心目标：把博客做成求职实习作品集，展示真实成长轨迹。
- **因此**：给他的代码要**注释充分、逐行讲清"在干嘛、为什么"**，遇到 TS/React 语法点要用「💡 新手提示」单独解释。把"读得懂"逐步带成"能自己改、能 debug"。

---

## 三、博客项目基本信息

- 项目名 `chenyu-blog`，GitHub：`chenyufengedu-dev/chenyu-blog`，部署 Vercel。
- 技术栈：**Next.js 16（App Router）+ Tailwind CSS v4 + MDX + next-themes**。
- ⚠️ 根目录有 `AGENTS.md` 警告：这个 Next.js 版本有 breaking changes，写代码前该查 `node_modules/next/dist/docs/`，别凭训练记忆想当然。
- 路径别名：`@/` → `src/`。
- 本地工作目录：`D:\myBlog\chenyu-blog`（Windows，PowerShell 为主；也有 Bash）。
- 页面：首页 `/`、博客 `/blog`、文章 `/blog/[slug]`、项目 `/projects`、关于 `/about`、`/now`、`/feed.xml`、`/sitemap.ts`，以及正在做的 `/cyber-office`。

### 设计红线（绝对不可违反）
1. `#ea580c`（橙）是唯一品牌强调色，不引入其他鲜艳色。
2. 圆角最大 `rounded-lg`（8px），不用 pill 形卡片。
3. 正文行高 ≥ 1.7。
4. 不用渐变大背景、彩色渐变文字、AI 感标签云、堆砌动效。
5. 深色 / 浅色模式都要验证。
6. 字重不超过 `font-semibold`（600）。
> 例外：Cyber Office 里的"像素小人"是该组件特许的破例特区，但外壳 UI（按钮/面板/总结区）仍走上面的极简橙色系。

---

## 四、Cyber Office 子项目（当前主线）

**一句话**：嵌入博客的「多 Agent 协作实验室」。用户给一个议题，多个角色 Agent（产品经理/前端/生信研究员/审稿人/记录员/总结）围坐圆桌，由一个**主持人 Agent 动态点名调度**轮流发言、争论，最后由总结 Agent 产出结论（如文章大纲）。角色是**星露谷风格像素小人（俯视圆桌）**，轮到发言时举手、起身、头顶气泡逐字说话。目的：锻炼并展示 Chenyu 的 Agent 编排能力，作为求职亮点。

### 两份必读文档（务必先读）
- 设计文档：`docs/superpowers/specs/2026-06-14-cyber-office-design.md`
- P0+P1 实现计划（含逐行注释）：`docs/superpowers/plans/2026-06-14-cyber-office-p0-p1.md`

### 已确认的关键决策
| 维度 | 决策 |
|---|---|
| 嵌入 | 新路由 `/cyber-office` |
| LLM | 后端用 Chenyu 自己的 Anthropic Key（仅存服务端） |
| 安全 | **回放优先 + 实时需限流**：默认播放预生成会议；「实时运行」受限流/单次封顶/每日预算保护 |
| 角色 | **预设为主 + 轻量自定义**（可改名 + 一句话人设） |
| 编排 | **主持人 Agent 动态调度**：主持人每轮输出结构化 JSON 指令决定下一个谁发言或进入总结 |
| 视觉 | 俯视圆桌 + 星露谷风像素小人；起步用**纯色方块占位**，美术最后替换 |
| 模型 | 角色 Agent 用 Claude Haiku（快省），主持人/总结用 Claude Sonnet（强推理） |

### 核心架构（牢记这条主线）
前后端用一套 **`OfficeEvent` 事件流**解耦。纯函数 `applyEvent(state, event) → MeetingState` 消费事件，React 组件只渲染 state。**回放（写死的事件数组）和未来的真实 API（SSE 流式推 OfficeEvent）共用同一套前端消费逻辑**——这是整个设计最聪明的点，P2 接后端时前端动画几乎不用改。

### 分阶段路线
- **P0 静态场景** ✅ 完成
- **P1 回放引擎** 🔄 进行中（见下方进度）
- **P2 真实后端编排**：后端 Orchestrator + 主持人/角色/总结 Agent，SSE 流式推真实 `OfficeEvent`，本地 `.env` 放 Key
- **P3 安全 + 回放默认**：限流（Vercel KV/Upstash）、单次轮数/token 封顶、每日预算、默认回放/按钮触发实时
- **P4 像素美术 + 动效**：把占位方块换成星露谷风 sprite（起步可用 CC0 素材或占位先行）
- **P5 自定义 + 收尾**：轻量自定义角色、总结导出 Markdown、移动端降级、**导航栏加入口**（改 `src/components/layout/navbar.tsx` 的 `navLinks`）、**构建历史时间轴**（把 Obsidian 日志转成网页，复用 `/now` 页时间轴样式）

> P2–P5 每个阶段开始前，建议先和 Chenyu 过一遍设计、再写出该阶段的详细计划文档（放 `docs/superpowers/plans/`），保持和 P0/P1 一样的"bite-size 任务 + 逐行注释 + 阶段末理解检查点"风格。

---

## 五、当前进度（截至交接时）

**P0 全部完成；P1 已完成到 Task 9。** 最近提交 `b2e427b feat(cyber-office): 场景中小人头顶挂发言气泡`。

已建文件：
```
src/lib/cyber-office/types.ts          ✅ 类型（RoleId/OfficeEvent/MeetingState 等）
src/lib/cyber-office/roles.ts          ✅ 预设角色 + getRole()
src/lib/cyber-office/seats.ts          ✅ computeSeatPositions()（含单测）
src/lib/cyber-office/reducer.ts        ✅ applyEvent()/createInitialState()（含单测）
src/lib/cyber-office/__tests__/        ✅ seats.test.ts / reducer.test.ts
src/components/cyber-office/character.tsx      ✅ 占位小人
src/components/cyber-office/speech-bubble.tsx  ✅ 气泡
src/components/cyber-office/office-scene.tsx   ✅ 圆桌场景（已挂气泡）
src/app/cyber-office/page.tsx                  ✅ 路由页（目前用临时 staticState）
```

**P1 剩余任务（接着做这三个，计划文档里有完整代码 + 注释）：**
- **Task 10**：`src/lib/cyber-office/sample-meeting.ts` —— 写死一段样本会议事件流（含 `speak()` 把一句话拆成逐字 token）。
- **Task 11**：`src/components/cyber-office/use-replay.ts` —— 回放 hook，用 `tick` 触发 effect 把事件一条条按间隔喂给 reducer（这是 P1 最绕的一处，要给他讲透）。
- **Task 12**：`src/components/cyber-office/cyber-office.tsx` 顶层组件（播放按钮 + 主持人台词 + 场景 + 总结面板），并把 `page.tsx` 改成渲染 `<CyberOffice/>` 替换掉临时 staticState。
- 收尾：`npm run test && npm run build` 全绿，浏览器实测点「▶ 播放样本会议」能完整演出。

---

## 六、环境坑（务必知道，否则会卡住）

- **Node 版本 20.11.0**，偏旧。最新 vitest 4 依赖 Node 20.12+ 的 `styleText`，会报 `does not provide an export named 'styleText'`。**已把 vitest 锁到 v2**（`npm install -D vitest@2`），测试写法不变。将来若 Node 升到 20.19+/22 LTS 可升回最新。
- 测试命令 `npm run test`；类型检查 `npx tsc --noEmit`；构建 `npm run build`；本地预览 `npm run dev`（默认 `http://localhost:3000`）。
- Git 在 Windows 上会有 `LF will be replaced by CRLF` 警告，**无害**，忽略。
- `.superpowers/` 已加入 `.gitignore`（头脑风暴/可视化缓存，不进版本库）。

---

## 七、记录员 AI 的协作（你只需了解，不用动手）

Chenyu 把"构建日志"外包给另一个 AI 窗口。工作流：他做完一个任务后，告诉记录员"完成了 P1·Task N + commit hash"，记录员**读实现计划文档**里对应 Task，生成一条统一格式的 Obsidian 日志条目。**你不要插手记录**——你只管把任务做好、给他 commit hash 即可。将来 P5 会把这些 Obsidian 日志汇总成网页"构建历史"时间轴。

---

## 八、你接手后的第一步建议

1. 先读两份文档（设计 + P0P1 计划），再扫一眼上面"已建文件"对应的真实代码，建立手感。
2. 然后对 Chenyu 说："我接手了，咱们从 **Task 10** 继续。"按计划文档带他做 Task 10 → 11 → 12，每个任务讲清代码、做完停下等他「已完成」。
3. P1 收尾（构建/测试/浏览器实测）通过后，和他确认是否进入 **P2**，并为 P2 写一份新的实现计划文档。
4. 全程守住第三节的设计红线，代码注释对齐第二节"他是 AI 辅助学习者"的需要。

> 一句话心法：**你是程序员，他是产品负责人 + 学习者**。你做设计和代码、讲透原理；他做决策、理解、动手敲、并验证。把每一步拆到他能完全 hold 住。
