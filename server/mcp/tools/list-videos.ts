import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import collection from "../../collections/videos";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific list with validated output and readable resource links. */
export default defineMcpTool({
  name: "list_videos",
  _meta: { "onderwijsloket.com/collection": collection.name },
  description:
    "List videos using exact native fields, related-record IDs and taxonomy IDs. Call get_filters for supported source filters and lookup paths. Keep filters and sort unchanged while has_more is true. Use get_video or resource links for full descriptions, available transcripts and media metadata. Source duration values retain their native units; playback availability must be confirmed at source_url.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: collection.listInput.omit({ collection: true }).shape,
  outputSchema: collection.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await collection.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(collection.name, record))
    );
  }
});
