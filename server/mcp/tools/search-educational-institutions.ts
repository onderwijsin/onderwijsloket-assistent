import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import institutions from "../../collections/educational-institutions";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific search with validated output and readable resource links. */
export default defineMcpTool({
  name: "search_educational_institutions",
  _meta: { "onderwijsloket.com/collection": institutions.name },
  description:
    "Search educational institutions by text, facets or geographic proximity. For nearby institutions, supply location (city, postcode or address) and optional radius in metres (default 50000); results sort nearest first and return the resolved coordinates, full address, effective radius and each hit's distance in geo metadata. Keep institution names or other text in query, or omit query to browse nearby providers. Call get_facets for the available type facet. Hits contain partial main-location metadata, not full descriptions or opening schedules. Use get_educational_institution for complete current records; indexed results can lag the source.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: institutions.searchInput.omit({ collection: true }).shape,
  outputSchema: institutions.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await institutions.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(institutions.name, record))
    );
  }
});
