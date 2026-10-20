import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { defineMcpResource } from "@nuxtjs/mcp-toolkit/server";
import articles from "../../collections/articles";
import { resourceUri, listResources, serveResource } from "../../utils/resources";

/** Expose article discovery and Markdown reads through the native resource-template callbacks. */
export default defineMcpResource({
  name: "articles",
  title: "Onderwijsloket articles",
  description:
    "Read an article as Markdown with YAML front matter. Browse resources/list, use list_articles or follow its resource links. Cite source_url; check truncated and content_warnings before treating a document as complete.",
  group: "content",
  tags: ["articles", "education", "readonly"],
  uri: new ResourceTemplate(resourceUri(articles.name, "{id}"), { list: listResources(articles) }),
  metadata: { mimeType: "text/markdown", annotations: { audience: ["user", "assistant"] } },
  handler: serveResource({
    name: articles.name,
    get: articles.get,
    metadata: articles.resourceMetadata
  })
});
