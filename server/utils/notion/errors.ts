/** Sanitized Notion write failure, independent of the feedback domain. */
export class NotionWriteError extends Error {
  /** Describe only whether configuration, rejection or uncertain delivery failed.
   * @param code - Provider-neutral delivery outcome; never contains response bodies.
   */
  constructor(public readonly code: "NOT_CONFIGURED" | "REJECTED" | "UNCERTAIN") {
    super(`Notion write: ${code}`);
    this.name = "NotionWriteError";
  }
}
