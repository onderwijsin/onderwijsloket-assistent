import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import faqs, { describeFaqResource } from "../../collections/faqs";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "get_faq",
  _meta: { "onderwijsloket.com/collection": faqs.name },
  description:
    "Read one faq by its identifier. Returns the question, answer as Markdown and related article references. Check content_warnings, truncated and relations_truncated; no canonical FAQ page is inferred.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: faqs.getInput.omit({ collection: true }).shape,
  outputSchema: faqs.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated faq arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await faqs.get(args.id);
    return toolResult(result, [describeFaqResource(result.record)]);
  }
});
