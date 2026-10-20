# Collection resources

Every core collection must ship a resource URI template, catalogue entries and readable resource documents alongside its record tools. Each template uses `onderwijsloket://{collection}/{id}` and MIME type `text/markdown`. Supporting collections remain embedded in parent documents; this requirement does not create standalone supporting tools or resources.

| Collection               | Representation                                                                   | State               |
| ------------------------ | -------------------------------------------------------------------------------- | ------------------- |
| articles                 | Existing article Markdown and attribution metadata                               | Implemented         |
| faqs                     | Rendered answer; native question as descriptor title                             | Implemented         |
| sectors                  | Named guidance sections under Markdown headings                                  | Implemented         |
| testimonials             | Story Markdown with author/profile attribution                                   | Required in group 2 |
| educational_institutions | Institution description, contacts and locations                                  | Required in group 3 |
| programs                 | Program overview and separately named form descriptions, providers and locations | Required in group 3 |
| regional_education_desks | Desk description, consultation services, coverage and contacts                   | Required in group 4 |
| podcast_shows            | Series description, hosts and platform links                                     | Required in group 5 |
| podcast_episodes         | Episode metadata and available transcript; explicit null when absent             | Required in group 5 |

The representation for each future collection must be verified against its native detail schema. A missing transcript does not prevent an episode resource: return its metadata and available content without inventing transcript text. Media links are metadata; audio binaries are not Markdown.

## Discovery and reads

- `resources/templates/list` advertises one template per enabled core collection. `resources/list` lists all accessible record descriptors through each template's native list callback.
- List, get and search tools return `resource_link` blocks; structured records and their JSON fallback retain their existing shapes. `list_collections` and `describe_collection` advertise the actual registered templates.
- Resource descriptors use native fields. FAQ questions supply titles without fabricating a description or website URL. Sector resources retain their canonical `source_url`.
- Reads validate IDs with the collection's get-input schema and call its existing getter. Body mappings and front matter selectors are explicit; records need no artificial `content` field.
- Front matter retains identity, attribution, related references, source timestamps and completeness metadata. FAQs retain `truncated`, `content_warnings` and `relations_truncated`; sectors retain relation warnings, actions, cards and featured references. Sector body sections are Introduction, Roles, Routes, Salary and Costs; null sections are omitted. Source fields retain their original names in structured tool results.
- Source visibility follows [data access responsibilities](data-access.md). Resources add no status filters, publication guards or date gates.

`server/utils/resources.ts` handles descriptors, batched catalogue listing, ID validation, YAML packaging and sanitized protocol errors. Collection callbacks supply descriptor/body/metadata mappings. Catalogue lists are cached per collection for five minutes and fetch summaries in batches of 25. No protocol cursor or subscriptions are implemented; use record tools for filtered pagination. FAQ and sector reads use their existing getters without adding a separate resource cache. [Article resources](article-resources.md) retain their existing format and getter cache.

## Rollout checks

A core collection is complete only when template discovery, catalogue listing, valid reads, collection-specific IDs, tool resource links, front matter completeness and sanitized invalid/missing/upstream failures are verified. Preserve article URI, body and metadata behavior. Test missing optional content without inventing empty complete documents. Node and Cloudflare Workers runtime compatibility remains required.
