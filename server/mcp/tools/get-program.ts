import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import programs from "../../collections/programs";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources";

/** Collection-specific get with validated output and readable resource links. */
export default defineMcpTool({
  name: "get_program",
  _meta: { "onderwijsloket.com/collection": programs.name },
  description:
    "Read a program with providers, teaching location, taxonomy and separately rendered program-form descriptions. Each form has its own track and URL. Registry codes remain strings. Cite source_url and inspect content_warnings, truncated and relations_truncated; this tool does not determine personal eligibility.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: programs.getInput.omit({ collection: true }).shape,
  outputSchema: programs.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await programs.get(args.id);
    return toolResult(result, [describeResource(programs.name, result.record)]);
  }
});
