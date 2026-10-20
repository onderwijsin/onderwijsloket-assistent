import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import programs from "../../server/collections/programs";
import institutions from "../../server/collections/educational-institutions";
import desks from "../../server/collections/regional-education-desks";
import articles from "../../server/collections/articles";
import { programRecord, institutionRecord } from "../fixtures/institutions-and-programs";
import { deskRecord } from "../fixtures/regional-education-desks";
import { GeocodingError } from "../../server/utils/geocoding";
import { geoSearchMetadataSchema, geoHitSchema } from "../../server/utils/search/geo";

const { search, geocode } = vi.hoisted(() => ({ search: vi.fn(), geocode: vi.fn() }));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: vi.fn() }));
vi.mock("../../server/utils/geocoding", async (original) => ({
  ...(await original<typeof import("../../server/utils/geocoding")>()),
  geocode
}));
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
const match = {
  mapboxId: "place.utrecht",
  name: "Utrecht",
  fullAddress: "Utrecht, Nederland",
  featureType: "place",
  latitude: 52.09,
  longitude: 5.12,
  bbox: [5, 52, 5.2, 52.2] as [number, number, number, number]
};
const ranking = {
  geoDistance: 123,
  geoPrecision: 10,
  matchedGeoLocation: { lat: 52.1, lng: 5.13, distance: 1234 }
};
const cases = [
  {
    collection: programs,
    hit: {
      ...programRecord,
      educational_institutions: programRecord.educational_institutions.map(
        (row) => row.educational_institutions_id
      )
    },
    kind: "indexed_location"
  },
  { collection: institutions, hit: institutionRecord, kind: "indexed_location" },
  { collection: desks, hit: deskRecord, kind: "service_area_grid" }
] as const;

beforeEach(() => {
  search.mockReset();
  geocode.mockReset().mockResolvedValue([match, { ...match, mapboxId: "place.alternative" }]);
});

/** Supply the collection's real hit shape while keeping upstream transport controlled. */
function respond(hit: { id: string }, info: unknown = ranking) {
  search.mockResolvedValue({
    hits: [{ ...hit, objectID: hit.id, _rankingInfo: info }],
    nbHits: 30,
    nbPages: 3,
    exhaustive: { nbHits: true }
  });
}

describe.each(cases)("location search for $collection.name", ({ collection, hit, kind }) => {
  it("resolves text and applies radius and distance-first ranking before pagination", async () => {
    respond(hit);
    const result = await collection.search({ location: " Utrecht ", query: "leraar", page: 2 });
    expect(geocode).toHaveBeenCalledWith("Utrecht");
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.lastCall?.[0]).toMatchObject({
      indexName: collection.name,
      searchParams: {
        query: "leraar",
        page: 1,
        hitsPerPage: 10,
        aroundLatLng: "52.09,5.12",
        aroundRadius: 50_000,
        aroundPrecision: 1,
        getRankingInfo: true,
        ranking: ["geo", "typo", "words", "filters", "proximity", "attribute", "exact", "custom"],
        typoTolerance: true,
        enableRules: false,
        enableReRanking: false,
        enablePersonalization: false,
        analytics: false
      }
    });
    const geo = geoSearchMetadataSchema.parse("geo" in result ? result.geo : undefined);
    expect(geo).toEqual({
      location_query: "Utrecht",
      matched_location: match,
      candidate_count: 2,
      radius_meters: 50_000,
      sort: "distance",
      distance_kind: kind
    });
    const record = result.records[0]!;
    expect(geoHitSchema.parse("geo" in record ? record.geo : undefined)).toEqual({
      distance_meters: 1234,
      matched_coordinates: { latitude: 52.1, longitude: 5.13 },
      precision_meters: 10
    });
    expect(result).toMatchObject({ page: 2, total: 30, total_pages: 3, has_more: true });
    expect(record).not.toHaveProperty("_rankingInfo");
    expect(record).not.toHaveProperty("_geoloc");
  });

  it("retains facets alongside geographic filtering and accepts an explicit radius", async () => {
    respond(hit);
    const filters: Record<string, (string | boolean)[]> =
      kind === "service_area_grid" ? { has_consultation_service: [true] } : { type: ["opleiding"] };
    search.mockResolvedValueOnce({
      facets: { type: { opleiding: 1 }, has_consultation_service: { true: 1 } }
    });
    await collection.search({ location: "Utrecht", radius: 12000, filters });
    expect(search.mock.lastCall?.[0].searchParams).toMatchObject({
      aroundRadius: 12000,
      facetFilters:
        kind === "service_area_grid" ? [["has_consultation_service:true"]] : [["type:opleiding"]]
    });
  });

  it("keeps ordinary searches unchanged and never calls geocoding", async () => {
    respond(hit);
    const result = await collection.search({ query: "leraar" });
    expect(geocode).not.toHaveBeenCalled();
    expect(search.mock.lastCall?.[0].searchParams).not.toHaveProperty("aroundLatLng");
    expect(search.mock.lastCall?.[0].searchParams).not.toHaveProperty("ranking");
    expect(result).not.toHaveProperty("geo");
    expect(result.records[0]).not.toHaveProperty("geo");
  });

  it("accepts geographic empty results without inventing hits", async () => {
    search.mockResolvedValue({ hits: [], nbHits: 0, nbPages: 0 });
    const result = await collection.search({ location: "Utrecht" });
    expect(result).toMatchObject({
      records: [],
      total: 0,
      has_more: false,
      geo: { radius_meters: 50000, matched_location: match }
    });
  });
});

describe("geographic search boundaries", () => {
  it("only exposes location and radius on the three opted-in collection schemas", () => {
    for (const { collection } of cases) {
      expect(z.toJSONSchema(collection.searchInput).properties).toHaveProperty("location");
      expect(z.toJSONSchema(collection.searchOutput).properties).toHaveProperty("geo");
    }
    expect(
      articles.searchInput.safeParse({ collection: "articles", location: "Utrecht" }).success
    ).toBe(false);
    expect(z.toJSONSchema(articles.searchOutput).properties).not.toHaveProperty("geo");
  });

  it.each([0, -1, 1.5, Infinity, NaN])(
    "rejects invalid radius %s before upstream calls",
    async (radius) => {
      await expect(programs.search({ location: "Utrecht", radius })).rejects.toThrow();
      expect(geocode).not.toHaveBeenCalled();
      expect(search).not.toHaveBeenCalled();
    }
  );

  it("rejects a radius without a location and invalid location strings", async () => {
    await expect(programs.search({ radius: 1000 })).rejects.toMatchObject({ statusCode: 400 });
    for (const location of ["  ", "a;b", "x".repeat(257)]) {
      await expect(programs.search({ location })).rejects.toThrow();
    }
    expect(geocode).not.toHaveBeenCalled();
    expect(search).not.toHaveBeenCalled();
  });

  it("does not search without geographic constraints when geocoding has no matches", async () => {
    geocode.mockResolvedValue([]);
    await expect(programs.search({ location: "unknown" })).rejects.toThrow("LOCATION_NOT_FOUND");
    expect(search).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_CONFIGURED", 503, "GEOCODING_NOT_CONFIGURED"],
    ["UPSTREAM_UNAVAILABLE", 502, "UPSTREAM_UNAVAILABLE"],
    ["INVALID_RESPONSE", 502, "UPSTREAM_UNAVAILABLE"],
    ["INVALID_QUERY", 400, "INVALID_LOCATION"]
  ] as const)("translates geocoding failure %s", async (code, statusCode, message) => {
    geocode.mockRejectedValue(new GeocodingError(code));
    await expect(programs.search({ location: "Utrecht" })).rejects.toMatchObject({
      statusCode,
      message: expect.stringContaining(message)
    });
    expect(search).not.toHaveBeenCalled();
  });

  it("converts precision-scaled distances without inventing matched coordinates", async () => {
    respond(cases[0].hit, { geoDistance: 123, geoPrecision: 10 });
    const result = await programs.search({ location: "Utrecht" });
    expect(result.records[0]).toMatchObject({
      geo: {
        distance_meters: 1230,
        matched_coordinates: null,
        precision_meters: 10
      }
    });
  });

  it.each([
    undefined,
    {},
    { geoDistance: -1 },
    { geoDistance: 1, matchedGeoLocation: { lat: 100, lng: 5, distance: 1 } }
  ])("rejects missing or invalid geo ranking data %s", async (info) => {
    search.mockResolvedValue({
      hits: [{ ...cases[0].hit, _rankingInfo: info }],
      nbHits: 1,
      nbPages: 1
    });
    await expect(programs.search({ location: "Utrecht" })).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
});
