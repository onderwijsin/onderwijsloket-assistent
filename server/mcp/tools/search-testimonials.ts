import { describeResource } from "../../utils/resources/descriptors";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import testimonials from "../../collections/testimonials";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "search_testimonials",
  _meta: { "onderwijsloket.com/collection": testimonials.name },
  description:
    "Search personal experience stories by text or omit query to browse. Call get_facets for accepted search values; these differ from list taxonomy/person IDs. Use get_testimonial for current full content. Search results may lag behind source changes.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: testimonials.searchInput.omit({ collection: true }).shape,
  outputSchema: testimonials.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated testimonial arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await testimonials.search(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(testimonials.name, record))
    );
  }
});
