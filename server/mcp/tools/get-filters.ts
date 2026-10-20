import { toolResult } from "../../utils/tool-result";
import { collections } from "../../collections";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "get_filters",
  description:
    "Discover accepted list filters and current taxonomy choices. Select values by their titles/descriptions, then pass their id fields to the collection's list tool under filters.<name>. Operators describe behavior; do not send operator objects. Conditions across fields use AND; IDs within one field use OR. Choices have no record-match counts and may be cached for one minute.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: collections.filtersOutput.shape,
  inputSchema: collections.filterInput,
  /**
   * Discover accepted list filters and current taxonomy choices.
   *
   * @param args - Allowlisted collection supporting list-filter discovery.
   * @returns Filter definitions as structured content and a JSON text fallback.
   */
  handler: async (args) => {
    const result = await collections.filters(args.collection);
    return toolResult(result);
  }
});
