# MCP tools

The server exposes thirteen read-only tools through `/mcp`. Tool descriptions and schemas explain how to discover collections, select filters and retrieve content without exposing underlying service providers.

| Tool                  | Responsibility                                                       |
| --------------------- | -------------------------------------------------------------------- |
| `list_collections`    | Return available collections and their capabilities.                 |
| `describe_collection` | Describe fields, filterable properties, sorts and pagination limits. |
| `list_articles`       | Return a filtered page of article summaries.                         |
| `get_article`         | Return article detail, including Markdown and completeness metadata. |
| `get_filters`         | Return list filter rules and current taxonomy choices.               |
| `search_articles`     | Return lightweight discovery results with matched snippets.          |
| `get_facets`          | Return search facet names, values and contextual counts.             |

FAQ and sector record tools are `list_faqs`, `get_faq`, `search_faqs`, `list_sectors`, `get_sector` and `search_sectors`. They have no collection selector and return resource links. Shared discovery includes all three collections; facets support articles and FAQs only. See [faq and sector guidance](../../../docs/collection-inventory/faqs-and-sectors.md).

## Response contracts

Each tool declares input and output schemas. The four shared discovery tools delegate through the explicit collection registry; the article list/get/search tools retain their own definition and contracts. Successful responses include validated `structuredContent` and a JSON text fallback. Record retrieval, listing and search also include resource links for reading article documents through MCP.

Missing records return `NOT_FOUND`. Provider failures and invalid upstream data return sanitized `UPSTREAM_UNAVAILABLE` errors. Input validation rejects unsupported collections, filter shapes and pagination values before record queries run.

## Filtering and discovery

`get_filters` describes the selected collection's concrete list tool; taxonomy arrays use returned IDs. `get_facets` describes search values for articles and FAQs; these use search facet names and values. Both combine fields with AND and values within a taxonomy or facet array with OR.

Search results contain discovery metadata and an optional query-matched snippet. Use `get_article` or the linked resource for the complete article. Clients should cite `source_url` and inspect `content_warnings` and `truncated` when using article content.

Keep handlers focused on protocol adaptation. Collection schemas and behavior belong in `server/collections/`; shared operations belong in `server/utils/`. Document handlers with a description, parameter tags where applicable and a return tag. Keep client-facing descriptions independent of infrastructure choices.

See [article contracts](../../../docs/articles-poc.md), [search](../../../docs/search.md), [article resources](../../../docs/article-resources.md) and [cache configuration](../../../docs/cache.md).

## Extension boundary

Discovery metadata includes concrete operation names and optional resource representations. `toolResult` supplies the structured/text response envelope without assuming that every record has a Markdown resource. Keep new list/get/search tools collection-specific and omit their redundant collection input; the article record tools use this pattern too. See [phase 3 preparation](../../../docs/collection-inventory/phase-3.md).

Article record entrypoints are `list-articles.ts`, `get-article.ts` and `search-articles.ts`; their public names are `list_articles`, `get_article` and `search_articles`. They take no collection selector. Old names are not registered.

Testimonials add `list_testimonials`, `get_testimonial`, `search_testimonials` and resource links. Shared filters/facets include testimonials. Person-ID list filters use explicit nested lookup paths, separate from search facet labels. See [article evidence and testimonials](../../../docs/collection-inventory/article-evidence-and-testimonials.md).

Institutions and programs adds list/get/search tools for programs and educational institutions with resource links. Shared enum filter discovery describes source codes, while facets describe index labels. Institution programs remain a filtered program list instead of a recursive expansion. See [contracts](../../../docs/collection-inventory/institutions-and-programs.md).
