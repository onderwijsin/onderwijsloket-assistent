import articles from "../../collections/articles";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "get_record",
  description:
    "Read one complete article by an ID returned by list_records. Returns taxonomy metadata, a canonical source URL and Markdown content. Check content_warnings and truncated for omitted content; cite source_url when using the article. Returns NOT_FOUND for an unknown ID.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: articles.getOutput.shape,
  inputSchema: articles.getInput.shape,
  handler: async (args) => {
    const result = await articles.get(args.id);
    // Include text for MCP clients that do not consume structuredContent.
    return { structuredContent: result, content: [{ type: "text", text: JSON.stringify(result) }] };
  }
});
