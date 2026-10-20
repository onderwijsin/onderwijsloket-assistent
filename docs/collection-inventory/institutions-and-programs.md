# Institutions and programs

Institutions and programs enable `educational_institutions` and `programs`, with locations, weekly schedules, provider references and program forms embedded through their parents. The server now has six core collections, twenty-two tools and six Markdown resource templates. Existing article, FAQ, sector and testimonial contracts remain unchanged. Standalone location/availability/form tools, exact geographic matching and personalized eligibility decisions remain outside scope.

## Public operations and source filters

| Collection               | Tools                                                                                       | List filters                                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| educational_institutions | list_educational_institutions, get_educational_institution, search_educational_institutions | Exact title, slug, code, brin_code; type/vendor enums; locations UUID array                                                                                                          |
| programs                 | list_programs, get_program, search_programs                                                 | Exact title, slug, croho, crebo; type/level/financing/vendor enums; sectors/qualifications/roles/school_subjects GUID arrays; educational_institutions UUID array; one location UUID |

Shared `get_filters` and `get_facets` accept the collection selector. Dedicated record tools omit it. Both cores use UUID record IDs, including observed deterministic version-five IDs. Registry codes remain strings, preserving leading zeros. Pagination is 1-based, default 10/max 25 with one continuation row. Sorts are `title`, `-title`, `date_updated`, `-date_updated`, followed by ID for stability. Source enum choices are advertised as `enum` in string equality descriptors; search facet values are a separate contract.

Location-ID discovery uses explicit nested lookup paths: institution `locations[].id` through list_educational_institutions and program `location.id` through list_programs. Program provider filters point to list_educational_institutions. No unbounded location/provider enumeration or standalone support collection is needed. Source filters combine AND across dimensions and OR within arrays; the single program location uses equality through `location.id`.

**Degrees are search-only filters.** Directus rejects `_contains` on the JSON degrees field. No source-list `degrees` filter is advertised, and no client-side scan attempts to emulate it. Source and index degrees return human-readable labels such as Bachelor of Education, despite the generated model's code union. Degree arrays therefore retain the delivered strings; they are not translated or guessed. The verified live program level `associate` is accepted alongside generated levels, because it is missing from the generated union.

## Embedded locations and schedules

Locations retain `{id,title,url,address,zip,city,country,location_address,location_geopoint,vendor,opening_hours}`. Optional text/URLs and schedules become explicit nulls. Main and additional institution locations remain separate; a program has one nullable location independent of its form variants. Internal provider IDs, address components and reverse program/institution arrays are excluded.

`location_geopoint` is normalized to nullable GeoJSON `{type: Point, coordinates: [longitude,latitude]}`. The boundary accepts the structured object observed live or its serialized JSON representation, checks finite longitude/latitude ranges and rejects malformed shapes. It does not infer a location, calculate distances or offer coordinate/radius filtering.

Schedules retain ID and each Monday–Sunday enabled flag plus nullable `_start`/`_end` strings. Live values use `HH:mm:ss`; fractional seconds are accepted. Missing times normalize to null. Disabled days with populated times and overnight intervals remain source data; no timezone, overnight interpretation or current availability is invented. Unexpanded location/schedule IDs fail structural validation rather than masquerading as expanded metadata.

Synchronization metadata is excluded from all public projections, including nested records. Each embedded record preserves its own vendor instead of inheriting its parent's provenance. Source visibility at every depth remains a [Directus responsibility](../data-access.md), with no publication or vendor-access policy added locally.

## Institution records

Summaries include identity, title/slug/code/type, canonical source URL, vendor/sync/update metadata, logo, main location and bounded additional locations, content_warnings and relations_truncated. Detail adds Markdown `description`, email/phone, BRIN code, language-tagged websites and document `truncated`. Websites retain Nederlands/Engels/Overig tags; invalid HTTP(S) destinations become null with a warning. Logos use the existing public image asset projection. Description JSON uses the shared document renderer without an invented institution editor_nodes relation; unavailable descriptions emit an explicit warning.

Additional locations unwrap `locations_id`. The query fetches 101 rows sorted by junction sort then ID, returning the first 100. Missing targets emit warnings and the sentinel signals `relations_truncated: [locations]`. Reverse institution programs are not expanded: use list_programs filtered by educational_institutions instead.

## Program records and forms

Summaries include identity/title/slug, canonical URL, type/level, nullable degrees/financing/credits/CROHO/CREBO, source provenance and dates, bounded provider references, nullable location, four taxonomy arrays, content_warnings and relations_truncated. There is no fabricated root body or description. Provider references contain ID/title/type/source_url/logo plus their own vendor/sync metadata; multiple providers stay distinct.

Detail adds nullable croho_name/croho_sector/crebo_profile, ordered program_forms and document `truncated`. Forms retain `{id,sort,url,description,track,vendor,content_warnings,truncated}`. Each description is rendered separately as Markdown with the existing renderer; no form editor_nodes relation is invented. Nullable tracks remain null. Missing documents and unresolved relation blocks emit per-form warnings, also surfaced on the parent with form IDs. Invalid form URLs become null with warnings.

Forms are O2M rows, not a junction to unwrap. Queries select program_id to verify ownership, sort by source sort then ID, and fetch 101/return 100. Orphan or mismatched-parent forms are omitted with an explicit warning. Provider and taxonomy relations have independent 101/100 bounds and missing-target warnings. `relations_truncated` reports capped arrays; top-level `truncated` only aggregates document traversal truncation, preserving the distinction between incomplete documents and incomplete relations.

## Search and resources

| Collection               | Verified facet keys                                                                                                                                  | Hit projection                                                                                     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| educational_institutions | type                                                                                                                                                 | collection, id, title, slug, type, source_url, partial main_location, snippet                      |
| programs                 | type, level, degrees, roles.name, sectors.title, qualifications.name, school_subjects.name, program_forms.track.name, educational_institutions.title | collection, id, title, slug, type, level, degrees, source_url, partial providers/location, snippet |

The verified paths are plural `degrees` and singular `program_forms.track.name`, correcting the older documentation's `degree` and `program_forms.tracks.name`. Degree facets use returned labels, not model codes. Vendor is a source-list filter but not an advertised search facet. Program search providers are flattened index objects, not source junctions; their limited projection omits unavailable vendor/sync fields. Indexed locations expose only ID/title/city/country/geopoint; an indexed opening-hours ID is never interpreted as a schedule. No full indexed descriptions/forms are returned. Index results may lag source updates.

Both cores register resources/templates at `onderwijsloket://{collection}/{id}` with text/markdown. Native resource catalogue callbacks list root-only descriptors, and all six record tools return links. Institution resources render the description with contact/location/provenance metadata in YAML. Program resources render an overview and separate named form sections with provider/location context; front matter retains form metadata/completeness without duplicating rendered form descriptions. Read handlers reuse the collection-specific UUID schemas and getters. There is no additional resource read cache. Existing per-collection catalogue caching remains in use. Both search tools participate in existing opt-in query analytics.

## Evidence and verification

Read-only checks on 2026-10-20 used the configured source/search credentials:

- Sample institution/provider/location/form relationships confirmed target UUIDs, GeoJSON objects, nullable opening schedules, weekly time encodings, rich document shapes and language-tagged websites. Available source responses included Onderwijsloket, HOVI and KiesMBO provenance; access configuration remains upstream.
- A metadata-only scan of 1,014 source programs confirmed degree labels and the additional associate level. A metadata-only scan of 100 institutions confirmed native type/code shapes. No source content or personal-data snapshots are committed.
- A degree containment query returned the source's explicit unsupported-JSON-filter error.
- Live query endpoints exposed nine program facets and one institution facet. Temporary read-only checks executed the actual collection list/get/search/facet methods, including three program details, two institution details, provider/location source filtering and degree search filtering. These checks passed; no permanent live tests or credentials are added.

Synthetic unit and production HTTP tests cover source projections, schema drift, enum discovery, ID filters, codes, GeoJSON/time validation, nullable and unexpanded relations, cross-vendor provenance, independent main/additional locations, form ownership/order/rendering, missing content, relation bounds, exact search paths, resources/catalogues/links, portable schemas and sanitized failures. Node server behavior is verified; a deployed Cloudflare Workers instance is not. Runtime code adds no dependencies or Node-only APIs.

Institution descriptions and program-form descriptions are nullable Markdown. Missing or empty source documents remain `null` in JSON; resource Markdown uses the [shared missing-body notice](../collection-resources.md#missing-body-content), with no generated title substituted for content.
