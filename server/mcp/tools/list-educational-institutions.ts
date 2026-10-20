import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import institutions from "../../collections/educational-institutions";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific list with validated output and readable resource links. */
export default defineMcpTool({
  name: "list_educational_institutions",
  _meta: { "onderwijsloket.com/collection": institutions.name },
  description:
    "List educational institutions with exact text, source enum and location-ID filters. Call get_filters for accepted values and nested location ID lookup paths. Use get_educational_institution or resource links for full description and contacts. Keep pagination arguments unchanged while has_more is true.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: institutions.listInput.omit({ collection: true }).shape,
  outputSchema: institutions.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await institutions.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(institutions.name, record))
    );
  }
});
