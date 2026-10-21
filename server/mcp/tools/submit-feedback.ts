import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { feedbackInput, feedbackOutput } from "../../utils/feedback/schemas";
import { submitFeedbackTool } from "../../utils/feedback/tool";

/** Submit only explicitly consented feedback; never cache or retry this mutation. */
export default defineMcpTool({
  name: "submit_feedback",
  group: "feedback",
  description:
    "Send a wrong-information report, bug or other feedback to the Onderwijsloket team. First summarize the exact report and included conversation/diagnostics, explain that it will be stored in the team feedback database with available client metadata, and obtain explicit user consent. Email is optional. Do not submit automatically when an answer fails. Include only available, user-approved context; never invent history, include hidden reasoning, credentials or unsent drafts. Call once with user_consent: true. On SUBMISSION_UNCERTAIN it may already be saved: never retry automatically. Relay the receipt or explain failure in the user language without exposing the internal database.",
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
