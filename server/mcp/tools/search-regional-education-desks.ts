import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import desks from "../../collections/regional-education-desks";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific search with validated output and readable resource links. */
export default defineMcpTool({
  name: "search_regional_education_desks",
  _meta: { "onderwijsloket.com/collection": desks.name },
  description:
    "Search regional education desks by text, facets or geographic proximity. For local advice services, supply location (city, postcode or address) and optional radius in metres (default 50000); results sort nearest service areas first and return the resolved coordinates, full address, effective radius and each hit's distance in geo metadata. Distances approximate service-area grid points, not offices or exact polygon boundaries. Keep topic or desk-name terms in query, or omit query to browse nearby service areas. Call get_facets for sector, consultation-service, orientation-activity and content-type counts. Regions and municipalities are searchable text, not facets. Use get_regional_education_desk for coverage, contacts and schedules.",
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
