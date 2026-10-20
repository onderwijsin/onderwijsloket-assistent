# Articles POC

The current implementation exposes five Directus-backed tools. Article Markdown resources are also available; see [article resources](article-resources.md). `search_articles` and `get_facets` add [Algolia discovery](search.md). Global search, UI and prompts remain deferred.

## Collection architecture

`server/collections/articles.ts` has one export: `export default defineMcpCollection(...)`. That definition contains the schemas, description and `list()`, `get()` and `filters()` implementations. Query builders and normalization functions remain private to the module.

`defineMcpCollection` in `server/utils/define-mcp-collection.ts` infers method argument and result types from the collection schemas. It validates list/get inputs and outputs and supplies pagination and retrieval-time envelopes. `filterSchema` describes accepted list filters; `filters()` retrieves their values through the shared taxonomy cache. MCP tools import the default collection and call its methods. Summary fields are defined once and extended for details. The collection uses the existing Directus server helper directly; there is no service layer.

```ts
import articles from "../server/collections/articles";

await articles.list();
await articles.list({ filters: { english: false }, page_size: 5 });
await articles.get("00f81660-a2e4-48af-b8d7-98ce338de447");
await articles.filters();
```

`search()` and `facets()` delegate to the shared Algolia discovery utilities, with collection-specific index configuration.

## Tools

`list_articles`, `get_article` and `search_articles` target articles directly and take no `collection` argument. Shared `describe_collection`, `get_filters` and `get_facets` still require a collection selector.

| Tool                  | Behavior                                                                            |
| --------------------- | ----------------------------------------------------------------------------------- |
| `list_collections`    | Lists articles with a description and capabilities.                                 |
| `describe_collection` | Describes summary/detail fields, supported sorts and pagination.                    |
| `list_articles`       | Retrieves a page of article summaries with optional scalar and relation filters.    |
| `get_article`         | Retrieves article detail by UUID, including readable content and taxonomy metadata. |
| `get_filters`         | Describes accepted filters and fetches current taxonomy choices from Directus.      |

The two additional tools `search_articles` and `get_facets` are registered. Collection metadata advertises `list`, `get`, `filters`, `search` and `facets` as available. Search filters are index facet values, separate from the Directus taxonomy ID filters described below.

## Filtering

Scalar filters `title`, `slug` and `english` use equality. Relation filters accept arrays of IDs from `get_filters`:

- sectors
- qualifications
- audiences
- phases
- roles
- topics
- tracks

IDs within a dimension combine with OR; different dimensions and scalar filters combine with AND. Each relation filter follows the Directus junction, for example `topics.topics_id.id` with `_in`. Arrays contain 1–50 GUID-formatted IDs; unknown fields and raw Directus expressions are rejected.

```json
{
  "collection": "articles",
  "filters": {
    "english": false,
    "topics": ["00f81660-a2e4-48af-b8d7-98ce338de447"]
  },
  "page_size": 5
}
```

The ID above is illustrative. Retrieve actual current IDs using `get_filters`. Its values come from the seven taxonomy collections, not Algolia, and do not include article-match counts. The shared [readTaxonomy utility](taxonomies.md) fetches each taxonomy with `limit: -1` and caches it for one minute. Failures return an explicit error instead of partial options.

## Records and pagination

Both summary and detail include flattened metadata for sectors, qualifications, roles, topics and tracks. Each metadata entry uses the shared `{ id, title, slug, description }` contract; unavailable slug/description values are null. The same shape is used by filter choices and `readTaxonomy()`. Null junction targets are skipped. Audiences and phases are available as filters but are not included in record metadata.

Records also contain ID, title, slug, description, summary, update date, language flag and source URL. The shared `server/utils/use-source-url.ts` helper constructs source URLs with `ufo`. Detail adds content, content warnings and truncation, plus bounded sources/documents/authors and `relations_truncated`; see [article evidence and testimonials](collection-inventory/article-evidence-and-testimonials.md). Tool results include structured content and a JSON text fallback; all seven tools advertise output schemas and validate their successful structured responses.

Pagination is one-based with a default page size of 10 and maximum of 25. Supported sorts are `title`, `-title`, `date_updated` and `-date_updated`, with ID as a tie-breaker. Listing fetches one extra record for `has_more` without promising an exact count.

## Current limitations

Detail content uses the shared [content-document pipeline](content-documents.md) to resolve editor nodes and render Markdown without a character cap. Document traversal limits still report truncation. Author, source and document references are included through bounded detail projections. FAQ expansion outside content documents remains deferred. Taxonomy metadata is resolved separately from editor nodes.

Missing records return `NOT_FOUND`; provider and response-validation failures return a sanitized `UPSTREAM_UNAVAILABLE` error.

## Verification

Unit tests cover collection inputs, M2M filter translation, taxonomy metadata in lists/details, taxonomy discovery with mocked Directus responses, pagination, safe errors and complete Markdown rendering and traversal limits. Production-build integration tests exercise all five MCP tools against a local Directus HTTP fixture, including pagination, full Markdown rendering, dynamic filters, cache reuse and safe failures. The Algolia HTTP fixture exercises both discovery tools; see [search](search.md).

## Agent-facing contracts

Tool descriptions explain discovery, filtering, pagination and detail retrieval. Parameter descriptions live on the collection's Zod schemas and are published in MCP input schemas; agents do not need repository documentation to construct calls. Every tool declares a JSON Schema output contract. `defineMcpCollection` derives the metadata and record contracts and validates the collection's declared `filtersOutput` schema.

`get_filters` returns dynamic choices plus usage instructions. Its `type`, `items`, `minItems` and `maxItems` fields use JSON Schema vocabulary; `operator` and `operations` are descriptive discovery metadata, not arguments to forward. Taxonomy arrays are arrays of identifier strings with an explicit pattern, rather than the custom `guid[]` label. Strict UUID validation is deliberately not used for taxonomy IDs because existing source IDs do not all have RFC UUID version/variant bits. Always use returned IDs rather than inventing identifiers.

Successful output schemas do not describe MCP protocol errors or tool error results. Missing records and upstream failures retain their existing error behavior.

Filter definitions use the reusable building blocks in `server/utils/taxonomy/collection-filters.ts`. `defineCollectionFilters` derives the strict input schema, discovery output schema and `filters()` implementation from one field map. `exactTextFilter`, `booleanFilter`, `taxonomyFilter` and `taxonomyFilters` keep validation, descriptions and dynamic choices together; collections retain their own Directus query translation.

`describe_collection` and `list_collections` include `filterable_fields`, derived directly from the collection input schema. This is separate from summary/detail fields: audiences and phases, for example, can be filtered without being returned as record metadata. Use `get_filters` for detailed rules and live choices.

Nullable output fields use `nullableOutput` from `server/utils/mcp-schema.ts`. It preserves explicit `anyOf` branches when Zod serializes schemas, avoiding primitive `type` arrays that some MCP clients reject. Fields remain required and accept null; URL constraints, descriptions and other non-null validation remain intact. This improves JSON Schema portability without claiming compatibility with dialects that cannot represent null at all.
