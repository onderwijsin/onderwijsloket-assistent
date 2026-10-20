import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import programs from "../../collections/programs";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific search with validated output and readable resource links. */
export default defineMcpTool({
  name: "search_programs",
  _meta: { "onderwijsloket.com/collection": programs.name },
  description:
    "Search or browse concrete educational programs with verified facets from get_facets. Use degrees display labels and program_forms.track.name; these are separate from list source codes and taxonomy IDs. Hits expose providers and partial location metadata, never full variant descriptions. Use get_program for current detail.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: programs.searchInput.omit({ collection: true }).shape,
  outputSchema: programs.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await programs.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(programs.name, record))
    );
  }
});
