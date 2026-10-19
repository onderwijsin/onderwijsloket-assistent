import { stringify } from "yaml";

/** Package any Markdown document with YAML metadata, leaving the body unchanged. */
export function withFrontMatter(markdown: string, metadata: Record<string, unknown> = {}): string {
  return `---\n${stringify(metadata)}---\n\n${markdown}`;
}
