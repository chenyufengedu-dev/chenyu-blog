# Cyber Office P3 Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 P2 的真实 DeepSeek 会议入口加上上线前安全闸门：默认回放、服务端限流、每日实时次数预算、错误信息脱敏、前端可取消请求。

**Architecture:** 继续守住 `OfficeEvent` 事件流主线，前端回放与实时会议仍共用 `applyEvent`。P3 只在实时入口外层加保护：Route Handler 先做请求校验和限流预算，通过后才创建 DeepSeek model；前端用 `fetch + ReadableStream + AbortController` 消费 SSE，并能在切换模式或离开页面时取消请求。限流状态放在 Upstash Redis，代码在本地无 Upstash 环境时允许开发调试，在生产环境缺配置时拒绝实时运行。

**Tech Stack:** Next.js App Router Route Handler、TypeScript、Vitest、DeepSeek OpenAI-compatible SDK、Upstash Redis、`@upstash/ratelimit`、浏览器 `AbortController`。

---

## 设计边界

P3 不是新增 Agent 能力，也不是美术阶段。它只解决 P2 上线前最危险的四件事：

1. **成本保护**：实时 DeepSeek 会议必须先过限流和每日次数预算。
2. **默认安全体验**：页面仍默认展示样本回放，访客不点实时按钮就不消耗 token。
3. **错误脱敏**：浏览器不能看到 `Missing DEEPSEEK_API_KEY`、SDK 堆栈、Redis 连接细节这类内部错误。
4. **请求可取消**：用户切到回放、重复启动、离开页面时，前端要中断正在读取的实时流。

> P3 的“预算”先按**实时会议次数**控制，不做精确 token 计费。真实 token 用量要依赖模型响应 usage 或更细的计数，复杂度高，放到以后需要统计面板时再做。

## 参考资料

- Next.js 本地文档：`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
- Next.js 本地文档：`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`
- Upstash Redis TypeScript 部署文档：<https://upstash.com/docs/redis/sdks/ts/deployment>
- Upstash Ratelimit 算法文档：<https://upstash.com/docs/redis/sdks/ratelimit-ts/algorithms>
- Upstash Ratelimit features 文档：<https://upstash.com/docs/redis/sdks/ratelimit-ts/features>

## 文件结构

本阶段新增或修改的文件：

```txt
src/lib/cyber-office/
  limits.ts                         # P3 安全常量：轮数、token 上限、限流窗口、用户可见错误文案
  live-errors.ts                    # 把内部异常转换成可给前端看的稳定错误
  rate-limit.ts                     # Upstash Redis + Ratelimit 保护实时会议入口
  deepseek-client.ts                # 改用 limits.ts 里的 token 上限
  sse.ts                            # 解析坏 SSE JSON 时不让前端直接崩掉

src/lib/cyber-office/__tests__/
  live-errors.test.ts
  rate-limit.test.ts
  sse.test.ts                       # 补坏 JSON 测试

src/app/api/cyber-office/run/
  route.ts                          # 接入 guardLiveMeetingRequest，错误脱敏，maxTurns 走常量

src/components/cyber-office/
  use-live-meeting.ts               # 增加 AbortController、取消、HTTP JSON 错误读取
  cyber-office.tsx                  # 切到回放时取消实时会议，实时运行中显示停止按钮

package.json
package-lock.json                   # 新增 Upstash 依赖
```

---

### Task 1: 安装 Upstash 依赖

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: 安装依赖**

Run:

```bash
npm install @upstash/redis @upstash/ratelimit
```

Expected: `package.json` 的 dependencies 里出现 `@upstash/redis` 和 `@upstash/ratelimit`。

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add package.json package-lock.json
git commit -m "chore(cyber-office): 安装 Upstash 限流依赖"
```

---

### Task 2: 集中定义 P3 安全常量

**Files:**
- Create: `src/lib/cyber-office/limits.ts`

> P2 里 `maxTurns` 和 `max_tokens` 分散写在 route/client 里。P3 先把这些“花钱相关”的数字集中到一个文件，后续调额度只改一处。

- [x] **Step 1: 创建 limits.ts**

Create `src/lib/cyber-office/limits.ts`:

```ts
// P3 先用“实时会议次数”做预算，不做精确 token 计费。
// 这些数字偏保守：够你演示能力，但不至于被陌生访问者刷爆额度。
export const LIVE_MEETING_LIMITS = {
  maxTurns: 4,
  moderatorMaxTokens: 420,
  roleMaxTokens: 160,
  summaryMaxTokens: 520,
  perIpHourlyLimit: 3,
  perIpHourlyWindow: "1 h",
  globalMinuteLimit: 5,
  globalMinuteWindow: "1 m",
  dailyLiveRunBudget: 30,
} as const;

// 所有会给用户看的错误文案集中放这里，避免 route.ts 把内部异常 message 直接吐给前端。
export const LIVE_MEETING_MESSAGES = {
  rateLimited: "实时会议请求太频繁了，请稍后再试。你仍然可以播放样本会议。",
  dailyBudgetExhausted: "今天的实时会议体验额度已经用完，请先播放样本会议。",
  configMissing: "实时会议暂时未开放，请先播放样本会议。",
  deepseekFailed: "实时会议生成失败，请稍后再试或播放样本会议。",
  networkFailed: "网络连接中断，请稍后再试。",
  invalidRequest: "请输入 6-240 个字符的议题，并选择 2-6 个参会角色。",
} as const;
```

- [x] **Step 2: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 提交**

```bash
git add src/lib/cyber-office/limits.ts
git commit -m "feat(cyber-office): 集中定义实时会议安全常量"
```

---

### Task 3: DeepSeek token 上限改用常量

**Files:**
- Modify: `src/lib/cyber-office/deepseek-client.ts`

- [ ] **Step 1: 引入 limits**

Modify `src/lib/cyber-office/deepseek-client.ts` 顶部 import：

```ts
import "server-only";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ChatModel } from "./orchestrator";
import { LIVE_MEETING_LIMITS } from "./limits";
```

- [x] **Step 2: 替换 complete 的 max_tokens**

在 `complete` 方法里把 `max_tokens: 600` 改成：

```ts
        // 主持人 JSON 和总结都走 complete；P3 用集中常量控制单次输出成本。
        max_tokens: LIVE_MEETING_LIMITS.moderatorMaxTokens,
```

> 注意：这一步先让 `complete` 用主持人上限。下一步会把总结也拆成单独上限。

- [x] **Step 3: 让 ChatModel.complete 支持可选 maxTokens**

Modify `src/lib/cyber-office/orchestrator.ts` 中 `ChatModel` 接口：

```ts
export interface ChatModel {
  complete(
    messages: ChatCompletionMessageParam[],
    options?: { maxTokens?: number },
  ): Promise<string>;
  stream(messages: ChatCompletionMessageParam[]): AsyncIterable<string>;
}
```

Then modify `src/lib/cyber-office/deepseek-client.ts` 的 `complete` 签名和 `max_tokens`：

```ts
    async complete(
      messages: ChatCompletionMessageParam[],
      options?: { maxTokens?: number },
    ) {
      const response = await client.chat.completions.create({
        model: DEEPSEEK_MODEL,
        messages,
        temperature: 0.4,
        max_tokens: options?.maxTokens ?? LIVE_MEETING_LIMITS.moderatorMaxTokens,
      });

      return response.choices[0]?.message?.content?.trim() || "";
    },
```

- [x] **Step 4: 总结调用使用 summaryMaxTokens**

Modify `src/lib/cyber-office/orchestrator.ts` 里最后总结的 `model.complete(...)` 调用：

```ts
  const summary = await model.complete(
    [
      { role: "system", content: buildSummarySystemPrompt() },
      { role: "user", content: buildSummaryUserPrompt(topic, transcript) },
    ],
    { maxTokens: LIVE_MEETING_LIMITS.summaryMaxTokens },
  );
```

同时在 `orchestrator.ts` 顶部加入：

```ts
import { LIVE_MEETING_LIMITS } from "./limits";
```

- [x] **Step 5: 角色 stream 使用 roleMaxTokens**

Modify `src/lib/cyber-office/deepseek-client.ts` 的 `stream` 方法：

```ts
        // 角色发言越短，前端气泡越稳定，也越省 token。
        max_tokens: LIVE_MEETING_LIMITS.roleMaxTokens,
```

- [x] **Step 6: 更新 FakeModel 类型**

Modify `src/lib/cyber-office/__tests__/orchestrator.test.ts`，如果 `FakeModel` 的 `complete` 方法因为接口变化报错，把它写成：

```ts
  async complete() {
    const value = this.completions.shift();
    if (!value) throw new Error("No fake complete response");
    return value;
  }
```

> TypeScript 允许类方法参数比接口少，因为测试 fake 不需要读取 `messages/options`。这样代码更短，也不会有未使用参数 lint 问题。

- [x] **Step 7: 跑测试和类型检查**

Run:

```bash
npm run test
npx tsc --noEmit
```

Expected: 全部通过。

- [x] **Step 8: 提交**

```bash
git add src/lib/cyber-office/deepseek-client.ts src/lib/cyber-office/orchestrator.ts src/lib/cyber-office/__tests__/orchestrator.test.ts
git commit -m "feat(cyber-office): 集中控制 DeepSeek 输出上限"
```

---

### Task 4: 定义前端可见的稳定错误

**Files:**
- Create: `src/lib/cyber-office/live-errors.ts`
- Create: `src/lib/cyber-office/__tests__/live-errors.test.ts`

> 这一步的核心是：内部错误可以写进服务端日志，但给浏览器的只能是稳定、温和、不会泄露配置细节的文案。

- [x] **Step 1: 写失败测试**

Create `src/lib/cyber-office/__tests__/live-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  PublicLiveMeetingError,
  toPublicLiveMeetingError,
} from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";

describe("live meeting public errors", () => {
  it("保留已经是 PublicLiveMeetingError 的错误", () => {
    const error = new PublicLiveMeetingError({
      code: "rate_limited",
      message: LIVE_MEETING_MESSAGES.rateLimited,
      status: 429,
      retryAfter: 60,
    });

    expect(toPublicLiveMeetingError(error)).toBe(error);
  });

  it("把缺少 DeepSeek Key 的内部错误转成配置错误", () => {
    const error = toPublicLiveMeetingError(new Error("Missing DEEPSEEK_API_KEY"));

    expect(error.status).toBe(503);
    expect(error.code).toBe("config_missing");
    expect(error.message).toBe(LIVE_MEETING_MESSAGES.configMissing);
  });

  it("普通异常不会把原始 message 暴露给前端", () => {
    const error = toPublicLiveMeetingError(new Error("Redis token leaked detail"));

    expect(error.status).toBe(502);
    expect(error.code).toBe("provider_failed");
    expect(error.message).toBe(LIVE_MEETING_MESSAGES.deepseekFailed);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，提示找不到 `live-errors` 模块。

- [x] **Step 3: 创建 live-errors.ts**

Create `src/lib/cyber-office/live-errors.ts`:

```ts
import { LIVE_MEETING_MESSAGES } from "./limits";

export type LiveMeetingErrorCode =
  | "rate_limited"
  | "daily_budget_exhausted"
  | "config_missing"
  | "provider_failed";

export class PublicLiveMeetingError extends Error {
  code: LiveMeetingErrorCode;
  status: number;
  retryAfter?: number;

  constructor(options: {
    code: LiveMeetingErrorCode;
    message: string;
    status: number;
    retryAfter?: number;
  }) {
    super(options.message);
    this.name = "PublicLiveMeetingError";
    this.code = options.code;
    this.status = options.status;
    this.retryAfter = options.retryAfter;
  }
}

export function toPublicLiveMeetingError(error: unknown): PublicLiveMeetingError {
  if (error instanceof PublicLiveMeetingError) return error;

  if (error instanceof Error && error.message.includes("DEEPSEEK_API_KEY")) {
    return new PublicLiveMeetingError({
      code: "config_missing",
      message: LIVE_MEETING_MESSAGES.configMissing,
      status: 503,
    });
  }

  return new PublicLiveMeetingError({
    code: "provider_failed",
    message: LIVE_MEETING_MESSAGES.deepseekFailed,
    status: 502,
  });
}
```

- [x] **Step 4: 跑测试**

Run:

```bash
npm run test
```

Expected: PASS，新增测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/live-errors.ts src/lib/cyber-office/__tests__/live-errors.test.ts
git commit -m "feat(cyber-office): 定义实时会议公开错误"
```

---

### Task 5: 编写 Upstash 限流与每日预算 guard

**Files:**
- Create: `src/lib/cyber-office/rate-limit.ts`
- Create: `src/lib/cyber-office/__tests__/rate-limit.test.ts`

> 这里有三层保护：单 IP 每小时次数、全站每分钟并发入口、每日实时会议总次数。Upstash 环境变量缺失时，本地开发允许通过；生产环境拒绝实时会议。

- [x] **Step 1: 写失败测试**

Create `src/lib/cyber-office/__tests__/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  consumeDailyLiveRunBudget,
  getClientIp,
  getUtcDateKey,
  secondsUntilNextUtcDay,
} from "@/lib/cyber-office/rate-limit";

describe("rate-limit helpers", () => {
  it("优先从 x-forwarded-for 取第一个 IP", () => {
    const request = new Request("https://example.com", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });

    expect(getClientIp(request)).toBe("1.1.1.1");
  });

  it("没有代理头时使用 anonymous", () => {
    const request = new Request("https://example.com");

    expect(getClientIp(request)).toBe("anonymous");
  });

  it("生成 UTC 日期 key", () => {
    const date = new Date("2026-07-04T23:30:00.000Z");

    expect(getUtcDateKey(date)).toBe("2026-07-04");
  });

  it("计算距离下一个 UTC 零点的秒数", () => {
    const date = new Date("2026-07-04T23:59:30.000Z");

    expect(secondsUntilNextUtcDay(date)).toBe(30);
  });

  it("每日预算第一次计数时设置过期时间", async () => {
    const calls: string[] = [];
    const store = {
      async incr(key: string) {
        calls.push(`incr:${key}`);
        return 1;
      },
      async expire(key: string, seconds: number) {
        calls.push(`expire:${key}:${seconds}`);
        return 1;
      },
    };

    const result = await consumeDailyLiveRunBudget(
      store,
      new Date("2026-07-04T23:59:30.000Z"),
      30,
    );

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(29);
    expect(calls).toEqual([
      "incr:cyber-office:live:daily:2026-07-04",
      "expire:cyber-office:live:daily:2026-07-04:30",
    ]);
  });
});
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，提示找不到 `rate-limit` 模块。

- [x] **Step 3: 创建 rate-limit.ts**

Create `src/lib/cyber-office/rate-limit.ts`:

```ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { LIVE_MEETING_LIMITS, LIVE_MEETING_MESSAGES } from "./limits";
import { PublicLiveMeetingError } from "./live-errors";

type GuardResult =
  | { allowed: true }
  | {
      allowed: false;
      error: PublicLiveMeetingError;
    };

interface DailyBudgetStore {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

let redis: Redis | null | undefined;
let perIpLimiter: Ratelimit | null | undefined;
let globalLimiter: Ratelimit | null | undefined;

function hasUpstashEnv() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production";
}

function getRedis() {
  if (!hasUpstashEnv()) return null;
  if (redis !== undefined) return redis;

  // Redis.fromEnv 会读取 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN。
  // 客户端缓存到模块变量里，热 lambda 可以复用连接配置。
  redis = Redis.fromEnv();
  return redis;
}

function getPerIpLimiter() {
  const client = getRedis();
  if (!client) return null;
  if (perIpLimiter !== undefined) return perIpLimiter;

  perIpLimiter = new Ratelimit({
    redis: client,
    prefix: "cyber-office:live:ip",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.slidingWindow(
      LIVE_MEETING_LIMITS.perIpHourlyLimit,
      LIVE_MEETING_LIMITS.perIpHourlyWindow,
    ),
  });

  return perIpLimiter;
}

function getGlobalLimiter() {
  const client = getRedis();
  if (!client) return null;
  if (globalLimiter !== undefined) return globalLimiter;

  globalLimiter = new Ratelimit({
    redis: client,
    prefix: "cyber-office:live:global",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.fixedWindow(
      LIVE_MEETING_LIMITS.globalMinuteLimit,
      LIVE_MEETING_LIMITS.globalMinuteWindow,
    ),
  });

  return globalLimiter;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "anonymous";
}

export function getUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function secondsUntilNextUtcDay(date = new Date()): number {
  const next = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
  );

  return Math.max(1, Math.ceil((next - date.getTime()) / 1000));
}

export async function consumeDailyLiveRunBudget(
  store: DailyBudgetStore,
  date = new Date(),
  budget = LIVE_MEETING_LIMITS.dailyLiveRunBudget,
) {
  const key = `cyber-office:live:daily:${getUtcDateKey(date)}`;
  const used = await store.incr(key);

  // 第一次创建当天 key 时加过期时间，第二天自然清零。
  if (used === 1) {
    await store.expire(key, secondsUntilNextUtcDay(date));
  }

  return {
    allowed: used <= budget,
    used,
    remaining: Math.max(0, budget - used),
  };
}

function retryAfterSeconds(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}

export async function guardLiveMeetingRequest(
  request: Request,
): Promise<GuardResult> {
  const client = getRedis();

  if (!client) {
    if (!isProductionRuntime()) return { allowed: true };

    return {
      allowed: false,
      error: new PublicLiveMeetingError({
        code: "config_missing",
        message: LIVE_MEETING_MESSAGES.configMissing,
        status: 503,
      }),
    };
  }

  const ip = getClientIp(request);
  const perIp = await getPerIpLimiter()?.limit(ip);

  if (perIp && !perIp.success) {
    return {
      allowed: false,
      error: new PublicLiveMeetingError({
        code: "rate_limited",
        message: LIVE_MEETING_MESSAGES.rateLimited,
        status: 429,
        retryAfter: retryAfterSeconds(perIp.reset),
      }),
    };
  }

  const global = await getGlobalLimiter()?.limit("all");

  if (global && !global.success) {
    return {
      allowed: false,
      error: new PublicLiveMeetingError({
        code: "rate_limited",
        message: LIVE_MEETING_MESSAGES.rateLimited,
        status: 429,
        retryAfter: retryAfterSeconds(global.reset),
      }),
    };
  }

  const daily = await consumeDailyLiveRunBudget(client);

  if (!daily.allowed) {
    return {
      allowed: false,
      error: new PublicLiveMeetingError({
        code: "daily_budget_exhausted",
        message: LIVE_MEETING_MESSAGES.dailyBudgetExhausted,
        status: 429,
        retryAfter: secondsUntilNextUtcDay(),
      }),
    };
  }

  return { allowed: true };
}
```

- [x] **Step 4: 跑测试**

Run:

```bash
npm run test
```

Expected: PASS，新增 helper 测试通过。

- [x] **Step 5: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 6: 提交**

```bash
git add src/lib/cyber-office/rate-limit.ts src/lib/cyber-office/__tests__/rate-limit.test.ts
git commit -m "feat(cyber-office): 增加实时会议限流与每日预算"
```

---

### Task 6: Route Handler 接入 guard 和错误脱敏

**Files:**
- Modify: `src/app/api/cyber-office/run/route.ts`

- [x] **Step 1: 修改 imports**

Modify `src/app/api/cyber-office/run/route.ts` 顶部 imports：

```ts
import { createDeepSeekChatModel } from "@/lib/cyber-office/deepseek-client";
import { toPublicLiveMeetingError } from "@/lib/cyber-office/live-errors";
import { LIVE_MEETING_LIMITS } from "@/lib/cyber-office/limits";
import { parseRunMeetingRequest } from "@/lib/cyber-office/live-schema";
import { runMeeting } from "@/lib/cyber-office/orchestrator";
import { guardLiveMeetingRequest } from "@/lib/cyber-office/rate-limit";
import { encodeSseEvent } from "@/lib/cyber-office/sse";
import type { OfficeEvent } from "@/lib/cyber-office/types";
```

- [x] **Step 2: 在创建 stream 前先做限流**

Modify `POST`，在 `if (!parsed.ok) { ... }` 后加入：

```ts
  const guard = await guardLiveMeetingRequest(request);

  if (!guard.allowed) {
    const body = {
      code: guard.error.code,
      message: guard.error.message,
      retryAfter: guard.error.retryAfter,
    };

    return Response.json(body, { status: guard.error.status });
  }
```

- [x] **Step 3: maxTurns 改用常量**

把 `runMeeting` 参数里的 `maxTurns: 6` 改成：

```ts
          maxTurns: LIVE_MEETING_LIMITS.maxTurns,
```

- [x] **Step 4: catch 里只返回公开错误**

把当前 catch 块替换为：

```ts
      } catch (error) {
        const publicError = toPublicLiveMeetingError(error);

        // 服务端可以记录原始错误；前端只接收脱敏后的 OfficeEvent。
        console.error("[cyber-office] live meeting failed", error);
        streamEvent(controller, {
          type: "error",
          message: publicError.message,
        });
```

- [x] **Step 5: 手动检查完整 route.ts 形状**

`src/app/api/cyber-office/run/route.ts` 应该保持这个结构：

```ts
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = parseRunMeetingRequest(body);

  if (!parsed.ok) {
    return Response.json({ message: parsed.message }, { status: 400 });
  }

  const guard = await guardLiveMeetingRequest(request);

  if (!guard.allowed) {
    return Response.json(
      {
        code: guard.error.code,
        message: guard.error.message,
        retryAfter: guard.error.retryAfter,
      },
      { status: guard.error.status },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const model = createDeepSeekChatModel();

        for await (const event of runMeeting({
          topic: parsed.data.topic,
          participants: parsed.data.participants,
          model,
          maxTurns: LIVE_MEETING_LIMITS.maxTurns,
        })) {
          streamEvent(controller, event);
        }
      } catch (error) {
        const publicError = toPublicLiveMeetingError(error);

        console.error("[cyber-office] live meeting failed", error);
        streamEvent(controller, {
          type: "error",
          message: publicError.message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [x] **Step 6: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 7: 提交**

```bash
git add src/app/api/cyber-office/run/route.ts
git commit -m "feat(cyber-office): 实时会议 API 接入限流保护"
```

---

### Task 7: SSE 解析器容忍坏 JSON

**Files:**

- Modify: `src/lib/cyber-office/sse.ts`
- Modify: `src/lib/cyber-office/__tests__/sse.test.ts`

> P2 的 `parseSseChunk` 遇到坏 JSON 会直接抛异常，前端只能显示“网络连接中断”。P3 让解析器跳过坏行，保持页面稳定。

- [x] **Step 1: 补失败测试**

Modify `src/lib/cyber-office/__tests__/sse.test.ts`，在 `describe("SSE helpers", () => { ... })` 内新增：

```ts
  it("跳过无法解析的 data 行", () => {
    const chunk = [
      "data: {bad json}",
      "",
      'data: {"type":"meeting_end"}',
      "",
    ].join("\n");

    expect(parseSseChunk(chunk)).toEqual([{ type: "meeting_end" }]);
  });
```

- [x] **Step 2: 运行测试确认失败**

Run:

```bash
npm run test
```

Expected: FAIL，`JSON.parse` 抛错。

- [x] **Step 3: 修改 parseSseChunk**

Modify `src/lib/cyber-office/sse.ts` 中 `events.push(JSON.parse(json) as OfficeEvent);` 为：

```ts
    try {
      events.push(JSON.parse(json) as OfficeEvent);
    } catch {
      // 网络或代理偶尔可能切出一行坏数据。跳过坏行，让后续合法事件继续驱动画面。
      continue;
    }
```

- [x] **Step 4: 跑测试**

Run:

```bash
npm run test
```

Expected: PASS，SSE 测试通过。

- [x] **Step 5: 提交**

```bash
git add src/lib/cyber-office/sse.ts src/lib/cyber-office/__tests__/sse.test.ts
git commit -m "fix(cyber-office): SSE 解析器跳过坏数据行"
```

---

### Task 8: 前端实时 hook 支持取消和 HTTP 错误读取

**Files:**
- Modify: `src/components/cyber-office/use-live-meeting.ts`

> `AbortController` 是浏览器原生的取消工具。它解决两个问题：用户切换到回放时不再继续读实时流；组件卸载时不让后台请求继续占资源。

- [x] **Step 1: 替换 use-live-meeting.ts**

Replace `src/components/cyber-office/use-live-meeting.ts` with:

```ts
"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { applyEvent, createInitialState } from "@/lib/cyber-office/reducer";
import { LIVE_MEETING_MESSAGES } from "@/lib/cyber-office/limits";
import { parseSseChunk } from "@/lib/cyber-office/sse";
import type { RoleId } from "@/lib/cyber-office/types";

interface LiveErrorResponse {
  message?: string;
}

async function readErrorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as   | null;
  return body?.message || LIVE_MEETING_MESSAGES.deepseekFailed;
}

export function useLiveMeeting() {
  const [state, dispatch] = useReducer(
    applyEvent,
    undefined,
    createInitialState,
  );
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    // 只负责发出取消信号。真正清理 running 状态放在对应请求自己的 finally 里，
    // 这样旧请求不会误关掉刚启动的新请求。
    abortRef.current?.abort();
  }, []);

  const start = useCallback(
    async (topic: string, participants: RoleId[]) => {
      cancel();
      dispatch({ type: "reset" });
      setIsRunning(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/cyber-office/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, participants }),
          // signal 把 fetch 和 AbortController 绑在一起；cancel() 会让 reader.read() 也中断。
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          dispatch({
            type: "error",
            message: await readErrorMessage(response),
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            for (const event of parseSseChunk(`${part}\n\n`)) {
              dispatch(event);
            }
          }
        }

        if (buffer.trim()) {
          for (const event of parseSseChunk(buffer)) {
            dispatch(event);
          }
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        dispatch({
          type: "error",
          message: LIVE_MEETING_MESSAGES.networkFailed,
        });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setIsRunning(false);
        }
      }
    },
    [cancel],
  );

  useEffect(() => {
    return () => cancel();
  }, [cancel]);

  return { state, isRunning, start, cancel };
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
git add src/components/cyber-office/use-live-meeting.ts
git commit -m "feat(cyber-office): 实时会议前端支持取消请求"
```

---

### Task 9: 页面切换模式时取消实时流

**Files:**
- Modify: `src/components/cyber-office/cyber-office.tsx`

- [x] **Step 1: 拆开按钮禁用状态**

Modify `src/components/cyber-office/cyber-office.tsx` 中 `busy/canRunLive` 这一段：

```tsx
  const busy = replay.isPlaying || live.isRunning;
  const canRunReplay = !replay.isPlaying;
  const canRunLive = topic.trim().length >= 6 && !busy;
```

> `busy` 仍然用于禁用 textarea，避免会议进行中改议题；但回放按钮不能再简单用 `busy` 禁用。否则 live 正在运行时，你就没法通过“播放样本会议”切回零成本回放。

- [x] **Step 2: 回放按钮先取消 live**

Modify 回放按钮的 `onClick`：

```tsx
            onClick={() => {
              live.cancel();
              setMode("replay");
              replay.start();
            }}
```

Then change 回放按钮的 `disabled`：

```tsx
            disabled={!canRunReplay}
```

- [x] **Step 3: 实时按钮保持启动逻辑**

实时按钮的 `onClick` 保持：

```tsx
            onClick={() => {
              setMode("live");
              live.start(topic, LIVE_PARTICIPANTS);
            }}
```

实时按钮的 `disabled` 保持：

```tsx
            disabled={!canRunLive}
```

- [x] **Step 4: 增加停止实时会议按钮**

在实时按钮后面新增：

```tsx
          {live.isRunning && (
            <button
              onClick={live.cancel}
              className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-accent/40 hover:text-accent"
            >
              停止实时会议
            </button>
          )}
```

- [x] **Step 5: 类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 6: 提交**

```bash
git add src/components/cyber-office/cyber-office.tsx
git commit -m "feat(cyber-office): 页面支持停止实时会议"
```

---

### Task 10: 配置 Upstash 环境变量说明

**Files:**
- No tracked code changes required unless the project already has a committed env example file.

> `.env.local` 不提交。Vercel 上需要在项目环境变量里配置同名变量。

- [x] **Step 1: 本地 .env.local 增加 Upstash 配置**

Update `.env.local` manually:

```bash
DEEPSEEK_API_KEY=你的_DeepSeek_API_Key
DEEPSEEK_MODEL=deepseek-chat

UPSTASH_REDIS_REST_URL=你的_Upstash_REST_URL https://enabling-grouse-158950.upstash.io
UPSTASH_REDIS_REST_TOKEN=你的_Upstash_REST_TOKEN
```

Expected: `.env.local` 不出现在 `git status --short` 的待提交列表里。

- [x] **Step 2: Vercel 配置生产环境变量**

在 Vercel 项目设置里添加：

```txt
DEEPSEEK_API_KEY
DEEPSEEK_MODEL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Expected: 生产环境有 Upstash 时实时入口可用；没有 Upstash 时生产环境返回“实时会议暂时未开放，请先播放样本会议。”

- [x] **Step 3: 本地无 Upstash 验证**

临时移除 `.env.local` 里的 Upstash 两项，保留 DeepSeek Key，重启 dev server：

```bash
npm run dev
```

Expected: 本地开发环境仍允许实时会议运行，方便调试 DeepSeek 编排。

---

### Task 11: 完整验证 P3

**Files:**
- No code changes unless previous tasks fail.

- [x] **Step 1: 跑单元测试**

Run:

```bash
npm run test
```

Expected: 全部测试通过。

- [x] **Step 2: 跑类型检查**

Run:

```bash
npx tsc --noEmit
```

Expected: 无类型错误。

- [x] **Step 3: 跑 lint**

Run:

```bash
npm run lint
```

Expected: 无 ESLint 报错。

- [x] **Step 4: 跑生产构建**

Run:

```bash
npm run build
```

Expected: 构建成功，路由列表仍包含 `/cyber-office` 和 `/api/cyber-office/run`。

- [x] **Step 5: 浏览器验证默认回放**

Run:

```bash
npm run dev
```

Open:

```txt
http://localhost:3000/cyber-office
```

Expected:
- 页面默认仍在回放模式。
- 点击“播放样本会议”不调用 DeepSeek。
- 样本会议能完整演出。

- [x] **Step 6: 浏览器验证实时会议可取消**

With DeepSeek Key configured, click:

```txt
实时运行 DeepSeek 会议
```

Then click:

```txt
停止实时会议
```

Expected:
- 按钮停止 running 状态。
- 页面不再继续追加新 token。
- 浏览器控制台没有未处理 Promise 错误。

- [x] **Step 7: curl 验证 400 错误**

Run:

```bash
curl -i -X POST http://localhost:3000/api/cyber-office/run ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\":\"短\",\"participants\":[\"host\",\"pm\"]}"
```

Expected: HTTP 400，JSON message 是用户可读文案，不是堆栈。

- [x] **Step 8: curl 验证限流**

With Upstash env configured, 连续运行 4 次：

```bash
curl -i -X POST http://localhost:3000/api/cyber-office/run ^
  -H "Content-Type: application/json" ^
  -d "{\"topic\":\"讨论空间转录组可视化文章大纲\",\"participants\":[\"host\",\"bio\",\"pm\"]}"
```

Expected: 前 3 次最多进入 SSE；第 4 次返回 HTTP 429，JSON message 是：

```txt
实时会议请求太频繁了，请稍后再试。你仍然可以播放样本会议。
```

- [x] **Step 9: 收尾**

If Step 1-8 all pass, no commit is required for Task 11.

If any verification fails, go back to the specific task that introduced the failing file, apply the fix there, then re-run Task 11 from Step 1.

---

## P3 理解检查点

做完 P3，合上代码回答：

1. 为什么 P3 选择“回放默认 + 实时按钮触发”，而不是进入页面自动跑 DeepSeek？

   *因为 `/cyber-office` 是公开网页，页面访问不可控。自动跑 DeepSeek 会把普通浏览、搜索引擎访问、误刷新都变成付费请求。回放默认让作品可以零成本展示，实时按钮则把花钱行为变成用户明确触发。*

2. `guardLiveMeetingRequest` 为什么要放在创建 `createDeepSeekChatModel()` 之前？

   *因为限流和预算是闸门。只有请求被允许，才应该创建模型客户端并开始外部 API 调用。否则被拒绝的请求也可能消耗连接、时间，甚至在未来改动中误触发模型调用。*

3. 为什么生产环境缺 Upstash 配置时要拒绝实时会议，但本地开发可以放行？

   *生产环境面对公网，缺少限流就等于裸奔；本地开发只有你自己调试，强制依赖 Upstash 会降低学习和排错效率。所以 P3 用环境区分：本地允许调试，生产必须有保护。*

4. 为什么要把内部异常转换成 `PublicLiveMeetingError`？

   *内部异常可能包含环境变量名、SDK 细节、Redis 状态或堆栈。前端只需要知道“能不能继续、该显示什么”。统一转换后，用户看到稳定文案，服务端日志仍保留真实错误供开发者排查。*

5. `AbortController` 解决了什么问题？

   *它让前端可以主动取消正在进行的 fetch/stream。用户切换到回放、点停止、离开页面时，旧实时流不会继续读 token，也不会在后台继续更新已经不需要的 UI。*

---

## 完成标准

- [x] `/cyber-office` 默认仍可零成本播放样本会议。
- [x] `/api/cyber-office/run` 在生产环境必须有 Upstash 才允许实时运行。
- [x] 同一 IP 超过每小时限制会收到 HTTP 429。
- [x] 全站每日实时会议次数超过预算会收到 HTTP 429。
- [x] DeepSeek / Redis / 环境变量内部错误不会原样暴露到浏览器。
- [x] 实时会议可以被前端取消。
- [x] `npm run test` 通过。
- [x] `npx tsc --noEmit` 通过。
- [x] `npm run lint` 通过。
- [x] `npm run build` 通过。

下一阶段 P4 再进入视觉表达：把占位方块替换成像素小人 sprite，并补发言/举手/坐下的轻量动效。

---



### **[P3 · Bugfix] 修复取消实时会议时的流崩溃**

**问题：经典的 SSE 竞态问题，客户端已经走了，服务端却还在往断掉的管子里塞数据。**

\- **做了什么**：给 SSE 流加了 `clientGone` 标记 + `cancel()` 回调 + 安全写入，客户端断开后停止向已关闭的 controller 写数据。

\- **为什么这么做**：取消时前端断开连接会关闭服务端流，而 `runMeeting` 仍在吐事件，继续 enqueue 会抛 `Controller is already closed`；加标记让循环及时停下、不再写入。

\- **commit**: `1d0d06a`



