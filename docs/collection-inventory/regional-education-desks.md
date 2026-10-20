# Regional education desks and service coverage

Implemented `regional_education_desks` with embedded `areas`, shared locations/availability, logo assets and sector taxonomy. No standalone area/location tool or geographic matching operation is introduced. Visibility at every relation depth remains a [Directus responsibility](../data-access.md).

## Public operations

| Operation                         | Contract                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_regional_education_desks`   | Exact `title`/`slug`, sector-ID arrays and boolean `has_consultation_service`, `has_physical_location`, `appointment_for_visit`; one-based pagination, maximum 25 records |
| `get_regional_education_desk`     | UUID; expanded coverage, contacts, location, desk/service descriptions and independent phone availability                                                                 |
| `search_regional_education_desks` | Text search/browse and four verified facets; lightweight hits, no geometry expansion                                                                                      |
| Shared discovery                  | `list_collections`, `describe_collection`, `get_filters`, `get_facets`                                                                                                    |
| Resource/template                 | `onderwijsloket://regional_education_desks/{id}`, `text/markdown`; descriptor-only catalogue and tool links                                                               |

Source sorts are `title`, `-title`, `date_updated`, `-date_updated`, followed by ID for stable paging. Conditions use AND across fields and OR within sector arrays. False booleans remain explicit filters. Source JSON-array containment is unsupported: regions, activity types and content types are not accepted source-list filters. Search facets use `sectors.title`, `has_consultation_service`, `orientation_activity_types` and `content_types`; regions and municipality names are searched through `query`, not facet-filtered. Search facet labels are distinct from source sector IDs.

## Records and relationships

Summaries retain identity, title/slug, canonical `source_url`, nullable `date_updated`, website/email/phone, the three service/visit flags, logo, region strings, native `cities_municipalities` text, expanded area and physical location, flattened sectors, `content_warnings` and `relations_truncated`. There is no invented desk vendor. Private notes, reviewers, user relations, synchronization bookkeeping and internal integration flags are excluded.

An expanded area is `{id,title,area_center,area_bounds,area_inner}`. Center is a nullable GeoJSON Point; bounds are a nullable Polygon with closed rings; interior samples are a nullable MultiPoint. Coordinates remain `[longitude,latitude]` and are range-validated. Structured objects and serialized GeoJSON are accepted. Geometry is retained without coordinate truncation. An unavailable area relation becomes `null` with an explicit coverage warning, never an empty region. Bare, unexpanded IDs and malformed geometry fail structural validation safely. Polygon support reflects verified source shapes; other geometry types are not silently reinterpreted.

The physical location uses the existing location projection, including its own vendor and optional opening hours. Desk `phone_availability` is a separate weekly schedule. Times are source wall-clock strings; no timezone, open-now, appointment or exact service-eligibility inference is added. A desk advertising physical visits without an available location retains its service area and emits a warning. Sector expansions are bounded to 100 plus a sentinel and report missing targets/truncation independently of document traversal.

Detail adds nullable Markdown `description` and `consultation_service_description`, nullable consultation URL, phone availability, native email response-time label, nullable service links and nullable activity/content arrays. Each document is rendered independently with no invented editor-node relation. Their warnings retain field context, and `truncated` is true if either document hits traversal bounds. Missing bodies remain `null` in JSON and use the [shared Markdown notice](../collection-resources.md#missing-body-content). Resource metadata keeps public coverage, contacts, schedules, links, arrays and completeness flags; descriptions appear as separate body sections. Invalid HTTP(S) destinations become null with warnings rather than generating unsafe links.

Search hits contain identity, title/slug, source URL, nullable region labels, the three service/visit flags and a matched snippet. Index-only `_geoloc` grid samples, full area geometry, unexpanded schedules and document bodies are not returned. The upstream grid approximation is neither an address nor proof of exact service coverage.

## Evidence and verification

Read-only checks on 2026-10-20 used the configured Directus/Algolia credentials. The [Navigator family](https://docs.onderwijsloket.com/data-model/families/navigator) describes desks as regional guidance/consultation services; [index documentation](https://docs.onderwijsloket.com/search/collections) distinguishes service-grid approximation from physical locations.

- Source and index each returned 48 desks. Production list projections, detail reads for all 48 records, ID mapping, search, facet discovery and the descriptor-only catalogue were checked. No live names, contact details, bodies or credentials are committed as test fixtures.
- Actual area fields are structured Point/Polygon/MultiPoint GeoJSON despite generated string declarations. Some interior sample sets are null; all observed boundary types were Polygon.
- Phone availability and physical location/opening schedules can be null independently. Consultation descriptions, booking URLs, contacts and service arrays also have real null cases.
- The source includes activity values `open dagen (opleiding)` and `anders`, content value `anders`, service-link type `oriëntatieactiviteiten`, and lowercase `zo snel mogelijk` absent from generated unions. These are explicitly accepted alongside generated values without rewriting labels.
- Exact containment queries for `regions`, `orientation_activity_types` and `content_types` failed with an unsupported JSON-filter error. No enum-array source-filter builder was added for an unsupported operation. Four countable facets were verified through search, without requiring settings-read permission.
- The internal integration field `content_via_onderwijsloket` is not selectable with the configured service account and is outside the public contract. Public desk projections succeed without it.

Deterministic collection-based unit and production Node HTTP tests cover geometry, null coverage/location, independent schedules, enum drift, booleans, sector junctions, relation bounds, safe URLs, missing bodies/notices, portable schemas, exact search projections/facets, all three tools, catalogue/template/read discovery, tool links and sanitized errors. Runtime code adds no dependency or Node-only API. A deployed Cloudflare Workers instance and exact geographic matching remain outside this verification.
