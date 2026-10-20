import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { entries, request, env } = vi.hoisted(() => ({
  entries: new Map<string, unknown>(),
  request: vi.fn(),
  env: {
    MAPBOX_API_TOKEN: "secret",
    MAPBOX_ENABLE_TEMPORARY_GEOCODING: false,
    MAPBOX_ENABLE_GEOCODING_CACHE: true
  }
}));
vi.mock("varlock/env", () => ({ ENV: env }));
vi.mock("ofetch", () => ({ ofetch: request }));
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
  const { defineCachedFunction } = await import("nitropack/runtime/internal/cache");
  return { defineCachedFunction };
});

import { geocode } from "../../server/utils/geocoding";
import { cacheDurations } from "../../config/cache";

const response = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: { type: "Point", coordinates: [5.12, 52.09] },
      properties: {
        mapbox_id: "place.1",
        name: "Utrecht",
        full_address: "Utrecht, Netherlands",
        feature_type: "place"
      },
      bbox: [5, 52, 5.2, 52.2]
    }
  ]
};
beforeEach(() => {
  entries.clear();
  request.mockReset().mockResolvedValue(response);
  env.MAPBOX_API_TOKEN = "secret";
  env.MAPBOX_ENABLE_TEMPORARY_GEOCODING = false;
  env.MAPBOX_ENABLE_GEOCODING_CACHE = true;
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-20T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Mapbox geocoding", () => {
  it.each([false, true])("respects disabled caching in temporary mode %s", async (temporary) => {
    env.MAPBOX_ENABLE_TEMPORARY_GEOCODING = temporary;
    await geocode("Utrecht");
    const stored = structuredClone(entries);
    env.MAPBOX_ENABLE_GEOCODING_CACHE = false;
    await geocode("Utrecht");
    await geocode("Utrecht");
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.lastCall?.[1].query.permanent).toBe(!temporary);
    expect(entries).toEqual(stored);
  });
  it("normalizes results, coalesces requests and expires permanent results after 90 days", async () => {
    const [result] = await Promise.all([geocode(" Utrecht "), geocode("Utrecht")]);
    expect(result).toEqual([
      {
        mapboxId: "place.1",
        name: "Utrecht",
        fullAddress: "Utrecht, Netherlands",
        featureType: "place",
        longitude: 5.12,
        latitude: 52.09,
        bbox: [5, 52, 5.2, 52.2]
      }
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("https://api.mapbox.com/search/geocode/v6/forward", {
      query: {
        q: "Utrecht",
        access_token: "secret",
        permanent: true,
        autocomplete: false,
        language: "nl"
      },
      timeout: 10_000,
      retry: 0
    });
    vi.advanceTimersByTime(cacheDurations.geocoding * 1000 - 1);
    await geocode("Utrecht");
    expect(request).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2);
    await geocode("Utrecht");
    expect(request).toHaveBeenCalledTimes(2);
    await geocode("Amsterdam");
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("respects enabled caching in temporary mode and isolates modes", async () => {
    await geocode("Utrecht");
    env.MAPBOX_ENABLE_TEMPORARY_GEOCODING = true;
    await geocode("Utrecht");
    await geocode("Utrecht");
    await geocode("Amsterdam");
    expect(request).toHaveBeenCalledTimes(3);
    expect(request.mock.lastCall?.[1].query.permanent).toBe(false);
    env.MAPBOX_ENABLE_TEMPORARY_GEOCODING = false;
    await geocode("Amsterdam");
    expect(request).toHaveBeenCalledTimes(4);
    await geocode("Utrecht");
    expect(request).toHaveBeenCalledTimes(4);
  });

  it.each(["", "  ", "a;b", "x".repeat(257), Array(21).fill("word").join(" ")])(
    "rejects unsupported input before requesting Mapbox: %s",
    async (value) => {
      await expect(geocode(value)).rejects.toMatchObject({ code: "INVALID_QUERY" });
      expect(request).not.toHaveBeenCalled();
    }
  );

  it("requires a token even on a cache hit", async () => {
    await geocode("Utrecht");
    env.MAPBOX_API_TOKEN = "";
    await expect(geocode("Utrecht")).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("sanitizes upstream errors, rejects malformed results and retries failures", async () => {
    request.mockRejectedValueOnce(new Error("URL containing secret"));
    await expect(geocode("Utrecht")).rejects.toMatchObject({
      code: "UPSTREAM_UNAVAILABLE",
      message: "Geocoding failed: UPSTREAM_UNAVAILABLE"
    });
    request.mockResolvedValueOnce({ type: "FeatureCollection", features: [{}] });
    await expect(geocode("Utrecht")).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
    await expect(geocode("Utrecht")).resolves.toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("returns and caches no matches, and accepts features without bounding boxes", async () => {
    request.mockResolvedValueOnce({ type: "FeatureCollection", features: [] });
    await expect(geocode("unknown")).resolves.toEqual([]);
    await geocode("unknown");
    expect(request).toHaveBeenCalledTimes(1);
    const feature = response.features[0]!;
    request.mockResolvedValueOnce({
      ...response,
      features: [
        {
          type: feature.type,
          geometry: feature.geometry,
          properties: feature.properties
        }
      ]
    });
    expect((await geocode("Utrecht"))[0]).not.toHaveProperty("bbox");
  });
});
