import {
  availabilitySourceSchema,
  locationFields,
  locationSourceSchema,
  indexedLocationSourceSchema
} from "../../server/utils/projections/navigator";
import {
  locationRecord,
  locationId,
  availabilityRecord
} from "../fixtures/institutions-and-programs";

import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("location and availability boundaries", () => {
  it("preserves GeoJSON coordinate order and source wall-clock schedules without interpreting availability", () => {
    expect(locationFields).not.toContain("last_sync");
    const location = locationSourceSchema.parse(locationRecord);
    expect(location.location_geopoint).toEqual({ type: "Point", coordinates: [4.9, 52.3] });
    expect(location.opening_hours).toMatchObject({
      monday: true,
      monday_start: "22:00:00",
      monday_end: "06:00:00",
      tuesday: false,
      tuesday_start: null,
      sunday: false,
      sunday_start: "09:00:00"
    });
    expect(JSON.stringify(location)).not.toMatch(
      /internal@example|hovi_id|location_components|status/
    );
    expect(
      locationSourceSchema.parse({
        ...locationRecord,
        location_geopoint: JSON.stringify(locationRecord.location_geopoint),
        opening_hours: null
      }).location_geopoint
    ).toEqual(location.location_geopoint);
  });
  it("normalizes nullable metadata and retains partial index locations without pretending hours are expanded", () => {
    const location = locationSourceSchema.parse({
      id: locationId,
      vendor: "hovi",
      opening_hours: null
    });
    expect(location).toMatchObject({
      address: null,
      location_geopoint: null,
      title: null,
      url: null
    });
    const indexed = indexedLocationSourceSchema.parse({
      ...locationRecord,
      opening_hours: { id: availabilityRecord.id }
    });
    expect(indexed).not.toHaveProperty("opening_hours");
    expect(indexed).not.toHaveProperty("vendor");
    expect(
      locationSourceSchema.parse({ ...locationRecord, url: "javascript:alert(1)" }).url
    ).toBeNull();
  });
  it("rejects malformed geopoints, unexpanded schedules and invalid time strings", () => {
    for (const location_geopoint of [
      "not-json",
      { type: "Point", coordinates: [200, 52] },
      { type: "Point", coordinates: [5, -100] }
    ])
      expect(locationSourceSchema.safeParse({ ...locationRecord, location_geopoint }).success).toBe(
        false
      );
    expect(
      locationSourceSchema.safeParse({ ...locationRecord, opening_hours: availabilityRecord.id })
        .success
    ).toBe(false);
    expect(
      availabilitySourceSchema.safeParse({ ...availabilityRecord, monday_start: "25:00:00" })
        .success
    ).toBe(false);
  });
});
