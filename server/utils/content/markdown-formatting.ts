import { joinURL } from "ufo";
import { useSourceUrl } from "../use-source-url";
import { isContentRecord } from "./types";

/** Read optional CMS text without coercing objects or missing values into visible strings. */
export function getContentText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Escape labels and descriptions inserted directly into generated Markdown. */
export function escapeMarkdownText(value: string): string {
  return value.replace(/[\\[\]*_`<>]/g, "\\$&");
}

/** Resolve internal paths and accept the link protocols used by content documents. */
export function resolveContentLink(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  // Reject raw whitespace, control characters and backslashes before writing a link destination.
  const hasInvalidCharacter = Array.from(value).some(
    (character) => character.charCodeAt(0) <= 32 || character === "\\"
  );
  if (hasInvalidCharacter) {
    return null;
  }

  if (value.startsWith("/")) {
    return useSourceUrl(value);
  }
  if (value.startsWith("#") || /^(https?:|mailto:|tel:)/i.test(value)) {
    return value;
  }

  return null;
}

/** Render a CMS link, retaining its label when the destination is missing or unsupported. */
export function renderMarkdownLink(label: unknown, destination: unknown): string {
  const title = escapeMarkdownText(getContentText(label));
  const href = resolveContentLink(destination);
  if (!href) {
    return title;
  }

  // Angle brackets keep parentheses in a URL from ending the Markdown destination early.
  return `[${title}](<${href.replace(/>/g, "%3E")}>)`;
}

/** Accept both an asset ID and an expanded Directus file record. */
export function resolveContentAsset(value: unknown, assetBaseUrl: string): string | null {
  let id = "";
  if (typeof value === "string") {
    id = value;
  } else if (isContentRecord(value)) {
    id = getContentText(value.id);
  }

  return id ? joinURL(assetBaseUrl, encodeURIComponent(id)) : null;
}

/** Discard unexpanded IDs or malformed entries before reading a related-record array. */
export function getContentRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isContentRecord) : [];
}

/** Respect the editor's explicit item order without mutating the fetched relation array. */
export function getSortedContentItems(value: unknown): Record<string, unknown>[] {
  return getContentRecords(value).toSorted(
    (left, right) => Number(left.sort ?? 0) - Number(right.sort ?? 0)
  );
}

/** Quote every line, including blank lines, so a callout remains one Markdown blockquote. */
export function renderMarkdownBlockquote(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => (line ? `> ${line}` : ">"))
    .join("\n");
}
