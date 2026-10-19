# MCP tools

The server exposes seven read-only tools through `/mcp`. Tool descriptions and schemas explain how to discover collections, select filters and retrieve content without exposing underlying service providers.

| Tool                  | Responsibility                                                       |
| --------------------- | -------------------------------------------------------------------- |
| `list_collections`    | Return available collections and their capabilities.                 |
| `describe_collection` | Describe fields, filterable properties, sorts and pagination limits. |
| `list_records`        | Return a filtered page of article summaries.                         |
| `get_record`          | Return article detail, including Markdown and completeness metadata. |
| `get_filters`         | Return list filter rules and current taxonomy choices.               |
| `search_collection`   | Return lightweight discovery results with matched snippets.          |
| `get_facets`          | Return search facet names, values and contextual counts.             |

## Response contracts

Each tool declares input and output schemas and delegates to the collection definition. Successful responses include validated `structuredContent` and a JSON text fallback. Record retrieval, listing and search also include resource links for reading article documents through MCP.

Missing records return `NOT_FOUND`. Provider failures and invalid upstream data return sanitized `UPSTREAM_UNAVAILABLE` errors. Input validation rejects unsupported collections, filter shapes and pagination values before record queries run.

## Filtering and discovery

`get_filters` describes the filters accepted by `list_records`; taxonomy arrays use returned IDs. `get_facets` describes the values accepted by `search_collection`; these use search facet names and values. Both combine fields with AND and values within a taxonomy or facet array with OR.

Search results contain discovery metadata and an optional query-matched snippet. Use `get_record` or the linked resource for the complete article. Clients should cite `source_url` and inspect `content_warnings` and `truncated` when using article content.

Keep handlers focused on protocol adaptation. Collection schemas and behavior belong in `server/collections/`; shared operations belong in `server/utils/`. Document handlers with a description, parameter tags where applicable and a return tag. Keep client-facing descriptions independent of infrastructure choices.

See [article contracts](../../../docs/articles-poc.md), [search](../../../docs/search.md), [article resources](../../../docs/article-resources.md) and [cache configuration](../../../docs/cache.md).
