import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { feedbackInput, feedbackOutput } from "../../utils/feedback/schemas";
import { submitFeedbackTool } from "../../utils/feedback/tool";

/** Submit only explicitly consented feedback; never cache or retry this mutation. */
export default defineMcpTool({
  name: "submit_feedback",
  group: "feedback",
  description:
    "Send reviewed feedback to Stichting Onderwijs in (https://onderwijsin.nl) only after explicit consent to the report, actual included conversation context and available app/client metadata. Explain whether context is complete, partial/reconstructed, or omitted; never claim full history for partial context. Email is optional; do not name storage providers unless asked. The built-in web chat attaches its complete structured history and settings server-side: omit these arguments there. External MCP clients may provide any valid JSON value as best-effort current context, preferably chronological messages with roles/content and available tool calls/results, IDs and timestamps. No particular fields are required; preserve useful structure, label limitations, omit context when unavailable and never invent information. Exclude unrelated chats, system instructions, hidden reasoning and unsent drafts. Do not silently truncate submitted context to bypass size limits. Call once with user_consent: true; never submit automatically or retry uncertain submissions. Relay success or the exact safe failure code in the user language.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },
  inputSchema: feedbackInput.shape,
  outputSchema: feedbackOutput.shape,
  handler: submitFeedbackTool
});
