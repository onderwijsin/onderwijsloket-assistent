import { describeResource } from "../../utils/resources/descriptors";
import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import testimonials from "../../collections/testimonials";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "get_testimonial",
  _meta: { "onderwijsloket.com/collection": testimonials.name },
  description:
    "Read a personal experience story as Markdown with editorial authors and featured participants. Individual experiences do not establish general eligibility rules. Cite source_url and check content_warnings, truncated and relations_truncated.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: testimonials.getInput.omit({ collection: true }).shape,
  outputSchema: testimonials.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated testimonial arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await testimonials.get(args.id);
    return toolResult(result, [describeResource(testimonials.name, result.record)]);
  }
});
