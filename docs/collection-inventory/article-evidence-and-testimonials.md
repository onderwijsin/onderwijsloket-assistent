# Article evidence and testimonials

Article details include supporting evidence and attribution, while the `testimonials` core collection exposes personal stories with featured profiles and its own tools and resource template. Supporting collections remain embedded; no standalone author, profile, source or document tool/resource is added. [Data access responsibilities](../data-access.md) apply at every depth: no status filters, status validators or release-date gates.

## Article additive detail contract

`get_article` retains all existing fields and adds:

| Field               | Output                                |
| ------------------- | ------------------------------------- |
| sources             | `{id,title,description:string         | null,url:URL           | null}[]` |
| documents           | `{id,title,description:string         | null,asset:{id,url:URL | null}    | null}[]` |
| authors             | `{id,name,first_name,job_title:string | null,image:{id,url:URL | null}    | null}[]` |
| relations_truncated | Names of incomplete supporting arrays |

Article lists and search hits retain their existing shapes and do not fetch supporting data. Detail queries unwrap actual `sources_id`, `documents_id` and `authors_id` targets. Each supporting junction fetches 101 rows sorted by junction ID and returns at most 100; the extra row signals incompleteness. Missing targets and unavailable document assets emit warnings. Unsafe or malformed external source URLs become null with a warning. Missing selected projections and malformed/unexpanded target records fail with sanitized UPSTREAM_UNAVAILABLE errors rather than implying empty complete arrays.

Article Markdown and resource URI remain unchanged. Existing front matter fields remain, with supporting arrays and `relations_truncated` added. The five-minute article getter cache is shared by tools/resources; its namespace changes to `articles-get-supporting` so pre-enrichment cached payloads cannot violate the new detail contract. Document traversal `truncated` retains its original meaning and is independent of relation truncation.

## Testimonials

| Operation                | Contract                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| list_testimonials        | Exact title/slug; sectors, audiences, phases, roles, topics, tracks GUID arrays; authors/profiles target-ID arrays |
| get_testimonial          | UUID copied from list/search results; returns rendered story Markdown                                              |
| search_testimonials      | Text query or browsing; strict verified facet keys below                                                           |
| get_filters / get_facets | Shared discovery with `collection: testimonials`                                                                   |
| Resource                 | `onderwijsloket://testimonials/{id}`, `text/markdown`, complete native catalogue callback                          |

List pagination is 1-based, default 10/max 25, with a continuation row. Sorts are `title`, `-title`, `publication_date`, `-publication_date`, always followed by ID; null date ordering follows Directus. Domain filters combine AND between fields and OR within arrays. Related-person filter discovery points to `list_testimonials` with explicit `lookup.path` values `authors[].id` and `profiles[].id`; copy nested target IDs, never parent story IDs. Supporting IDs remain bounded opaque strings rather than asserting UUIDs for every upstream identifier.

Summaries contain identity, title/slug/description/summary, canonical source URL, nullable `date_updated` and `publication_date`, six normalized taxonomies, authors, profiles, `content_warnings` and `relations_truncated`. Details add `content` Markdown and document `truncated`. Testimonials have no `english` field. Editorial authors and featured participants remain separate. Profile references contain `{id,first_name,last_name:string|null,source_url:URL|null,image:Asset|null}`. Biography/body and video-avatar rendering are deliberately not included in minimal participant attribution; no profile editor-node relation is invented.

All eight taxonomy/person relations have the same 101-fetch/100-return bounds and missing-target warnings. Reverse content, team members, user/reviewer metadata, raw file storage metadata and private contacts are excluded by field projections and output schemas. Body/editor nodes are fetched only for detail, using the existing renderer, including buttons, callouts, images and related content. Missing body emits the existing explicit document warning; missing content is not claimed to be complete. Future/null publication dates are retained as metadata without changing returned content.

Search hits contain `{collection,id,title,slug,description,publication_date:string|null,source_url:URL|null,snippet:Snippet|null}`. Verified facet keys are `audiences.title`, `authors.name`, `phases.title`, `roles.name`, `sectors.title`, `topics.name`, `tracks.name`. The documented searchable-field spelling `topic.name` is not an accepted facet key. Search uses ID with objectID fallback and exposes no indexed full body. Counts/snippets/pagination use the existing adapter; index freshness remains independent of current source detail. Search query analytics includes `search_testimonials` under the existing opt-in setting.

All three testimonial tools return resource links. The resource template uses the same UUID validator and getter as the get tool, with readable story Markdown and YAML metadata retaining authors/profiles, dates, references and completeness fields. Invalid/missing IDs and upstream failures use the existing sanitized MCP resource error contracts.

## Asset delivery and source evidence

Inspected read-only on 2026-10-20 using the configured source and search credentials:

- Three article and three testimonial samples confirmed target-ID junctions, author image IDs and profile paths/images. Testimonial samples contained native `doc` bodies, including relation-blocks with callouts and related-content lists. Supporting nullable fields and author null images were observed.
- The testimonial index returned matching source UUIDs, title/slug/path/description/publication-date fields and the seven facet names above. Actual collection list/get/search/facet methods passed a temporary read-only verification against source SDK queries, including three detailed testimonials. No credentials, production content snapshots or permanent live tests are committed.
- Two document samples selected only file ID/type metadata. Both were PDFs. HEAD requests returned HTTP 200 with application/pdf through Cloudinary `image/upload/onderwijsloket-directus/production/{id}`, while `raw/upload/.../{id}` returned 404. The [Cloudinary documentation](https://docs.onderwijsloket.com/misc/cloudinary) confirms public ID-based delivery. Document PDFs/images therefore use the verified image route; unknown file types or ID-only file responses retain `{id,url:null}` plus a parent warning. Additional raw/non-image document delivery types remain unverified and are not guessed.
- Author/profile images use the documented Cloudinary image route. Document references expose downloads only: no PDF extraction, inferred document text, arbitrary file browsing or standalone supporting search.

Deterministic unit and production HTTP tests cover supporting projections, safe URLs/assets, attribution separation, bounded and missing relations, unchanged article bodies/list/search contracts, future dates, missing body warnings, testimonial filters/search/facets, tool links, template/catalogue/read behavior, schema portability and sanitized errors. Node HTTP behavior is tested; a deployed Cloudflare Workers instance is not. Runtime code uses existing cross-runtime dependencies.

Navigator and podcast collections, standalone supporting resources and profile biographies remain outside this contract. Unsupported document asset delivery URLs remain explicitly null pending verified mappings.
