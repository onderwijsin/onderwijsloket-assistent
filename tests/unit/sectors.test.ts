import sectors, { sectorResourceContent } from "../../server/collections/sectors";
import { sectorRecord, faqId, sectorId, relatedArticle } from "../fixtures/faqs-and-sectors";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
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

describe("sector content and identity", () => {
  it("accepts source-authorized records at every relationship depth without status checks", async () => {
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

describe("sector search", () => {
  it("advertises collection-specific search capabilities", async () => {
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

it("uses the shared notice when sector prose is absent", () => {
  expect(
    sectorResourceContent({
      title: "Sector",
      description: "",
      introduction: null,
      roles_content: null,
      routes_content: null,
      salary_content: null,
      costs_content: null
    })
  ).toContain("> **Notice:** No body content is available.");
});
