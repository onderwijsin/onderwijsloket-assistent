import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import desks from "../../collections/regional-education-desks";
import { toolResult } from "../../utils/tool-result";
import { describeResource } from "../../utils/resources/descriptors";

/** Collection-specific get with validated output and readable resource links. */
export default defineMcpTool({
  name: "get_regional_education_desk",
  _meta: { "onderwijsloket.com/collection": desks.name },
  description:
    "Read a regional education desk with separate Markdown desk and consultation descriptions, expanded service area, physical location, contacts, service links and phone availability. Missing descriptions remain null. Phone and opening schedules are distinct source wall-clock values, not open-now guarantees. Cite source_url and inspect content_warnings, truncated and relations_truncated. No exact geographic eligibility is inferred.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: desks.getInput.omit({ collection: true }).shape,
  outputSchema: desks.getOutput.shape,
  /**
   * Execute the collection-specific get operation.
   * @param args - Validated arguments without a collection selector.
   * @returns Structured data, JSON fallback and resource links.
   */
  async handler(args) {
    const result = await desks.get(args.id);
    return toolResult(result, [describeResource(desks.name, result.record)]);
  }
});
