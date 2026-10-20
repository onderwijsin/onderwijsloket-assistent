import testimonials from "../../server/collections/testimonials";
import {
  author,
  profile,
  testimonialRecord,
  testimonialId
} from "../fixtures/article-evidence-and-testimonials";

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

describe("testimonial records and resources", () => {
  it("renders editor nodes and preserves future publication dates without introducing an english flag", async () => {
    read.mockResolvedValue([testimonialRecord]);
    const { record } = await testimonials.get(testimonialId);
    expect(record.content).toContain("My personal story.");
    expect(record.content).toContain("[Advice](<https://onderwijsloket.com/advies>)");
    expect(record.publication_date).toBe("2999-01-01T00:00:00");
    expect(record.authors[0]?.id).toBe(author.id);
    expect(record.profiles[0]?.id).toBe(profile.id);
    expect(record.content_warnings).toEqual([]);
    expect(record).not.toHaveProperty("english");
    const metadata = testimonials.resourceMetadata!(record);
    expect(metadata).not.toHaveProperty("content");
    expect(metadata).toMatchObject({
      publication_date: record.publication_date,
      authors: record.authors,
      profiles: record.profiles,
      relations_truncated: []
    });
    expect(testimonials.metadata.resources).toEqual([
      { uri_template: "onderwijsloket://testimonials/{id}", mime_type: "text/markdown" }
    ]);
  });
  it("uses native junction filters, stable pagination and summary projections without body reads", async () => {
    read.mockResolvedValue([testimonialRecord, testimonialRecord]);
    const guid = "00000000-0000-0000-0000-000000000001";
    const result = await testimonials.list({
      page: 2,
      page_size: 1,
      sort: "-publication_date",
      filters: {
        title: "My teaching experience",
        sectors: [guid],
        authors: [author.id],
        profiles: [profile.id]
      }
    });
    expect(result).toMatchObject({ page: 2, page_size: 1, has_more: true });
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).not.toHaveProperty("content");
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      offset: 1,
      limit: 2,
      sort: ["-publication_date", "id"],
      filter: {
        title: { _eq: "My teaching experience" },
        sectors: { sectors_id: { id: { _in: [guid] } } },
        authors: { authors_id: { id: { _in: [author.id] } } },
        profiles: { profiles_id: { id: { _in: [profile.id] } } }
      }
    });
    expect(JSON.stringify(query)).not.toMatch(/status|body|editor_nodes|team_member|video_avatar/);
  });
  it("warns about absent documents and relation limits without claiming complete empty content", async () => {
    read.mockResolvedValue([
      {
        ...testimonialRecord,
        body: null,
        publication_date: null,
        profiles: [{ profiles_id: null }],
        authors: Array.from({ length: 101 }, () => ({ authors_id: author }))
      }
    ]);
    const { record } = await testimonials.get(testimonialId);
    expect(record.content).toBeNull();
    expect(record.authors).toHaveLength(100);
    expect(record.profiles).toEqual([]);
    expect(record.relations_truncated).toEqual(["authors"]);
    expect(record.content_warnings).toContain("No content document is available.");
    expect(record.content_warnings.join()).toContain("Unavailable related record");
    expect(record.publication_date).toBeNull();
    expect(record.truncated).toBe(false);
  });
  it("returns safe errors for source failures, malformed relations, unknown IDs and invalid inputs", async () => {
    for (const row of [
      { ...testimonialRecord, authors: [author.id] },
      { ...testimonialRecord, profiles: [{ profiles_id: { id: profile.id } }] }
    ]) {
      read.mockResolvedValueOnce([row]);
      await expect(testimonials.get(testimonialId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
    read.mockRejectedValueOnce(new Error("provider secret"));
    await expect(testimonials.get(testimonialId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    read.mockResolvedValueOnce([]);
    await expect(testimonials.get(testimonialId)).rejects.toThrow("NOT_FOUND");
    read.mockClear();
    await expect(testimonials.get("invalid")).rejects.toThrow();
    await expect(testimonials.list({ filters: { english: true } } as never)).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("discovers embedded person IDs via explicit paths without adding standalone support tools", async () => {
    read.mockResolvedValue([]);
    const result = await testimonials.filters();
    expect(result.filters.find((field) => field.name === "authors")).toMatchObject({
      lookup: { collection: "testimonials", tool: "list_testimonials", path: "authors[].id" }
    });
    expect(result.filters.find((field) => field.name === "profiles")).toMatchObject({
      lookup: { collection: "testimonials", tool: "list_testimonials", path: "profiles[].id" }
    });
    for (const schema of [
      testimonials.getOutput,
      testimonials.listOutput,
      testimonials.searchOutput,
      testimonials.filtersOutput
    ])
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    read.mockRejectedValueOnce(new Error("provider secret"));
    await expect(testimonials.filters()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
  it("accepts verified facets and lightweight hits without exposing full indexed documents", async () => {
    search.mockResolvedValueOnce({
      facets: { "authors.name": { "Editorial Author": 1 } }
    });
    search.mockResolvedValueOnce({
      hits: [{ ...testimonialRecord, id: undefined, objectID: testimonialId }],
      nbHits: 1,
      nbPages: 1
    });
    const result = await testimonials.search({
      query: "teacher",
      filters: { "authors.name": ["Editorial Author"] }
    });
    expect(result.records[0]).toMatchObject({
      id: testimonialId,
      publication_date: testimonialRecord.publication_date
    });
    expect(result.records[0]).not.toHaveProperty("body");
    const request = search.mock.calls.at(-1)![0];
    expect(request.searchParams.attributesToRetrieve).not.toContain("status");
    expect(
      testimonials.searchInput.safeParse({
        collection: "testimonials",
        filters: { "topic.name": ["x"] }
      }).success
    ).toBe(false);
    expect(
      testimonials.searchInput.safeParse({
        collection: "testimonials",
        filters: { english: [true] }
      }).success
    ).toBe(false);
  });
});
