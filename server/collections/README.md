# Collections

Collection definitions are the source of truth for the MCP server’s data contracts and operations. Each module exports one default `defineMcpCollection(...)` definition containing its description, schemas, supported sorts and operation implementations.

## Article operations

`articles.ts` provides:

| Method                     | Result                                                           |
| -------------------------- | ---------------------------------------------------------------- |
| `list(options)`            | Paginated summaries with filters and stable sorting.             |
| `get(id)`                  | Article metadata and rendered Markdown, cached for five minutes. |
| `filters()`                | List filter definitions and dynamic taxonomy choices.            |
| `search(options)`          | Lightweight search results with query-matched snippets.          |
| `facets(options)`          | Search filter values and counts for the supplied context.        |
| `resourceMetadata(record)` | Metadata selected for resource front matter.                     |

List filters cover title, slug, language, sectors, qualifications, audiences, phases, roles, topics and tracks. Summaries and details include normalized sectors, qualifications, roles, topics and tracks. Taxonomy entries share the `{ id, title, slug, description }` shape.

## Shared contracts

`defineMcpCollection` derives collection discovery metadata and MCP input/output schemas. It validates operation boundaries and wraps list/detail results with pagination or retrieval timestamps. Search and facet capabilities are advertised when their implementations are supplied.

Keep collection-specific queries, field mappings and metadata selection in the collection module. Reusable behavior belongs in `server/utils/`:

- `taxonomy/` supplies filter building blocks, relation normalization and cached lookups.
- `search/` supplies the shared client, collection search adapter and snippet selection.
- `content/` hydrates editor nodes and renders Markdown independently of collection type.
- `resources.ts` supplies resource descriptors, cached catalogues and read handlers.

Tools and resource reads both call the collection methods. Article detail caching therefore serves both access paths without separate document caches. Durations are configured in [`config/cache.ts`](../../config/cache.ts).

See [article contracts](../../docs/articles-poc.md), [search](../../docs/search.md), [content documents](../../docs/content-documents.md) and [resources](../../docs/article-resources.md).

## Registry and independent contracts

The explicit production allowlist lives in `index.ts`. Shared discovery consumes its narrow metadata/filter/facet view; collection-specific record tools retain their own schemas. Definitions require an ID schema and concrete list/get/search operation names. Search result/input schemas and resource representations are independent opt-ins.

See [phase 3 preparation](../../docs/collection-inventory/phase-3.md) for the extension steps and [the grouped plan](../../docs/collection-inventory/implementation-plan.md) for the collection rollout order and evidence gates. Only articles is enabled; the FAQ collection in tests is synthetic.
