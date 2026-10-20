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
import { listResources } from "../../server/utils/resources/catalogue";
import { serveResource } from "../../server/utils/resources/read";
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
    vi.advanceTimersByTime(cacheDurations.collections.articles.detail * 1000 - 1);
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

// Real Nitro caching across every native definition, not an identity cache mock.
import faqs from "../../server/collections/faqs";
import sectors from "../../server/collections/sectors";
import testimonials from "../../server/collections/testimonials";
import institutions from "../../server/collections/educational-institutions";
import programs from "../../server/collections/programs";
import desks from "../../server/collections/regional-education-desks";
import shows from "../../server/collections/podcast-shows";
import episodes from "../../server/collections/podcast-episodes";
import videos from "../../server/collections/videos";
import { faqRecord, sectorRecord } from "../fixtures/faqs-and-sectors";
import { testimonialRecord } from "../fixtures/article-evidence-and-testimonials";
import { institutionRecord, programRecord } from "../fixtures/institutions-and-programs";
import { deskRecord } from "../fixtures/regional-education-desks";
import { showRecord, episodeRecord, videoRecord } from "../fixtures/podcasts-and-videos";
import { cacheCollectionDetail } from "../../server/utils/collections/cache-detail";
import { z } from "zod";

const detailCases = [
  { collection: articles, row: article },
  { collection: faqs, row: faqRecord },
  { collection: sectors, row: sectorRecord },
  { collection: testimonials, row: testimonialRecord },
  { collection: institutions, row: institutionRecord },
  { collection: programs, row: programRecord },
  { collection: desks, row: deskRecord },
  { collection: shows, row: showRecord },
  { collection: episodes, row: episodeRecord },
  { collection: videos, row: videoRecord }
];
it.each(detailCases)(
  "shares validated $collection.name detail across tools/resources, coalesces refreshes and expires at its configured TTL",
  async ({ collection, row }) => {
    read.mockResolvedValue([row]);
    const [first] = await Promise.all([collection.get(row.id), collection.get(row.id)]);
    expect(read).toHaveBeenCalledTimes(1);
    const ttl = cacheDurations.collections[collection.name].detail;
    expect(collection.cache?.detail).toBe(ttl);
    vi.advanceTimersByTime(1000);
    const second = await collection.get(row.id);
    expect(second.retrieved_at).not.toBe(first!.retrieved_at);
    const handler = serveResource({
      name: collection.name,
      id: collection.getInput.shape.id,
      get: async (id) => ({ record: (await collection.get(id)).record as unknown }),
      content: () => "Body"
    });
    await handler(new URL(`onderwijsloket://${collection.name}/${row.id}`), { id: row.id });
    expect(read).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ttl * 1000);
    await Promise.all([collection.get(row.id), collection.get(row.id)]);
    expect(read).toHaveBeenCalledTimes(2);
  }
);
it.each(detailCases)(
  "does not cache failed, missing or malformed $collection.name detail",
  async ({ collection, row }) => {
    read
      .mockRejectedValueOnce(new Error("provider secret"))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "malformed" }])
      .mockResolvedValue([row]);
    await expect(collection.get(row.id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    await expect(collection.get(row.id)).rejects.toThrow("NOT_FOUND");
    await expect(collection.get(row.id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    await collection.get(row.id);
    await collection.get(row.id);
    expect(read).toHaveBeenCalledTimes(4);
  }
);
it("isolates collection identities, supports disabling and rejects malformed cached payloads", async () => {
  const schema = z.object({ id: z.string(), title: z.string() });
  const one = vi.fn(async (id: string) => ({ id, title: "One" })),
    two = vi.fn(async (id: string) => ({ id, title: "Two" }));
  const first = cacheCollectionDetail("fixture-one", schema, one, 10),
    second = cacheCollectionDetail("fixture-two", schema, two, 20);
  expect(await first("same")).toEqual({ id: "same", title: "One" });
  expect(await second("same")).toEqual({ id: "same", title: "Two" });
  await first("other");
  expect(one).toHaveBeenCalledTimes(2);
  const disabled = cacheCollectionDetail("fixture-disabled", schema, two, false);
  await disabled("same");
  await disabled("same");
  expect(two).toHaveBeenCalledTimes(3);
  const key = [...entries.keys()].find(
    (key) => key.includes("fixture-one") && key.includes("same")
  )!;
  const entry = entries.get(key) as { value: unknown };
  entry.value = { id: "same", title: 123 };
  entries.set(key, entry);
  expect(await first("same")).toEqual({ id: "same", title: "One" });
  expect(one).toHaveBeenCalledTimes(3);
});
it("leaves ordinary lists and search queries uncached", async () => {
  read.mockResolvedValue([article]);
  await articles.list();
  await articles.list();
  expect(read).toHaveBeenCalledTimes(2);
  search.mockResolvedValue({ hits: [article], nbHits: 1, nbPages: 1 });
  await articles.search({ query: "teacher" });
  await articles.search({ query: "teacher" });
  expect(search).toHaveBeenCalledTimes(2);
});
it("does not serve an expired record after a failed refresh and retries the source", async () => {
  const schema = z.object({ id: z.string(), title: z.string() });
  const get = vi.fn(async (id: string) => ({ id, title: "Current" }));
  const cached = cacheCollectionDetail("refresh-failure", schema, get, 1);
  await cached("same");
  vi.advanceTimersByTime(1001);
  get.mockRejectedValueOnce(new Error("offline"));
  await expect(cached("same")).rejects.toThrow("offline");
  expect(await cached("same")).toEqual({ id: "same", title: "Current" });
  expect(get).toHaveBeenCalledTimes(3);
});
