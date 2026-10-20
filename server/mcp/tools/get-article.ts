import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";
import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  _meta: { "onderwijsloket.com/collection": articles.name },
  name: "get_article",
  description:
    "Read one complete article by an ID returned by list_articles. Returns taxonomy metadata, a canonical source URL and Markdown content. Check content_warnings and truncated for omitted content; cite source_url when using the article. Returns NOT_FOUND for an unknown ID.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: articles.getOutput.shape,
  inputSchema: articles.getInput.omit({ collection: true }).shape,
  /**
   * Retrieve one complete article and its resource link.
   *
   * @param args - Validated operation arguments, including filters and pagination where supported.
   * @returns Article detail as structured content, JSON text and an MCP resource link.
   */
  handler: async (args) => {
    const result = await articles.get(args.id);
    return toolResult(result, [describeResource(articles.name, result.record)]);
  }
});
