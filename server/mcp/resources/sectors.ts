import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import sectors, { sectorResourceContent } from "../../collections/sectors";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Expose sectors catalogue discovery and Markdown reads through the native URI template. */
export default defineMcpResource({
  name: "sectors",
  title: "Onderwijsloket sectors",
  description: `${sectors.description} Read the named guidance sections as Markdown with actions and featured references in YAML front matter. Browse resources/list or follow tool resource links. Cite source_url; check content_warnings and relations_truncated before treating the guidance as complete.`,
  group: "content",
  tags: ["sectors", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(sectors.name, "{id}"), {
    list: listResources(sectors)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: sectors.name,
    id: sectors.getInput.shape.id,
    get: sectors.get,
    content: sectorResourceContent,
    metadata: sectors.resourceMetadata
  })
});
