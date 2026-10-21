/** Public error codes contain no provider payloads or personal details. */
export type SchedulingErrorCode =
  | "NOT_CONFIGURED"
  | "UNAVAILABLE"
  | "INVALID_INPUT"
  | "INVALID_RESPONSE"
  | "FORM_NOT_CONFIGURED"
  | "INVALID_ANSWERS"
  | "SLOT_UNAVAILABLE"
  | "RATE_LIMITED"
  | "BOOKING_REJECTED"
  | "BOOKING_UNCERTAIN";

/** Sanitized scheduling failure; retry timing is safe to expose to MCP callers. */
export class SchedulingError extends Error {
  /** Construct a safe failure without retaining raw upstream errors.
   * @param code - Public failure category.
   * @param retryAt - Optional ISO timestamp at which quota becomes available.
   */
  constructor(
    public readonly code: SchedulingErrorCode,
    public readonly retryAt?: string
  ) {
    super(`Scheduling: ${code}`);
    this.name = "SchedulingError";
  }
}
