import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { PublicLiveMeetingError } from "./live-errors";
import {
  LIVE_MEETING_LIMITS,
  LIVE_MEETING_MESSAGES,
  LIVE_STEP_LIMITS,
} from "./limits";

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
// 两套额度：meeting = 老的"整场"接口 /run；step = 新的"单步"接口 /step。
export type GuardScope = "meeting" | "step";

const perIpLimiters = new Map<GuardScope, Ratelimit>();
const globalLimiters = new Map<GuardScope, Ratelimit>();

function limitsFor(scope: GuardScope) {
  if (scope === "step") {
    return {
      perIp: LIVE_STEP_LIMITS.perIpHourlyLimit,
      perIpWindow: LIVE_STEP_LIMITS.perIpHourlyWindow,
      global: LIVE_STEP_LIMITS.globalMinuteLimit,
      globalWindow: LIVE_STEP_LIMITS.globalMinuteWindow,
      daily: LIVE_STEP_LIMITS.dailyBudget,
    };
  }
  return {
    perIp: LIVE_MEETING_LIMITS.perIpHourlyLimit,
    perIpWindow: LIVE_MEETING_LIMITS.perIpHourlyWindow,
    global: LIVE_MEETING_LIMITS.globalMinuteLimit,
    globalWindow: LIVE_MEETING_LIMITS.globalMinuteWindow,
    daily: LIVE_MEETING_LIMITS.dailyLiveRunBudget,
  };
}

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

function getPerIpLimiter(scope: GuardScope) {
  const client = getRedis();
  if (!client) return null;

  const cached = perIpLimiters.get(scope);
  if (cached) return cached;

  const l = limitsFor(scope);
  const limiter = new Ratelimit({
    redis: client,
    // meeting 保持原来的 prefix，避免改动影响已有计数；step 用独立 key。
    prefix:
      scope === "meeting"
        ? "cyber-office:live:ip"
        : "cyber-office:live:ip:step",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.slidingWindow(l.perIp, l.perIpWindow),
  });

  perIpLimiters.set(scope, limiter);
  return limiter;
}

function getGlobalLimiter(scope: GuardScope) {
  const client = getRedis();
  if (!client) return null;

  const cached = globalLimiters.get(scope);
  if (cached) return cached;

  const l = limitsFor(scope);
  const limiter = new Ratelimit({
    redis: client,
    prefix:
      scope === "meeting"
        ? "cyber-office:live:global"
        : "cyber-office:live:global:step",
    analytics: true,
    timeout: 1000,
    limiter: Ratelimit.fixedWindow(l.global, l.globalWindow),
  });

  globalLimiters.set(scope, limiter);
  return limiter;
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
  // 显式标注 number：limits.ts 用了 as const，默认值的类型是字面量 30，
  // 不标注的话参数类型会被推断成 30，传"按步额度"就会类型报错。
  budget: number = LIVE_MEETING_LIMITS.dailyLiveRunBudget,
  scope: GuardScope = "meeting",
) {
  // meeting 沿用原来的 key 格式；step 用带后缀的独立 key，两套预算互不干扰。
  const scopeSuffix = scope === "meeting" ? "" : `${scope}:`;
  const key = `cyber-office:live:daily:${scopeSuffix}${getUtcDateKey(date)}`;
  const used = await store.incr(key);

  // 第一次创建当天 key 时加过期时间，第二天自然清零。
  // 每次连接数据库发指令都是极度耗时的网络操作。一天有 30 次请求，如果每一次都去命令数据库“这个账单今晚 12 点销毁”，那就是在浪费 29 次服务器性能。
  // 只有在数字刚好变成 1（也就是今天第一笔账单诞生）的那一瞬间，去触发 expire 指令，挂上我们在上一个函数算好的倒计时。这是对服务器性能的极致压榨和优化。
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
  scope: GuardScope = "meeting",
): Promise<GuardResult> {
  const client = getRedis();
  //检查有没有配置 Redis 数据库
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
  const perIp = await getPerIpLimiter(scope)?.limit(ip);

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

  // 全局防瘫痪
  const global = await getGlobalLimiter(scope)?.limit("all");

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

  // 每日预算核销
  const daily = await consumeDailyLiveRunBudget(
    client,
    new Date(),
    limitsFor(scope).daily,
    scope,
  );

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
