import { describeResource } from "../../utils/resources";
import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "list_records",
  description:
    "List article summaries; use get_record with a returned ID for full Markdown content. Call get_filters before selecting taxonomy IDs. Filters accept plain values: e.g. filters: { english: false, topics: [id] }. Use IDs, not labels or slugs, for taxonomies. Across fields conditions use AND; within each taxonomy array IDs use OR. Title/slug are exact matches, not full-text search. Pages start at 1; increment page while has_more is true, keeping other arguments unchanged.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: articles.listOutput.shape,
  inputSchema: articles.listInput.shape,
  /**
   * Retrieve one filtered page of article summaries.
   *
   * @param args - Validated operation arguments, including filters and pagination where supported.
   * @returns Paginated summaries as structured content, JSON text and resource links.
   */
  handler: async (args) => {
    const result = await articles.list(args);
    // Include text for MCP clients that do not consume structuredContent.
    return {
      structuredContent: result,
      content: [
        { type: "text", text: JSON.stringify(result) },
        ...result.records.map((record) => ({
          type: "resource_link" as const,
          ...describeResource(articles.name, record)
        }))
      ]
    };
  }
});
