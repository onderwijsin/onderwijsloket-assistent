import { describeResource } from "../../utils/resources/descriptors";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import testimonials from "../../collections/testimonials";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "list_testimonials",
  _meta: { "onderwijsloket.com/collection": testimonials.name },
  description:
    "List personal experience stories with exact title/slug, taxonomy and related-person filters. Call get_filters for accepted keys and ID lookup paths. Authors and featured profiles are distinct. Use get_testimonial or its resource for the full story.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: testimonials.listInput.omit({ collection: true }).shape,
  outputSchema: testimonials.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated testimonial arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await testimonials.list(args);
    return toolResult(
      result,
      result.records.map((record) => describeResource(testimonials.name, record))
    );
  }
});
