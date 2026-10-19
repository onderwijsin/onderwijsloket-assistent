import { joinURL } from "ufo";

/**
 * Build a canonical Onderwijsloket source URL from a local content path.
 *
 * @param path - Local content path under the canonical Onderwijsloket origin.
 * @returns The canonical source URL, or null when the path is not local.
 */
export function useSourceUrl(path: string): string | null {
  // Only local paths belong to this canonical origin; reject protocol-relative destinations.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  return joinURL("https://onderwijsloket.com", path);
}
