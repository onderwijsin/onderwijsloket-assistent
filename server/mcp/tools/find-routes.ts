import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { findRoutes } from "../../utils/routes/service";
import { findRoutesInput, findRoutesOutput } from "../../utils/routes/schemas";
import { toolResult } from "../../utils/tool-result";

/** Source-side subset matching after complete questionnaire validation. */
export default defineMcpTool({
  name: "find_routes",
  group: "routes",
  description:
    "Find potential pathways into education from a complete, valid get_route_questions selection map. Every required answer of a route must be selected; extra selected answers are allowed and routes without requirements can match. All current questions must be answered; stale, unavailable or out-of-order answers fail before querying routes. Results sort by stored approximate duration ascending, with ID as a stable tie-breaker. Defaults to a three-route preview; use page/page_size for more. Null duration is unknown, zero is a stored zero-month estimate. Use get_route for the ordered full steps. Matching is guidance, not a personal admission or qualification guarantee.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: findRoutesInput.shape,
  outputSchema: findRoutesOutput.shape,
  /**
   * Validate all answers and query source-matched pathways.
   * @param args - Complete selections and pagination.
   * @returns Route cards with approximate durations, timeline summaries and continuation metadata.
   */
  handler: async (args) => toolResult(await findRoutes(args))
});
