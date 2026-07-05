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

export function toPublicLiveMeetingError(
  error: unknown,
): PublicLiveMeetingError {
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
