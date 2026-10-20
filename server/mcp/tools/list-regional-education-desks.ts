import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import desks from "../../collections/regional-education-desks";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific list with validated output and readable resource links. */
export default defineMcpTool({
  name: "list_regional_education_desks",
  _meta: { "onderwijsloket.com/collection": desks.name },
  description:
    "List regional education desks with exact title/slug, sector IDs and service/visit booleans. Call get_filters for source-list choices. Use search_regional_education_desks for region/city text and activity/content facets. Coverage differs from physical location; inspect area, location and content_warnings. Keep filters and sort unchanged while has_more is true.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: desks.listInput.omit({ collection: true }).shape,
  outputSchema: desks.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await desks.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(desks.name, record))
    );
  }
});
