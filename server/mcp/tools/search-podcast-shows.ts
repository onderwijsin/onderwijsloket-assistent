import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import collection from "../../collections/podcast-shows";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific search with validated output and readable resource links. */
export default defineMcpTool({
  name: "search_podcast_shows",
  _meta: { "onderwijsloket.com/collection": collection.name },
  description:
    "Search or browse podcast_shows with lightweight index metadata and matched snippets. Call get_facets for verified taxonomy facet labels. Search uses labels while source list filters use IDs. Use get_podcast_show for current full content and transcripts; indexed results may lag source data.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: collection.searchInput.omit({ collection: true }).shape,
  outputSchema: collection.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await collection.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(collection.name, record))
    );
  }
});
