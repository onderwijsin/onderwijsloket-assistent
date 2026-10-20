import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import desks, { deskResourceContent } from "../../collections/regional-education-desks";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Native regional_education_desks resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "regional_education_desks",
  title: "Onderwijsloket regional education desks",
  description: `${desks.description} Read separately named desk and consultation descriptions with YAML service coverage, contacts, phone schedules, locations and completeness metadata. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["regional_education_desks", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(desks.name, "{id}"), {
    list: listResources(desks)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: desks.name,
    id: desks.getInput.shape.id,
    get: desks.get,
    content: deskResourceContent,
    metadata: desks.resourceMetadata
  })
});
