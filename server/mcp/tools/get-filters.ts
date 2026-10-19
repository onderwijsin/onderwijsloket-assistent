import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "get_filters",
  description:
    "Discover accepted article filters and current taxonomy choices. Select values by their titles/descriptions, then pass their id fields to list_records under filters.<name>. Operators describe behavior; do not send operator objects. Conditions across fields use AND; IDs within one field use OR. Choices have no article-match counts and may be cached for one minute.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: articles.filtersOutput.shape,
  inputSchema: articles.collectionInput,
  /**
   * Discover accepted list filters and current taxonomy choices.
   *
   * @returns Filter definitions as structured content and a JSON text fallback.
   */
  handler: async () => {
    const result = await articles.filters();
    // Include text for MCP clients that do not consume structuredContent.
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
