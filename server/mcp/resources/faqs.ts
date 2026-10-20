import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import faqs, { describeFaqResource } from "../../collections/faqs";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Expose faqs catalogue discovery and Markdown reads through the native URI template. */
export default defineMcpResource({
  name: "faqs",
  title: "Onderwijsloket faqs",
  description:
    "Read faqs as Markdown with YAML metadata. Follow tool resource links or browse resources/list. Check content_warnings and relations_truncated, and truncated before treating content as complete.",
  group: "content",
  tags: ["faqs", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(faqs.name, "{id}"), {
    list: listResources(faqs, describeFaqResource)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: faqs.name,
    id: faqs.getInput.shape.id,
    get: faqs.get,
    content: (record) => record.answer,
    metadata: faqs.resourceMetadata
  })
});
