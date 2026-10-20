import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import collection from "../../collections/podcast-shows";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Native podcast_shows resource template and complete descriptor catalogue. */
export default defineMcpResource({
  name: "podcast_shows",
  title: "Onderwijsloket podcast shows",
  description: `${collection.description} Read the series description with public hosts, seasons, platform links and trailer metadata in YAML. Discover episode transcripts through podcast episode records. Playback availability is determined upstream. Browse resources/list or follow tool resource links. Cite source_url; inspect content_warnings, truncated and relations_truncated.`,
  group: "content",
  tags: ["podcast_shows", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(collection.name, "{id}"), {
    list: listResources(collection)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: collection.name,
    id: collection.getInput.shape.id,
    get: collection.get,
    content: (record) => record.description,
    metadata: collection.resourceMetadata
  })
});
