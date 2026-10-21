export type FeedbackErrorCode =
  | "INVALID_INPUT"
  | "NOT_CONFIGURED"
  | "SUBMISSION_REJECTED"
  | "SUBMISSION_UNCERTAIN";

/** Safe error shared by storage adapters and transports; never retains provider bodies. */
export class FeedbackError extends Error {
  /** Construct a public failure category without sensitive error causes.
   * @param code - Safe failure category.
   */
  constructor(public readonly code: FeedbackErrorCode) {
    super(`Feedback: ${code}`);
    this.name = "FeedbackError";
  }
}
