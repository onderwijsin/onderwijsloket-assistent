import { FeedbackError } from "./errors";
import { feedbackContext, feedbackInput, feedbackOutput, type FeedbackStorage } from "./schemas";

/** Bind submission to a storage port without depending on Nitro, MCP or Notion.
 * @param storage - Persistence implementation; an HTTP transport can reuse the same service.
 * @returns A submission operation with consent, size and response validation.
 */
export function createFeedbackService(storage: FeedbackStorage) {
  return {
    /** Validate and detach a report before persisting exactly once.
     * @param input - Untrusted report including explicit user consent.
     * @param context - Transport-supplied attribution, not user identity proof.
     * @returns Minimal receipt after confirmed storage success.
     */
    async submit(input: unknown, context: unknown) {
      const parsed = feedbackInput.safeParse(input);
      const attribution = feedbackContext.safeParse(context);
      if (!parsed.success || !attribution.success || !parsed.data.conversation) {
        throw new FeedbackError("INVALID_INPUT");
      }
      let serialized: string;
      try {
        serialized = JSON.stringify({ input: parsed.data, context: attribution.data });
        if (new TextEncoder().encode(serialized).byteLength > 80_000) {
          throw new FeedbackError("INVALID_INPUT");
        }
      } catch {
        throw new FeedbackError("INVALID_INPUT");
      }
      const snapshot = JSON.parse(serialized) as {
        input: typeof parsed.data;
        context: typeof attribution.data;
      };
      const receivedAt = new Date().toISOString();
      let id: string;
      try {
        id = await storage.create({
          schemaVersion: 1,
          consentVersion: "feedback-v2",
          receivedAt,
          ...snapshot
        });
      } catch (error) {
        throw error instanceof FeedbackError ? error : new FeedbackError("SUBMISSION_UNCERTAIN");
      }
      const receipt = feedbackOutput.safeParse({ report_id: id, received_at: receivedAt });
      if (!receipt.success) throw new FeedbackError("SUBMISSION_UNCERTAIN");
      return receipt.data;
    }
  };
}
