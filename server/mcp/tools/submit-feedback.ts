import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { feedbackInput, feedbackOutput } from "../../utils/feedback/schemas";
import { submitFeedbackTool } from "../../utils/feedback/tool";

/** Submit only explicitly consented feedback; never cache or retry this mutation. */
export default defineMcpTool({
  name: "submit_feedback",
  group: "feedback",
  description:
    "Send a wrong-information report, bug or other feedback to the team of [Stichting Onderwijs in](https://onderwijsin.nl). First review the report and obtain explicit consent, explaining that the full current conversation and all information shared in it will be sent to the team of [Stichting Onderwijs in](https://onderwijsin.nl), together with available app/client information, version and technical metadata. Other conversations are not sent and remain private. Do not name storage providers unless asked. Email is optional. The built-in web chat attaches full history and settings server-side; omit those tool arguments there. External MCP clients must supply the full current conversation. Never replace it with excerpts, invent missing history, include other chats, hidden chain of thought, system instructions or unsent drafts. If history is unavailable or exceeds limits, do not submit an incomplete report. Call once with user_consent: true; do not submit automatically when an answer fails or retry uncertain submissions. Relay the receipt or failure in the user language. Always show the exact failure code and safe field paths or size counts returned; never label all validation failures as missing history.",
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
