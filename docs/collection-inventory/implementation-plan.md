# Collection implementation plan

Shared infrastructure supports the implemented articles, FAQs, sectors, testimonials, institutions and programs. See [FAQ and sector guidance](faqs-and-sectors.md), [article evidence and testimonials](article-evidence-and-testimonials.md) and [institutions and programs contracts and evidence](institutions-and-programs.md). This plan organizes work by shared data relationships and verified rendering behavior. Each collection domain may be delivered in smaller changes, with only completed collection/tool pairs added to the production allowlist. Tool names and record contracts follow [architecture](architecture.md) and [core contracts](core.md).

## Prepared in phase 3

- `server/collections/index.ts` explicitly enables articles. Shared catalogue, description, filter discovery and facets consume the registry rather than importing articles. Article record entrypoints are named list_articles/get_article/search_articles and omit collection selectors. Their record schemas remain unchanged.
- Collection definitions own ID validation and concrete operation names. Discovery adds `operations` and `resources`; every core must provide resources/templates using its own native fields. The generic helper remains usable by resource-free test fixtures.
- Search adapters can declare a precise hit schema, projection, mapper and strict filter object. They retain shared provider transport, snippets and count/pagination behavior. Count discovery is restricted to the declared filter keys for strict adapters; articles retain dynamic facet behavior.
- List-filter discovery targets a concrete list tool. Existing text/boolean/taxonomy builders remain available. Add enum/registry-code/relation-ID descriptor variants with the first collection that actually needs them, rather than building unused variants now.
- `toolResult` packages already validated results as structured content plus JSON text, with resource links only when explicitly supplied.
- A synthetic FAQ-shaped collection tests non-UUID identity, question/answer detail, an independent search hit shape, strict search filters, capability gating and SDK-advertised schemas. It is not registered in production and does not prove live FAQ permissions or document behavior.

The helpers remain internal APIs. Required `id` and `operations` configuration is an intentional internal definition change, separate from the intentional public rename of the article tools and removal of their redundant collection selector. Current article IDs, list/get/search data, resource URIs and filters remain intact. Discovery output has additive operation/resource metadata; descriptions and the internal source of shared discovery schemas change. No new collection is made available by merely generating its Directus types.

All collections follow [data access responsibilities](../data-access.md): Directus owns visibility at every depth. Do not implement status filters, status guards or release-date gates in list/detail/search/resource paths. Upstream permission checks below concern source configuration, not application policy.

## Common exit criteria for every collection

1. Read the relevant inventory entries and inspect permitted upstream samples, including null/missing relations. Verify the service account's collection, field, nested relation and vendor access. Do not infer public exposure from token access alone.
2. Resolve ID formats and actual document/media/geometry encodings before choosing Zod schemas. Preserve source nullability and report bounded relationship incompleteness explicitly. No fake page routes, empty article fields or UUID assumptions.
3. Verify configured index identity, hit-to-Directus ID mapping and countable facet names. Strict search schemas expose only verified keys; source-list filters remain separate. A collection may launch with search/facets disabled if these are unresolved, and metadata must say so.
4. Implement one collection definition and its specific static list/get/search entrypoints for supported operations. Reuse `get_filters`/`get_facets`; update the explicit registry only when enabled tool names really exist. A new record tool omits the redundant collection input.
5. Check structured/text results, exact schema fields, source attribution, unknown-key rejection, stable paging, nulls, missing records, provider errors and relation truncation. Use deterministic synthetic HTTP/SDK fixtures; live samples establish evidence but are not regression tests or committed personal data.
6. Register the collection resource template and complete catalogue callback, map native fields to Markdown/front matter and return links from list/get/search tools. Verify template/catalogue/read discovery, collection-specific IDs, warnings and sanitized errors. Follow [collection resources](../collection-resources.md).
7. Preserve article regressions and resources. Run formatting, lint, typecheck and relevant unit/HTTP checks. Confirm no Node-only dependency entered runtime code used by Cloudflare Workers. Record remaining deployment-specific validation separately.

## FAQs and sector guidance (implemented)

**Collections:** `faqs`, `sectors`. **Dependencies:** existing topics, audiences, phases and sectors taxonomy lookups; article references; sector featured FAQ/article/media junctions. No new supporting-person or asset catalogue is required.

**Why together:** both extend knowledge discovery and taxonomy usage while challenging the article-shaped assumptions. FAQ rendering is short answer content; sectors combine filter identity with multiple content sections. They share lookup infrastructure, not one detail schema.

**Order and deliverables:**

1. Replace synthetic FAQ evidence with permitted samples. Confirm answer Tiptap shape and whether it can contain relation nodes without an editor_nodes junction. Verify FAQ record IDs separately from article relation IDs. Keep source_url null until a real canonical route is evidenced.
2. Implement FAQ definition, its three specific entrypoints and index mapping with native question fields. Test plain answers, null/empty metadata, linked articles and invalid/missing IDs.
3. Implement sectors using the same GUID-compatible IDs as filter lookup. Verify the content strings' format, canonical route and null sort placement. Render named sections rather than concatenating an article-like body. Preserve featured-content ordering and M2A target identity; deferred videos remain references only.
4. Enable each independently after its checks. Sectors initially have no facets capability. FAQ and sector resources/templates and tool links are implemented; keep their descriptor/read contracts covered.

**Release gates:** actual FAQ answer semantics, sector string markup/route, stable sector ordering, relevant index fields and permissions. **Regression focus:** FAQ ID handling and lack of slug/title; sector document ID equals its filter ID; no recursive reverse-content expansion; no unsupported sector facets.

## Article supporting evidence and testimonials (implemented)

**Collections:** existing `articles` enrichment and new `testimonials`. **Supporting collections:** `sources`, `documents`, `authors`, `profiles`. **Dependencies:** permitted file assets, existing taxonomy and content-document pipeline.

**Why together:** articles and testimonials share body/editor-node rendering and author attribution. Article citations need source/document URLs, while testimonials need featured people. Build those projections once at their demonstrated relationship boundary; neither authors nor profiles become standalone tools.

**Order and deliverables:**

1. Verify public source/document URLs, asset delivery mapping and allowed author/profile fields. Keep internal reviewer/team relations and host email out. Resolve optional profile body rendering separately from minimal ProfileRef attribution.
2. Add focused source, document, author and profile projection/normalization helpers only where both parents need them. Unwrap real junction targets, preserve source IDs and avoid recursive reverse relations.
3. Add article supporting arrays as a documented additive contract change. Preserve every existing summary/detail field and resource representation. Define per-relation caps and additive completeness reporting before adding arrays; do not reinterpret the current document `truncated` flag.
4. Implement testimonial list/get/search and its required resource/template with story Markdown, publication metadata, authors/profiles and resolved body nodes. Keep personal experience distinguishable from factual guidance in tool descriptions.

**Resolved:** source date nullability, body/editor-node shape, minimal person projections, source URLs, PDF/image asset delivery and relation bounds; see [article evidence and testimonials](article-evidence-and-testimonials.md). Unknown non-image document delivery remains explicit null, and profile biographies remain outside minimal attribution. **Regression focus:** citations resolve beyond Algolia's partial references; authors versus profiles remain distinct; source-returned records remain independent of status/date metadata; no article API regression.

## Institutions and programs (implemented)

**Collections:** `educational_institutions`, `programs`. **Embedded dependencies:** `locations`, `availabilities`, `program_forms`; institution/program/location junctions; qualifications, roles, sectors, school subjects and form track taxonomies.

**Why together:** provider identity and locations underpin both domains. Implement institution references before program detail so programs can return useful providers rather than bare keys. Program forms belong to a program; they are not equivalent to its single nullable location.

**Order and deliverables:**

1. Verify permitted vendors and retain vendor metadata. Resolve address/geopoint encoding and opening-hour time semantics. Implement bounded Location and Availability projections without provider/internal sync identifiers.
2. Implement institution list/get/search and its resource/template, including description, contacts, main location, additional locations and language-tagged websites. Expose program linkage through filtered program lists rather than an unbounded institution detail graph.
3. Add enum and relation-ID filter descriptors/builders needed by these collections. Keep accepted enum values in the actual source unions. Relation discovery points to the relevant public list tool rather than enumerating every institution or pretending relation IDs are taxonomy choices.
4. Implement program registry-code/enum/taxonomy filters and per-form descriptions with nullable track. Add its resource/template with overview, providers, locations and separately named form sections. Preserve CROHO/CREBO as strings and keep forms ordered and separate.
5. Verify search mappings before enabling them: documented `degree` versus generated `degrees`, and `program_forms.tracks.name` versus source `track`, must be resolved through actual permitted index evidence. Keep source list and search filters independent.

**Resolved:** source projections and upstream access, GeoJSON/time encodings, form document rendering/ownership, bounded relationships and verified search keys; see [institutions and programs](institutions-and-programs.md). Degree filtering is search-only because source JSON filtering is unsupported. Degree labels and the live associate level override stale generated assumptions; unavailable location sync time remains null. **Regression focus:** distinct source provenance across nested references, null locations, multiple providers, ordered forms, leading-zero codes, declared enum boundaries and correct junction filters. No geo search tool is included.

## Regional education desks and service coverage

**Collection:** `regional_education_desks`. **Embedded dependencies:** `areas`; reuse the implemented location, availability and asset projections from institutions and programs.

**Why separate:** desk coverage and consultation services have materially different meaning from provider locations. Shared addresses do not justify sharing a detail schema or promising exact geographic matching.

**Order and deliverables:**

1. Verify required area expansion, serialized center/bounds/inner geometry formats, publication permissions and actual null cases. Do not fabricate a vendor field or expose internal notes.
2. Implement list/detail and a resource/template with flattened area, optional physical location, public contacts, service links and distinct phone/opening availability. Render description and consultation-service description as separate named fields.
3. Implement strict search using verified regions/cities/service facets. Keep the provider grid approximation separate from real physical location and exact coverage. Add enum-array discovery variants for actual service/activity filters.
4. Enable list/get/search as each contract is ready. Defer a geo-specific operation until coordinate order, units/radius bounds, matching semantics and approximation caveats have a dedicated tested contract.

**Release gates:** required relation handling, geometry encodings, service descriptions, availability consistency and countable search fields. **Regression focus:** inaccessible area is not an empty service region; nullable location does not erase coverage; false booleans remain filters; no inference that area grid points are an address or proof of exact service eligibility.

## Podcast series and episodes

**Collections:** `podcast_shows`, `podcast_episodes`. **Supporting collections:** `podcast_hosts`, reuse `profiles`. **Embedded dependencies:** `seasons`, file/media assets, relevant taxonomy and host/guest junctions. **Prerequisite:** reuse the implemented person/asset projections and verify podcast-specific payloads independently.

**Why together:** shows, seasons and episodes have required relationships and shared host identity. Deliver show references and hosts before episode detail. A host and a guest profile remain separate roles; season identity must agree with show identity.

**Order and deliverables:**

1. Verify show description and episode body documents without assuming an editor_nodes relation. Resolve audio/trailer JSON structure, URL delivery, duration units, publication metadata format and nullability. Exclude host email and raw processing/transcription internals.
2. Implement bounded host and season projections, show list/detail/search, podcast_status and external platform URLs. List episodes through a show filter instead of embedding an entire series.
3. Implement episode list/detail/search with show/season, ordered episode metadata, hosts/guests and nullable readable transcripts. Preserve speaker mapping when allowed; never invent transcript text from episode descriptions or search snippets.
4. Verify that search and embedded references follow the upstream visibility boundary without local publication guards. Implement required show and episode resource/templates with verified descriptor/read mappings. Show resources contain series guidance, hosts and links; episode resources contain metadata and available transcript, including explicit absence. Audio is not a Markdown resource.

**Release gates:** media schemas/units, date metadata nullability, transcript/speaker permissions and show/season consistency. **Regression focus:** source availability representation without date-based omission; null transcripts; accurate show/season/host/guest identity; no dead media links or false full-content guarantees.

## Remaining scope

The plan covers every requested core and supporting collection. Standalone supporting collections, videos, route/question/answer workflows, geocoding and exact geographic matching remain excluded or deferred as recorded in the inventory. Do not enable them as a side effect of reference expansion. Resources and URI templates are required deliverables for every core collection; their registration and tests belong in each collection implementation.

No timeline or effort estimate is assumed before the live evidence gates are resolved. Implemented domains are listed first; regional education desks and podcasts remain planned. Each collection can release independently when its prerequisites and contracts pass. No additional generic tool factory, dependency, registry discovery mechanism or further article migration is required by this plan.

Every future core implementation must follow the [shared missing-body contract](../collection-resources.md#missing-body-content): nullable JSON content, preserved metadata and a globally formatted Markdown notice for missing source content.
