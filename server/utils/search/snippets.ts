import type { snippetSchema } from "./schemas";
import type { z } from "zod";

type Snippet = z.output<typeof snippetSchema>;

/**
 * Prefer complete query matches, then the excerpt with the most context.
 *
 * @param value - Value to inspect without assuming it has the expected shape.
 * @returns The best matched excerpt, or null when no matching snippet exists.
 */
export function findSearchSnippet(value: unknown): Snippet | null {
  const snippets: Snippet[] = [];
  collectSnippets(value, "", snippets);

  snippets.sort((a, b) => {
    if (a.match_level !== b.match_level) return a.match_level === "full" ? -1 : 1;
    return b.text.length - a.text.length;
  });
  return snippets[0] ?? null;
}

/**
 * Walk Algolia's nested attributes; arrays retain their attribute path, without numeric indices.
 *
 * @param value - Value to inspect without assuming it has the expected shape.
 * @param field - Dot-separated attribute path, without array indices.
 * @param snippets - Matched excerpts collected in place.
 * @returns Nothing; appends matched excerpts to the supplied array.
 */
function collectSnippets(value: unknown, field: string, snippets: Snippet[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectSnippets(item, field, snippets);
    return;
  }
  if (!value || typeof value !== "object") return;

  const node = value as Record<string, unknown>;
  if (
    typeof node.value === "string" &&
    (node.matchLevel === "full" || node.matchLevel === "partial")
  ) {
    snippets.push({ field, text: node.value, match_level: node.matchLevel });
    return;
  }

  for (const [key, child] of Object.entries(node)) {
    const childField = field ? `${field}.${key}` : key;
    collectSnippets(child, childField, snippets);
  }
}
