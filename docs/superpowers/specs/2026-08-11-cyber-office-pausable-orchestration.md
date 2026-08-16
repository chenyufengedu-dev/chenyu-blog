# 设计 spec：实时 Agent 编排 —— 轮次边界可暂停 / 可恢复

> **性质**：架构设计文档（不是照着敲的教程）。定方向、定接口、定分期。方案确定后再拆成 Task 教程。
> **目标**：让实时会议能在**轮次边界**真正暂停（停止向 LLM 发请求）、之后恢复继续；并为「人在回路」留出接口。
> **动机**：这是 Agent 岗位高频面试题「如何暂停一个 Agent？」的实战落地。做完之后，Chenyu 能从"背概念"变成"我实现过，并且知道为什么这么设计"。

---

## 一、现状：为什么现在停不了

当前实时会议的数据流（`route.ts` + `orchestrator.ts` + `use-live-meeting.ts`）：

```
前端 POST 一次 (topic)
      │
      ▼
Route Handler 建 ReadableStream
      │
      ▼
runMeeting() 一口气把整场会议循环跑完
   ├─ 问主持人 → 点名 → 角色流式吐字 → 说完 → 下一轮 …
      │
      ▼
SSE 单向推事件 ──────► 前端只能"读"
```

**问题的本质不是"网络流不能暂停"，而是：**

1. **前端没有话语权**。只 POST 了一次，之后服务端自驱到底；SSE 是**单向**的，前端没有任何通道能在中途告诉后端"到下一个边界先停一下"。
2. 现有 `cancel()` 走的是 `AbortController` → 连接断开 → `route.ts` 的 `cancel()` 把 `clientGone = true`。这是**终止**（丢弃整场），不是**暂停**（可恢复）。

## 二、决定性约束：Serverless 的 60 秒天花板 ⚠️

`route.ts:11` 写着：

```ts
export const maxDuration = 60;
```

这意味着这个 Route Handler 是**一个最多活 60 秒的无服务器函数**。由此推出三条硬约束：

- **不能"让函数挂起等待恢复"**：函数被计时，暂停期间时钟照走，60 秒一到直接被杀。
- **暂停期间保持函数活着 = 白烧执行时间**（Vercel 按执行时长计费）。
- **实例不粘连**：恢复请求不保证落到同一个函数实例，进程内的内存状态（比如一个 `isPaused` 变量）**根本不共享**。

> **结论：在当前部署形态下，"暂停一个正在运行的服务端循环"这个思路从根上就是错的。** 正确的方向是让服务端**不再长跑**。

## 三、三个方案与取舍

### 方案 A：进程内暂停标志（`runMeeting` 每轮 `await` 一个 flag）
- 做法：在生成器循环每轮开头检查/等待一个"是否暂停"的信号。
- **否决**。理由见上：serverless 60 秒会杀掉函数；暂停即烧钱；多实例下内存 flag 不共享。只有在"长驻自有服务器"下才成立。

### 方案 B：客户端逐轮驱动（服务端变成无状态单步）⭐ 推荐
- 做法：把"跑完整场会议"的一个长请求，拆成**每轮一个短请求**。服务端只负责"**给定会议历史，执行下一步**"，不再持有会议进程。
- 暂停 = **前端干脆不发起下一轮请求**。真正停止向 LLM 发提示词，**零成本**、**可无限期暂停**。
- 恢复 = 带着已有 `transcript` 再发一次请求。
- **副作用（全是好处）**：
  - 服务端**无状态**，天然适配 serverless，每次调用远低于 60 秒。
  - 会议状态（`transcript`）成为**显式的检查点**，可存 localStorage / URL / 数据库 → 关掉页面明天再接着开会都可能。
  - **人在回路**天然可插入：拿到主持人决策后、执行之前，前端可以让用户"批准 / 改点名对象 / 改指令"再提交下一步。这是本设计最亮的延伸。
- **代价**：改后端编排的驱动方式 + 前端 hook 重写。是一次真正的架构升级，不是小修。

### 方案 C：外部控制通道（Redis flag / WebSocket + 长驻 worker）
- 做法：会议跑在长驻进程里，前端通过 Redis 或 WebSocket 发"暂停"信号。
- **不选**。需要引入长驻服务或队列（Vercel serverless 上做不了），对一个作品集项目属于过度工程。**但值得在面试里提到**：这是工业界（Temporal、LangGraph + checkpointer）的做法，说明你知道边界在哪。

> **决策：走方案 B。** 它同时解决了"能暂停"、"能恢复"、"适配 serverless"、"能做人在回路" 四件事。

---

## 四、方案 B 详细设计

### 4.1 核心思路：把"会议循环"从服务端搬到客户端

```
现在： 前端 ──POST 一次──► [服务端：整场循环] ──SSE──► 前端
之后： 前端持有 transcript，逐轮驱动
       ┌─► POST /step (topic, transcript) ──► 服务端执行"下一步" ──SSE(本轮事件)──► 前端
       │                                                                          │
       └──────────────── 前端决定：继续 / 暂停 / 结束 ◄────────────────────────────┘
```

**关键点：服务端从"会议的主人"降级成"一次调用一步的纯函数"。** 会议的进度由前端持有，这正是"状态检查点"的落地形式。

### 4.2 服务端：新增单步接口

新增 `POST /api/cyber-office/step`（保留旧的 `/run` 一段时间，见 §5 分期）。

**请求体**：
```ts
{
  topic: string;
  participants: RoleId[];
  transcript: { speaker: RoleId; text: string }[]; // 已有会议历史 = 检查点
  turn: number;                                    // 当前是第几轮（用于封顶 maxTurns）
  decision?: ModeratorDecision;  // 可选：人在回路时，前端直接指定本轮决策（跳过问主持人）
}
```

**响应**：SSE 流，只推**这一轮**的事件（`moderator_decision` → `host_speak` → `call_on` → `speaking_start` → `token`… → `speaking_end`），最后补一个新事件：

```ts
{ type: "step_end"; nextTurn: number; done: boolean }
```

`done: true` 表示主持人判定该总结了（或达到 maxTurns），前端下一次改调总结。

> 复用现有 `encodeSseEvent` / `parseSseChunk`，事件格式不变——**这就是当初事件流解耦架构的红利**。

**服务端逻辑**（把 `runMeeting` 的循环体抽出来，成为 `runOneTurn`）：

```
runOneTurn(topic, transcript, turn, decision?):
  1. decision 有传就直接用（人在回路）；否则问主持人拿决策
  2. yield moderator_decision / host_speak
  3. 若 action === "summarize" → yield step_end{done:true}，结束
  4. yield call_on / speaking_start
  5. 流式跑角色发言 → yield token…
  6. yield speaking_end / step_end{done:false, nextTurn: turn+1}
```

总结单独一个接口或一个 `mode: "summarize"` 分支，输入完整 transcript，输出 `summary` 事件。

**限流**：`guardLiveMeetingRequest` 现在是"每场会议一次"，改成逐轮后会被调用 N 次。需要相应调整配额口径（见 §6 待定项）。

### 4.3 前端：会议循环搬到 hook 里

`useLiveMeeting` 重写为一个**由前端驱动的状态机**：

```
状态：idle → running → paused → running → … → ended
```

```ts
// 伪代码
async function loop() {
  while (!done && turn < maxTurns) {
    if (pausedRef.current) return;      // ← 暂停点：直接退出循环，不发请求
    await runStep(turn);                // 发一次 /step，把 SSE 事件 dispatch 进 reducer
    turn = nextTurn;                    // 从 step_end 拿
  }
  await runSummary();
}

pause():  pausedRef.current = true      // 当前这一轮跑完就自然停住
resume(): pausedRef.current = false; loop()   // 从 transcript 接着跑
```

**暂停语义（重要，要在 UI 上说清）**：点"暂停"后，**当前这一轮会把话说完**（这句的 LLM 调用已经在飞了），**然后停在轮次边界**。这不是 bug，正是"安全暂停点"的正确行为——UI 文案应显示「本轮结束后暂停」。

`transcript` 已经在 `MeetingState` 里（Task 9 加的），前端天然持有检查点，**恢复不需要额外数据结构**。

### 4.4 人在回路（Human-in-the-loop）—— 本设计的皇冠

因为决策和执行被拆成了两步，可以自然地插入人类审批：

1. 前端请求"只问主持人，先别执行"（`/step` 加个 `planOnly: true`，或单独 `/plan` 接口）；
2. UI 展示主持人的决策 JSON，用户可以：**批准** / **改点名对象** / **改指令文本**；
3. 用户确认后，前端把（可能被修改的）`decision` 回传给 `/step` 执行。

**这一条直接对应面试答案里"暂停最重要的用途是人在回路"**，而且和现有的「编排逻辑面板」是同一块 UI——面板已经在展示决策 JSON 了，加一个"批准/修改"就成立。

---

## 五、分期落地（每期都可独立提交、不破坏现状）

| 期 | 内容 | 产出 |
|---|---|---|
| **S1** | 后端：抽出 `runOneTurn`，新增 `/api/cyber-office/step` 与 `step_end` 事件类型。`/run` 保持不动 | 单步接口可用（可用 curl / 单测验证） |
| **S2** | 前端：`useLiveMeeting` 改为逐轮驱动，走 `/step`；行为与现在等价（无暂停） | 功能不变，架构已换骨 |
| **S3** | 加 `pause()` / `resume()`，UI 出现「暂停 / 继续」，文案说明"本轮结束后暂停" | ⭐ 真暂停达成 |
| **S4** | 检查点持久化：`transcript` 存 localStorage，刷新页面可恢复会议 | 可恢复性可演示 |
| **S5** | 人在回路：决策审批 / 修改后执行，接进编排面板 | ⭐ 皇冠功能 |
| **S6** | 清理：下线 `/run`，或保留为"一键跑完"的快捷入口 | 收尾 |

> 建议至少做到 **S3**（真暂停成立）。S4/S5 是加分项，但 S5 的面试价值极高。

---

## 六、待定决策（开工前拍板）

1. **限流口径**：逐轮请求后，`guardLiveMeetingRequest` 是按"每步"计数，还是引入一个会议级 token（每场会议发一个 id，按 id 累计预算）？
   - 倾向：引入会议级预算计数，否则按步限流会让长会议被误伤。
2. **`/run` 何去何从**：S6 直接下线，还是保留成"不暂停、一口气跑完"的快捷路径？
   - 倾向：保留一段时间，降低回归风险。
3. **总结走单独接口还是 `/step` 的一个分支**？
   - 倾向：`/step` 加 `mode: "summarize"`，少一个路由。
4. **回放模式是否也统一到这套驱动**？回放已有自己的 `pause/resume/skip`（Task 11 已完成），可暂不动。
   - 倾向：不动，两者各司其职。

---

## 七、面试话术映射（做完之后你可以这样讲）

| 面试要点 | 你项目里的实现 |
|---|---|
| 暂停 ≠ 停止，暂停要能恢复 | `pause()` 停在轮次边界，`resume()` 带 transcript 继续；`cancel()` 才是终止 |
| 只能在**安全点**暂停 | 轮次边界（一轮说完、下一轮未发起）；不能停在 token 流中途或工具副作用中途 |
| 协作式检查，而非强杀 | 循环每轮开头检查暂停标志后再决定是否发起下一次调用 |
| 状态检查点 / durable execution | `transcript` 就是检查点；服务端无状态，任何一次 `/step` 都可从检查点重放 |
| 为什么不用进程内 flag | **serverless 60 秒上限 + 实例不粘连 + 暂停期间照计费**，所以把循环移到客户端、服务端做成单步纯函数 |
| 工业界怎么做 | Temporal / LangGraph checkpointer 是同一思路的重型版；我的场景用轻量方案达到了同样的语义 |
| 暂停的杀手级用途 | 人在回路：主持人决策先给人看，批准或修改后再执行（S5） |

> 最有杀伤力的一句：**"我一开始想在服务端加个暂停标志，后来发现部署在 serverless 上根本不成立——函数有 60 秒上限、实例还不粘连。所以我把编排循环的驱动权交给了客户端，服务端退化成'给定历史执行一步'的无状态纯函数。这样暂停就是'不发起下一步'，零成本、可无限期，而且顺带获得了可恢复和人在回路。"**

---

## 八、风险与注意

- **in-flight 调用**：暂停时当前轮的 LLM 调用已发出，必须让它跑完（结果进 transcript），否则恢复时会丢一轮。**不要**在暂停时 abort 当前轮。
- **幂等**：若某轮请求失败重试，同一轮可能被执行两次 → 前端要保证"同一 turn 只提交一次成功结果进 transcript"。
- **每轮一次握手的延迟**：逐轮请求比单条长连接多几次 TCP/TLS 往返，观感上轮次之间会略有停顿。可接受（会议本来就有节奏），必要时用 keep-alive 缓解。
- **回归风险**：S1/S2 期间 `/run` 与 `/step` 并存，注意别让两套路径的事件语义漂移。
