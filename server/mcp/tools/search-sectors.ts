import { describeResource } from "../../utils/resources/descriptors";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import sectors from "../../collections/sectors";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "search_sectors",
  _meta: { "onderwijsloket.com/collection": sectors.name },
  description:
    "Search sectors by text or omit query to browse. Returns lightweight sector results and matched snippets; no search filters or facets are supported. Use get_sector for current detail. Search results may lag behind source changes.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: sectors.searchInput.omit({ collection: true }).shape,
  outputSchema: sectors.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated sector arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await sectors.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(sectors.name, record))
    );
  }
});
