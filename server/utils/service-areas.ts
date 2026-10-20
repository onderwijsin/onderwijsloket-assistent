import { z } from "zod";
import { nullableOutput } from "./mcp-schema";
import { navigatorIdSchema, geopointSchema } from "./navigator-content";

const positionSchema = geopointSchema.shape.coordinates;
const ringSchema = z
  .array(positionSchema)
  .min(4)
  .refine(
    (ring) =>
      ring.length >= 4 && ring[0]![0] === ring.at(-1)![0] && ring[0]![1] === ring.at(-1)![1],
    "Polygon rings must be closed."
  );
/** Source coverage boundaries retain longitude/latitude order; no eligibility matching is inferred. */
export const areaBoundsSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(ringSchema).min(1)
});
/** Sampled interior points support upstream search approximations, not exact coverage or addresses. */
export const areaInnerSchema = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(positionSchema)
});
/** Expanded service region; nullable geometry is distinct from an unavailable area relation. */
export const areaSchema = z.object({
  id: navigatorIdSchema,
  title: z.string(),
  area_center: nullableOutput(geopointSchema),
  area_bounds: nullableOutput(areaBoundsSchema),
  area_inner: nullableOutput(areaInnerSchema)
});
/**
 * Validate either structured GeoJSON or a serialized source value without guessing coordinates.
 * @param schema - Expected source geometry.
 * @returns Nullable geometry boundary preserving missing values as null.
 */
function geometrySource<Shape extends z.ZodType>(schema: Shape) {
  return z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }, schema.nullish())
    .transform((value) => value ?? null);
}
/** Source projection excludes area publication policy, users and internal bookkeeping. */
export const areaSourceSchema = z
  .object({
    id: navigatorIdSchema,
    title: z.string(),
    area_center: geometrySource(geopointSchema),
    area_bounds: geometrySource(areaBoundsSchema),
    area_inner: geometrySource(areaInnerSchema)
  })
  .pipe(areaSchema);
/** Explicit area fields used by desk list/detail queries. */
export const areaFields = ["id", "title", "area_center", "area_bounds", "area_inner"] as const;
