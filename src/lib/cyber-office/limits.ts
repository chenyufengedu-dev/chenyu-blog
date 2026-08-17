// P3 先用“实时会议次数”做预算，不做精确 token 计费。
// 这些数字偏保守：够你演示能力，但不至于被陌生访问者刷爆额度。
export const LIVE_MEETING_LIMITS = {
  maxTurns: 6,
  // 主持人要输出一整段 JSON（含 prompt / hostText 两个中文字段）。
  // 420 太紧：实测会出现 JSON 写到一半被截断，解析必然失败。
  // DeepSeek 文档也明确要求 JSON 模式下要配足 max_tokens，否则字符串会被中断。
  moderatorMaxTokens: 700,
  roleMaxTokens: 160,
  // 总结要写完整五段方案（见 buildSummarySystemPrompt），预算给足，
  // 同时在 prompt 里限制篇幅（700 字），双管齐下防截断。
  summaryMaxTokens: 1400,
  perIpHourlyLimit: 3,
  perIpHourlyWindow: "1 h",
  globalMinuteLimit: 5,
  globalMinuteWindow: "1 m",
  dailyLiveRunBudget: 30,
} as const;

// 逐轮驱动后，一场会议 ≈ maxTurns 轮 + 1 次总结 = 这么多次请求。
export const STEPS_PER_MEETING = LIVE_MEETING_LIMITS.maxTurns + 1;

// 按"步"限流时，把原来按"场"的额度乘以每场步数，
// 这样总成本口径和改造前保持一致（还是约等于每 IP 每小时 3 场会议）。
export const LIVE_STEP_LIMITS = {
  perIpHourlyLimit: LIVE_MEETING_LIMITS.perIpHourlyLimit * STEPS_PER_MEETING,
  perIpHourlyWindow: LIVE_MEETING_LIMITS.perIpHourlyWindow,
  globalMinuteLimit: LIVE_MEETING_LIMITS.globalMinuteLimit * STEPS_PER_MEETING,
  globalMinuteWindow: LIVE_MEETING_LIMITS.globalMinuteWindow,
  dailyBudget: LIVE_MEETING_LIMITS.dailyLiveRunBudget * STEPS_PER_MEETING,
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
