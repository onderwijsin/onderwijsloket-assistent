import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import institutions from "../../collections/educational-institutions";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific get with validated output and readable resource links. */
export default defineMcpTool({
  name: "get_educational_institution",
  _meta: { "onderwijsloket.com/collection": institutions.name },
  description:
    "Read an educational institution with its Markdown description, public contacts, language-tagged websites, main location and bounded additional locations. Opening hours are source schedules, not current availability. Cite source_url and inspect content_warnings, truncated and relations_truncated. Find its programs through list_programs with educational_institutions IDs.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: institutions.getInput.omit({ collection: true }).shape,
  outputSchema: institutions.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await institutions.get(args.id);
    return toolResult(result, [describeResource(institutions.name, result.record)]);
  }
});
