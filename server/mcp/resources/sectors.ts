import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import sectors, { sectorResourceContent } from "../../collections/sectors";
import { resourceUri, listResources, serveResource, describeResource } from "../../utils/resources";

/** Expose sectors catalogue discovery and Markdown reads through the native URI template. */
export default defineMcpResource({
  name: "sectors",
  title: "Onderwijsloket sectors",
  description:
    "Read sectors as Markdown with YAML metadata. Follow tool resource links or browse resources/list. Check content_warnings and relations_truncated before treating content as complete.",
  group: "content",
  tags: ["sectors", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(sectors.name, "{id}"), {
    list: listResources(sectors, (record) => describeResource(sectors.name, record))
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
