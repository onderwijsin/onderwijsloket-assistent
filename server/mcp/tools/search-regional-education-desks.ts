import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import desks from "../../collections/regional-education-desks";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific search with validated output and readable resource links. */
export default defineMcpTool({
  name: "search_regional_education_desks",
  _meta: { "onderwijsloket.com/collection": desks.name },
  description:
    "Search regional education desks by title, region/city text or browse without a query. Call get_facets for sector, consultation-service, orientation-activity and content-type counts. Regions and municipalities are searchable text, not facets. Search hits do not include geometry or complete descriptions and may lag source data. Use get_regional_education_desk for coverage, contacts and schedules; no exact geographic matching is provided.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: desks.searchInput.omit({ collection: true }).shape,
  outputSchema: desks.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await desks.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(desks.name, record))
    );
  }
});
