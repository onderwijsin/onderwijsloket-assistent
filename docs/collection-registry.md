# Collection registry and application boundaries

The server exposes ten core collections through thirty-four tools: three record operations per collection and four shared discovery operations. Each core also has a readable Markdown resource and URI template. The registry makes this surface explicit without forcing every collection into an article-shaped record or exposing arbitrary Directus tables.

## Native records, shared discovery

`server/collections/index.ts` is the production allowlist. It registers articles, FAQs, sectors, testimonials, educational institutions, programs, regional education desks, podcast shows, podcast episodes and videos. Generating a source type or adding a supporting projection does not make a collection public.

Each definition owns its summary/detail schemas, supported inputs, source queries, normalization, search adapter and resource metadata. For example, FAQs use question/answer fields, programs have separately described forms, and episodes have show/season identity and transcripts. Native fields explain the data better than a common record with many invented empty properties.

The shared registry receives a narrower discovery view: identity, descriptions, capabilities, operation names, schemas, filters and facets. `list_collections` and `describe_collection` describe registered contracts; `get_filters` and `get_facets` dispatch only supported discovery operations. Unknown names and unavailable capabilities fail before provider access. A test-only FAQ definition exercises non-UUID identities and different record fields without entering the production allowlist.

Record tools remain explicit: `list_articles`, `get_article`, `search_articles`, and their equivalents for other collections. Their names select the collection, so they do not accept redundant collection selectors. Shared discovery tools do. Concrete tool files preserve individually advertised input/output schemas and domain guidance; a generic runtime router would obscure those contracts for little maintenance benefit.

## Responsibilities by layer

| Location                    | Responsibility                                                                                            |
| --------------------------- | --------------------------------------------------------------------------------------------------------- |
| `server/mcp/tools/`         | Static protocol declarations, meaningful descriptions and structured/text results with resource links     |
| `server/mcp/resources/`     | Explicit URI templates, native body selectors and metadata mapping                                        |
| `server/collections/`       | Domain-specific source queries, filters, schemas and normalization                                        |
| `server/utils/collections/` | Definition/envelope validation, registry metadata, source-read errors, detail caching and relation bounds |
| `server/utils/projections/` | Reusable public projections for people, assets, providers, locations, schedules, media and areas          |
| `server/utils/taxonomy/`    | Taxonomy identity/archives, source filter vocabulary and cached choices                                   |
| `server/utils/search/`      | Search transport, strict facet boundaries, snippets and result pagination                                 |
| `server/utils/content/`     | Pure content hydration/rendering, resource notices, media Markdown and YAML serialization                 |
| `server/utils/resources.ts` | Resource descriptors, queued catalogue reads and protocol error translation                               |

```mermaid
flowchart LR
  T[Record tool or resource] --> D[Collection definition]
  D --> C[Validated detail cache]
  C --> Q[Native query and source reader]
  Q --> P[Public projections and rendering]
  P --> C
  D --> E[Fresh response envelope]
```

List and search operations use the same input/output boundaries but do not use the detail cache. Tools package data; they do not perform source queries or reimplement relationship rules. Resources call the same getter as tools and add their Markdown/YAML representation outside the record cache.

## Why the shared mechanisms stop here

`definition.ts` validates IDs and operation arguments, constructs portable output schemas and response envelopes, advertises capabilities and applies optional detail caching. `cache-detail.ts` stores only validated detail records. `read-records.ts` executes typed SDK commands and sanitizes source transport/validation failures. Queries remain at their collection call sites, where TypeScript checks selected fields against the generated schema.

Reusable projections remove repeated relationship handling without becoming generic public tables. Their output validators stay separate from source transforms because published MCP JSON Schema must describe the output, not executable parsing logic. Markdown formatting is separate again: a projection normalizes media identity; a content helper decides how a body and transcript appear in a resource.

This organization deliberately retains some explicit repetition: tool declarations, field selections, source-list filters and index mappings are useful review boundaries. Similar names do not imply identical source/index semantics. Introducing a query DSL, one configurable domain factory or automatic collection registration would weaken those boundaries. Splitting large domain modules into adjacent files can be useful when a domain grows independently; creating ten identical subdirectory trees now would add navigation without removing behavior.

The architecture review addressed repeated source readers, the article-only cache, scattered infrastructure helpers and formatting mixed into projections. Remaining deliberate constraints are explicit tool declarations, separate source/search contracts and configuration-owned cache durations. There is no framework migration or dependency change involved.

See [collection data](collection-data.md) for relationship semantics, [search](search.md) for index discovery, [resources](collection-resources.md) for representations and [caching](cache.md) for freshness boundaries. Directus visibility remains governed by [data access responsibilities](data-access.md). Geocoding and exact geographic matching are future features, not implied by returning coordinates.
