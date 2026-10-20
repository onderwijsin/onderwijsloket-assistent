# Collection data and public projections

The MCP layer turns source graphs into useful bounded records. It preserves domain identity and source attribution while excluding internal bookkeeping, recursive reverse graphs and invented content. Generated Directus types help build queries, but runtime Zod boundaries establish what the application can actually return: generated optionality, enum unions and JSON/string labels can lag the live source.

## Core and supporting data

Core collections have independent list/get/search tools and Markdown resources. Supporting collections are embedded where their meaning is clear; they do not become extra browsing surfaces simply because a generated source table exists.

| Domain                | Public core records                     | Important embedded relationships                                                                            |
| --------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Knowledge and stories | articles, FAQs, sectors, testimonials   | Taxonomies, linked articles/FAQs/media, evidence sources/documents, editorial authors and featured profiles |
| Training providers    | educational_institutions, programs      | Provider references, main/additional locations, weekly schedules and separately described program forms     |
| Regional guidance     | regional_education_desks                | Service area, physical location, sector context, consultation services and independent phone availability   |
| Podcasts and video    | podcast_shows, podcast_episodes, videos | Hosts, guests/profiles, seasons, media references, transcript/speaker metadata and chapters                 |

`server/utils/projections/` owns reusable public projections. `supporting.ts` covers people/evidence/assets; `navigator.ts` covers providers, locations and schedules; `service-areas.ts` validates coverage geometry; `media.ts` covers hosts, seasons, platform links, speaker maps and media references. Collection modules retain the actual queries and domain rules. Source transport and sanitized boundary errors are shared in `collections/read-records.ts`.

The service never implements publication or release policy. No collection or nested relationship is filtered locally by status or date. Source-returned future publication metadata is retained. Synchronization bookkeeping, private users/reviewers, internal notes and raw processing transcripts are excluded. See [data access responsibilities](data-access.md).

## Identity, archives and relation completeness

Junctions unwrap the actual target key—such as `authors_id`, `profiles_id`, `podcast_hosts_id` or `sectors_id`—instead of returning junction identities. Supporting people retain distinct roles: an author is editorial attribution, a profile is a featured participant, and a podcast host is a presenter. Host email is excluded. Public source URLs follow verified canonical paths; there is no fabricated FAQ or host page.

Taxonomies share `{id,title,source_url,description}`. IDs remain GUID-compatible, including existing non-RFC version bits. Archive links use source paths for topics, roles, qualifications, tracks and school subjects; sectors use root-relative slugs; audiences/phases have null archive URLs. These links explain context; source filter arguments still use IDs. Taxonomy slugs are absent from public references, while core record slugs remain native fields. See [taxonomy lookups](taxonomies.md).

Expanded supporting/taxonomy relations use a 100-record bound plus a sentinel row. `relations_truncated` identifies incomplete arrays, and warnings distinguish unavailable targets from a genuinely empty relationship. Ordering stays explicit where source sort matters. Large reverse graphs are discovered through filtered lists rather than recursive detail expansion: institutions do not embed every program, and shows do not embed every episode.

## Knowledge and stories

Article details enrich readable content with evidence sources, downloadable document references and public author attribution. Lists/search keep their own smaller projections. Asset references expose only identity and documented delivery URLs; unsupported download types retain a null URL rather than an invented destination.

FAQs preserve their native question/answer and linked articles. Sectors have a dual role as filter identity and standalone guidance, with named text sections, actions and ordered featured references. Testimonials keep personal experiences distinguishable from factual eligibility guidance, and featured profiles distinct from editorial authors. Not every collection has an editor-node junction; collections without one do not borrow the article graph.

## Providers, programs and regional guidance

Institutions retain separate main and additional locations, language-tagged websites and public contacts. Programs retain multiple provider identities, a single optional location, registry codes as strings and separate form descriptions/tracks. Forms verify their parent program before attachment. Degree labels come from the live source, and the live associate level extends an outdated generated union. Program degrees filter in search because source JSON containment is unsupported.

Locations preserve structured addresses, their own source vendor and optional opening schedules. GeoJSON Point coordinates remain longitude/latitude and are range-validated; structured and serialized source geometry are accepted. Times are source wall-clock strings, with overnight intervals retained. No timezone, open-now or appointment inference is added.

Desk coverage is independent of a physical location. Areas retain identity/title and nullable Point center, Polygon bounds and MultiPoint samples. Rings are closed and coordinates range-validated; geometry is not silently truncated. An unavailable area relation is null with a coverage warning, never an empty service region. A missing advertised physical location gets a separate warning without erasing coverage. Desk phone availability is distinct from location opening hours. No desk vendor is invented.

Grid samples used by the search index are approximations, not addresses or proof of exact eligibility. [Geographic search](search.md#geographic-search) geocodes location text and applies a radius to indexed grid points; exact polygon coverage tools remain unavailable. Desk array membership filtering is limited by source support; search has its own supported facets.

## Podcast and video content

Shows expose creator, tagline, lifecycle, artwork, hosts and taxonomies; detail adds a nullable description, platform links, optional trailer and bounded seasons. Episodes retain separate show/season references, presenters and guest profiles. Seasons include `show_id`; missing or mismatched ownership is warned rather than attaching unrelated seasons. Series lifecycle is independent of publication policy.

Videos keep featured profiles, taxonomies, native body, media reference, transcript variants, speaker map and chapters. They do not acquire article description fields or podcast relationships. Audio/trailers use source/service references and videos also support the source's legacy id/service form. Verified Directus media identities map to Cloudinary video delivery, including audio. Unsupported/conflicting references yield null and warnings; URLs do not guarantee playback availability.

Transcripts remain nullable source strings, with no detail character cap or inferred text from bodies/snippets. Speaker-attributed and plain versions remain distinct; resources prefer the attributed text when available. Missing speaker indices become null with warnings rather than invented positions. Empty platform placeholders are omitted with warnings; named links with unusable destinations retain null URLs. Native duration values retain their source units, which are not verified. Video chapter offsets are explicitly seconds.

## Readable content and metadata-only records

Document hydration/rendering lives in `server/utils/content/`. Source validators and projections do not package protocol responses or Markdown notices. A missing document, or one rendering to empty text, remains null in JSON before generated headings are considered. Titles and summaries must not manufacture a body. Unsupported nodes, unresolved relations and traversal bounds have independent warnings; `truncated` describes document traversal, not relation bounds.

Resources add visible notices for absent bodies/transcripts while preserving available metadata. They contain native readable content with YAML identity, attribution, relationships, source timestamps and completeness flags. Media binary data is linked, not embedded as Markdown. Representation work stays outside the validated record cache. See [content rendering](content-documents.md), [resources](collection-resources.md) and [cache boundaries](cache.md).

Collection-based synthetic tests protect these contracts and source discrepancies; real SDK HTTP tests protect the public tools/resources. Historical source snapshots and implementation milestones are not the architecture's source of truth: executable schemas, explicit queries and these focused guides are.
