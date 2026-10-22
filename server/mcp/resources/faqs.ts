import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import faqs from "../../collections/faqs";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Expose faqs catalogue discovery and Markdown reads through the native URI template. */
export default defineMcpResource({
  name: "faqs",
  title: "Onderwijsloket faqs",
  description: `${faqs.description} Read the answer as Markdown with question, taxonomy and related-article metadata in YAML front matter. Browse resources/list or follow tool resource links. Check content_warnings, relations_truncated and truncated before treating the answer as complete.`,
  group: "content",
  tags: ["faqs", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(faqs.name, "{id}"), {
    list: listResources(faqs)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: faqs.name,
    id: faqs.getInput.shape.id,
    get: faqs.get,
    /**
     * Select the rendered answer for the resource document.
     * @param record - Validated detail record returned by the collection.
     * @returns The record’s rendered answer text.
     */
    content: (record) => record.answer,
    metadata: faqs.resourceMetadata
  })
});
