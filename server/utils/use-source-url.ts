import { joinURL } from "ufo";

/** Build a canonical Onderwijsloket source URL from a local content path. */
export function useSourceUrl(path: string): string | null {
  // Only local paths belong to this canonical origin; reject protocol-relative destinations.
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  return joinURL("https://onderwijsloket.com", path);
}
