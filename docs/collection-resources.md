# Collection resources

Every core collection has a Markdown resource at `onderwijsloket://{collection}/{id}` and a URI template for discovery. Tools provide structured data for decisions and filtering; resources provide readable documents with attribution and completeness metadata. Supporting people, files and other embedded projections do not acquire standalone resources.

| Collection               | Body representation                                                       |
| ------------------------ | ------------------------------------------------------------------------- |
| articles                 | Rendered body with supporting evidence/attribution metadata               |
| faqs                     | Rendered answer; question supplies the descriptor title                   |
| sectors                  | Named guidance sections, with actions and featured references in metadata |
| testimonials             | Personal story with distinct authors and featured people                  |
| educational_institutions | Description with contacts and main/additional locations                   |
| programs                 | Overview and separately named form descriptions                           |
| regional_education_desks | Separate desk/consultation descriptions with coverage and contacts        |
| podcast_shows            | Series description with hosts, seasons and platform links                 |
| podcast_episodes         | Body and available transcript with audio/speaker metadata                 |
| videos                   | Body and available transcript with video/speaker/chapter metadata         |

## Discovery without full records

`resources/templates/list` describes templates. `resources/list` asks each template for a complete descriptor catalogue, and the SDK combines those catalogues. The source query selects only `id`, native `title` or FAQ `question`, and `date_updated`. It never calls the public list/get methods, expands nested relationships or loads bodies/transcripts.

Descriptor pages request 250 records and advance by the actual returned count until an empty page. This tolerates a lower upstream page cap without silently truncating discovery. Repeated IDs fail the refresh rather than caching a non-advancing or incomplete catalogue. Reads are sequential, with a shared per-runtime queue across concurrent catalogue builds. Identical cold requests are coalesced by Nitro and complete catalogues are cached. The queue is not a distributed limit across replicas.

The native callback returns one complete MCP catalogue, without protocol cursors or subscriptions. Use record tools for filtered pagination. Per-record empty descriptions suppress repeating a long template description for every descriptor; rich collection descriptions remain on templates and discovery tools.

## Reading and attribution

A resource read validates the collection-specific ID and calls the same getter as its detail tool. The shared detail cache contains validated normalized records, not protocol responses. Collection bindings select the native body and metadata; Markdown/YAML packaging stays outside the cache. See [cache controls](cache.md).

Front matter retains identity, source URLs/dates, attribution, related references and completeness metadata. Media records retain public asset links rather than binary data. `source_url` is the canonical page to cite, while `onderwijsloket://` identifies an MCP resource rather than a browser destination. Invalid IDs, missing records and source failures become sanitized protocol errors.

## Missing body content

Missing documents, or documents rendering to empty/whitespace-only Markdown, yield null JSON content before generated headings are considered. Titles, summaries and snippets cannot substitute for source bodies. The shared pure formatter in `content/resource-content.ts` renders:

```markdown
> **Notice:** No body content is available. Any available record information is provided in the metadata.
```

The notice belongs only to the resource representation, never a JSON content field. Composite resources use it for missing component documents. Podcast/video resources keep body and transcript sections distinct and add a separate notice when transcript text is absent. YAML and completeness warnings remain available on metadata-only records.

Document `truncated` and relation `relations_truncated` have separate meanings. Structural errors, unsupported content and unresolved relationships retain explicit warnings; a readable resource is not a guarantee that the source record is complete or media can be played. Publication/visibility policy remains upstream at every depth.

See [collection data and projections](collection-data.md), [content documents](content-documents.md) and [data access responsibilities](data-access.md). Unit/HTTP tests cover every template, catalogue, native body mapping, resource link, metadata-only document and sanitized error path.
