# Article resources

Articles are available through the public `/mcp` endpoint at `onderwijsloket://articles/{id}`. These are MCP identifiers, not browser routes; `source_url` points to the normal website article.

## Discovery and reading

`resources/templates/list` advertises the article URI template with MIME type `text/markdown`. Use `list_records` to find article IDs, or follow the `resource_link` blocks returned by `list_records` and `get_record`. Then request a document:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "onderwijsloket://articles/00f81660-a2e4-48af-b8d7-98ce338de447"
  }
}
```

The ID is illustrative. The template’s native list callback makes all article URIs visible in `resources/list`, including inspector catalogues. The shared helper reads summaries in batches of 25 and returns one complete descriptor list; it never loads document bodies. There is no separate cursor implementation or Nitro plugin. Use the existing tools for filtered, paginated discovery.

The definition uses group `content` and tags `articles`, `education`, `readonly`. These organize the resource within MCP Toolkit; clients should not rely on group/tags being present as protocol fields. Audience annotations include users and assistants. No subscriptions or change notifications are implemented.

## Document format and implementation

The resource definition wires `listResources(articles)` into the template and uses `serveResource({ name, get, metadata })` for reads. Both helpers are collection-independent. The read helper calls the configured collection get method and returns its existing Markdown body with YAML front matter. Article-specific metadata selection lives in `resourceMetadata()` within `server/collections/articles.ts`. It includes public record fields, taxonomy labels, `truncated` and `content_warnings`, excluding the body itself. Source timestamps remain source timestamps; no volatile retrieval timestamp is added.

`server/utils/content/front-matter.ts` uses the `yaml` library to serialize metadata. `server/utils/resources.ts` handles URI/descriptor formatting, complete catalogue listing, ID validation and safe resource responses for any collection. Neither utility imports an article collection. The resource file only declares the template, organization metadata and collection callbacks through MCP Toolkit.

The body uses the existing document pipeline, including H1 insertion and full content without a character cap. Traversal limits still report truncation. Check completeness metadata and cite `source_url`. Tools retain their existing structured output and JSON text fallback for clients without resource support.

## Verification

Unit tests cover YAML round trips, body preservation, collection-specific metadata selection and collection-independent resource descriptors. Production HTTP tests cover template discovery, a complete catalogue spanning multiple upstream pages, resource reads, tool resource links, content beyond 20,000 characters and sanitized missing/invalid/upstream errors.

The native callback returns a complete catalogue in one response. This keeps inspector discovery simple and lets the SDK combine different collection templates automatically. The complete catalogue is cached for five minutes per collection; protocol-level pagination remains deferred. Article tools and resource reads share the five-minute `articles.get()` cache, including rendered Markdown. Resource serialization itself is cheap and is not cached separately. See [cache configuration](./cache.md).
