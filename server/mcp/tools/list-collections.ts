import { toolResult } from "../../utils/tool-result";
import { collections } from "../../collections";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

const outputSchema = collections.catalogueOutput;

export default defineMcpTool({
  name: "list_collections",
  description:
    "Discover available collections and their purpose, capabilities, fields, sorts and pagination limits. Use operations to select the concrete tool; pass collection only where its input schema requires it. Check capabilities before choosing an operation.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: {},
  outputSchema: outputSchema.shape,
  /**
   * List the collections and operations available to MCP clients.
   *
   * @returns Collection metadata as structured content and a JSON text fallback.
   */
  handler: async () => {
    const result = outputSchema.parse({ collections: collections.catalogue() });
    return toolResult(result);
  }
});
