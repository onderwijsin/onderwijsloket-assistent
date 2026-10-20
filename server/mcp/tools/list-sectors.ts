import { describeResource } from "../../utils/resources/descriptors";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import sectors from "../../collections/sectors";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "list_sectors",
  _meta: { "onderwijsloket.com/collection": sectors.name },
  description:
    "List sectors with exact filters and stable pagination. Call get_filters for accepted rules and taxonomy IDs. Use get_sector for full detail; check relation completeness warnings.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: sectors.listInput.omit({ collection: true }).shape,
  outputSchema: sectors.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated sector arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await sectors.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(sectors.name, record))
    );
  }
});
