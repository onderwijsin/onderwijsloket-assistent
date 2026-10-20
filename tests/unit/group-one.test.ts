import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import faqs from "../../server/collections/faqs";
import sectors from "../../server/collections/sectors";
import { faqRecord, sectorRecord, faqId, sectorId, relatedArticle } from "../fixtures/group-one";

const { read, search } = vi.hoisted(() => ({ read: vi.fn(), search: vi.fn() }));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));
vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn,
  useRuntimeConfig: () => ({
    public: { directus: { assetBaseUrl: "https://assets.example.test" } }
  })
}));
beforeEach(() => {
  read.mockReset();
  search.mockReset();
});

describe("FAQ contracts", () => {
  it("accepts source-authorized records at every relationship depth without status checks", async () => {
    read.mockResolvedValueOnce([
      {
        ...faqRecord,
        status: "draft",
        sectors: [{ sectors_id: { ...faqRecord.sectors[0]!.sectors_id, status: "archived" } }],
        articles: [{ articles_id: { ...relatedArticle, status: "draft" } }]
      }
    ]);
    expect((await faqs.get(faqId)).record.articles).toHaveLength(1);
    read.mockResolvedValueOnce([
      {
        ...sectorRecord,
        status: "draft",
        featured_articles: [{ articles_id: { ...relatedArticle, status: "archived" } }],
        featured_faqs: [{ faqs_id: { id: faqId, question: "Source FAQ", status: "draft" } }],
        featured_media: sectorRecord.featured_media.map((row) => ({
          ...row,
          item: { ...row.item, status: "draft" }
        }))
      }
    ]);
    expect((await sectors.get(sectorId)).record.featured_media).toHaveLength(1);
    read.mockResolvedValueOnce([sectorRecord]);
    await sectors.list();
    for (const [request] of read.mock.calls)
      expect(JSON.stringify(request().params)).not.toMatch(/status|publication_date/);
  });

  it("renders native answers and flattened taxonomy/article references without article metadata", async () => {
    read.mockResolvedValue([faqRecord]);
    const { record } = await faqs.get(faqId);
    expect(record.answer).toBe("**Yes, with the required qualification.**");
    expect(record.source_url).toBeNull();
    expect(record.sectors).toEqual([
      {
        id: sectorId,
        title: "Primary education",
        slug: "primary",
        description: "Primary education"
      }
    ]);
    expect(record.articles).toEqual([
      {
        id: relatedArticle.id,
        title: "Article",
        source_url: "https://onderwijsloket.com/kennisbank/artikelen/article"
      }
    ]);
    expect(record).not.toHaveProperty("title");
    expect(record).not.toHaveProperty("slug");
    expect(record).not.toHaveProperty("status");
    expect(record.content_warnings).toEqual([]);
    expect(record.relations_truncated).toEqual([]);
    const query = read.mock.calls[0]![0]().params;
    expect(query.filter).toEqual({ id: { _eq: faqId } });
    expect(JSON.stringify(query)).not.toContain("status");
    expect(query.deep.articles).toMatchObject({
      _limit: 101,
      _sort: ["id"]
    });
    expect(JSON.stringify(query.fields)).not.toContain("editor_nodes");
  });
  it("filters via actual junction keys, retains false values and fetches a continuation row", async () => {
    read.mockResolvedValue([faqRecord, faqRecord]);
    const result = await faqs.list({
      page: 2,
      page_size: 1,
      filters: { english: false, sectors: [sectorId], articles: [relatedArticle.id] }
    });
    expect(result).toMatchObject({ page: 2, page_size: 1, has_more: true });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).not.toHaveProperty("answer");
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      limit: 2,
      offset: 1,
      sort: ["question", "id"],
      filter: {
        english: { _eq: false },
        sectors: { sectors_id: { id: { _in: [sectorId] } } },
        articles: { articles_id: { id: { _in: [relatedArticle.id] } } }
      }
    });
    expect(query.fields).not.toContain("answer");
    expect(JSON.stringify(query)).not.toContain("status");
  });
  it("reports null targets and truncation instead of silently returning complete relations", async () => {
    read.mockResolvedValue([
      {
        ...faqRecord,
        articles: [
          { articles_id: null },
          ...Array.from({ length: 100 }, () => ({ articles_id: relatedArticle }))
        ]
      }
    ]);
    const { record } = await faqs.get(faqId);
    expect(record.articles).toHaveLength(99);
    expect(record.relations_truncated).toContain("articles");
    expect(record.content_warnings.join()).toContain("Unavailable related record");
  });
  it("rejects unexpanded and malformed source data with safe errors", async () => {
    for (const value of [
      { ...faqRecord, answer: { invalid: true } },
      { ...faqRecord, sectors: [sectorId] }
    ]) {
      read.mockResolvedValueOnce([value]);
      await expect(faqs.get(faqId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
    read.mockResolvedValueOnce([]);
    await expect(faqs.get(faqId)).rejects.toThrow("NOT_FOUND");
    await expect(faqs.get("faq-1")).rejects.toThrow();
    await expect(faqs.list({ filters: { slug: "x" } } as never)).rejects.toThrow();
  });
  it("advertises article-ID lookup separately from taxonomy choices", async () => {
    read.mockResolvedValue([]);
    const result = await faqs.filters();
    expect(result.filters.find(({ name }) => name === "articles")).toMatchObject({
      type: "array",
      lookup: { collection: "articles", tool: "list_articles" },
      operations: ["list_faqs"]
    });
    expect(result.instructions).toContain("Call list_faqs and filters");
    expect(() => z.toJSONSchema(faqs.filtersOutput)).not.toThrow();
  });
});

describe("sector content and identity", () => {
  it("keeps named plain-text sections and GUID identity, with no facets", async () => {
    read.mockResolvedValue([sectorRecord]);
    const { record } = await sectors.get(sectorId);
    expect(record).toMatchObject({
      id: sectorId,
      source_url: "https://onderwijsloket.com/primary",
      introduction: "Teach children.",
      routes_content: null
    });
    expect(record.featured_faqs).toEqual([
      { id: faqId, question: "Can I teach?", source_url: null }
    ]);
    expect(record.costs_actions?.[0]?.link).toBe("https://onderwijsloket.com/funding");
    expect(record.salary_cards?.[0]?.link_internal).toBeNull();
    expect(record.salary_cards?.[1]).toMatchObject({ link: null, link_label: null });
    expect(sectors.metadata.capabilities).toMatchObject({
      list: true,
      get: true,
      search: true,
      facets: false
    });
    expect(sectors.metadata.resources).toEqual([
      { uri_template: "onderwijsloket://sectors/{id}", mime_type: "text/markdown" }
    ]);
    expect(sectors.searchInput.omit({ collection: true }).safeParse({ filters: {} }).success).toBe(
      false
    );
    await expect(sectors.facets()).rejects.toThrow("UNSUPPORTED_OPERATION");
    const query = read.mock.calls[0]![0]().params;
    expect(query.deep.featured_media).toMatchObject({ _limit: 101, _sort: ["sort", "id"] });
    expect(query.deep.featured_articles._sort).toEqual(["id"]);
    expect(JSON.stringify(query)).not.toMatch(/status|publication_date/);
  });
  it("preserves source media ordering and future dates, reporting missing targets", async () => {
    read.mockResolvedValue([
      {
        ...sectorRecord,
        featured_media: [
          {
            ...sectorRecord.featured_media[0],
            id: 2,
            sort: 1,
            collection: "podcast_episodes",
            item: { ...sectorRecord.featured_media[0]!.item, title: "First" }
          },
          {
            ...sectorRecord.featured_media[0],
            id: 3,
            sort: 2,
            item: { ...sectorRecord.featured_media[0]!.item, title: "Second" }
          },
          { id: 4, sort: 3, collection: "videos", item: null },
          {
            ...sectorRecord.featured_media[0],
            id: 5,
            sort: 4,
            item: {
              ...sectorRecord.featured_media[0]!.item,
              publication_date: "2999-01-01T00:00:00Z"
            }
          }
        ]
      }
    ]);
    const { record } = await sectors.get(sectorId);
    expect(record.featured_media.map(({ title }) => title)).toEqual([
      "First",
      "Second",
      "Experience"
    ]);
    expect(record.featured_media[0]?.collection).toBe("podcast_episodes");
    expect(record.content_warnings).toContain("Unavailable featured media omitted.");
  });
  it("rejects unexpanded sectors without leaking upstream details", async () => {
    read.mockResolvedValueOnce([{ ...sectorRecord, featured_articles: [relatedArticle.id] }]);
    await expect(sectors.get(sectorId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    read.mockResolvedValueOnce([]);
    await expect(sectors.get(sectorId)).rejects.toThrow("NOT_FOUND");
  });
});

describe("independent search adapters", () => {
  it("returns FAQ question hits independently of publication status", async () => {
    search.mockResolvedValueOnce({
      hits: [{ objectID: faqId, question: "Can I teach?" }],
      nbHits: 1,
      nbPages: 1
    });
    const result = await faqs.search({ query: "teach" });
    expect(result.records[0]).toMatchObject({
      id: faqId,
      question: "Can I teach?",
      source_url: null
    });
    expect(result.records[0]).not.toHaveProperty("slug");
    search.mockResolvedValueOnce({
      hits: [{ objectID: faqId, question: "Source result", status: "draft" }],
      nbHits: 1,
      nbPages: 1
    });
    expect((await faqs.search()).records[0]?.question).toBe("Source result");
    for (const [request] of search.mock.calls)
      expect(JSON.stringify(request)).not.toContain("status");
  });
  it("accepts verified FAQ facets while sectors advertise a query-only schema", async () => {
    expect(
      faqs.searchInput.safeParse({
        collection: "faqs",
        filters: { english: [false], "topics.name": ["Teaching"] }
      }).success
    ).toBe(true);
    expect(
      faqs.searchInput.safeParse({ collection: "faqs", filters: { title: ["x"] } }).success
    ).toBe(false);
    search.mockResolvedValueOnce({
      hits: [{ ...sectorRecord, objectID: sectorId, status: "draft" }],
      nbHits: 1,
      nbPages: 1
    });
    expect((await sectors.search()).records[0]).toMatchObject({
      id: sectorId,
      source_url: "https://onderwijsloket.com/primary"
    });
    expect(JSON.stringify(search.mock.calls[0]![0])).not.toContain("status");
    expect(() => z.toJSONSchema(sectors.searchOutput)).not.toThrow();
  });
});
