import { beforeEach, describe, it, expect, vi } from "vitest";
import { z } from "zod";
import desks from "../../server/collections/regional-education-desks";
import { deskResourceContent } from "../../server/utils/content/desk-resource";
import { areaSourceSchema } from "../../server/utils/projections/service-areas";
import { deskRecord, deskId, areaRecord } from "../fixtures/regional-education-desks";
import { sectorId } from "../fixtures/faqs-and-sectors";
import { serveResource } from "../../server/utils/resources/read";
import { listResources } from "../../server/utils/resources/catalogue";
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

describe("regional education desk source contracts", () => {
  it("expands coverage independently from physical location and phone/opening schedules", async () => {
    read.mockResolvedValue([
      {
        ...deskRecord,
        service_links: [{ ...deskRecord.service_links[0], type: "oriëntatieactiviteiten" }],
        status: "draft",
        notes: "private",
        vendor: "do-not-invent",
        last_sync: "private"
      }
    ]);
    const { record } = await desks.get(deskId);
    expect(record.area).toEqual(areaRecord);
    expect(record.phone_availability?.monday_start).toBe("09:00:00");
    expect(record.location?.opening_hours?.monday_start).toBe("22:00:00");
    expect(record.description).toContain("Independent regional guidance.");
    expect(record.consultation_service_description).toBe("Book an advice conversation.");
    expect(record.orientation_activity_types).toContain("open dagen (opleiding)");
    expect(record.content_types).toContain("anders");
    expect(record.email_response_time).toBe("zo snel mogelijk");
    expect(record.sectors[0]?.id).toBe(sectorId);
    expect(record.content_warnings).toEqual([]);
    expect(
      JSON.stringify([record, desks.resourceMetadata!(record), read.mock.calls[0]![0]().params])
    ).not.toMatch(/notes|status|last_sync|do-not-invent|reviewers/);
    expect(record).not.toHaveProperty("vendor");
    const markdown = deskResourceContent(record);
    expect(markdown.match(/# Regional advice desk/g)).toHaveLength(1);
    expect(markdown).toContain("## Consultation service\n\nBook an advice conversation.");
    expect(desks.resourceMetadata!(record)).not.toHaveProperty("description");
  });
  it("keeps false values and sector junction filters, using stable bounded pages without bodies", async () => {
    read.mockResolvedValue([deskRecord, deskRecord]);
    const result = await desks.list({
      filters: {
        has_consultation_service: false,
        has_physical_location: false,
        appointment_for_visit: false,
        sectors: [sectorId]
      },
      page: 2,
      page_size: 1,
      sort: "-title"
    });
    expect(result.has_more).toBe(true);
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      filter: {
        has_consultation_service: { _eq: false },
        has_physical_location: { _eq: false },
        appointment_for_visit: { _eq: false },
        sectors: { sectors_id: { id: { _in: [sectorId] } } }
      },
      limit: 2,
      offset: 1,
      sort: ["-title", "id"]
    });
    expect(query.fields).not.toContain("description");
    expect(JSON.stringify(query.fields)).not.toContain("phone_availability");
    expect(result.records[0]).not.toHaveProperty("description");
  });
  it("does not advertise unsupported source JSON-array or geographic filters", async () => {
    read.mockResolvedValue([]);
    const result = await desks.filters();
    expect(result.filters.map((value) => value.name)).toEqual([
      "title",
      "slug",
      "sectors",
      "has_consultation_service",
      "has_physical_location",
      "appointment_for_visit"
    ]);
    expect(
      result.filters.every((value) => value.operations[0] === "list_regional_education_desks")
    ).toBe(true);
    for (const filter of [
      { regions: ["Region"] },
      { content_types: ["podcasts"] },
      { orientation_activity_types: ["webinars"] },
      { lat: 52 },
      { vendor: "onderwijsloket" }
    ])
      expect(desks.filterSchema.safeParse(filter).success).toBe(false);
  });
  it("preserves inaccessible coverage and missing advertised location without inventing empty regions", async () => {
    read.mockResolvedValue([
      {
        ...deskRecord,
        area: null,
        location: null,
        regions: null,
        description: null,
        consultation_service_description: null,
        phone_availability: null
      }
    ]);
    const { record } = await desks.get(deskId);
    expect(record.area).toBeNull();
    expect(record.location).toBeNull();
    expect(record.phone_availability).toBeNull();
    expect(record.description).toBeNull();
    expect(record.consultation_service_description).toBeNull();
    expect(record.content_warnings.join()).toContain("coverage cannot be determined");
    expect(record.content_warnings.join()).toContain("physical location");
    expect(deskResourceContent(record).match(/\*\*Notice:\*\*/g)).toHaveLength(2);
  });
  it("bounds sector relations and reports unavailable targets independently of document truncation", async () => {
    read.mockResolvedValue([
      {
        ...deskRecord,
        sectors: [{ sectors_id: null }, ...Array.from({ length: 100 }, () => deskRecord.sectors[0])]
      }
    ]);
    const { record } = await desks.get(deskId);
    expect(record.sectors).toHaveLength(99);
    expect(record.relations_truncated).toEqual(["sectors"]);
    expect(record.content_warnings.join()).toContain("Unavailable related record");
    expect(record.truncated).toBe(false);
    expect(read.mock.calls[0]![0]().params.deep.sectors).toEqual({ _limit: 101, _sort: ["id"] });
  });
  it("sanitizes unusable public URLs and preserves service types without inventing destinations", async () => {
    read.mockResolvedValue([
      {
        ...deskRecord,
        website: "javascript:evil",
        consultation_service_url: "javascript:evil",
        service_links: [{ ...deskRecord.service_links[0], url: "javascript:evil" }]
      }
    ]);
    const { record } = await desks.get(deskId);
    expect(record.website).toBeNull();
    expect(record.consultation_service_url).toBeNull();
    expect(record.service_links?.[0]?.url).toBeNull();
    expect(record.content_warnings).toHaveLength(3);
  });
  it("rejects unexpanded required relations, malformed geometry and unknown source enums safely", async () => {
    for (const row of [
      { ...deskRecord, area: areaRecord.id },
      {
        ...deskRecord,
        area: { ...areaRecord, area_center: { type: "Point", coordinates: [200, 52] } }
      },
      { ...deskRecord, email_response_time: "tomorrow" },
      { ...deskRecord, phone_availability: deskRecord.phone_availability.id }
    ]) {
      read.mockResolvedValueOnce([row]);
      await expect(desks.get(deskId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
    read.mockRejectedValueOnce(new Error("provider secret"));
    await expect(desks.get(deskId)).rejects.not.toThrow("provider secret");
    read.mockResolvedValueOnce([]);
    await expect(desks.get(deskId)).rejects.toThrow("NOT_FOUND");
    await expect(desks.get("bad")).rejects.toThrow();
  });
});
describe("service area geometry", () => {
  it("normalizes serialized GeoJSON and absent optional geometry without interpreting coverage", () => {
    expect(
      areaSourceSchema.parse({
        ...areaRecord,
        area_center: JSON.stringify(areaRecord.area_center),
        area_bounds: JSON.stringify(areaRecord.area_bounds),
        area_inner: JSON.stringify(areaRecord.area_inner)
      })
    ).toEqual(areaRecord);
    expect(areaSourceSchema.parse({ id: areaRecord.id, title: "Region" })).toMatchObject({
      area_center: null,
      area_bounds: null,
      area_inner: null
    });
  });
  it("rejects invalid coordinate ranges, unclosed rings and unsupported geometry types", () => {
    for (const area_bounds of [
      "bad",
      { type: "Polygon", coordinates: [[]] },
      {
        type: "Polygon",
        coordinates: [
          [
            [4, 51],
            [6, 51],
            [6, 53],
            [5, 51]
          ]
        ]
      },
      { type: "Point", coordinates: [4, 51] },
      {
        type: "Polygon",
        coordinates: [
          [
            [4, 51],
            [6, 51],
            [6, 100],
            [4, 51]
          ]
        ]
      }
    ])
      expect(areaSourceSchema.safeParse({ ...areaRecord, area_bounds }).success).toBe(false);
  });
});
describe("desk search and resources", () => {
  it("uses only verified facets and lightweight index fields, preserving false boolean searches", async () => {
    search.mockResolvedValue({
      hits: [{ ...deskRecord, objectID: deskId, _geoloc: [{ lat: 0, lng: 0 }] }],
      nbHits: 1,
      nbPages: 1,
      facets: {
        "sectors.title": {},
        has_consultation_service: { false: 1 },
        orientation_activity_types: { webinars: 1 },
        content_types: { podcasts: 1 }
      }
    });
    const result = await desks.search({
      filters: { has_consultation_service: [false], content_types: ["podcasts"] }
    });
    expect(result.records[0]).toMatchObject({ id: deskId, regions: ["Synthetic region"] });
    expect(result.records[0]).not.toHaveProperty("area");
    expect(result.records[0]).not.toHaveProperty("_geoloc");
    expect(search.mock.calls.at(-1)![0].searchParams.facetFilters).toContainEqual([
      "has_consultation_service:false"
    ]);
    expect(search.mock.calls.at(-1)![0].searchParams.attributesToRetrieve).not.toContain("area");
    const facets = await desks.facets({});
    expect(facets.facets).toHaveLength(4);
    for (const filter of [
      { regions: ["Region"] },
      { has_physical_location: [true] },
      { content_types: ["bad"] }
    ])
      expect(desks.searchInput.safeParse({ filters: filter }).success).toBe(false);
    search.mockRejectedValueOnce(new Error("provider secret"));
    await expect(desks.search({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
  it("advertises portable schemas and readable templates, and lists descriptor-only catalogue pages", async () => {
    for (const schema of [
      desks.listInput,
      desks.listOutput,
      desks.getOutput,
      desks.searchInput,
      desks.searchOutput,
      desks.filtersOutput
    ])
      expect(() => z.toJSONSchema(schema)).not.toThrow();
    expect(desks.resources).toEqual([
      { uri_template: "onderwijsloket://regional_education_desks/{id}", mime_type: "text/markdown" }
    ]);
    read
      .mockResolvedValueOnce([{ id: deskId, title: deskRecord.title, date_updated: null }])
      .mockResolvedValueOnce([]);
    expect((await listResources(desks)()).resources[0]?.uri).toBe(
      `onderwijsloket://regional_education_desks/${deskId}`
    );
    expect(read.mock.calls[0]![0]().params.fields).toEqual(["id", "title", "date_updated"]);
    read.mockResolvedValueOnce([deskRecord]);
    const handler = serveResource({
      name: desks.name,
      id: desks.getInput.shape.id,
      get: desks.get,
      content: deskResourceContent,
      metadata: desks.resourceMetadata
    });
    const result = await handler(new URL(`onderwijsloket://regional_education_desks/${deskId}`), {
      id: deskId
    });
    expect(result.contents[0]!.text).toContain("area_bounds:");
    expect(result.contents[0]!.text).toContain("phone_availability:");
  });
});
