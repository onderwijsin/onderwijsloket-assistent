import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import programs from "../../collections/programs";
import { programResourceContent } from "../../utils/content/program-resource";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

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
