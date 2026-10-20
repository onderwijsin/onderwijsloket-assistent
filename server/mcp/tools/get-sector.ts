import { describeResource } from "../../utils/resources";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import sectors from "../../collections/sectors";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "get_sector",
  _meta: { "onderwijsloket.com/collection": sectors.name },
  description:
    "Read one sector by its identifier. Returns named plain-text guidance sections and ordered featured references. Sector IDs are also used in taxonomy filters. Check content_warnings and relations_truncated; cite source_url.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: sectors.getInput.omit({ collection: true }).shape,
  outputSchema: sectors.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated sector arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await sectors.get(args.id);
    return toolResult(result, [describeResource(sectors.name, result.record)]);
  }
});
