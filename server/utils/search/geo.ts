import { createError } from "h3";
import { z } from "zod";
import {
  geocode,
  GeocodingError,
  geocodingLocationSchema,
  geocodingQuerySchema
} from "../geocoding";
import { nullableOutput } from "../mcp-schema";

/** Opt-in search inputs; radius is only meaningful alongside a location. */
export const geoSearchFields = {
  location: geocodingQuerySchema
    .optional()
    .describe(
      "Location text, such as a city, postcode or address. Results are sorted nearest first around its best geocoding match."
    ),
  radius: z
    .number()
    .int()
    .positive()
    .max(2_147_483_647)
    .optional()
    .describe(
      "Search radius in metres. Defaults to 50000 when location is supplied; requires location."
    )
};

/** Coordinates use explicit names to avoid latitude/longitude ordering ambiguity. */
const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

/** Geographic distance is either to a physical indexed point or a desk's coverage grid. */
export const geoDistanceKindSchema = z.enum(["indexed_location", "service_area_grid"]);

/** Resolved search centre and applied geographic constraints. */
export const geoSearchMetadataSchema = z.object({
  location_query: z.string(),
  matched_location: geocodingLocationSchema,
  candidate_count: z.number().int().positive(),
  radius_meters: z.number().int().positive(),
  sort: z.literal("distance"),
  distance_kind: geoDistanceKindSchema
});

/** Per-hit geographic metadata; never expose the complete ranking payload or coordinate grid. */
export const geoHitSchema = z.object({
  distance_meters: z.number().nonnegative(),
  matched_coordinates: nullableOutput(coordinatesSchema),
  precision_meters: z.number().positive()
});

const rankingSchema = z.object({
  geoDistance: z.number().nonnegative(),
  geoPrecision: z.number().positive().optional(),
  matchedGeoLocation: z
    .object({
      lat: coordinatesSchema.shape.latitude,
      lng: coordinatesSchema.shape.longitude,
      distance: z.number().nonnegative()
    })
    .optional()
});

/**
 * Resolve the most relevant geocoding match without falling back to unbounded search.
 * @param args - Validated location and optional radius.
 * @param kind - Interpretation of each hit's indexed coordinates.
 * @returns Search metadata, or undefined for an ordinary text/browse search.
 */
export async function resolveGeoSearch(
  args: { location?: string; radius?: number },
  kind: z.output<typeof geoDistanceKindSchema>
): Promise<z.output<typeof geoSearchMetadataSchema> | undefined> {
  if (!args.location) {
    if (args.radius !== undefined)
      throw createError({
        statusCode: 400,
        message: "INVALID_LOCATION: radius requires location."
      });
    return;
  }
  let matches;
  try {
    matches = await geocode(args.location);
  } catch (error) {
    if (error instanceof GeocodingError && error.code === "NOT_CONFIGURED")
      throw createError({
        statusCode: 503,
        message: "GEOCODING_NOT_CONFIGURED: Location search is unavailable."
      });
    if (error instanceof GeocodingError && error.code === "INVALID_QUERY")
      throw createError({
        statusCode: 400,
        message: "INVALID_LOCATION: Location text cannot be geocoded."
      });
    throw createError({
      statusCode: 502,
      message: "UPSTREAM_UNAVAILABLE: Location could not be resolved."
    });
  }
  const matched = matches[0];
  if (!matched)
    throw createError({
      statusCode: 400,
      message: "LOCATION_NOT_FOUND: No location matched the supplied text."
    });
  return {
    location_query: args.location,
    matched_location: matched,
    candidate_count: matches.length,
    radius_meters: args.radius ?? 50_000,
    sort: "distance",
    distance_kind: kind
  };
}

/**
 * Request distance-first ranking on the provider before pagination.
 * @param geo - Resolved centre and effective radius.
 * @returns Fixed geographic query parameters, with reranking and promotions disabled.
 */
export function geoSearchParams(geo: z.output<typeof geoSearchMetadataSchema>) {
  return {
    aroundLatLng: `${geo.matched_location.latitude},${geo.matched_location.longitude}`,
    aroundRadius: geo.radius_meters,
    aroundPrecision: 1,
    getRankingInfo: true,
    ranking: ["geo", "typo", "words", "filters", "proximity", "attribute", "exact", "custom"],
    typoTolerance: true,
    enableRules: false,
    enableReRanking: false,
    enablePersonalization: false
  };
}

/**
 * Convert validated provider ranking data to explicit metric distance metadata.
 * @param ranking - Untrusted hit ranking information.
 * @returns Distance in metres, matched point when available and provider precision.
 */
export function geoHitMetadata(ranking: unknown): z.output<typeof geoHitSchema> {
  const info = rankingSchema.parse(ranking);
  const point = info.matchedGeoLocation;
  return {
    distance_meters: point?.distance ?? info.geoDistance * (info.geoPrecision ?? 1),
    matched_coordinates: point ? { latitude: point.lat, longitude: point.lng } : null,
    precision_meters: info.geoPrecision ?? 1
  };
}
