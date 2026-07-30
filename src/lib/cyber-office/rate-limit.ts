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
    //开启内部的数据分析打点
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

  // 全局防瘫痪
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

  // 每日预算核销
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
