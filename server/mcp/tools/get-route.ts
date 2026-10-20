import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { getRoute } from "../../utils/routes/service";
import { getRouteInput, getRouteOutput } from "../../utils/routes/schemas";
import { toolResult } from "../../utils/tool-result";

/** Read a pathway without exposing its underlying supporting collections. */
export default defineMcpTool({
  name: "get_route",
  group: "routes",
  description:
    "Read a known education pathway by route ID independently of questionnaire completion. Returns stored approximate total duration and ordered steps with short/long titles, Markdown bodies, durations and article/FAQ references. Use get_article/get_faq to read linked content when needed. Cite source_url and inspect content_warnings, truncated and relations_truncated. Missing duration is unknown; durations are estimates, not dates, admission decisions or guarantees. Opening a route does not establish that it matches the user's circumstances; use the questionnaire and find_routes for that.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: getRouteInput.shape,
  outputSchema: getRouteOutput.shape,
  /**
   * Retrieve the ordered, readable pathway.
   * @param args - Known route UUID.
   * @returns Route detail in structured and text representations.
   */
  handler: async (args) => toolResult(await getRoute(args))
});
