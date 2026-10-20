# FAQs and sector guidance

`faqs` and `sectors` are enabled alongside articles. Each has its own list/get/search tools; shared discovery remains common. FAQ and sector resources and URI templates are registered; sectors do not support facets. Article tool inputs, record outputs and Markdown resources remain unchanged.

## Public surface

| Collection | Tools                                    | List filters                                                                                              | Sorts                                                      |
| ---------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| faqs       | list_faqs, get_faq, search_faqs          | Exact question; english boolean; sectors/audiences/phases/topics GUID arrays; related article UUID arrays | question (default), -question, date_updated, -date_updated |
| sectors    | list_sectors, get_sector, search_sectors | Exact title, slug, code                                                                                   | title (default), -title, sort, -sort                       |

Dedicated tools omit a collection selector; shared `describe_collection`, `get_filters` and `get_facets` retain one. Pagination uses the existing 1-based page, default 10/max 25 records, one extra continuation row and stable ID tie breaker. Sector default ordering is alphabetical rather than relying on nullable source sort values. Explicit numeric sort uses Directus ordering, including its null placement; it always includes an ID tie breaker. No custom editorial rank is inferred.

FAQ detail returns native `question`, Markdown `answer`, nullable `english`/`date_updated`, normalized taxonomy objects, related article references, `content_warnings`, document `truncated` and `relations_truncated`. There is no fabricated title, slug or description. `source_url` is null because FAQs have no verified standalone route; linked articles retain their own canonical URLs. Lists omit answer and article expansion.

Sector detail retains `introduction`, `roles_content`, `routes_content`, `salary_content` and `costs_content` as separately named **plain-text** fields, with null when absent. It does not parse them as Tiptap or synthesize an article body. Cost actions and salary cards retain their metadata and normalize safe HTTP(S) links to absolute URLs. Optional card action links, labels, flags and icons become explicit nulls; actual JSON entries omit some fields that the generated nested TypeScript type calls required.

Featured article/FAQ junctions have no sort column: they use stable junction ID order. Featured media uses source sort then junction ID and preserves its explicit collection discriminator. Only bounded references to videos, podcast episodes and testimonials are exposed; there are no new media tools or recursive media expansions. Unavailable media targets are omitted with a warning; source-returned references are retained regardless of status or publication date. The response contains reference metadata, never assets or transcripts.

## Input and response boundaries

- FAQ record IDs are UUIDs based on the generated model and published samples. Sector IDs retain GUID compatibility because the same IDs are used in taxonomy filters. Related article IDs use the article UUID contract.
- Queries and validators follow [data access responsibilities](../data-access.md). Directus owns visibility at every depth; source schemas validate structure without publication-status or release-date guards. Malformed or unexpanded records fail safely.
- Expanded relations fetch at most 101 rows and publish the first 100. The sentinel row marks the corresponding name in `relations_truncated`. Missing targets are omitted with a warning, not silently presented as complete data. Missing entire selected relations or malformed records produce sanitized UPSTREAM_UNAVAILABLE failures.
- FAQ filters describe related-article selection with `lookup: {collection: articles, tool: list_articles}`. This is independent of taxonomy choice enumeration. No unbounded article list is fetched for filter discovery.
- Unknown IDs return NOT_FOUND after a source lookup. Invalid IDs/arguments are rejected before provider access. Unsafe URL protocols become null, not executable links.

## Search and facets

Both configured indexes were queried read-only using the existing service credentials. FAQ search has strict `audiences.title`, `phases.title`, `sectors.title`, `topics.name` and `english` facet keys. Live facet values confirm boolean language values; the contract accepts booleans and returned true/false strings. The english facet was absent from the earlier documentation inventory and is now recorded as live evidence.

FAQ hits expose `{collection,id,question,source_url,snippet}`. Sector hits expose `{collection,id,title,slug,description,source_url,snippet}`. Both validate their record shape and corresponding ID format; neither exposes full indexed documents or staff metadata. Sectors advertise only query/page/page_size; their live index has no facets. FAQ facet discovery is limited to the declared search keys and preserves query/filter context, counts/exactness and existing caching behavior.

Index freshness remains independent of Directus: hits and facet counts can lag source changes, and a stale hit may fail detail lookup. Visibility is owned upstream; search adapters do not filter or reject hits by publication status. No index settings were read or modified.

## Evidence and verification

Inspected 2026-10-20 with the configured proxy token, selecting only relevant source fields:

- Three detailed FAQ samples and a published FAQ document-shape scan (125 answers) showed self-contained `doc`/`paragraph`/`text` Tiptap nodes and no relational editor nodes. The existing document renderer is used with an empty node context; newly encountered unresolved nodes still emit explicit warnings.
- Published sector samples showed plain-text content sections, numeric sort values and featured article/FAQ/media references. Sampled sort values were non-null; alphabetic default sorting avoids assuming a null ranking policy.
- `https://onderwijsloket.com/werken-in-het-primair-onderwijs` returned its matching canonical link; the corresponding `/sectoren/...` path returned 404. Sector source URLs therefore use the verified root-level slug route.
- Both index query endpoints returned matching Directus-style IDs and published status. FAQ facets include english; sector facets are empty. Read-only execution of the actual collection methods verifies the SDK list/detail projections and search adapters; no production credentials or content snapshots are committed as fixtures.

Deterministic unit and HTTP tests use synthetic records. They cover query projections, absence of publication filters and guards at every depth, junction filters, false booleans, missing relations, truncation, plain-text sections, nullable salary-card actions, media identity/order, search projections, safe failures and the expanded thirteen-tool catalogue. The earlier non-UUID FAQ-shaped fixture remains test-only to protect infrastructure extensibility; it is not the live FAQ ID contract.

The change uses existing dependencies and runtime APIs. Node HTTP integration is tested; a deployed Cloudflare Workers instance and every possible future source record are not verified. Article evidence and testimonials and later collections, geo/route operations remain outside this contract.

## Resources

Both collections implement [collection resources](../collection-resources.md): `onderwijsloket://faqs/{id}` and `onderwijsloket://sectors/{id}`, MIME `text/markdown`. Native template list callbacks expose record descriptors; all six record tools emit resource links. FAQ title is its question, its body is the rendered answer, and metadata retains article/taxonomy references and completeness fields. Sector bodies render separately named guidance sections; actions, cards and ordered featured references remain in YAML front matter. Reads reuse the existing getters and their collection-specific ID schemas. No article-shaped record fields or publication policies are introduced.
