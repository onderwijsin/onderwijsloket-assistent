import { mediaResourceContent } from "../../utils/content/media-resource";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import collection from "../../collections/videos";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Native videos resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "videos",
  title: "Onderwijsloket videos",
  description: `${collection.description} Read native content and available transcripts with public media, attribution and completeness metadata in YAML. Playback availability is determined upstream. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["videos", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(collection.name, "{id}"), {
    list: listResources(collection)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: collection.name,
    id: collection.getInput.shape.id,
    get: collection.get,
    content: mediaResourceContent,
    metadata: collection.resourceMetadata
  })
});
