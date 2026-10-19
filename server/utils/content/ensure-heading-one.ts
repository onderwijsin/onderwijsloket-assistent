import { escapeMarkdownText } from "./markdown-formatting";

/** Common plain-text metadata fields; collections can map other fields into these names. */
export interface ContentDocumentMetadata {
  title?: string | null;
  name?: string | null;
  label?: string | null;
  description?: string | null;
  introduction?: string | null;
  summary?: string | null;
}

/**
 * Pick the first nonblank field rather than letting an empty CMS field hide its fallback.
 *
 * @param values - Candidate text fields, from highest to lowest priority.
 * @returns The first nonblank string, or undefined when none is available.
 */
function firstText(...values: (string | null | undefined)[]): string | undefined {
  return values.find((value) => value?.trim())?.trim();
}

/**
 * Prepend metadata only when the first nonblank Markdown line is not already an H1.
 *
 * @param markdown - Markdown body to format.
 * @param metadata - Record metadata used for the document header.
 * @returns Markdown with a metadata header when the body does not already start with an H1.
 */
export function ensureHeadingOne(markdown: string, metadata: ContentDocumentMetadata): string {
  // Tiptap emits ATX headings. Leading blank paragraphs/lines do not change the first heading.
  if (/^\s*#(?:[\t ]|$)/.test(markdown)) {
    return markdown;
  }

  const title = firstText(metadata.title, metadata.name, metadata.label);
  if (!title) {
    return markdown;
  }

  // Metadata is plain text, not editor Markdown. Keep the title on a single heading line.
  const heading = `# ${escapeMarkdownText(title.replace(/\s+/g, " "))}`;
  const introduction = firstText(metadata.description, metadata.introduction, metadata.summary);
  return [heading, introduction ? escapeMarkdownText(introduction) : undefined, markdown.trim()]
    .filter(Boolean)
    .join("\n\n");
}
