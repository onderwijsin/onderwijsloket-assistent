import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import articles from "../../collections/articles";
import { resourceUri } from "../../utils/resources/descriptors";
import { listResources } from "../../utils/resources/catalogue";
import { serveResource } from "../../utils/resources/read";

/** Expose article discovery and Markdown reads through the native resource-template callbacks. */
export default defineMcpResource({
  name: "articles",
  title: "Onderwijsloket articles",
  description: `${articles.description} Read the article as Markdown with YAML front matter. Browse resources/list, use list_articles or follow its resource links. Cite source_url; check truncated, content_warnings and relations_truncated before treating a document as complete.`,
  group: "content",
  tags: ["articles", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(articles.name, "{id}"), {
    list: listResources(articles)
  }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: articles.name,
    get: articles.get,
    id: articles.getInput.shape.id,
    content: (record) => record.content,
    metadata: articles.resourceMetadata
  })
});
