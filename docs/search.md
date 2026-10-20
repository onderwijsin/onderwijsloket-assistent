# Collection search and discovery

Search finds relevant records; source reads retrieve their current structured detail. Each collection owns a `search_<collection>` tool with a fixed index and native lightweight hit schema. This keeps discovery fast to interpret without pretending that an index contains complete documents, relationships or current playback availability. There is no cross-index ranking or arbitrary client-selected index.

## Source filters and search facets solve different problems

`get_filters` describes the inputs accepted by a collection's source list tool. Taxonomy filters use target IDs and return archive links for context. Exact text fields, booleans, enums, relation IDs and episode numbers retain native semantics. `get_facets` instead reports countable index attributes and their current labels/counts for a query/filter context. A source taxonomy ID is not a search facet label.

| Collection       | Search facet boundary                                                                                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Articles         | Dynamically discovered countable article facets                                                                                                      |
| FAQs             | english, sectors.title, audiences.title, phases.title, topics.name                                                                                   |
| Sectors          | Query/browse only; facet capability is absent                                                                                                        |
| Testimonials     | audiences.title, authors.name, phases.title, roles.name, sectors.title, topics.name, tracks.name                                                     |
| Institutions     | type                                                                                                                                                 |
| Programs         | type, level, degrees, roles.name, sectors.title, qualifications.name, school_subjects.name, program_forms.track.name, educational_institutions.title |
| Regional desks   | sectors.title, has_consultation_service, orientation_activity_types, content_types                                                                   |
| Podcast shows    | sectors.title, audiences.title, phases.title                                                                                                         |
| Podcast episodes | Those three plus roles.name, topics.name, tracks.name and show.title                                                                                 |
| Videos           | sectors.title, audiences.title, phases.title, roles.name, topics.name, tracks.name                                                                   |

Most adapters declare strict filter schemas, based on verified index fields. The shared adapter intersects those boundaries with live countable-facet discovery. Articles retain dynamic facet discovery. This is intentional: a static domain contract prevents accidentally exposing unrelated fields, while live discovery avoids claiming support for a removed upstream facet.

Source JSON-array containment is unavailable for program degrees and desk region/activity/content arrays. Degrees and desk activity/content types therefore filter through search; desk regions and municipalities are searchable query text, not countable facets. The application does not emulate unsupported source filtering over a single partial page.

## Adapter and transport boundaries

`server/utils/search/collection-search.ts` supplies provider transport, pagination, facet validation and snippet selection. Definitions supply their fixed index, requested attributes, `recordSchema`, `mapHit` and optional strict `filterSchema`. A FAQ hit keeps its question; an institution hit has partial location metadata; a podcast episode can retain a bounded show reference. Full source documents and transcripts are not search result bodies.

`algolia-client.ts` reuses a private SDK client for the active application/token/host configuration. Environment values populate private runtime configuration. `NUXT_ALGOLIA_HOST` is an HTTP(S) fixture override; normal operation uses the provider's hosts. Queries set `analytics: false`; the server neither edits records/settings nor adds click/conversion tracking. Optional server tool-query analytics are described separately in [tool analytics](tool-analytics.md).

Tool descriptions explain domain search without naming infrastructure providers. Implementation details belong in developer documentation rather than model-facing usage instructions.

## Facet values and counts

Values within a filter dimension combine with OR; dimensions combine with AND. The adapter constructs facet expressions, including literal-value escaping. Raw provider expressions and unrestricted request parameters are not exposed.

The configured credential need not read index settings. A minimal zero-hit search discovers countable facet names. Filtering-only attributes without counts are not exposed by this route. `get_facets` can select facets and scope counts by query and filters; counts include each facet's own selected filter. This is contextual rather than disjunctive faceting.

`max_values` defaults to 100 and allows up to 1,000 values per facet. Exact counts do not promise a complete value enumeration: `counts_are_exact` and value limits describe different constraints. Facet-name discovery and contextual facet results are cached; search result queries are not. Cached facet `retrieved_at` describes the cached snapshot. See [cache controls](cache.md).

## Results, snippets and paging

Each hit has native identity and source attribution with only the selected metadata needed for discovery. A nonblank query requests 30-word excerpts; snippet selection prefers full matches and richer context, including nested relationship snippets. Matched terms use Markdown bold markers. Browsing returns null snippets, and a query can still have no useful excerpt. A snippet explains a match, not a complete body, transcript or ranking rationale.

Pagination is one-based, default size 10 and maximum 25. The adapter translates to zero-based provider pages. `total_is_exact` distinguishes exact from estimated counts; `total_pages` reflects the provider's accessible pagination window, which may cover fewer records than the total. Empty results are valid. Relevance, searchable attributes, synonyms and ranking remain upstream configuration.

Unknown/unavailable filters produce `INVALID_FILTER`; source transport or malformed provider responses produce sanitized `UPSTREAM_UNAVAILABLE`. Index visibility is upstream policy, including publication behavior. The MCP adapter validates shapes without adding local status/date gates.

## Geographic search

`search_programs`, `search_educational_institutions` and `search_regional_education_desks`
accept optional `location` text (city, postcode or address) and `radius` in metres.
The radius defaults to `50_000` when location is supplied; an explicit radius must
be a positive integer no larger than 2,147,483,647 and requires a location.
The same query and facet filters still apply. Other collections and `get_facets`
do not accept geographic inputs.

```json
{
  "location": "Utrecht",
  "radius": 25000,
  "query": "leraar",
  "page": 1,
  "page_size": 10
}
```

The handler uses the first ranked match from the Dutch-language [geocoding utility](geocoding.md),
which biases ambiguous location names toward central Netherlands without excluding
foreign locations. The returned matched address and coordinates make this selection explicit.
Geocoding cache and mode flags continue to apply. No match produces `LOCATION_NOT_FOUND`
(400) without querying the index. A radius without location produces `INVALID_LOCATION`
(400); invalid input shapes are rejected by the tool schema. Missing Mapbox configuration
produces `GEOCODING_NOT_CONFIGURED` (503); provider or response failures produce a sanitized
`UPSTREAM_UNAVAILABLE` (502). Location search never falls back to an unbounded search.

The search request supplies `aroundLatLng` in **latitude,longitude** order,
`aroundRadius`, `aroundPrecision: 1` and `getRankingInfo: true`. Its ranking override
puts `geo` first before pagination, followed by the standard text/custom criteria.
Rules, dynamic reranking and personalization are disabled for geographic requests
so they cannot promote distant hits ahead of nearer ones; ordinary searches keep
their existing upstream ranking. Typo tolerance is set to `true` to avoid a strict
index setting forcing typo ranking ahead of distance. No index settings are mutated.

Geographic responses add optional `geo` metadata:

- Response `geo`: `location_query`, `matched_location` (Mapbox identifier, name,
  full address, type, longitude/latitude and optional bounding box), `candidate_count`,
  effective `radius_meters`, `sort: "distance"` and `distance_kind`.
- Each hit's `geo`: `distance_meters`, `matched_coordinates` (latitude/longitude,
  or null when unavailable) and `precision_meters`. Distances use
  `_rankingInfo.matchedGeoLocation.distance` when present, otherwise
  `geoDistance * geoPrecision` (precision defaults to one metre). Missing or malformed
  ranking data fails validation rather than inventing a distance.

`distance_kind` is `indexed_location` for programs and institutions, using the nearest
indexed geographic point, which need not be the displayed main location. For regional
desks it is `service_area_grid`: distance to the nearest indexed service-area grid
point approximates coverage. It is neither distance to an office nor an exact
point-in-polygon test. These are geographic distances, not driving or travel distances.
Records without indexed geographic points cannot match a geographic search.

Ordinary searches omit both response and hit `geo` fields and do not call geocoding.
Pagination, counts, facets and resource links retain their existing contracts; keep
location and radius fixed along with query/filters when requesting another page.
An empty indexed result set still returns the resolved geographic metadata.

The provider query and distance interpretation follow the
[Onderwijsloket examples](https://docs.onderwijsloket.com/raw/search/advanced-usage.md)
and [Algolia ranking metadata](https://www.algolia.com/doc/api-reference/api-parameters/getRankingInfo).

The unit suite covers projection mapping, strict/dynamic facet validation, escaping, snippets, paging and failures. HTTP tests exercise the installed SDK against controlled index fixtures and verify actual tool schemas and resource links. See [collection architecture](collection-registry.md), [native data boundaries](collection-data.md) and [data access responsibilities](data-access.md).
