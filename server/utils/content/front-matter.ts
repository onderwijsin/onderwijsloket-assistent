import { stringify } from "yaml";

/**
 * Package any Markdown document with YAML metadata, leaving the body unchanged.
 *
 * @param markdown - Markdown body to format.
 * @param metadata - Record metadata used for the document header.
 * @returns The unchanged Markdown body prefixed with serialized YAML metadata.
 */
export function withFrontMatter(markdown: string, metadata: Record<string, unknown> = {}): string {
  return `---\n${stringify(metadata)}---\n\n${markdown}`;
}
