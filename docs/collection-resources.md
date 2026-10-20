# Collection resources

Every core collection must ship a resource URI template, catalogue entries and readable resource documents alongside its record tools. Each template uses `onderwijsloket://{collection}/{id}` and MIME type `text/markdown`. Supporting collections remain embedded in parent documents; this requirement does not create standalone supporting tools or resources.

| Collection               | Representation                                                                   | State       |
| ------------------------ | -------------------------------------------------------------------------------- | ----------- |
| articles                 | Existing article Markdown and attribution metadata                               | Implemented |
| faqs                     | Rendered answer; native question as descriptor title                             | Implemented |
| sectors                  | Named guidance sections under Markdown headings                                  | Implemented |
| testimonials             | Story Markdown with author/profile attribution                                   | Implemented |
| educational_institutions | Institution description, contacts and locations                                  | Implemented |
| programs                 | Program overview and separately named form descriptions, providers and locations | Implemented |
| regional_education_desks | Desk description, consultation services, coverage and contacts                   | Implemented |
| podcast_shows            | Series description, hosts and platform links                                     | Implemented |
| podcast_episodes         | Episode metadata and available transcript; explicit null when absent             | Implemented |
| videos                   | Video metadata, body, available transcript and chapter/speaker metadata          | Implemented |

The representation for each future collection must be verified against its native detail schema. A missing transcript does not prevent an episode resource: return its metadata and available content without inventing transcript text. Media links are metadata; audio binaries are not Markdown.

## Discovery and reads

- `resources/templates/list` advertises one template per enabled core collection. `resources/list` lists all accessible record descriptors through each template's native list callback.
- List, get and search tools return `resource_link` blocks; structured records and their JSON fallback retain their existing shapes. `list_collections` and `describe_collection` advertise the actual registered templates.
- Resource descriptors use native fields. FAQ questions supply titles without fabricating a description or website URL. Sector resources retain their canonical `source_url`.
- Reads validate IDs with the collection's get-input schema and call its existing getter. Body mappings and front matter selectors are explicit; records need no artificial `content` field.
- Front matter retains identity, attribution, related references, source timestamps and completeness metadata. FAQs retain `truncated`, `content_warnings` and `relations_truncated`; sectors retain relation warnings, actions, cards and featured references. Sector body sections are Introduction, Roles, Routes, Salary and Costs; null sections are omitted. Source fields retain their original names in structured tool results.
- Source visibility follows [data access responsibilities](data-access.md). Resources add no status filters, publication guards or date gates.

`server/utils/resources.ts` handles descriptors, batched catalogue listing, ID validation, YAML packaging and sanitized protocol errors. Collection callbacks supply descriptor/body/metadata mappings. Catalogue lists are cached per collection for five minutes and fetch only root identity, native title/question and update timestamps in pages of 250. No protocol cursor or subscriptions are implemented; use record tools for filtered pagination. FAQ, sector and testimonial reads use their existing getters without adding a separate resource cache. [Article resources](article-resources.md) retain their existing format and getter cache.

## Rollout checks

A core collection is complete only when template discovery, catalogue listing, valid reads, collection-specific IDs, tool resource links, front matter completeness and sanitized invalid/missing/upstream failures are verified. Preserve article URI, body and metadata behavior. Test missing optional content without inventing empty complete documents. Node and Cloudflare Workers runtime compatibility remains required.

Institution/program resource contracts and exact variant rendering are documented in [institutions and programs](collection-inventory/institutions-and-programs.md).

Catalogue discovery uses dedicated descriptor queries with exactly `id`, the native `title` or FAQ `question`, and `date_updated`. It never calls collection list/get methods or expands relations. Pages request 250 records, advance by the actual number returned, and continue until an empty page so a lower Directus page cap cannot truncate discovery. Repeated IDs fail the whole refresh rather than caching incomplete discovery.

Pages are awaited sequentially. A shared in-process queue also serializes page reads across concurrent catalogue rebuilds; Nitro coalesces identical cold requests and caches complete catalogues for five minutes. This queue is per Node process or Workers isolate, not a distributed limit across replicas. The MCP SDK visits templates sequentially and returns the complete catalogue in one protocol response. Empty per-record descriptions prevent repeating the full template description for every record; rich collection descriptions remain on templates and discovery tools.

Previously catalogue discovery called public list methods with pages of 25, which included nested summary relations for programs and institutions. Those requests were sequential, but unnecessarily heavy. Full content and related data are fetched when a record tool or resource read requests them.

## Missing body content

This is a shared contract for every collection. A missing source document or one that renders to empty/whitespace-only Markdown yields an explicit `null` in its JSON content field (`content`, `answer` or `description`, including program-form descriptions). Record titles, summaries and other metadata must not manufacture a body. Existing nonempty source documents still use the normal Markdown renderer and heading normalization. Structural errors, unsupported content and truncation retain their existing validation and warning behavior.

The shared resource handler renders absent content as:

```markdown
> **Notice:** No body content is available. Any available record information is provided in the metadata.
```

YAML front matter remains available and completeness warnings are preserved. Notices belong only to the Markdown representation; they are never stored in JSON content fields. Composite resources use the same formatter for missing component documents; programs without forms also include the notice alongside their generated overview. Sector resources render their native description and named text sections rather than requiring a rich-text body.

Desk resources keep desk and consultation descriptions separate, with expanded coverage, contacts and independent schedules in front matter. See [regional education desks](collection-inventory/regional-education-desks.md).

Podcast and video resource contracts, nullable transcript behavior and season/host identity are documented in [podcasts and videos](collection-inventory/podcasts-and-videos.md).
