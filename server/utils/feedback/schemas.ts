import { z } from "zod";

const shortText = z.string().trim().min(1).max(256);
const timestamp = z.iso.datetime({ offset: true });

/** Selected Pinia conversation snapshot; exclude drafts and unrelated UI state. */
export const feedbackConversationSchema = z.object({
  id: shortText.optional(),
  title: z.string().max(256).optional(),
  createdAt: timestamp.optional(),
  updatedAt: timestamp.optional(),
  messages: z
    .array(
      z.object({
        id: shortText.optional(),
        role: z.enum(["user", "assistant"]),
        parts: z
          .array(z.looseObject({ type: shortText }))
          .min(1)
          .max(100)
      })
    )
    .min(1)
    .max(100)
});

/** Transport-independent feedback contract; optional context must be user-approved. */
export const feedbackInput = z.object({
  title: z.string().trim().min(1).max(120).describe("Short summary of the issue."),
  category: z.enum(["incorrect_information", "bug", "other"]),
  message: z
    .string()
    .trim()
    .min(1)
    .max(8000)
    .describe("User feedback, expected behavior and reproduction details, where known."),
  email: z
    .email()
    .max(200)
    .optional()
    .describe("Optional contact email; never infer it from unrelated conversation details."),
  user_consent: z
    .literal(true)
    .describe(
      "Set only after explicit user permission to share this report and all included context with Stichting Onderwijs in (https://onderwijsin.nl)."
    ),
  occurred_at: timestamp.optional(),
  message_id: shortText.optional(),
  conversation: feedbackConversationSchema
    .optional()
    .describe(
      "Full current conversation, not excerpts or a summary. The built-in web chat attaches this automatically; external MCP clients must supply all available user/assistant messages and structured parts. Never include other chats, system prompts, hidden reasoning or unsent drafts. If full history is unavailable, do not submit or claim it is complete."
    ),
  settings: z
    .object({
      model: shortText,
      webSearch: z.boolean(),
      extendedThinking: z.boolean()
    })
    .optional()
    .describe("Current chat selections when actually available; not a per-message model history."),
  diagnostics: z
    .object({
      request_id: shortText.optional(),
      tool_name: shortText.optional(),
      error_code: shortText.optional(),
      error_message: z.string().max(2000).optional()
    })
    .optional()
    .describe("Reviewed diagnostics only. Remove secrets and unrelated personal information.")
});

/** Minimal receipt; never echo report contents or expose the internal database URL. */
export const feedbackOutput = z.object({
  report_id: z.string().min(1).max(256),
  received_at: timestamp
});

export type FeedbackInput = z.infer<typeof feedbackInput>;
export type FeedbackReceipt = z.infer<typeof feedbackOutput>;

/** Bounded attribution supplied by the transport, never by tool arguments. */
export const feedbackContext = z.object({
  source: z.enum(["Web chat", "MCP client", "Other"]),
  userAgent: z.string().max(2000).optional(),
  clientName: shortText.optional(),
  clientVersion: shortText.optional(),
  appVersion: shortText.optional(),
  environment: z.enum(["production", "preview", "development"]).optional()
});
export type FeedbackContext = z.infer<typeof feedbackContext>;

/** Validated, detached report passed to any storage implementation. */
export interface FeedbackReport {
  schemaVersion: 1;
  consentVersion: "feedback-v3";
  receivedAt: string;
  input: FeedbackInput;
  context: FeedbackContext;
}

/** Storage port shared by MCP and future HTTP or dashboard entry points. */
export interface FeedbackStorage {
  /** Persist once without automatic retries.
   * @param report - Validated consented report.
   * @returns An opaque storage identifier.
   */
  create(report: FeedbackReport): Promise<string>;
}
