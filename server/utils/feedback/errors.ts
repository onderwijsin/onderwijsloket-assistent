export type FeedbackErrorCode =
  | "INVALID_INPUT"
  | "MISSING_CONVERSATION"
  | "INVALID_CHAT_CONTEXT"
  | "INVALID_METADATA"
  | "REPORT_TOO_LARGE"
  | "SNAPSHOT_ENCODING_FAILED"
  | "NOT_CONFIGURED"
  | "SUBMISSION_REJECTED"
  | "SUBMISSION_UNCERTAIN";

/** Safe error shared by storage adapters and transports; never retains provider bodies. */
export class FeedbackError extends Error {
  /** Construct a public failure category without sensitive error causes.
   * @param code - Safe failure category.
   * @param details - Validation field paths or size counts only; never submitted values.
   */
  constructor(
    public readonly code: FeedbackErrorCode,
    public readonly details?: { fields?: string[]; size_bytes?: number; limit_bytes?: number }
  ) {
    super(`Feedback: ${code}`);
    this.name = "FeedbackError";
  }
}
