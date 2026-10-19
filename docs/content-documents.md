# Content documents

The utilities in `server/utils/content/` implement a collection-independent pipeline for Directus content documents. Articles currently use it for `body`; other collections can use the same pipeline for `description`, `answer` or another document field.

## Fetch, inject, render

1. Include the document field and `{ editor_nodes: editorNodeFields }` in the Directus field selection. `editorNodeFields` lives in `content/editor-node-fields.ts` and uses scoped M2A projections for the actual Onderwijsloket node types.
2. Pass the document and expanded editor-node rows to `renderContentDocument(document, editorNodes, { assetBaseUrl })`.
3. The pipeline validates document structure, clones nodes, matches relations by junction ID and collection, and injects payloads into `attrs.data`. Nested callout documents use their own editor-node rows as well as the surrounding scope.
4. Tiptap's `MarkdownManager`, StarterKit and custom node/mark extensions serialize the hydrated document. No DOM or editor instance is required.

```ts
import { editorNodeFields } from "../server/utils/content/editor-node-fields";
import { renderContentDocument } from "../server/utils/content/render-content-document";

// Fetch alongside your own collection-specific fields:
const fields = ["description", { editor_nodes: editorNodeFields }];

// Once fetched:
const result = renderContentDocument(record.description, record.editor_nodes, {
  assetBaseUrl: config.public.directus.assetBaseUrl
});
// { markdown, warnings, truncated }
```

The pipeline has no parent collection, record ID or document-field assumptions. `injectContentData` and `contentToMarkdown` are also available separately. The article collection maps their result into the existing `content`, `content_warnings` and `truncated` output fields.

## Supported Onderwijsloket nodes

| Collection              | Markdown representation                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `buttons`               | Label and destination link.                                                                                                  |
| `callouts`              | Blockquote with title, rendered description and action links. Nested mentions are hydrated.                                  |
| `images`                | Markdown image with alt text and configured asset URL.                                                                       |
| `mediaplayers`          | Audio/video link, artist, optional artwork and timestamped chapter links. Both `source` and legacy `id` media payloads work. |
| `content_lists`         | Sorted list of titles/links, descriptions and optional images.                                                               |
| `related_content_lists` | Sorted links to related articles, stories, videos, podcasts, sectors, programmes, institutions and regional desks.           |
| `mentions`              | Inline article link using the custom mention title when provided.                                                            |

Standard paragraphs, headings, bold/italic/strike/code, lists, blockquotes, fenced code, horizontal rules, line breaks and tables are handled by Tiptap and the table extension. Subscript and superscript use inline HTML. Relation marks are supported defensively, although Onderwijsloket currently registers no relation-mark renderer.

This follows the fetch/inject/render separation in `onderwijsin-v2-nuxt/modules/content-renderer`, adapted to the seven node types in `onderwijsloket/app/composables/content-renderer.ts` and its Vue renderer. The approved direct Tiptap dependencies use the already-installed 3.24.0 versions.

## Links, integrity and limits

Internal links become absolute Onderwijsloket source URLs. Images/media use the configured public asset base. Unsafe protocols are not emitted as links. Injection does not mutate fetched records and replaces any pre-existing `attrs.data` with the fetched payload.

Missing, unexpanded, cyclic and unsupported editor nodes produce explicit warnings/markers. Document traversal is bounded to 10,000 nodes and depth 40; there is no Markdown character cap. Traversal limits report truncation. Missing documents return empty Markdown with a warning. Malformed document structure fails validation.

Markdown tables cannot represent merged cells faithfully: colspan is flattened to extra columns and rowspan is reported through a warning. Unsupported node types retain their child text where possible and produce warnings. The renderer preserves meaning and links rather than visual styles, icons, interactive controls or layout details.

## Verification

Synthetic fixtures cover every relation type, nested callout hydration, relation marks, source immutability, missing/cyclic relations, link protocols, standard Markdown, tables and truncation. Article tests verify that detail queries request editor-node data and render it through the shared pipeline. Taxonomy caching and article pagination remain independent.

## Code map

- `render-content-document.ts` coordinates validation, hydration, rendering and output limits.
- `editor-node-fields.ts` declares the shared Directus projections.
- `inject-content-data.ts` resolves junction references, including nested document scopes and cycle detection.
- `markdown.ts` prepares the document and coordinates Tiptap serialization.
- `markdown-relations.ts` renders the seven Onderwijsloket relation types.
- `markdown-formatting.ts` contains shared text, link, asset and list formatting.
- `markdown-extensions.ts` registers Tiptap nodes/marks and handles Markdown tables.
- `types.ts` holds document boundary schemas and shared types.

To support another editor node, add its fetch projection, relation renderer and a fixture covering its output. Parent collections only need to fetch their document and `editor_nodes`; they should not resolve or render individual block types themselves.

## Optional document heading

Collections can opt into a title and introduction when the rendered body does not already start with an H1:

```ts
renderContentDocument(record.body, record.editor_nodes, {
  assetBaseUrl: config.public.directus.assetBaseUrl,
  ensureHeadingOne: true,
  metadata: record
});
```

The shared `ensureHeadingOne` utility ignores leading blank lines when checking for an existing H1. Otherwise it prepends the first nonblank `title`, `name` or `label`, followed by the first nonblank `description`, `introduction` or `summary`. These metadata fields are plain text. Collections with different field names can map them into `metadata`. Without a usable title, the body remains unchanged. Existing leading H1 content remains unchanged, including its introduction.

Articles enable this option. Other collections retain the default behavior until they opt in. The prefix is added once at the top level, never to nested callouts, and is returned with the complete rendered body. Missing body documents still report their warning even when metadata supplies a heading.
