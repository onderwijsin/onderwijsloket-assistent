import { z } from "zod";
import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

/** Reuse the collection metadata contract rather than duplicating its fields in the catalogue. */
const outputSchema = z.object({
  collections: z
    .array(articles.metadataSchema)
    .describe("Available collections and their supported operations.")
});

export default defineMcpTool({
  name: "list_collections",
  description:
    "Discover available collections and their purpose, capabilities, fields, sorts and pagination limits. Use the returned name as collection in subsequent calls. Only articles is currently available; search and facets are not implemented.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: {},
  outputSchema: outputSchema.shape,
  handler: async () => {
    const result = outputSchema.parse({ collections: [articles.metadata] });
    // Include text for MCP clients that do not consume structuredContent.
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
