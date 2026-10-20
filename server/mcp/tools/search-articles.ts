import { toolResult } from "../../utils/tool-result";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import articles from "../../collections/articles";
import { describeResource } from "../../utils/resources";

/** Search is collection-scoped discovery; Directus remains the full-record retrieval path. */
export default defineMcpTool({
  _meta: { "onderwijsloket.com/collection": articles.name },
  name: "search_articles",
  description:
    'Search articles by text using index relevance, or omit query to browse. Returns lightweight records and a query-centered snippet with **matched terms**; never full article content. Call get_facets for valid search filter names/values (not get_filters, which describes list_articles filters using taxonomy IDs). Supply filters as { "topics.name": ["Salaris"], english: [false] }; AND across fields, OR within arrays. Pages start at 1. Use get_article with a returned ID for complete, current content; search results may lag behind record updates.',
  group: "search",
  tags: ["articles", "readonly"],
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: articles.searchInput.omit({ collection: true }).shape,
  outputSchema: articles.searchOutput.shape,
  /**
   * Discover articles through text search or filtered browsing.
   *
   * @param args - Validated operation arguments, including filters and pagination where supported.
   * @returns Lightweight results as structured content, JSON text and resource links.
   */
  handler: async (args) => {
    const result = await articles.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(articles.name, record))
    );
  }
});
