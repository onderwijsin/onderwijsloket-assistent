import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import faqs, { describeFaqResource } from "../../collections/faqs";
import { toolResult } from "../../utils/tool-result";

export default defineMcpTool({
  name: "search_faqs",
  _meta: { "onderwijsloket.com/collection": faqs.name },
  description:
    "Search faqs by text or omit query to browse. Returns lightweight question results and matched snippets. Call get_facets for search values, separate from taxonomy IDs. Use get_faq for current detail. Search results may lag behind source changes.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: faqs.searchInput.omit({ collection: true }).shape,
  outputSchema: faqs.searchOutput.shape,
  /**
   * Execute the collection-specific search operation.
   * @param args - Validated faq arguments; no collection selector is needed.
   * @returns Validated structured data and a JSON text fallback with resource links.
   */
  async handler(args) {
    const result = await faqs.search(args);
    return toolResult(result, result.records.map(describeFaqResource));
  }
});
