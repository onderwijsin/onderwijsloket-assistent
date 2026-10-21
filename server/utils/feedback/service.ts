import { FeedbackError } from "./errors";
import {
  feedbackContext,
  feedbackInput,
  feedbackOutput,
  feedbackConversationSchema,
  type FeedbackStorage
} from "./schemas";

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
      let parsed: ReturnType<typeof feedbackInput.safeParse>;
      try {
        parsed = feedbackInput.safeParse(input);
      } catch {
        // Non-JSON in-process values (including cyclic structures) must fail safely too.
        throw new FeedbackError("INVALID_INPUT");
      }
      const attribution = feedbackContext.safeParse(context);
      if (!parsed.success)
        throw new FeedbackError("INVALID_INPUT", {
          fields: parsed.error.issues.slice(0, 10).map((issue) => issue.path.join("."))
        });
      if (!attribution.success)
        throw new FeedbackError("INVALID_METADATA", {
          fields: attribution.error.issues.slice(0, 10).map((issue) => issue.path.join("."))
        });
      if (attribution.data.source === "Web chat") {
        if (parsed.data.conversation === undefined) throw new FeedbackError("MISSING_CONVERSATION");
        const chat = feedbackConversationSchema.safeParse(parsed.data.conversation);
        if (!chat.success) throw new FeedbackError("INVALID_CHAT_CONTEXT");
        parsed.data.conversation = chat.data;
      }
      let serialized: string;
      try {
        serialized = JSON.stringify({ input: parsed.data, context: attribution.data });
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
          consentVersion: "feedback-v4",
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
