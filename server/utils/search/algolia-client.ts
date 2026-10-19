import { algoliasearch } from "algoliasearch";
import { parseURL } from "ufo";
import { useRuntimeConfig } from "nitropack/runtime";

let cached:
  | { applicationId: string; token: string; host: string; client: ReturnType<typeof algoliasearch> }
  | undefined;

/**
 * Reuse a server-only SDK client. Algolia's package supplies Node and Workers runtime builds.
 *
 * @returns The SDK client reused for the current private runtime configuration.
 */
export function useAlgoliaClient() {
  const { applicationId, token, host } = useRuntimeConfig().algolia;
  if (cached?.applicationId === applicationId && cached.token === token && cached.host === host) {
    return cached.client;
  }

  cached = { applicationId, token, host, client: createClient(applicationId, token, host) };
  return cached.client;
}

/**
 * Use the default Algolia hosts unless a private fixture host is configured.
 *
 * @param applicationId - Application identifier from private runtime configuration.
 * @param token - Server-side API credential.
 * @param host - Optional HTTP(S) host override; empty selects the default hosts.
 * @returns An SDK client using default hosts or the validated host override.
 */
function createClient(applicationId: string, token: string, host: string) {
  if (!host) return algoliasearch(applicationId, token, undefined);

  const url = parseURL(host);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Unsupported Algolia host protocol.");
  }
  if (!url.host) throw new Error("Missing Algolia host.");

  return algoliasearch(applicationId, token, {
    hosts: [
      { url: url.host, protocol: url.protocol === "http:" ? "http" : "https", accept: "readWrite" }
    ]
  });
}
