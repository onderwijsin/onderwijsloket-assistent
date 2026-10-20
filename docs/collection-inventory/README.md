# Collection inventory and MCP architecture

Design inventory for [issue #1](https://github.com/onderwijsin/onderwijsloket-assistent/issues/1), inspected 2026-10-20. Scope follows the collection list supplied for this task, rather than treating the issue's approximate 25–30 count as a target. Phase 1 records contracts and evidence; phase 2 records the architecture decision. Phase 3 implemented shared preparation; implemented domains enable articles, FAQs, sectors, testimonials, institutions, programs, regional education desks, podcast shows/episodes and videos.

- [FAQ and sector guidance implementation](faqs-and-sectors.md): live FAQ/sector contracts, evidence, relation bounds and validation.
- [Phase 3 preparation](phase-3.md): implemented boundaries, extension steps and verification limits.
- [Institutions and programs implementation](institutions-and-programs.md): programs, institutions, locations, schedules, variants and verified search/resource contracts.
- [Article evidence and testimonials implementation](article-evidence-and-testimonials.md): article evidence, authors, documents, featured profiles and testimonial resources.
- [Regional education desks implementation](regional-education-desks.md): coverage geometry, public services, nullable relations, independent schedules and verified search.
- [Collection implementation plan](implementation-plan.md): collection domains, prerequisites and release gates.
- [Phase 2 architecture](architecture.md): contract comparison, hybrid tool surface, static schemas and the minimum phase 3 scope.
- [Podcasts and videos](podcasts-and-videos.md): series/season/host identity, media references, transcripts and verified search.
- [Core contracts](core.md): ten public core collections (including the later video scope extension), including the existing articles contract.
- [Supporting and dependent collections](dependencies.md): five named supporting collections, taxonomy and relational dependencies, deferred and excluded tables.
- [Schema evidence](schema-evidence.md): selected generated interfaces, including actual enums and junction targets.
- [Search evidence](search.md): documented indexes, fields, facets and differences from Directus.

## Evidence and confidence

**Implemented** means verified in current repository code. **Observed** means present in generated types or official API documentation; it does not prove live data, permission or validation behavior. **Proposed** means a phase 1 contract recommendation, not an implemented or approved API. **TBD** is a specific unresolved constraint. Unless marked implemented, all public contracts in this inventory are proposed.

Primary evidence:

- Local `.nuxt/types/directus-schema.d.ts` (snapshot excerpts recorded here because `.nuxt` is generated and can change). A TypeScript `string` ID does not establish UUID formatting. Generated optionality also does not establish whether a relation was omitted, denied or empty.
- `server/collections/articles.ts`, `server/utils/define-mcp-collection.ts`, `server/utils/search/{schemas,collection-search}.ts`, `server/utils/taxonomy/`, `server/utils/content/`, and `server/mcp/resources/articles.ts`.
- [Knowledge Base](https://docs.onderwijsloket.com/data-model/families/knowledge-base), [Navigator](https://docs.onderwijsloket.com/data-model/families/navigator), [Media](https://docs.onderwijsloket.com/data-model/families/media), [Filters](https://docs.onderwijsloket.com/data-model/families/filters), [Indexes](https://docs.onderwijsloket.com/search/collections), [Permissions](https://docs.onderwijsloket.com/misc/permissions), read through the Onderwijsloket API Docs plugin.
- `SPEC.md` provides intent; current code wins for implemented article behavior. For example, the draft specification's old detail character cap is not the current renderer contract.

The Algolia Productivity plugin only accepts a fixed application allowlist that excludes `WSV9PQ4NXW`, the application recorded in `docs/search.md`. No live index query or settings audit was performed in phase 1. FAQ and sector guidance subsequently verified FAQ and sector queries using the configured SDK credentials; see [FAQ and sector guidance evidence](faqs-and-sectors.md). Index names and field lists below are documentation evidence, not live verification. No credentials, records or settings were changed.

## Contract notation and shared proposals

`T?` below means a **required output key accepting null**, not an optional key. Arrays are required and contain normalized objects, never junction IDs. Input filters are optional; omitted means unrestricted, and explicit false must remain meaningful. Do not accept arbitrary Directus queries, field selections, vendor index names or operator strings.

For proposed public core collections:

- `get`: required `{id: ID}`; collection selection/tool naming is deliberately left to phase 2. `ID` is an opaque nonempty string, proposed maximum 200 characters, unless a stronger format is verified. Articles retain their existing strict UUID; taxonomy IDs retain GUID validation. Do not globally tighten other IDs to UUID based only on generated strings. Validate live ID samples before finalizing each schema (issue #3).
- `list`: optional `filters`, `sort`, `page` (integer 1–10000, default 1), `page_size` (integer 1–25, default 10). Reject unknown keys. Default sort is the first listed for that collection; append `id` as a stable tie breaker. No arbitrary field sorts.
- Exact text filters: trimmed string, 1–200 characters, equality rather than substring. Taxonomy/relation selection: 1–50 IDs, OR within one array and AND across fields. Enums use the exact generated unions in the schema evidence; current permitted taxonomy choices come from filter discovery, not a frozen list of names.
- List output: `{records: Summary[], page: integer, page_size: integer, has_more: boolean, retrieved_at: ISO UTC string}`; get output: `{record: Detail, retrieved_at: ISO UTC string}`. Fetch one extra list record rather than claiming total counts. Proposed common record keys: `{collection: literal, id: ID, source_url: URL|null, date_updated: string|null}`. `date_updated` remains nullable source metadata; it is distinct from retrieval time. Sources without a page need an explicit `{collection,id}` reference and must not receive fabricated website URLs.
- Search/facet inputs and outputs are described in [search.md](search.md), including per-collection exceptions. Filter discovery returns names, matching rules, types and live accepted choices; it is not a facet-count response.
- Text documents become Markdown, with `content_warnings: string[]` and `truncated: boolean` on detail. Multiple document fields retain named sections. JSON in generated types is not proof of a Tiptap document; validate structure first. Never expose raw editor payloads as readable text.
- Bounded detail relation arrays must report incompleteness (proposed `relations_truncated: string[]`, naming incomplete relation fields). Exact per-relation caps are TBD from representative records; do not silently use the Directus default relation limit. Large reverse collections belong in filtered lists, not recursively expanded detail graphs. Broken/inaccessible required relations must not masquerade as an empty array: fail safely or return an explicit warning for an optional relation.
- Attribution: local `path` values use existing `useSourceUrl`; external links remain distinct from canonical `source_url`. Nullable/sanitized link and asset fields must use validated URL schemas. An asset is proposed as `{id: ID, url: URL|null}`; public delivery mapping and media payload schemas need verification.

These shared proposals are notation for comparing contracts, not a decision to use generic tools or identical envelopes for every operation. Non-applicable operations on embedded/deferred/excluded candidates are explicitly absent.

## Resource contract

Every core collection includes a readable resource and URI template as part of its implementation. See [collection resources](../collection-resources.md) for the required representations, discovery, links and verification. All ten core collections are implemented with their resources and templates. Supporting collections remain embedded.

## Exposure and access

Core means intended standalone discovery and retrieval. Supporting means included through core details; it does not imply standalone public tools. `sectors` intentionally has both roles. All ten core collections are implemented, including podcast series, episodes and the explicitly added videos.

Directus owns record visibility for every collection and nested relation; see [data access responsibilities](../data-access.md). The MCP layer does not implement publication filters or guards. Documentation says Navigator datasets depend on vendor-specific policies; the current service account's grants are TBD. Retain `vendor` where present so callers can distinguish origin. The desk type has no vendor field: do not invent one.

Do not expose staff/review metadata, Directus users, internal notes, sync identifiers or contact data merely because the service token can read them. Public desk/institution contact information is intentional; podcast-host email is not proposed for exposure. Source-returned publication metadata does not establish playback availability. Publication cutoffs and access rules are configured upstream, not enforced by this layer.

## Remaining evidence before implementation

1. Validate non-article ID formats, upstream relation permissions and vendor access with the actual service account.
2. Inspect one permitted representative record per core collection and optional/null relation cases. Resolve string/HTML/Tiptap content formats, geometry encodings, media JSON and asset delivery URLs.
3. Verify actual index existence, countable facets, search fields and hit-to-record identity. In particular resolve `degree` vs `degrees`, `track` vs `tracks`, and FAQ URL/title mapping.
4. Confirm sector canonical routes; FAQ has no path; do not generate either from guesses.
5. Choose relation caps and source availability representation before advertising new schemas. Resource representations and templates are required for each core collection.

The [phase 2 decision](architecture.md) selects shared discovery and collection-specific record operations, preserving current article contracts. Phase 3 preparation is documented in [phase-3.md](phase-3.md); unresolved upstream details still gate live collection rollout.

## Collection descriptions

Collection definitions describe the collection’s purpose, audience, typical questions and information, and its relationships to other collections. Keep comparable detail to the article description. FAQs explain focused factual answers and links to articles; sectors explain their dual role as content and taxonomy; testimonials distinguish personal experience, editorial authors and featured participants. Resources reuse each definition’s description, then add representation and read guidance. Shared catalogue/description tools already consume that same description, so no separate catalogue copy is maintained.

For future collections, Navigator descriptions should distinguish concrete programs, institutions and regional services from explanatory knowledge-base content. Media descriptions should distinguish series, episodes and personal narratives. Use the upstream [Knowledge Base](https://docs.onderwijsloket.com/data-model/families/knowledge-base), [Filters](https://docs.onderwijsloket.com/data-model/families/filters), [Navigator](https://docs.onderwijsloket.com/data-model/families/navigator) and [Media](https://docs.onderwijsloket.com/data-model/families/media) family guides for meaning, while describing only the projections and operations actually implemented. Visibility policy remains upstream as documented in [data access responsibilities](../data-access.md).
