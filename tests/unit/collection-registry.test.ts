import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createCollectionRegistry } from "../../server/utils/collection-registry";
import { toolResult } from "../../server/utils/tool-result";
import { createFaqCollection } from "../fixtures/faq-collection";
import articles from "../../server/collections/articles";
import { collections } from "../../server/collections";

vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn
}));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: vi.fn() }));
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));

beforeEach(() => search.mockReset());

describe("allowlisted collection discovery", () => {
  it("keeps the explicit production allowlist independent of synthetic registry fixtures", async () => {
    const before = z.toJSONSchema(articles.getOutput);
    const { collection } = createFaqCollection();
    const registry = createCollectionRegistry([articles, collection]);
    expect(collections.catalogue().map(({ name }) => name)).toEqual([
      "articles",
      "faqs",
      "sectors",
      "testimonials",
      "educational_institutions",
      "programs",
      "regional_education_desks"
    ]);
    expect(registry.catalogue().map(({ name }) => name)).toEqual(["articles", "faqs"]);
    expect(z.toJSONSchema(articles.getOutput)).toEqual(before);
    expect(registry.catalogue()[1]).toMatchObject({
      fields: ["collection", "id", "question"],
      detail_fields: ["answer"],
      resources: [],
      operations: {
        list: "list_faqs",
        get: "get_faq",
        search: "search_faqs",
        filters: "get_filters",
        facets: "get_facets"
      }
    });
    expect((await registry.filters("faqs")).instructions).toContain("Call list_faqs and filters");
    expect((await registry.filters("faqs")).filters[0]?.operations).toEqual(["list_faqs"]);
    expect(Object.isFrozen(registry.entries)).toBe(true);
  });

  it("rejects unknown, prototype and unsupported names before provider calls", async () => {
    const { collection } = createFaqCollection();
    const noFacets = {
      ...collection,
      metadata: {
        ...collection.metadata,
        capabilities: { ...collection.metadata.capabilities, facets: false }
      }
    };
    const facets = vi.spyOn(noFacets, "facets");
    const registry = createCollectionRegistry([articles, noFacets]);
    for (const name of ["unknown", "__proto__", "constructor", "routes", "sources"]) {
      expect(() => registry.resolve(name)).toThrow("INVALID_COLLECTION");
      await expect(registry.filters(name)).rejects.toThrow("INVALID_COLLECTION");
    }
    await expect(registry.facets({ collection: "faqs" })).rejects.toThrow("UNSUPPORTED_OPERATION");
    expect(registry.facetsInput.safeParse({ collection: "faqs" }).success).toBe(false);
    expect(facets).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("does not mistake wrapped methods for supported capabilities", async () => {
    const { collection } = createFaqCollection();
    const unsupported = {
      ...collection,
      metadata: {
        ...collection.metadata,
        capabilities: { ...collection.metadata.capabilities, facets: false }
      }
    };
    const registry = createCollectionRegistry([unsupported]);
    expect(typeof unsupported.facets).toBe("function");
    expect(registry.facetsInput.safeParse({ collection: "faqs" }).success).toBe(false);
    expect(() => registry.resolve("faqs", "facets")).toThrow("UNSUPPORTED_OPERATION");
    expect(() => createCollectionRegistry([])).toThrow();
    expect(() => createCollectionRegistry([collection, collection])).toThrow();
  });

  it("validates shared discovery results and prevents cross-collection responses", async () => {
    const { collection } = createFaqCollection();
    const wrong = {
      ...collection,
      filters: vi.fn(async () => ({ ...(await collection.filters()), collection: "articles" }))
    };
    const registry = createCollectionRegistry([articles, wrong]);
    await expect(registry.filters("faqs")).rejects.toThrow();
    const wrongFacets = {
      ...collection,
      facets: vi.fn(async () => ({
        collection: "articles",
        query: "",
        filters: {},
        facets: [],
        max_values: 100,
        counts_are_exact: true,
        retrieved_at: new Date().toISOString()
      }))
    };
    await expect(
      createCollectionRegistry([articles, wrongFacets]).facets({ collection: "faqs" })
    ).rejects.toThrow();
  });
});

describe("independent collection boundaries", () => {
  it("accepts FAQ IDs and question/answer fields without leaking article assumptions or resources", async () => {
    const { collection, get } = createFaqCollection();
    expect(collection.getInput.safeParse({ collection: "faqs", id: "faq-1" }).success).toBe(true);
    expect(articles.getInput.safeParse({ collection: "articles", id: "faq-1" }).success).toBe(
      false
    );
    const result = await collection.get("faq-1");
    expect(result.record).toEqual({
      collection: "faqs",
      id: "faq-1",
      question: "Can I teach?",
      answer: "A synthetic answer."
    });
    expect(result.record).not.toHaveProperty("title");
    const packaged = toolResult(result);
    expect(packaged.content).toHaveLength(1);
    expect(packaged.content).toEqual([{ type: "text", text: JSON.stringify(result) }]);
    await expect(collection.get("not-a-faq-id")).rejects.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
    expect(
      collection.listInput.omit({ collection: true }).safeParse({ filters: { english: false } })
        .success
    ).toBe(true);
    await expect(collection.list({ filters: { slug: "invalid" } } as never)).rejects.toThrow();
  });

  it("uses a precise non-article search schema, projection and static facet allowlist", async () => {
    const { collection } = createFaqCollection();
    search
      .mockResolvedValueOnce({ facets: { "topics.name": { Teaching: 1 }, secret: { Hidden: 1 } } })
      .mockResolvedValueOnce({
        hits: [{ objectID: "faq-1", question: "Can I teach?", private: "secret" }],
        nbHits: 1,
        nbPages: 1
      });
    const result = await collection.search({ filters: { "topics.name": ["Teaching"] } });
    expect(result.records).toEqual([
      { collection: "faqs", id: "faq-1", question: "Can I teach?", snippet: null }
    ]);
    expect(search.mock.calls[1]![0].searchParams.attributesToRetrieve).toEqual([
      "objectID",
      "id",
      "question"
    ]);
    expect(
      collection.searchInput.safeParse({ collection: "faqs", filters: { english: [false] } })
        .success
    ).toBe(false);
    search.mockClear();
    await expect(collection.search({ filters: { english: [false] } } as never)).rejects.toThrow();
    expect(search).not.toHaveBeenCalled();
    search.mockResolvedValue({ facets: { "topics.name": { Teaching: 1 }, secret: { Hidden: 1 } } });
    const facets = await createCollectionRegistry([collection]).facets({ collection: "faqs" });
    expect(facets.facets.map(({ name }) => name)).toEqual(["topics.name"]);
    expect(search.mock.calls[0]![0].searchParams.facets).toEqual(["topics.name"]);
    search.mockClear();
    await expect(collection.facets({ facets: ["secret"] })).rejects.toThrow("INVALID_FILTER");
    expect(search).not.toHaveBeenCalled();
  });

  it("rejects malformed FAQ search hits through the actual provider adapter", async () => {
    const { collection } = createFaqCollection();
    search.mockResolvedValue({
      hits: [{ objectID: "not-a-faq-id", title: "Not a FAQ" }],
      nbHits: 1,
      nbPages: 1
    });
    await expect(collection.search()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
});
