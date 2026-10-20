import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import collection from "../../collections/videos";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific get with validated output and readable resource links. */
export default defineMcpTool({
  name: "get_video",
  _meta: { "onderwijsloket.com/collection": collection.name },
  description:
    "Read a video with native metadata, bounded attribution and taxonomy relationships, readable content and available media links. Missing bodies and transcripts remain explicit; search snippets never substitute for them. Inspect content_warnings, truncated and relations_truncated and cite source_url. Speaker attribution and publication metadata are source values; they do not establish playback availability. Featured profiles and chapter offsets are distinct from the video body and transcript.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: collection.getInput.omit({ collection: true }).shape,
  outputSchema: collection.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await collection.get(args.id);
    return toolResult(result, [describeResource(collection.name, result.record)]);
  }
});
