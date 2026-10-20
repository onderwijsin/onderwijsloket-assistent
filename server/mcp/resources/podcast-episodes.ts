import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import collection, { resourceBody } from "../../collections/podcast-episodes";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Native podcast_episodes resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "podcast_episodes",
  title: "Onderwijsloket podcast episodes",
  description: `${collection.description} Read native content and available transcripts with public media, attribution and completeness metadata in YAML. Playback availability is determined upstream. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["podcast_episodes", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(collection.name, "{id}"), {
    list: listResources(collection)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: collection.name,
    id: collection.getInput.shape.id,
    get: collection.get,
    content: resourceBody,
    metadata: collection.resourceMetadata
  })
});
