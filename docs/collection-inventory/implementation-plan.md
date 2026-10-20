# Collection implementation plan

Phase 3 prepares the infrastructure; it does not enable live collections beyond articles. This plan groups work by shared data relationships and verified rendering behavior. Each group may be delivered in smaller changes, with only completed collection/tool pairs added to the production allowlist. Tool names and record contracts follow [architecture](architecture.md) and [core contracts](core.md).

## Prepared in phase 3

- `server/collections/index.ts` explicitly enables articles. Shared catalogue, description, filter discovery and facets consume the registry rather than importing articles. Article record entrypoints are named list_articles/get_article/search_articles and omit collection selectors. Their record schemas remain unchanged.
- Collection definitions own ID validation and concrete operation names. Discovery adds `operations` and `resources`; resource support is optional and does not impose article fields on other records.
- Search adapters can declare a precise hit schema, projection, mapper and strict filter object. They retain shared provider transport, snippets and count/pagination behavior. Count discovery is restricted to the declared filter keys for strict adapters; articles retain dynamic facet behavior.
- List-filter discovery targets a concrete list tool. Existing text/boolean/taxonomy builders remain available. Add enum/registry-code/relation-ID descriptor variants with the first collection that actually needs them, rather than building unused variants now.
- `toolResult` packages already validated results as structured content plus JSON text, with resource links only when explicitly supplied.
- A synthetic FAQ-shaped collection tests non-UUID identity, question/answer detail, an independent search hit shape, strict search filters, capability gating and SDK-advertised schemas. It is not registered in production and does not prove live FAQ permissions or document behavior.

The helpers remain internal APIs. Required `id` and `operations` configuration is an intentional internal definition change, separate from the intentional public rename of the article tools and removal of their redundant collection selector. Current article IDs, list/get/search data, resource URIs and filters remain intact. Discovery output has additive operation/resource metadata; descriptions and the internal source of shared discovery schemas change. No new collection is made available by merely generating its Directus types.

## Common exit criteria for every group

1. Read the relevant inventory entries and inspect permitted upstream samples, including null/missing relations. Verify the service account's collection, field, nested relation and vendor access. Do not infer public exposure from token access alone.
2. Resolve ID formats and actual document/media/geometry encodings before choosing Zod schemas. Preserve source nullability and report bounded relationship incompleteness explicitly. No fake page routes, empty article fields or UUID assumptions.
3. Verify configured index identity, hit-to-Directus ID mapping and countable facet names. Strict search schemas expose only verified keys; source-list filters remain separate. A collection may launch with search/facets disabled if these are unresolved, and metadata must say so.
4. Implement one collection definition and its specific static list/get/search entrypoints for supported operations. Reuse `get_filters`/`get_facets`; update the explicit registry only when enabled tool names really exist. A new record tool omits the redundant collection input.
5. Check structured/text results, exact schema fields, source attribution, unknown-key rejection, stable paging, nulls, missing records, provider errors and relation truncation. Use deterministic synthetic HTTP/SDK fixtures; live samples establish evidence but are not regression tests or committed personal data.
6. Preserve article regressions and optional resources. Run formatting, lint, typecheck and relevant unit/HTTP checks. Confirm no Node-only dependency entered runtime code used by Cloudflare Workers. Record remaining deployment-specific validation separately.

## Group 1 — FAQs and sector guidance

**Collections:** `faqs`, `sectors`. **Dependencies:** existing topics, audiences, phases and sectors taxonomy lookups; article references; sector featured FAQ/article/media junctions. No new supporting-person or asset catalogue is required.

**Why together:** both extend knowledge discovery and taxonomy usage while challenging the article-shaped assumptions. FAQ rendering is short answer content; sectors combine filter identity with multiple content sections. They share lookup infrastructure, not one detail schema.

**Order and deliverables:**

1. Replace synthetic FAQ evidence with permitted samples. Confirm answer Tiptap shape and whether it can contain relation nodes without an editor_nodes junction. Verify FAQ record IDs separately from article relation IDs. Keep source_url null until a real canonical route is evidenced.
2. Implement FAQ definition, its three specific entrypoints and index mapping with native question fields. Test plain answers, null/empty metadata, linked articles and invalid/missing IDs.
3. Implement sectors using the same GUID-compatible IDs as filter lookup. Verify the content strings' format, canonical route and null sort placement. Render named sections rather than concatenating an article-like body. Preserve featured-content ordering and M2A target identity; deferred videos remain references only.
4. Enable each independently after its checks. Sectors initially have no facets capability. Add any resource representation only after its descriptors/read behavior are independently specified.

**Release gates:** actual FAQ answer semantics, sector string markup/route, stable sector ordering, relevant index fields and permissions. **Regression focus:** FAQ ID handling and lack of slug/title; sector document ID equals its filter ID; no recursive reverse-content expansion; no unsupported sector facets.

## Group 2 — Article supporting evidence and testimonials

**Collections:** existing `articles` enrichment and new `testimonials`. **Supporting collections:** `sources`, `documents`, `authors`, `profiles`. **Dependencies:** permitted file assets, existing taxonomy and content-document pipeline.

**Why together:** articles and testimonials share body/editor-node rendering and author attribution. Article citations need source/document URLs, while testimonials need featured people. Build those projections once at their demonstrated relationship boundary; neither authors nor profiles become standalone tools.

**Order and deliverables:**

1. Verify public source/document URLs, asset delivery mapping and allowed author/profile fields. Keep internal reviewer/team relations and host email out. Resolve optional profile body rendering separately from minimal ProfileRef attribution.
2. Add focused source, document, author and profile projection/normalization helpers only where both parents need them. Unwrap real junction targets, preserve source IDs and avoid recursive reverse relations.
3. Add article supporting arrays as a documented additive contract change. Preserve every existing summary/detail field and resource representation. Define per-relation caps and additive completeness reporting before adding arrays; do not reinterpret the current document `truncated` flag.
4. Implement testimonial list/get/search with publication metadata, authors/profiles and resolved body nodes. Keep personal experience distinguishable from factual guidance in tool descriptions.

**Release gates:** future-publication and null-date behavior, visibility of body/assets/snippets in each state, source/file authorization and relation bounds. Do not launch testimonials while readable availability could be inferred incorrectly from discoverability. **Regression focus:** citations resolve beyond Algolia's partial references; authors versus profiles remain distinct; embargoed content cannot leak via search/resources/embedded nodes; no article API regression.

## Group 3 — Institutions and programs

**Collections:** `educational_institutions`, `programs`. **Embedded dependencies:** `locations`, `availabilities`, `program_forms`; institution/program/location junctions; qualifications, roles, sectors, school subjects and form track taxonomies.

**Why together:** provider identity and locations underpin both domains. Implement institution references before program detail so programs can return useful providers rather than bare keys. Program forms belong to a program; they are not equivalent to its single nullable location.

**Order and deliverables:**

1. Verify permitted vendors and retain vendor/last_sync metadata. Resolve address/geopoint encoding and opening-hour time semantics. Implement bounded Location and Availability projections without provider/internal sync identifiers.
2. Implement institution list/get/search, including main location, additional locations and language-tagged websites. Expose program linkage through filtered program lists rather than an unbounded institution detail graph.
3. Add enum and relation-ID filter descriptors/builders needed by these collections. Keep accepted enum values in the actual source unions. Relation discovery points to the relevant public list tool rather than enumerating every institution or pretending relation IDs are taxonomy choices.
4. Implement program registry-code/enum/taxonomy filters and per-form descriptions with nullable track. Preserve CROHO/CREBO as strings and keep forms ordered and separate.
5. Verify search mappings before enabling them: documented `degree` versus generated `degrees`, and `program_forms.tracks.name` versus source `track`, must be resolved through actual permitted index evidence. Keep source list and search filters independent.

**Release gates:** vendor license/policy grants; geometry/time encodings; program-form document shape; institution/program relation bounds; actual search keys. **Regression focus:** permitted vendor isolation across nested references, null locations, multiple providers, ordered forms, leading-zero codes, declared enum boundaries and correct junction filters. No geo search tool is included.

## Group 4 — Regional education desks and service coverage

**Collection:** `regional_education_desks`. **Embedded dependencies:** `areas`; reuse locations, availability and asset projections from group 3. **Prerequisite:** group 3's location/availability boundary can be extracted and shipped first if desks are prioritized ahead of programs.

**Why separate:** desk coverage and consultation services have materially different meaning from provider locations. Shared addresses do not justify sharing a detail schema or promising exact geographic matching.

**Order and deliverables:**

1. Verify required area expansion, serialized center/bounds/inner geometry formats, publication permissions and actual null cases. Do not fabricate a vendor field or expose internal notes.
2. Implement list/detail with flattened area, optional physical location, public contacts, service links and distinct phone/opening availability. Render description and consultation-service description as separate named fields.
3. Implement strict search using verified regions/cities/service facets. Keep the provider grid approximation separate from real physical location and exact coverage. Add enum-array discovery variants for actual service/activity filters.
4. Enable list/get/search as each contract is ready. Defer a geo-specific operation until coordinate order, units/radius bounds, matching semantics and approximation caveats have a dedicated tested contract.

**Release gates:** required relation handling, geometry encodings, service descriptions, availability consistency and countable search fields. **Regression focus:** inaccessible area is not an empty service region; nullable location does not erase coverage; false booleans remain filters; no inference that area grid points are an address or proof of exact service eligibility.

## Group 5 — Podcast series and episodes

**Collections:** `podcast_shows`, `podcast_episodes`. **Supporting collections:** `podcast_hosts`, reuse `profiles`. **Embedded dependencies:** `seasons`, file/media assets, relevant taxonomy and host/guest junctions. **Prerequisite:** group 2's person/asset boundary and publication policy can be reused; verify podcast-specific payloads independently.

**Why together:** shows, seasons and episodes have required relationships and shared host identity. Deliver show references and hosts before episode detail. A host and a guest profile remain separate roles; season identity must agree with show identity.

**Order and deliverables:**

1. Verify show description and episode body documents without assuming an editor_nodes relation. Resolve audio/trailer JSON structure, URL delivery, duration units, publication cutoff/timezone and null-date behavior. Exclude host email and raw processing/transcription internals.
2. Implement bounded host and season projections, show list/detail/search, podcast_status and external platform URLs. List episodes through a show filter instead of embedding an entire series.
3. Implement episode list/detail/search with show/season, ordered episode metadata, hosts/guests and nullable readable transcripts. Preserve speaker mapping when allowed; never invent transcript text from episode descriptions or search snippets.
4. Verify that search and embedded references obey the publication policy. Resource candidates for descriptions/transcripts require separate descriptor/read verification; audio is not a Markdown resource.

**Release gates:** media schemas/units, future and null publication states, transcript/speaker permissions and show/season consistency. **Regression focus:** future-dated discoverability versus playback/readability; null transcripts; accurate show/season/host/guest identity; no dead media links or false full-content guarantees.

## Scope after these groups

The groups cover every requested core and supporting collection. Standalone supporting collections, videos, route/question/answer workflows, geocoding and exact geographic matching remain excluded or deferred as recorded in the inventory. Do not enable them as a side effect of reference expansion. Optional resources are follow-up work per collection, not a prerequisite for tool-only access.

No timeline or effort estimate is assumed before the live evidence gates are resolved. The default order is groups 1 → 2 → 3 → 4 → 5; each collection can release independently when its prerequisites and contracts pass. No additional generic tool factory, dependency, registry discovery mechanism or further article migration is required by this plan.
