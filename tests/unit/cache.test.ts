import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { entries, read, search } = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  read: vi.fn(),
  search: vi.fn()
}));
vi.mock("nitropack/runtime/internal/app", () => ({
  useNitroApp: () => ({ captureError: vi.fn() })
}));
vi.mock("nitropack/runtime/internal/storage", () => ({
  useStorage: () => ({
    getItem: async (key: string) => structuredClone(entries.get(key)),
    setItem: async (key: string, value: unknown) => {
      entries.set(key, structuredClone(value));
    }
  })
}));
vi.mock("nitropack/runtime", async () => {
  const { defineCachedFunction, cachedFunction } = await import("nitropack/runtime/internal/cache");
  return {
    defineCachedFunction,
    cachedFunction,
    useRuntimeConfig: () => ({
      public: { directus: { assetBaseUrl: "https://assets.example.test" } }
    })
  };
});
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));

import articles from "../../server/collections/articles";
import { listResources, serveResource } from "../../server/utils/resources";
import { defineCollectionSearch } from "../../server/utils/search/collection-search";
import { facetsOptionsSchema } from "../../server/utils/search/schemas";
import { cacheDurations } from "../../config/cache";

const id = "00f81660-a2e4-48af-b8d7-98ce338de447";
const article = {
  id,
  sources: [],
  documents: [],
  authors: [],
  title: "Title",
  slug: "title",
  path: "/article",
  summary: "Summary",
  description: "Description"
};
beforeEach(() => {
  entries.clear();
  read.mockReset().mockResolvedValue([article]);
  search.mockReset().mockResolvedValue({ facets: { english: { false: 2 } } });
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("MCP cache boundaries", () => {
  it("shares article reads between tools and resources, isolates IDs and expires after five minutes", async () => {
    const get = serveResource({
      name: "articles",
      id: articles.getInput.shape.id,
      content: (record) => record.content,
      get: articles.get
    });
    await articles.get(id);
    await get(new URL(`onderwijsloket://articles/${id}`), { id });
    expect(read).toHaveBeenCalledTimes(1);
    const other = "00f81660-a2e4-48af-b8d7-98ce338de448";
    await articles.get(other);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(cacheDurations.article * 1000 - 1);
    await articles.get(id);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2);
    await articles.get(id);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("retries article errors and missing records instead of caching them", async () => {
    read.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce([]);
    await expect(articles.get(id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    await expect(articles.get(id)).rejects.toThrow("NOT_FOUND");
    await articles.get(id);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("keys facet results by collection and complete request, and expires counts", async () => {
    const collection = defineCollectionSearch({ name: "articles", indexName: "articles" });
    const args = facetsOptionsSchema.parse({});
    const first = await collection.facets(args);
    await collection.facets(args);
    expect(search).toHaveBeenCalledTimes(1);
    await collection.facets({ ...args, query: "teacher" });
    await collection.facets({ ...args, max_values: 5 });
    await collection.facets({ ...args, facets: ["english"] });
    await collection.facets({ ...args, filters: { english: [false] } });
    expect(search).toHaveBeenCalledTimes(6); // Includes one facet-name discovery request.
    await defineCollectionSearch({ name: "other", indexName: "other" }).facets(args);
    expect(search).toHaveBeenCalledTimes(7);
    vi.advanceTimersByTime(cacheDurations.facets * 1000 + 1);
    const refreshed = await collection.facets(args);
    expect(search).toHaveBeenCalledTimes(8);
    expect(refreshed.retrieved_at).not.toBe(first.retrieved_at);
  });

  it("caches complete catalogues per collection, refreshing all pages after expiry", async () => {
    read.mockImplementation(async (command) => (command().params.offset === 0 ? [article] : []));
    const catalogue = listResources(articles);
    expect((await Promise.all([catalogue(), catalogue()]))[0]!.resources).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(2);
    await catalogue();
    expect(read).toHaveBeenCalledTimes(2);
    await listResources({ name: "sectors", getInput: articles.getInput })();
    expect(read).toHaveBeenCalledTimes(4);
    vi.advanceTimersByTime(cacheDurations.resourceCatalogue * 1000 + 1);
    await catalogue();
    expect(read).toHaveBeenCalledTimes(6);
  });

  it("does not cache failed facets or incomplete catalogues", async () => {
    const collection = defineCollectionSearch({ name: "articles", indexName: "articles" });
    search.mockRejectedValueOnce(new Error("offline"));
    await expect(collection.facets(facetsOptionsSchema.parse({}))).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
    await collection.facets(facetsOptionsSchema.parse({}));
    expect(search).toHaveBeenCalledTimes(2);
    read
      .mockReset()
      .mockResolvedValueOnce([article])
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue([]);
    const catalogue = listResources(articles);
    await expect(catalogue()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect((await catalogue()).resources).toEqual([]);
    expect(read).toHaveBeenCalledTimes(3);
  });
});
