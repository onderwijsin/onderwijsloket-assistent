import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import programs from "../../collections/programs";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific list with validated output and readable resource links. */
export default defineMcpTool({
  name: "list_programs",
  _meta: { "onderwijsloket.com/collection": programs.name },
  description:
    "List programs using exact registry codes, source classification enums, taxonomy/provider ID arrays and a single location ID. Call get_filters for accepted source keys and lookup paths. Degree filtering is available through search_programs rather than source lists. Use get_program or resource links for ordered form descriptions.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: programs.listInput.omit({ collection: true }).shape,
  outputSchema: programs.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await programs.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(programs.name, record))
    );
  }
});
