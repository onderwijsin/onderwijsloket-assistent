import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineCollectionSearch } from "../../server/utils/search/collection-search";
import { findSearchSnippet } from "../../server/utils/search/snippets";
import {
  searchOptionsSchema,
  facetsOptionsSchema,
  searchResultSchema
} from "../../server/utils/search/schemas";

const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));
vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn
}));
const id = "00f81660-a2e4-48af-b8d7-98ce338de447";
const hit = {
  objectID: id,
  title: "Title",
  path: "/article",
  description: "Short description",
  slug: "article"
};
const response = {
  hits: [hit],
  nbHits: 1,
  nbPages: 1,
  exhaustive: { nbHits: true, facetsCount: true }
};
beforeEach(() => {
  search.mockReset();
});

describe("query-centered snippets", () => {
  it("finds nested relation matches and prefers full query matches with useful context", () => {
    expect(
      findSearchSnippet({
        title: { value: "Partial title", matchLevel: "partial" },
        topics: [{ name: { value: "Matched topic", matchLevel: "full" } }],
        body: {
          value: "A long and useful **matched** excerpt with surrounding context",
          matchLevel: "full"
        }
      })
    ).toEqual({
      field: "body",
      text: "A long and useful **matched** excerpt with surrounding context",
      match_level: "full"
    });
    expect(
      findSearchSnippet({ topics: [{ name: { value: "Topic", matchLevel: "partial" } }] })
    ).toMatchObject({ field: "topics.name", match_level: "partial" });
    expect(findSearchSnippet({ title: { value: "No match", matchLevel: "none" } })).toBeNull();
    expect(findSearchSnippet(undefined)).toBeNull();
  });
});

describe("collection-independent Algolia queries", () => {
  const collection = defineCollectionSearch({ name: "examples", indexName: "example_index" });

  it("uses one-based pages, a minimal projection and no snippets for browsing", async () => {
    search.mockResolvedValue(response);
    const result = await collection.search(searchOptionsSchema.parse({ page: 2, page_size: 5 }));
    expect(search.mock.calls[0]![0]).toMatchObject({
      indexName: "example_index",
      searchParams: {
        page: 1,
        hitsPerPage: 5,
        attributesToSnippet: [],
        attributesToHighlight: [],
        analytics: false
      }
    });
    expect(result.records[0]).toMatchObject({
      id,
      collection: "examples",
      source_url: "https://onderwijsloket.com/article",
      snippet: null
    });
    expect(result.has_more).toBe(false);
    expect(searchResultSchema.safeParse(result).success).toBe(true);
    expect(search.mock.calls[0]![0].searchParams.attributesToRetrieve).not.toContain("bodyString");
  });

  it("supports different field mappings and exposes only matched context from a text query", async () => {
    const mapped = defineCollectionSearch({
      name: "examples",
      indexName: "other",
      fields: { id: "key", title: "name", path: "route" }
    });
    search.mockResolvedValue({
      ...response,
      hits: [
        {
          key: id,
          name: "Example",
          route: "/example",
          _snippetResult: { content: { value: "A **match** in context", matchLevel: "full" } },
          secret: "do not return",
          bodyString: "full body"
        }
      ]
    });
    const result = await mapped.search(searchOptionsSchema.parse({ query: "match" }));
    expect(result.records[0]).toMatchObject({
      id,
      title: "Example",
      snippet: { field: "content", text: "A **match** in context" }
    });
    expect(result.records[0]).not.toHaveProperty("secret");
    expect(result.records[0]).not.toHaveProperty("bodyString");
  });

  it("discovers facet names dynamically and treats values as literals with AND/OR semantics", async () => {
    search
      .mockResolvedValueOnce({ facets: { "new.name": { A: 1 }, english: { false: 1 } } })
      .mockResolvedValueOnce(response);
    await collection.search(
      searchOptionsSchema.parse({ filters: { "new.name": ["A OR B", "-Lead"], english: [false] } })
    );
    expect(search.mock.calls[0]![0].searchParams).toMatchObject({
      facets: ["*"],
      hitsPerPage: 0,
      maxValuesPerFacet: 1
    });
    expect(search.mock.calls[1]![0].searchParams.facetFilters).toEqual([
      ["new.name:A OR B", "new.name:\\-Lead"],
      ["english:false"]
    ]);
  });

  it("rejects unknown facets before executing the search query", async () => {
    search.mockResolvedValue({ facets: { english: { false: 1 } } });
    await expect(
      collection.search(searchOptionsSchema.parse({ filters: { unknown: ["x"] } }))
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(search).toHaveBeenCalledTimes(1);
  });

  it("returns dynamic facet counts scoped by query and does not retrieve hits", async () => {
    search.mockResolvedValue({
      facets: { "dynamic.name": { B: 2, A: 2, C: 4 } },
      exhaustiveFacetsCount: false
    });
    const result = await collection.facets(
      facetsOptionsSchema.parse({ query: "match", max_values: 5 })
    );
    expect(result.facets).toEqual([
      {
        name: "dynamic.name",
        values: [
          { value: "C", count: 4 },
          { value: "A", count: 2 },
          { value: "B", count: 2 }
        ]
      }
    ]);
    expect(result.counts_are_exact).toBe(false);
    expect(search.mock.calls[0]![0].searchParams).toMatchObject({
      query: "match",
      facets: ["*"],
      hitsPerPage: 0,
      attributesToRetrieve: [],
      maxValuesPerFacet: 5
    });
  });

  it("does not treat missing matching hits as an error", async () => {
    search.mockResolvedValue({ hits: [], nbHits: 0, nbPages: 0 });
    const result = await collection.search(searchOptionsSchema.parse({ query: "absent" }));
    expect(result).toMatchObject({ records: [], total: 0, total_is_exact: false, has_more: false });
  });

  it("sanitizes provider and validation failures", async () => {
    search.mockRejectedValueOnce(new Error("provider token secret"));
    await expect(collection.search(searchOptionsSchema.parse({}))).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
    search.mockResolvedValueOnce({ ...response, hits: [{ id: "invalid" }] });
    await expect(collection.search(searchOptionsSchema.parse({}))).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
    search.mockResolvedValueOnce({ facets: { english: { false: -1 } } });
    await expect(collection.facets(facetsOptionsSchema.parse({}))).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
  });
});
