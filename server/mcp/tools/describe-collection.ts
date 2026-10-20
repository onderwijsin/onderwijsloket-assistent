import { toolResult } from "../../utils/tool-result";
import { collections } from "../../collections";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";

export default defineMcpTool({
  name: "describe_collection",
  description:
    "Describe an available collection: its purpose, summary, detail and filterable fields, available operations, sort options and pagination limits. Call get_filters for list filter rules and taxonomy IDs; call get_facets for search filter names, values and counts.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  outputSchema: collections.metadataSchema.shape,
  inputSchema: collections.collectionInput,
  /**
   * Return the validated collection description.
   *
   * @param args - Allowlisted public collection name.
   * @returns Collection metadata as structured content and a JSON text fallback.
   */
  handler: async (args) => {
    const result = collections.metadataSchema.parse(collections.resolve(args.collection).metadata);
    return toolResult(result);
  }
});
