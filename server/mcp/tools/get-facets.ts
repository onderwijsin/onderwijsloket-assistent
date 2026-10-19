import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import articles from "../../collections/articles";

/** Discover index-backed search filters and counts without retrieving document bodies. */
export default defineMcpTool({
  name: "get_facets",
  description:
    "Discover current article search facet names, values and counts for search. Pass returned names and values to search_collection.filters; these are search values, not the taxonomy IDs used by list_records. Omit facets to discover all countable facets. Optional query and filters scope counts to matching records, including a facet's own selected filters. max_values limits each facet's returned values, so the response is not a complete enumeration guarantee. Check counts_are_exact. For list_records filters use get_filters instead.",
  group: "search",
  tags: ["articles", "readonly"],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: articles.facetsInput.shape,
  outputSchema: articles.facetsOutput.shape,
  /**
   * Discover search facet values and counts.
   *
   * @param args - Validated operation arguments, including filters and pagination where supported.
   * @returns Facet discovery as structured content and a JSON text fallback.
   */
  handler: async (args) => {
    const result = await articles.facets(args);
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
