import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import institutions from "../../collections/educational-institutions";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Native educational_institutions resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "educational_institutions",
  title: "Onderwijsloket educational_institutions",
  description: `${institutions.description} Read Markdown with YAML provenance, contacts, locations and completeness metadata. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["educational_institutions", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(institutions.name, "{id}"), {
    list: listResources(institutions)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: institutions.name,
    id: institutions.getInput.shape.id,
    get: institutions.get,
    content: (record) => record.description,
    metadata: institutions.resourceMetadata
  })
});
