/**
 * Make absent content explicit in every Markdown resource without inventing a source body.
 * @param markdown - Rendered source content, or null when unavailable.
 * @returns Existing Markdown or a visible notice referring readers to the resource metadata.
 */
export function resourceContent(markdown: string | null | undefined): string {
  return markdown?.trim()
    ? markdown
    : "> **Notice:** No body content is available. Any available record information is provided in the metadata.";
}
