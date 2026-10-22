import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import testimonials from "../../collections/testimonials";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Expose testimonial discovery and Markdown reads through the native resource-template callbacks. */
export default defineMcpResource({
  name: "testimonials",
  title: "Onderwijsloket testimonials",
  description: `${testimonials.description} Read the story as Markdown with author and featured-profile attribution in YAML front matter. Browse resources/list, use list_testimonials or follow its resource links. Cite source_url; check truncated, content_warnings and relations_truncated before treating the story as complete.`,
  group: "content",
  tags: ["testimonials", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(testimonials.name, "{id}"), {
    list: listResources(testimonials)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: testimonials.name,
    get: testimonials.get,
    id: testimonials.getInput.shape.id,
    /**
     * Select the rendered body for the resource document.
     * @param record - Validated detail record returned by the collection.
     * @returns The record’s rendered body text.
     */
    content: (record) => record.content,
    metadata: testimonials.resourceMetadata
  })
});
