import { toolResult } from "../../utils/tool-result";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { collections } from "../../collections";

/** Discover index-backed search filters and counts without retrieving document bodies. */
export default defineMcpTool({
  name: "get_facets",
  description:
    "Discover current collection search facet names, values and counts for search. Pass returned names and values to the collection's search tool filters; these are search values, not the taxonomy IDs used by collection list tools. Omit facets to discover all countable facets. Optional query and filters scope counts to matching records, including a facet's own selected filters. max_values limits each facet's returned values, so the response is not a complete enumeration guarantee. Check counts_are_exact. For list filters use get_filters instead.",
  group: "search",
  tags: ["collections", "readonly"],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: collections.facetsInput.shape,
  outputSchema: collections.facetsOutput.shape,
  /**
   * Discover search facet values and counts.
   *
   * @param args - Validated operation arguments, including filters and pagination where supported.
   * @returns Facet discovery as structured content and a JSON text fallback.
   */
  handler: async (args) => {
    const result = await collections.facets(args);
    return toolResult(result);
  }
});
