import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { getRouteQuestions } from "../../utils/routes/service";
import { routeQuestionsInput, routeQuestionsOutput } from "../../utils/routes/schemas";
import { toolResult } from "../../utils/tool-result";

/** Stateless pathway questionnaire; route tables are not generic browsable collections. */
export default defineMcpTool({
  name: "get_route_questions",
  group: "routes",
  description:
    "Start or advance the pathway questionnaire for working in education. Omit selections to start; otherwise pass the previous question-ID to answer-ID map updated with the user's chosen answer. Returns ordered questions, currently available options, canonical selections, removed stale choices and next_question_id. Ask the next enabled question; never invent answer IDs or assume unconfirmed choices. Earlier choices can be changed; dependent and out-of-order choices are cleared. Call find_routes only when complete is true. Source data determines the question count.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: routeQuestionsInput.shape,
  outputSchema: routeQuestionsOutput.shape,
  /**
   * Revalidate the questionnaire using current source data.
   * @param args - Submitted selections, or empty state for a new questionnaire.
   * @returns Canonical questionnaire state in structured and text representations.
   */
  handler: async (args) => toolResult(await getRouteQuestions(args))
});
