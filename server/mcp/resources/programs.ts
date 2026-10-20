import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import programs, { programResourceContent } from "../../collections/programs";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Native programs resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "programs",
  title: "Onderwijsloket programs",
  description: `${programs.description} Read Markdown with YAML provenance, contacts, locations and completeness metadata. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["programs", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(programs.name, "{id}"), {
    list: listResources(programs)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: programs.name,
    id: programs.getInput.shape.id,
    get: programs.get,
    content: programResourceContent,
    metadata: programs.resourceMetadata
  })
});
