# Core collection contracts

All nine collections are intended public collections by the supplied scope. Articles, FAQs and sectors are implemented; [FAQ and sector guidance](faqs-and-sectors.md) is authoritative for the final FAQ/sector contracts and evidence. Read the common limits, null rules and evidence levels in [README](README.md); source field types and exact enums are in [schema evidence](schema-evidence.md). Search fields/facets and hit projections are in [search evidence](search.md). `Taxonomy`, `Area`, `Location`, `Season`, `Author`, `Document`, `Source` and reference shapes are specified in [dependencies](dependencies.md).

## articles

- **Purpose / audience:** Factual guidance for prospective education professionals and advisers.
- **Source / exposure:** Directus `articles` (`Article`); documented Algolia `articles` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Implemented list/get/search/filter discovery/facets and Markdown resources. Implemented supporting source/document/author references in detail; existing fields and behavior retained.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug (exact); english (boolean); sectors, qualifications, audiences, phases, roles, topics, tracks (GUID arrays). Sort allowlist: `title, -title, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, description:string, summary:string, english:boolean|null; sectors, qualifications, roles, topics, tracks:Taxonomy[].
- **Detail:** summary plus content:Markdown|null, content_warnings:string[], truncated:boolean (implemented). Proposed additive authors:Author[], documents:Document[], sources:Source[], faqs:FaqRef[].
- **Relationships / transformations:** articles.authors.authors_id → authors; documents.documents_id → documents; sources.sources_id → sources; faqs.faqs_id → faqs. Taxonomies unwrap <name>_id. Render body with ArticlesEditorNode expansions. Audiences/phases are filters but are not current summary fields.
- **Distinct behavior / unresolved evidence:** Strict UUID implemented. Resources: onderwijsloket://articles/{id}, text/markdown with YAML front matter. No character cap; traversal limits apply. Optional missing date_updated/english become null. Supporting detail expansion is implemented; see [article evidence and testimonials](article-evidence-and-testimonials.md).
- **Evidence / status:** local `Article` interface and related junctions; API family/index documentation. Articles behavior verified in `articles.ts`; all additions/new collections are proposals requiring live fixtures, permission checks and the stated TBD resolutions.

## sectors

Implemented in faq and sector guidance; see [the implementation contract](faqs-and-sectors.md). The proposal below records the phase 1 comparison and is superseded where faq and sector guidance differs.

- **Purpose / audience:** Sector guidance for readers; reusable filter vocabulary for all tagged content.
- **Source / exposure:** Directus `sectors` (`Sector`); documented Algolia `sectors` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Proposed list/get/search/filter discovery. No documented facets, so no useful facet operation until evidence changes. Implemented Markdown resource/template with named guidance sections; see [collection resources](../collection-resources.md).
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug, code (exact). Sort allowlist: `sort, -sort, title, -title`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, code:string, description:string, alt_names:string[]|null, icon:string|null.
- **Detail:** summary plus introduction, roles_content, routes_content, salary_content, costs_content: string|null; costs_actions:{label:string,link:string,internal:boolean}[]|null; salary_cards:{title,description,link,link_label,link_internal,icon:string}[]|null; featured_articles:ArticleRef[], featured_faqs:FaqRef[], featured_media:MediaRef[].
- **Relationships / transformations:** featured_articles.articles_id; featured_faqs.faqs_id; featured_media is M2A {collection,item,sort}. Preserve ordering and collection discriminator; videos remain a deferred reference. Do not expand all reverse articles/programs/media.
- **Distinct behavior / unresolved evidence:** Use GUID ID compatibility because sectors already serve taxonomy filters. No path field exists; canonical page mapping TBD. Content sections are upstream strings, not JSON documents; actual markup format TBD before Markdown conversion. routes_content is sector prose, not permission to implement route traversal. sort is nullable upstream: null placement TBD.
- **Evidence / status:** local `Sector` interface and related junctions; API family/index documentation. Articles behavior verified in `articles.ts`; all additions/new collections are proposals requiring live fixtures, permission checks and the stated TBD resolutions.

## faqs

Implemented in faq and sector guidance; see [the implementation contract](faqs-and-sectors.md). The proposal below records the phase 1 comparison and is superseded where faq and sector guidance differs.

- **Purpose / audience:** Concise factual answers for readers and advisers.
- **Source / exposure:** Directus `faqs` (`Faq`); documented Algolia `faqs` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Proposed list/get/search/filter discovery/facets. Implemented Markdown resource/template; question supplies the descriptor title and answer supplies the body. No native title/description/slug.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: question (exact); english:boolean; sectors, audiences, phases, topics (GUID arrays); articles (relation IDs, via articles.articles_id). Sort allowlist: `question, -question, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus question:string, english:boolean|null; sectors, audiences, phases, topics:Taxonomy[]. No invented summary/excerpt field.
- **Detail:** summary plus answer:Markdown|null, content_warnings:string[], truncated:boolean, articles:ArticleRef[].
- **Relationships / transformations:** FAQ answer is JSON. There is no Faq.editor_nodes relation in the generated schema. Render plain Tiptap answer only after structure verification; embedded relation nodes cannot assume an article junction context. articles is ArticlesFaq[] and must unwrap articles_id.
- **Distinct behavior / unresolved evidence:** ID is string upstream; format TBD. No slug/path/description fields: source_url is null unless a canonical route is verified; cite linked articles separately. Search question→title mapping must be explicit rather than requiring article fields.
- **Evidence / status:** local `Faq` interface and related junctions; API family/index documentation. Articles behavior verified in `articles.ts`; all additions/new collections are proposals requiring live fixtures, permission checks and the stated TBD resolutions.

## programs

- **Purpose / audience:** Compare education pathways, qualifications and providers for prospective students/advisers.
- **Source / exposure:** Directus `programs` (`Program`); documented Algolia `programs` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Implemented list/get/search/filter discovery/facets and Markdown resource/template with overview and named form descriptions. Geo search is a possible future operation; input/matching semantics TBD.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug, croho, crebo (exact); type, level, financing, vendor (source enums); sectors, qualifications, roles, school_subjects (GUID arrays); educational_institutions (ID array); location (ID). Sort allowlist: `title, -title, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, type:Program.type, level:Program.level, degrees:string[]|null (live display labels), financing:Program.financing|null, credits:number|null, croho:string|null, crebo:string|null, vendor:Program.vendor; educational_institutions:InstitutionRef[], location:Location|null; sectors, qualifications, roles, school_subjects:Taxonomy[].
- **Detail:** summary plus program_forms:ProgramForm[]; croho_name, croho_sector, crebo_profile:string|null; content_warnings:string[], relations_truncated:string[], truncated:boolean for rendered form descriptions.
- **Relationships / transformations:** educational_institutions.educational_institutions_id; location is one nullable Location, not an array; program_forms are O2M ProgramForm rows, each with program_id and track. Taxonomies use junctions.
- **Distinct behavior / unresolved evidence:** No body or description exists on Program. Preserve individual forms; do not merge competing provider descriptions. The live associate level extends the generated level union. Degrees are display labels and cannot be filtered in source lists; use the verified search facet. Upstream permissions own vendor visibility. Registry codes remain strings, preserving leading zeros.
- **Evidence / status:** local `Program` interface and related junctions; API family/index documentation. Live projections, ID mapping, search facets and synthetic contracts are verified in [institutions and programs](institutions-and-programs.md).

## regional_education_desks

- **Purpose / audience:** Find regional guidance, contact options and service coverage.
- **Source / exposure:** Directus `regional_education_desks` (`RegionalEducationDesk`); documented Algolia `regional_education_desks` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Implemented list/get/search/filter discovery/facets. Implemented Markdown resource/template with desk/service descriptions, coverage and contacts. Domain-specific area matching is TBD; no coordinates/radius API promised in phase 1.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Implemented source filter keys: title, slug (exact); sectors (GUID arrays); has_consultation_service, has_physical_location, appointment_for_visit (boolean); JSON-array membership filters are unsupported by Directus; use search facets for activity/content types and query for regions/cities. Sort allowlist: `title, -title, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, website:URL|null, email:string|null, phone:string|null; has_consultation_service, has_physical_location, appointment_for_visit:boolean; area:Area|null; location:Location|null; sectors:Taxonomy[]; regions:string[]|null; cities_municipalities:string|null.
- **Detail:** summary plus description:Markdown|null, consultation_service_description:Markdown|null; consultation_service_url:URL|null; phone_availability:Availability|null; email_response_time:source enum|null; service_links:{url:URL,type:source enum,domain:string}[]|null; orientation_activity_types, content_types:source-enum arrays|null; content_warnings:string[], truncated:boolean.
- **Relationships / transformations:** area is a required upstream M2O → areas, represented as null with a coverage warning when unavailable; include title, area_center, area_bounds, area_inner, not just its ID. location → locations including opening_hours → availability. phone_availability → availabilities independently of location opening hours.
- **Distinct behavior / unresolved evidence:** No vendor field. notes are internal and excluded. Structured or serialized GeoJSON Point/Polygon/MultiPoint is validated without reordering coordinates. Algolia area grid points are an approximation, not the desk address or exact point-in-polygon coverage. has_physical_location does not guarantee a populated location; preserve null and warn on inconsistency.
- **Evidence / status:** local `RegionalEducationDesk` interface and related junctions; API family/index documentation. Live source/search projections and synthetic regression contracts are verified in [regional education desks](regional-education-desks.md).

## educational_institutions

- **Purpose / audience:** Discover programme providers, their locations and public contact details.
- **Source / exposure:** Directus `educational_institutions` (`EducationalInstitution`); documented Algolia `educational_institutions` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Implemented list/get/search/filter discovery/facets and Markdown resource/template with institution description, contacts and locations. Program catalogue is retrieved through filtered program lists, not unbounded recursion.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug, code, brin_code (exact); type, vendor (source enums); locations (ID array via locations.locations_id). Sort allowlist: `title, -title, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, code:string, type:EducationalInstitution.type, vendor:EducationalInstitution.vendor; logo:Asset|null; main_location:Location|null; locations:Location[].
- **Detail:** summary plus description:Markdown; email:string|null, phone:string|null, website:{url:URL,lang: Nederlands|Engels|Overig}[]|null; brin_code:string|null; content_warnings:string[], truncated:boolean. Related programs use programs filter educational_institutions; bounded references only if needed.
- **Relationships / transformations:** locations.locations_id → locations; main_location → locations separately. programs.programs_id → programs for reverse references only. Include structured location/address/geo and opening_hours rather than bare foreign keys.
- **Distinct behavior / unresolved evidence:** description is JSON but there is no institution editor_nodes relation in the type. Rich relation-node support TBD. Website is a language-tagged array, not one string. main_location need not duplicate every listed location. HOVI/KiesMBO IDs and pending-change/reviewer metadata are excluded.
- **Evidence / status:** local `EducationalInstitution` interface and related junctions; API family/index documentation. Live queries, resource/search contracts and missing descriptions are verified in [institutions and programs](institutions-and-programs.md).

## testimonials

- **Purpose / audience:** Personal experience for prospective entrants; not a source of general eligibility rules.
- **Source / exposure:** Directus `testimonials` (`Testimonial`); documented Algolia `testimonials` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Implemented list/get/search/filter discovery/facets and Markdown resource/template with story and attribution.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug (exact); sectors, audiences, phases, roles, topics, tracks (GUID arrays); authors, profiles (ID arrays). Sort allowlist: `title, -title, publication_date, -publication_date`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, description:string, summary:string, publication_date:string|null; sectors, audiences, phases, roles, topics, tracks:Taxonomy[]; profiles:ProfileRef[], authors:Author[], content_warnings:string[], relations_truncated:string[].
- **Detail:** summary plus content:Markdown and truncated:boolean; summaries already include content_warnings and relations_truncated.
- **Relationships / transformations:** body plus TestimonialsEditorNode[]; authors.authors_id; profiles.profiles_id; taxonomy junctions. Keep featured people separate from authors.
- **Distinct behavior / unresolved evidence:** Represent source availability explicitly; do not replace missing body with an apparently complete empty document. Directus owns publication visibility; no local date/status gates. No english flag exists.
- **Evidence / status:** local `Testimonial` interface and related junctions; API family/index documentation. Live read-only SDK/index checks and synthetic regressions verified; see [article evidence and testimonials](article-evidence-and-testimonials.md).

## podcast_episodes

- **Purpose / audience:** Discover individual audio conversations and retrieve readable transcripts.
- **Source / exposure:** Directus `podcast_episodes` (`PodcastEpisode`); documented Algolia `podcast_episodes` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Proposed list/get/search/filter discovery/facets. Required Markdown resource/template with episode metadata and available transcript; missing transcript does not disable the resource. Never advertise audio binary as a Markdown resource.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug (exact); show, season (single IDs); hosts, guests (ID arrays); sectors, audiences, phases, roles, topics, tracks (GUID arrays); episode_number (integer, valid range TBD). Sort allowlist: `publication_date, -publication_date, episode_number, -episode_number`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, duration:number, episode_number:number, publication_date:string|null; show:ShowRef, season:Season; hosts:PodcastHost[], guests:ProfileRef[]; sectors, audiences, phases, roles, topics, tracks:Taxonomy[].
- **Detail:** summary plus content:Markdown from body; transcript_string:string|null; transcript_string_with_speakers:string|null; speaker_map:{speaker:number,name:string}[]|null; external_urls:{name:source enum,url:URL}[]|null; audio:normalized media|null (schema TBD); content_warnings:string[], truncated:boolean.
- **Relationships / transformations:** show and season are required M2O; season includes show identity so mismatches can be detected. hosts.podcast_hosts_id and guests.profiles_id flatten separately. No episode editor_nodes field exists.
- **Distinct behavior / unresolved evidence:** No description field; never require an article-shaped description. Audio JSON and duration units TBD; generated number does not prove positive integer seconds. Missing transcript is explicit null, not an inferred transcript from the description. Directus owns visibility of assets and transcripts; no local publication gates.
- **Evidence / status:** local `PodcastEpisode` interface and related junctions; API family/index documentation. Articles behavior verified in `articles.ts`; all additions/new collections are proposals requiring live fixtures, permission checks and the stated TBD resolutions.

## podcast_shows

- **Purpose / audience:** Discover a podcast series, hosts, release state and its episodes.
- **Source / exposure:** Directus `podcast_shows` (`PodcastShow`); documented Algolia `podcast_shows` index. Intended public core collection; sectors additionally supply filter metadata.
- **Operations / resources:** Proposed list/get/search/filter discovery/facets. Required Markdown resource/template for series description, hosts and platform links, not an unbounded episode dump.
- **Inputs:** get requires `id`; list uses the shared optional pagination/filter contract. Proposed/implemented filter keys: title, slug, creator_name (exact); podcast_status (ongoing|ended|planned); sectors, audiences, phases (GUID arrays); hosts (ID arrays). Sort allowlist: `title, -title, date_updated, -date_updated`. No domain-specific inputs beyond those explicitly described. Search/facet parameters follow search evidence.
- **Summary:** common keys plus title:string, slug:string, creator_name:string, tagline:string, podcast_status:ongoing|ended|planned; artwork:Asset|null; hosts:PodcastHost[]; sectors, audiences, phases:Taxonomy[].
- **Detail:** summary plus description:Markdown; header_image:Asset|null; trailer:normalized media|null (schema TBD); external_urls:{name:source enum,url:URL}[]|null; seasons:Season[]; content_warnings:string[], truncated:boolean. Retrieve episodes via list filter show rather than expanding the full series.
- **Relationships / transformations:** hosts.podcast_hosts_id → podcast_hosts; seasons is O2M; episodes is O2M. Never treat hosts as profiles.
- **Distinct behavior / unresolved evidence:** description is JSON; no show editor_nodes relation exists. podcast_status is release state, independent of Directus publication status. Arrays may be empty; missing/inaccessible host data must be distinguished from an empty host list. Trailer shape and resource description mapping TBD.
- **Evidence / status:** local `PodcastShow` interface and related junctions; API family/index documentation. Articles behavior verified in `articles.ts`; all additions/new collections are proposals requiring live fixtures, permission checks and the stated TBD resolutions.
