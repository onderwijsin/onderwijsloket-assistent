import { ENV } from "varlock/env";
import { ofetch } from "ofetch";
import { defineCachedFunction } from "nitropack/runtime";
import { z } from "zod";
import { cacheDurations } from "../../config/cache";

/** Mapbox free-text query limits, shared with location-aware search inputs. */
export const geocodingQuerySchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !value.includes(";"), "Geocoding queries cannot contain semicolons.")
  .refine(
    (value) => value.split(/[\s\p{P}]+/u).filter(Boolean).length <= 20,
    "Geocoding queries cannot exceed 20 words."
  );

/** Validated location metadata returned by Mapbox forward geocoding. */
export const geocodingLocationSchema = z.object({
  mapboxId: z.string(),
  name: z.string(),
  fullAddress: z.string(),
  featureType: z.string(),
  longitude: z.number().min(-180).max(180),
  latitude: z.number().min(-90).max(90),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional()
});
const locationsSchema = z.array(geocodingLocationSchema);
const responseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.object({
        type: z.literal("Point"),
        coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
      }),
      properties: z.object({
        mapbox_id: z.string(),
        name: z.string(),
        full_address: z.string(),
        feature_type: z.string()
      }),
      bbox: geocodingLocationSchema.shape.bbox
    })
  )
});

/** A ranked Mapbox location; coordinates are explicitly longitude/latitude. */
export type GeocodingLocation = z.output<typeof geocodingLocationSchema>;

/** Stable error codes without provider URLs, query text or API credentials. */
export class GeocodingError extends Error {
  /**
   * Create a sanitized failure that callers can distinguish by code.
   * @param code - Validation, configuration or upstream failure category.
   */
  constructor(
    public readonly code:
      | "INVALID_QUERY"
      | "NOT_CONFIGURED"
      | "UPSTREAM_UNAVAILABLE"
      | "INVALID_RESPONSE"
  ) {
    super(`Geocoding failed: ${code}`);
    this.name = "GeocodingError";
  }
}

/**
 * Resolve a validated query through Mapbox v6 and validate the provider response.
 * @param query - Trimmed location text.
 * @param temporary - Whether storage is prohibited for this request.
 * @returns Locations in Mapbox relevance order, or an empty array for no matches.
 */
async function requestLocations(query: string, temporary: boolean): Promise<GeocodingLocation[]> {
  let data: unknown;
  try {
    data = await ofetch("https://api.mapbox.com/search/geocode/v6/forward", {
      query: {
        q: query,
        access_token: ENV.MAPBOX_API_TOKEN,
        permanent: !temporary,
        autocomplete: false,
        language: "nl",
        // Bias ambiguous place names toward central Netherlands without restricting the country.
        proximity: "5.3,52.2"
      },
      timeout: 10_000,
      retry: 0
    });
  } catch {
    throw new GeocodingError("UPSTREAM_UNAVAILABLE");
  }
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new GeocodingError("INVALID_RESPONSE");
  return parsed.data.features.map(({ properties, geometry, bbox }) => ({
    mapboxId: properties.mapbox_id,
    name: properties.name,
    fullAddress: properties.full_address,
    featureType: properties.feature_type,
    longitude: geometry.coordinates[0],
    latitude: geometry.coordinates[1],
    ...(bbox ? { bbox } : {})
  }));
}

const cachedLocations = defineCachedFunction(requestLocations, {
  name: "mapbox-geocoding-nl-proximity-v1",
  maxAge: cacheDurations.geocoding,
  swr: false,
  /**
   * Reject cached geocoding payloads that do not match the current location schema.
   * @param entry - Cached entry whose value contains provider locations.
   * @returns Whether the cached locations satisfy the output schema.
   */
  validate: (entry) => locationsSchema.safeParse(entry.value).success
});

/**
 * Geocode location text. The cache flag controls reads and writes independently of geocoding mode.
 * @param value - An address, postcode, city or other location string (Mapbox limits apply).
 * @returns Up to five ranked locations; no matches returns an empty array.
 * @throws GeocodingError for invalid input, missing token, provider or response failures.
 */
export async function geocode(value: string): Promise<GeocodingLocation[]> {
  const query = geocodingQuerySchema.safeParse(value);
  if (!query.success) throw new GeocodingError("INVALID_QUERY");
  if (!ENV.MAPBOX_API_TOKEN?.trim()) throw new GeocodingError("NOT_CONFIGURED");
  const temporary = ENV.MAPBOX_ENABLE_TEMPORARY_GEOCODING;
  if (!ENV.MAPBOX_ENABLE_GEOCODING_CACHE) return requestLocations(query.data, temporary);
  return locationsSchema.parse(await cachedLocations(query.data, temporary));
}
