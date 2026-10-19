import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "describe_collection",
  description:
    "Describe the articles collection: its purpose, summary, detail and filterable fields, available operations, sort options and pagination limits. Call get_filters for list_records filter rules and taxonomy IDs; call get_facets for search filter names, values and counts.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: articles.metadataSchema.shape,
  inputSchema: articles.collectionInput,
  /**
   * Return the validated collection description.
   *
   * @returns Collection metadata as structured content and a JSON text fallback.
   */
  handler: async () => {
    const result = articles.metadataSchema.parse(articles.metadata);
    // Include text for MCP clients that do not consume structuredContent.
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
