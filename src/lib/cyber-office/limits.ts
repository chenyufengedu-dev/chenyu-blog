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
