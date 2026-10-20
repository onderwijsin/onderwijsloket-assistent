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

The explicit production allowlist lives in `index.ts`. Shared discovery consumes its narrow metadata/filter/facet view; collection-specific record tools retain their own schemas. Definitions require an ID schema and concrete list/get/search operation names. Search schemas and resource representations use independent native mappings. Every production core collection requires a resource/template; synthetic fixtures may omit them.

See [phase 3 preparation](../../docs/collection-inventory/phase-3.md) for the extension steps and [the collection plan](../../docs/collection-inventory/implementation-plan.md) for the collection rollout order and evidence gates. Articles, FAQs, sectors, testimonials, institutions and programs are enabled. The separate FAQ-shaped infrastructure fixture remains synthetic.

## FAQs and sectors

`faqs.ts` and `sectors.ts` provide independent list/get/search schemas and source reads governed by Directus permissions (see [data access responsibilities](../../docs/data-access.md)). FAQs render native answers and expand related article references; sectors retain named plain-text sections and bounded featured content. Sector identity is shared with taxonomy filters, with resources/templates enabled and facets disabled. See [faq and sector guidance contracts](../../docs/collection-inventory/faqs-and-sectors.md).

## Article supporting evidence and testimonials

Article details add bounded sources, documents and authors with independent relation completeness; summaries/search remain unchanged. `testimonials.ts` keeps personal stories, editorial authors and featured profiles distinct, using shared supporting projections from `supporting-content.ts` and the existing document renderer. It provides list/get/search/facets and a Markdown resource/template. See [article evidence and testimonials contracts](../../docs/collection-inventory/article-evidence-and-testimonials.md).

## Institutions and programs

`educational-institutions.ts` and `programs.ts` expose source filters, typed search and resources with bounded locations/providers/forms. `navigator-content.ts` owns verified enum, GeoJSON, schedule and provider projections. List degrees filtering is deliberately unsupported; source and index labels differ from generated assumptions. See [institutions and programs](../../docs/collection-inventory/institutions-and-programs.md).

`regional-education-desks.ts` exposes desk services, expanded coverage and contacts with independent phone/location schedules. `service-areas.ts` validates source GeoJSON; the index projection omits geometry/grid samples. See [regional desk contracts](../../docs/collection-inventory/regional-education-desks.md).

Podcast shows, episodes and videos have independent definitions. `media-content.ts` shares public host/season/media/transcript normalization without creating a generic record-tool surface. See [media contracts](../../docs/collection-inventory/podcasts-and-videos.md).
