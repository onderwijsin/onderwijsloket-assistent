# Phase 2 — Hybrid MCP surface

**Decision:** share catalogue, collection description, list-filter discovery and contextual facet counts. Keep list, get and search entrypoints specific to each collection. Reuse their implementation helpers where behavior overlaps. Use a small explicit registry for discovery and supported-operation lookup, without routing all record operations through it.

This is the phase 2 design for [issue #1](https://github.com/onderwijsin/onderwijsloket-assistent/issues/1), based on the [phase 1 inventory](README.md), inspected 2026-10-20. No implementation or public contract changes are made by this document. Phase 3 should implement the minimum infrastructure and a contrasting test fixture; subsequent collection rollouts are separate work. Unverified upstream details remain release gates, not assumed capabilities.

Implementation status: the shared preparation is now recorded in [phase 3](phase-3.md). The [grouped plan](implementation-plan.md) covers subsequent live collection work. This document remains the boundary decision; its phase 3 checklist is the implementation brief.

## Contract comparison

A matching envelope alone does not establish identical contracts. Compare the arguments, returned fields and meaning of the operation together.

| Operation              | Shared behavior                                                           | Material differences                                                                                                                    | Public boundary                                                                                        |
| ---------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Catalogue              | Enumerate approved, implemented collections with capability metadata      | Descriptions, fields, sorts and operation names vary as values                                                                          | Generic `list_collections`                                                                             |
| Collection description | Select one approved name and return metadata                              | Per-collection schema references and constraints                                                                                        | Generic `describe_collection`                                                                          |
| List filter discovery  | Describe accepted filter names, types, matching rules and current choices | Text, booleans, enums, taxonomy ID arrays, relation IDs and integer filters                                                             | Generic `get_filters`; small typed descriptor vocabulary, not an arbitrary record schema               |
| Facet discovery        | Query context, selected facet values and contextual counts                | Available names/values are dynamic per index; sectors have no evidenced facets                                                          | Generic `get_facets` for enabled facet-capable collections; bounded, runtime-validated name/value maps |
| Lists                  | Pagination envelope, stable sort, AND across dimensions                   | FAQ question, sector code/content, program enums/providers/forms, desk area/services, media publication fields; filter/sort sets differ | Separate statically typed collection tools                                                             |
| Details                | Select an ID, validate source, return a detail envelope                   | ID validators, question versus title, named sections versus body, forms, areas, locations, transcript and publication rules             | Separate statically typed collection tools                                                             |
| Search                 | Ranked discovery, query snippets, pagination and freshness caveats        | Search filter keys, result projections, optional fields and ID formats differ; sectors have no facets                                   | Separate statically typed collection tools; shared provider mechanics                                  |
| Resources              | Optional record URI and read representation                               | Article Markdown implemented; FAQ lacks descriptor fields, programs have multiple form documents, media has publication restrictions    | Explicit per-collection opt-in, outside the tool count                                                 |
| Geo / route operations | No implemented common contract to reuse                                   | Area approximation differs from physical distance; routes are a separate workflow                                                       | Deferred; no speculative tools                                                                         |

The [core contracts](core.md) define record fields, list filters and sorts; [search evidence](search.md) defines per-index fields, facets and result projections. This decision fixes tool boundaries around those shapes; it does not promote documented index attributes into verified live settings.

### Collection comparison and routing matrix

Every intended core has list, get and search semantics, but none of the complete proposed record schemas is identical to another. Article/testimonial body rendering overlaps; their language, publication and person relations differ. FAQ and sector detail are not article bodies under different names.

| Collection               | List / get / search tools                                                                         | List and detail distinction                                                                 | Search distinction                                                                      | Shared discovery / resources                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| articles                 | `list_articles`, `get_article`, `search_articles`                                                 | Existing UUID, article filters, taxonomy summaries and body Markdown                        | Existing article result contract and dynamic facet-name validation                      | All four discovery tools; existing article resource unchanged      |
| sectors                  | `list_sectors`, `get_sector`, `search_sectors`                                                    | GUID-compatible ID; code/sort and several content sections; same identity as sector filters | Section-text search; no filter map until facets are evidenced                           | Catalogue, description, list filters; no facets; resource deferred |
| faqs                     | `list_faqs`, `get_faq`, `search_faqs`                                                             | Question and rendered answer; no slug/path/description                                      | Question in hits; no invented article fields                                            | All four discovery tools once supported; resource deferred         |
| programs                 | `list_programs`, `get_program`, `search_programs`                                                 | Exact enum/registry filters, provider/location metadata and separate forms                  | Qualification/provider/type/level/degree/track facets; mapping discrepancies unresolved | All four discovery tools once supported; no initial resource       |
| regional_education_desks | `list_regional_education_desks`, `get_regional_education_desk`, `search_regional_education_desks` | Area required, physical location nullable; contact and service fields                       | Regions/cities/service facets; area grids cannot establish exact coverage               | All four discovery tools once supported; no initial resource       |
| educational_institutions | `list_educational_institutions`, `get_educational_institution`, `search_educational_institutions` | Provider enum, main and additional locations, language-tagged websites                      | Institution type and partial location projection                                        | All four discovery tools once supported; no initial resource       |
| testimonials             | `list_testimonials`, `get_testimonial`, `search_testimonials`                                     | Personal story, authors/profiles and publication date; no language flag                     | Story/author/tag discovery; availability cannot be inferred                             | All four discovery tools once supported; resource deferred         |
| podcast_episodes         | `list_podcast_episodes`, `get_podcast_episode`, `search_podcast_episodes`                         | Show/season, guests/hosts, audio metadata and nullable transcript                           | Transcript/show/guest matching; no native description                                   | All four discovery tools once supported; resource deferred         |
| podcast_shows            | `list_podcast_shows`, `get_podcast_show`, `search_podcast_shows`                                  | Series description, hosts/seasons and podcast_status; episodes listed separately            | Creator/host/series discovery; JSON description becomes search text                     | All four discovery tools once supported; resource deferred         |

The five supporting collections remain embedded; taxonomies remain filter vocabulary, with the intentional dual role for sectors. Areas, locations, availability, forms, seasons, files, junctions and renderer nodes remain indirect. Their reference shapes and exclusions are unchanged from [dependencies](dependencies.md). No supporting-table tools are created.

## Public tool catalogue

The complete intended surface has **31 tools**: four shared discovery tools plus three record operations for each of nine cores. This adds 24 collection-specific tools to the existing seven, rather than duplicating seven operations for every collection or exposing supporting tables. At phase 3's architecture-only milestone, all seven existing tools remain the only production tools; the contrasting collection is a test fixture.

Article record tools use `list_articles`, `get_article` and `search_articles`, implemented in `list-articles.ts`, `get-article.ts` and `search-articles.ts`. Backward compatibility is not required: there are no old-name aliases. Every collection-specific record tool omits `collection` because its name already determines the target. Output records retain their collection literal; shared describe/filter/facet tools still accept a collection selector.

| Tool                                              | Static input boundary                                                                                      | Output / responsibility                                                                                                                     |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_collections`                                | Empty object                                                                                               | `{collections: CollectionMetadata[]}`; only implemented, configured collections                                                             |
| `describe_collection`                             | `{collection: EnabledCollection}`                                                                          | One `CollectionMetadata`; shared schema, variable metadata values                                                                           |
| `get_filters`                                     | `{collection: FilterCollection}`                                                                           | Existing envelope with collection, combination, instructions, filters and retrieved_at; descriptors specify exact rules and current choices |
| `get_facets`                                      | Existing query/filter/facet/limit inputs plus `{collection: FacetCollection}`                              | Existing count envelope; identical contextual-count semantics for every enabled branch                                                      |
| `list_articles`, `get_article`, `search_articles` | Article-specific inputs without a collection selector                                                      | Existing article records/envelopes/resource links; no widened record union                                                                  |
| New `list_<plural>` tools from matrix             | `{filters?: CollectionListFilters,sort?: CollectionSort,page?:integer,page_size?:integer}`                 | Collection-specific summary array with existing list-style pagination envelope                                                              |
| New `get_<singular>` tools from matrix            | `{id: CollectionId}`                                                                                       | `{record: CollectionDetail,retrieved_at:ISO-UTC}`                                                                                           |
| New `search_<plural>` tools from matrix           | `{query?:string,filters?: CollectionSearchFilters,page?:integer,page_size?:integer}`; sectors omit filters | Collection-specific hits in the existing search-style envelope with count exactness and snippets                                            |

`EnabledCollection`, `FilterCollection` and `FacetCollection` are deployment-time enums derived from explicit enabled definitions and actual capabilities, not strings accepted as arbitrary upstream collection names. The full intended name set is the nine cores above. Until implemented, only articles is enabled. Capability metadata must describe what works now; an upstream index or future tool name does not make an operation available.

Keep all current article metadata fields and result values valid. Discovery can add optional `operations` and `resources` properties: `operations` maps each of `list`, `get`, `filters`, `search`, `facets` to its actual tool name or null; `resources` is an array of `{uri_template:string,mime_type:string}`. List/get/search names come from the matrix; filters/facets use the shared tool when enabled. This addition avoids teaching clients to call `list_articles` for every collection. Existing `fields`, `detail_fields`, `filterable_fields`, `sorts`, `pagination` and capabilities remain available. These properties describe record fields; the advertised tool schemas remain authoritative for types and validation.

`get_filters.instructions` and descriptor `operations` must reference the real collection-specific list tool. For articles they keep referencing `list_articles`. A client can discover a collection, select an operation from metadata, inspect its advertised schema and execute it without repository documentation. Generic tool descriptions must no longer claim that every operation is article-only once another collection is enabled. Descriptions for record tools identify their domain, valid input style and next retrieval operation. Tags/groups may assist discovery but correctness must not depend on clients hiding groups.

## Accurate static schemas

Each record tool exports an object input schema and a precise object output schema via the installed toolkit's `defineMcpTool` API. Fields come from that collection's Zod schemas. Root inputs and filter objects reject unknown keys; output validation checks the declared detail/hit projection before returning structuredContent. No `Record<string,unknown>`, arbitrary JSON content, stringified record blob, dynamic field selection or nine-collection record union is introduced to bypass incompatible types.

All successful outputs include validated `structuredContent` and a JSON text fallback. Reuse the current portable nullable-output representation. Search/detail transforms belong before output validation, not inside the JSON Schema representation. Resource links appear only for registered, readable resource representations. Tool annotations retain readOnlyHint, destructiveHint, idempotentHint and openWorldHint behavior from current read tools.

### Lists and details

Use phase 1's bounded page sizes, text lengths, equality/array semantics, per-collection sort allowlists and ID decisions. Collection list/detail schemas are independent even when they reuse pagination or taxonomy field builders. The first allowed sort is the default, with ID as a stable tie breaker. Source nullable timestamps and retrieval timestamps remain distinct.

A representative FAQ boundary, as a schema sketch rather than executable code:

```ts
list_faqs.input = {
  filters?: {
    question?: ExactText,
    english?: boolean,
    sectors?: GuidArray,
    audiences?: GuidArray,
    phases?: GuidArray,
    topics?: GuidArray,
    articles?: FaqArticleIdArray
  },
  sort?: "question" | "-question" | "date_updated" | "-date_updated",
  page?: Page,
  page_size?: PageSize
}
get_faq.input = { id: FaqId }
get_faq.output = {
  record: {
    collection: "faqs",
    id: FaqId,
    question: string,
    english: boolean | null,
    source_url: URL | null,
    date_updated: string | null,
    sectors: Taxonomy[],
    audiences: Taxonomy[],
    phases: Taxonomy[],
    topics: Taxonomy[],
    answer: Markdown,
    articles: ArticleRef[],
    content_warnings: string[],
    truncated: boolean,
    relations_truncated: string[]
  },
  retrieved_at: IsoUtc
}
```

ID schema symbols must be resolved independently: article ID is UUID, sector and taxonomy IDs are GUID-compatible, and unverified new record IDs remain bounded opaque strings pending evidence. `FaqArticleIdArray` selects article IDs, not FAQ IDs. This illustrates why making every ID or relation array use one global UUID validator would be wrong. No title/slug/description or editor_nodes relation is required on a FAQ.

A program's filters instead use its exact type/level/financing/vendor/degrees enums, provider IDs and taxonomy fields. Its detail preserves forms and location; it cannot be validated by the FAQ schema. `degrees` list filtering means any selected degree matches the source array; how it maps to an index facet is an independent adapter decision. Institution location filters traverse institution/location junctions; program location is a single M2O relation. Desks retain required area and nullable physical location. Do not flatten these differences into a common arbitrary `relationships` bag.

For new bounded relationship expansions, include `relations_truncated: string[]` in detail schemas as described in phase 1. Empty means all declared relation arrays were fully fetched. Do not add a new required field to the current article response in the architecture-only change; article supporting expansion and its completeness metadata need separate additive contract review. Existing `truncated` continues to mean document traversal truncation, not missing relation rows.

### Search versus filters

New collection search filters are strict objects with the documented collection-specific facet keys and selected-value arrays; names are additionally validated against currently available countable facets. Use the exact dotted keys rather than translating them into taxonomy-ID filters. Runtime settings cannot silently add public search arguments: expanding a static filter-key schema requires a reviewed change.

Examples: FAQ search allows `audiences.title`, `phases.title`, `sectors.title`, `topics.name`; institution search allows only `type`. Episode search allows its documented tag keys and `show.title`; it does not accept FAQ language or program degree fields. Sectors advertise query/page/page_size with no filters argument. Program `degree` and `program_forms.tracks.name` remain blocked until verified; do not choose guessed aliases. Array bounds and query/page limits follow [search evidence](search.md).

Facet label values are strings unless an actual boolean/numeric facet is verified. Boolean facet filters can accept booleans and their discovered string representations when documented; normalize at the boundary and retain returned discovery values. Do not coerce arbitrary strings into booleans or confuse labels with taxonomy IDs. Existing article search keeps its current dynamic facet-map schema and normalization; tightening that contract is outside this decision.

Each new search tool uses its own hit schema from phase 1. FAQ hits return `question`, program hits preserve providers/location where verified, and episode hits identify show/publication metadata. Share snippet/count/pagination schemas without forcing missing article fields to empty strings. Search never acts as the source of full current detail. Hit ID mapping to the detail ID validator must be tested, including objectID fallback where used.

### Shared filter discovery

The common result envelope describes filter rules rather than returning a collection's records. Keep a small discriminated descriptor vocabulary: existing string/equality, boolean/equality and taxonomy-array/inclusion descriptors, plus enum equality, enum-array inclusion, relation-ID array inclusion, relation-ID scalar equality and integer equality when required by an enabled collection. Preserve all existing article descriptor variants and fields. New variants have explicit fields; never allow arbitrary JSON Schema documents or unchecked `unknown` values in the output.

New enum descriptors provide allowed values; ID descriptors provide their format/array bounds and the relevant lookup collection/tool, without enumerating every institution or article. Integer descriptors specify verified bounds where known. Filter choices are not record counts. New descriptor variants should be added only when the corresponding collection fixture/implementation requires them. These descriptors aid selection; the actual collection list tool advertises the precise filter schema even without a preceding discovery call.

### Shared facet discovery

`get_facets` is the deliberate dynamic-name boundary. Its bounded selected-value map has the same semantics for every collection: query/filter context in, name/value/count arrays out. Reuse the current schema and limits from [search evidence](search.md), including bounded facet selection and max_values. Validate requested names against both the collection's declared search-filter keys and runtime countable facet discovery for new collections. Articles retain their existing dynamic-name behavior.

The static schema states that names are discovered values and unsupported names return INVALID_FILTER; it does not claim every string is a usable attribute. This is a common name/value protocol, not a permissive substitute for typed list/search schemas. Top-level collection and limits remain constrained. A small deployment enum plus bounded name/value map is sufficient; there is no collection-discriminated union of record schemas. Keep the existing facets output shape, contextual AND/OR behavior, own-filter counts, count exactness caveat and cached retrieval timestamp.

For new collections, expose only facets accepted by that collection's search schema so discovery never recommends an unusable search argument. This includes filtering the default all-facets response to declared keys. Sectors are absent from the facet-capable enum. A stale/unsupported facet selection must fail safely rather than be silently ignored. No automatic settings mutation or settings-read permission is required.

## Internal ownership and minimum registry

| Layer                      | Owns                                                                                                                                                                                    | Does not own                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Collection definition      | ID/list/detail/hit schemas, list/search filters, sorts, source projections, relation flattening, document field selection, attribution, publication/vendor policy and supported methods | Another collection's record shape or global tool dispatch                                  |
| Existing content utilities | Document validation, scoped node hydration, Markdown rendering, warnings and traversal limits                                                                                           | Assuming every collection has body/editor_nodes                                            |
| Taxonomy/filter helpers    | GUID lookup projection and reusable filter/descriptor builders                                                                                                                          | Which filters a collection supports or its junction paths                                  |
| Search helpers             | Client reuse, query transport, facet lookup/counting, snippets, page translation, safe provider errors                                                                                  | Requiring UUID/article hit shapes or inventing missing fields                              |
| Resource helpers           | URI/descriptor rendering and reads for explicit opt-ins                                                                                                                                 | Registering every collection or assuming title/description/content universally exist       |
| Tool entrypoint            | Static published schemas, annotations, validation boundary, structured/text response and optional resource links                                                                        | Directus queries or relation semantics                                                     |
| Explicit registry          | Enabled public collection definitions, metadata and supported-operation lookup for shared discovery                                                                                     | Upstream schema scanning, auto-registration, all-record union or unsafe arbitrary dispatch |

Introduce one proposed `server/collections/index.ts` with explicit imports and an immutable allowlist, initially only articles. Internal type design may retain the heterogeneous definitions as a tuple or keyed object; do not cast every collection to the article definition or erase it to `any`. Generic discovery consumes a narrow metadata/filter/facet view; collection-specific record entrypoints can import their own definition directly. All seven entrypoints importing articles is a problem for shared discovery, not evidence that specific article handlers must dynamically dispatch.

Registry resolution rejects an unknown/disabled name before provider access. Unsupported operations on a known definition fail with UNSUPPORTED_OPERATION; transport-level enum validation can reject those requests before resolution as well. Keep existing article errors and sanitized upstream failures. Do not add a callable fixture to production to demonstrate registry extensibility. Use capability presence deliberately: the current helper wraps optional search/facets into methods that throw, so inspecting method existence after wrapping is insufficient. Read explicit capabilities or raw optional implementations.

The current `defineMcpCollection` hardcodes UUID detail IDs and article-shaped search outputs. Phase 3 should parameterize those boundaries only enough to validate the contrasting fixture. Keep the existing article schema as an explicit supplied schema or article default; never widen it to an unconstrained string as a side effect. Let the definition receive an independent search-hit/output schema when search is supported. Resource behavior remains optional; a non-resource fixture must not need fake title/description fields to satisfy a resource helper.

No wholesale collection DSL, plugin lifecycle, filesystem scanner, inheritance hierarchy or dynamic registration is justified. An explicit map and the existing definition/search helpers are sufficient. Extract a small response adapter only if the implementation demonstrates duplicated structured/text/resource packaging; do not create a seven-tool factory that forces every collection into every capability. Static files under `server/mcp/tools/` remain a clear installed-toolkit integration point. Keep caches scoped by actual collection, ID, index and complete query context, and preserve Node/Cloudflare runtime compatibility.

## Discovery size and alternatives

Thirty-one tools is an upper bound for the full nine-core scope, not the immediate release target. Enable collections incrementally; each adds only its three record operations and entries in shared discovery. Specific names and accurate schemas make direct selection possible. There are no aliases, supporting-table tools or placeholder geo/route tools. Catalogue metadata links clients to actual operations; resource support does not multiply tool definitions.

| Alternative                                                             | Assessment                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One generic list/get/search dispatcher with a giant record/filter union | Reject: list filters, detail content and search hits vary materially; adding a collection would change unrelated schemas and client parsing. Metadata discovery cannot repair an inaccurate static schema.                                                                         |
| Generic get returning an untyped object or serialized JSON              | Reject: identical ID/envelope mechanics do not justify discarding detail output validation.                                                                                                                                                                                        |
| One normalized content search tool                                      | Defer: possible if clients want uniform lightweight content discovery, but phase 1 currently calls for distinct question/provider/area/show fields. Would require a new consciously reduced contract and a decision on the article result projection; no demonstrated benefit yet. |
| Seven tools per core plus tools for supporting tables                   | Reject: repeated discovery/facet protocols and unneeded support-table browsing; at least 63 core tools.                                                                                                                                                                            |
| Domain tools with several collection-specific filter/detail branches    | Reject for now: smaller name count shifts complexity into unions; the within-domain schemas are still different. Shared code does not require shared public unions.                                                                                                                |
| Separate endpoints or request-driven tool hiding                        | Defer: no measured discovery problem yet; extra routing/session/client behavior is not needed for this scope.                                                                                                                                                                      |

When real usage shows tool-selection failures, evaluate descriptions and the enabled collection subset first. Grouped content search or separate endpoints require evidence and a contract decision, not an automatic switch at an arbitrary tool count. Do not depend on unverified client support for tags or dynamic tool reloads.

## Phase 3 scope and verification gates

The next architecture change should:

1. Preserve article record behavior while publishing the three collection-specific record tool names without a collection selector. Keep shared discovery selector inputs and additive operation/resource metadata. Decouple shared discovery from direct article imports through the minimal allowlist.
2. Add one test-only contrasting fixture, preferably FAQ-shaped: no title/slug/path, its own ID validation, question/answer output and no resource support. It can provide a synthetic search projection to prove search schemas are independent. This is not implementation of live FAQs.
3. Exercise schema generation and tool results for articles and fixture-specific entrypoints without exposing the fixture in the production registry. Assert article UUID validation remains strict, fixture IDs use their own declared rules, unknown filter keys fail and every output matches its advertised schema.
4. Check catalogue/discovery capability gating; unknown/disabled names and unsupported operations must reject before provider calls. Test that non-resource fixtures never emit dead resource links and that adding fixture metadata does not mutate article schema objects.
5. Retain current article resource URI/MIME/front matter, pagination, taxonomy filters, matched snippets, error behavior and runtime checks. Run relevant existing contract tests plus formatting, lint and type checks. Do not add a dependency or an eval framework for this documentation-driven architecture change.

Before enabling any live new collection, resolve its phase 1 ID, permission, publication, geometry/media/document, relation-bound and index TBDs. At that point publish only verified filter keys and hit fields, and add meaningful contract regressions for that collection. Unresolved media/geo details do not block the minimal architecture/fixture work. Geo matching, geocoding, route tools, standalone support collections and optional new resources remain outside phase 3's architecture-only scope.

Evidence: [core contracts](core.md), [dependencies](dependencies.md), [search evidence](search.md), current `server/collections/articles.ts`, `server/utils/define-mcp-collection.ts`, `server/utils/search/`, `server/utils/resources.ts`, the seven existing tool entrypoints, and installed `@nuxtjs/mcp-toolkit` declarations. The manage-mcp skill was used to check static tool/structured output integration; no framework or dependency changes are proposed.
