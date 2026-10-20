import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import faqs, { describeFaqResource } from "../../collections/faqs";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "list_faqs",
  _meta: { "onderwijsloket.com/collection": faqs.name },
  description:
    "List faqs with exact filters and stable pagination. Call get_filters for accepted rules and taxonomy IDs. Use get_faq for full detail; check relation completeness warnings.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: faqs.listInput.omit({ collection: true }).shape,
  outputSchema: faqs.listOutput.shape,
  /**
   * Execute the collection-specific list operation.
   * @param args - Validated faq arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await faqs.list(args);
    return toolResult(result, result.records.map(describeFaqResource));
  }
});
