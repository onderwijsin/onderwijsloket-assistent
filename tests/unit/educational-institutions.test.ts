import institutions from "../../server/collections/educational-institutions";
import {
  institutionRecord,
  institutionId,
  locationRecord,
  locationId,
  availabilityRecord
} from "../fixtures/institutions-and-programs";

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

describe("institution source contracts", () => {
  it("separates main and additional locations and public contacts from reverse programs and internal identifiers", async () => {
    read.mockResolvedValue([institutionRecord]);
    const { record } = await institutions.get(institutionId);
    expect(record.description).toContain("Institution guidance.");
    expect(record.main_location?.vendor).toBe("kiesmbo");
    expect(record.vendor).toBe("hovi");
    expect(record.code).toBe("0010");
    expect(record.brin_code).toBe("00AB");
    expect(record.locations[0]?.opening_hours?.sunday).toBe(false);
    expect(record.website?.map((site) => site.lang)).toEqual(["Nederlands", "Engels"]);
    expect(record.content_warnings).toEqual([]);
    expect(JSON.stringify(record)).not.toMatch(
      /private-source-id|internal@example|programs|reviewed_by/
    );
    const query = read.mock.calls[0]![0]().params;
    expect(query.deep.locations).toEqual({ _limit: 101, _sort: ["sort", "id"] });
    expect(JSON.stringify(query)).not.toMatch(
      /status|reviewers|hovi_id|kiesmbo_id|location_components/
    );
    expect(institutions.resourceMetadata!(record)).not.toHaveProperty("description");
  });
  it("keeps summaries light and implements enum, exact-text and nested location filters with stable pagination", async () => {
    read.mockResolvedValue([institutionRecord, institutionRecord]);
    const result = await institutions.list({
      page: 2,
      page_size: 1,
      filters: {
        code: "0010",
        brin_code: "00AB",
        type: "hogeschool",
        vendor: "hovi",
        locations: [locationId]
      }
    });
    expect(result).toMatchObject({ has_more: true, page: 2, page_size: 1 });
    expect(result.records[0]).not.toHaveProperty("description");
    expect(result.records[0]).not.toHaveProperty("email");
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      limit: 2,
      offset: 1,
      sort: ["title", "id"],
      filter: {
        code: { _eq: "0010" },
        brin_code: { _eq: "00AB" },
        type: { _eq: "hogeschool" },
        vendor: { _eq: "hovi" },
        locations: { locations_id: { id: { _in: [locationId] } } }
      }
    });
    expect(query.fields).not.toContain("description");
    expect(query.fields).not.toContain("website");
  });
  it("reports incomplete location relations and absent descriptions while preserving optional contacts", async () => {
    read.mockResolvedValue([
      {
        ...institutionRecord,
        main_location: null,
        locations: [
          { locations_id: null },
          ...Array.from({ length: 100 }, () => ({ locations_id: locationRecord }))
        ],
        description: null,
        website: [{ url: "javascript:alert(1)", lang: "Overig" }],
        email: null
      }
    ]);
    const { record } = await institutions.get(institutionId);
    expect(record.description).toBeNull();
    expect(record.main_location).toBeNull();
    expect(record.locations).toHaveLength(99);
    expect(record.relations_truncated).toEqual(["locations"]);
    expect(record.content_warnings).toContain("No content document is available.");
    expect(record.content_warnings).toContain("Unavailable or invalid institution website URL.");
    expect(record.content_warnings.join()).toContain("Unavailable related record");
    expect(record.website?.[0]?.url).toBeNull();
    expect(record.email).toBeNull();
    expect(record.truncated).toBe(false);
  });
  it("validates source enums and exposes actual enum choices and lookup paths", async () => {
    read.mockResolvedValue([]);
    const result = await institutions.filters();
    expect(result.filters.find((field) => field.name === "vendor")).toMatchObject({
      type: "string",
      enum: ["onderwijsloket", "hovi", "kiesmbo"]
    });
    expect(result.filters.find((field) => field.name === "locations")).toMatchObject({
      lookup: {
        collection: "educational_institutions",
        tool: "list_educational_institutions",
        path: "locations[].id"
      }
    });
    expect(institutions.filterSchema.safeParse({ type: "School" }).success).toBe(false);
    expect(institutions.filterSchema.safeParse({ vendor: "unknown" }).success).toBe(false);
  });
});

describe("institution errors and search", () => {
  it("sanitizes source errors, rejects malformed expansions and distinguishes missing records", async () => {
    for (const [collection, id, row] of [
      [institutions, institutionId, { ...institutionRecord, main_location: locationId }]
    ] as const) {
      read.mockResolvedValueOnce([row]);
      await expect(collection.get(id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
      read.mockRejectedValueOnce(new Error("provider secret"));
      await expect(collection.get(id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
      read.mockResolvedValueOnce([]);
      await expect(collection.get(id)).rejects.toThrow("NOT_FOUND");
      read.mockClear();
      await expect(collection.get("bad-id")).rejects.toThrow();
      expect(read).not.toHaveBeenCalled();
    }
  });
  it("uses partial institution search metadata without inventing an article description or schedule", async () => {
    search.mockResolvedValueOnce({
      hits: [
        {
          ...institutionRecord,
          objectID: institutionId,
          id: undefined,
          main_location: { ...locationRecord, opening_hours: availabilityRecord.id }
        }
      ],
      nbHits: 1,
      nbPages: 1
    });
    const result = await institutions.search({ query: "university" });
    expect(result.records[0]).toMatchObject({
      id: institutionId,
      main_location: { id: locationId }
    });
    expect(result.records[0]).not.toHaveProperty("description");
    expect(result.records[0]?.main_location).not.toHaveProperty("opening_hours");
    expect(JSON.stringify(search.mock.calls[0]![0])).not.toContain("status");
    expect(
      institutions.searchInput.safeParse({
        collection: "educational_institutions",
        filters: { vendor: ["hovi"] }
      }).success
    ).toBe(false);
  });
  it("exports portable schemas and actual resource templates for the collection", () => {
    for (const collection of [institutions]) {
      for (const schema of [
        collection.listOutput,
        collection.getOutput,
        collection.searchOutput,
        collection.filtersOutput
      ])
        expect(() => z.toJSONSchema(schema)).not.toThrow();
      expect(collection.metadata.resources).toEqual([
        { uri_template: `onderwijsloket://${collection.name}/{id}`, mime_type: "text/markdown" }
      ]);
    }
  });
});
