import { ensureHeadingOne } from "./ensure-heading-one";
import type { ContentDocumentMetadata } from "./ensure-heading-one";
import { injectContentData } from "./inject-content-data";
import { contentToMarkdown } from "./markdown";
import type { ContentMarkdownOptions } from "./types";

/** Options for the complete document pipeline; metadata is never applied to nested editor blocks. */
export interface ContentDocumentOptions extends ContentMarkdownOptions {
  /** Prepend a title and optional introduction unless the body already starts with an H1. */
  ensureHeadingOne?: boolean;
  /** Plain-text record fields used only when ensureHeadingOne is enabled. */
  metadata?: ContentDocumentMetadata;
}

/**
 * Hydrate and serialize any collection's content document, reporting incomplete or truncated data.
 *
 * @param document - Source document to hydrate or render.
 * @param editorNodes - Fetched editor-node junctions used to resolve embedded relations.
 * @param options - Asset URL and optional heading/record metadata settings.
 * @returns Nullable Markdown (before generated headings), combined hydration/rendering warnings and the truncation flag.
 */
export function renderContentDocument(
  document: unknown,
  editorNodes: unknown,
  options: ContentDocumentOptions
) {
  // Some document fields store the node array directly instead of a Tiptap doc wrapper.
  const source =
    document == null
      ? { type: "doc", content: [] }
      : Array.isArray(document)
        ? { type: "doc", content: document }
        : document;
  const hydrated = injectContentData(source, editorNodes);
  const rendered = contentToMarkdown(hydrated.document, options);
  const warnings = [...hydrated.warnings, ...rendered.warnings];
  if (!rendered.markdown.trim()) {
    warnings.push("No content document is available.");
  }
  // Apply once to the top-level result; nested editor blocks keep their own headings.
  const markdown = !rendered.markdown.trim()
    ? null
    : options.ensureHeadingOne
      ? ensureHeadingOne(rendered.markdown, options.metadata ?? {})
      : rendered.markdown;
  return {
    markdown,
    warnings: [...new Set(warnings)],
    truncated: hydrated.truncated
  };
}
