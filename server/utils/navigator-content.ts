import { z } from "zod";
import type { Availability, EducationalInstitution, Location, Program } from "#directus";
import type { QueryFields } from "@directus/sdk";
import type { Schema } from "#directus";
import { nullableOutput } from "./mcp-schema";
import { useSourceUrl } from "./use-source-url";
import { assetSchema, imageAssetSourceSchema } from "./supporting-content";

/** Source provenance is metadata; visibility is configured upstream. */
export const navigatorVendorSchema = z.enum([
  "onderwijsloket",
  "hovi",
  "kiesmbo"
] satisfies Program["vendor"][]);
/** Institution types use source codes, not display labels. */
export const institutionTypeSchema = z.enum([
  "mbo",
  "hogeschool",
  "universiteit",
  "onderzoeksuniversiteit",
  "internationaal onderwijs"
] satisfies EducationalInstitution["type"][]);
/** Supported native program classifications. */
export const programTypeSchema = z.enum([
  "crebo_program",
  "croho_program",
  "zib",
  "minor",
  "specialization",
  "course",
  "short_variant",
  "premaster",
  "elective_course",
  "exchange_program",
  "double_degree",
  "graduation",
  "honours_track",
  "joint_degree",
  "content_variant",
  "language_variant"
] satisfies Program["type"][]);
/** Program levels include the live associate value absent from the generated union. */
export const programLevelSchema = z.enum([
  "mbo",
  "bachelor",
  "master",
  "phd",
  "post-graduate",
  "preparatory",
  "associate"
] satisfies (Program["level"] | "associate")[]);
/** Native funding classification when supplied. */
export const financingSchema = z.enum(["government", "private"] satisfies NonNullable<
  Program["financing"]
>[]);
/** Native navigator identifiers observed as UUIDs, including deterministic version-five IDs. */
export const navigatorIdSchema = z.uuid();
const days = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;
const timeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?$/);
const availabilityShape = Object.fromEntries(
  days.flatMap((day) => [
    [day, z.boolean()],
    [`${day}_start`, nullableOutput(timeSchema)],
    [`${day}_end`, nullableOutput(timeSchema)]
  ])
) as Record<(typeof days)[number], z.ZodBoolean> &
  Record<
    `${(typeof days)[number]}_${"start" | "end"}`,
    ReturnType<typeof nullableOutput<typeof timeSchema>>
  >;
/** Weekly source schedule. Times are local wall-clock strings; no timezone or open-now inference. */
export const availabilitySchema = z.object({ id: navigatorIdSchema, ...availabilityShape });
const availabilitySourceShape = Object.fromEntries(
  days.flatMap((day) => [
    [day, z.boolean()],
    [`${day}_start`, timeSchema.nullish()],
    [`${day}_end`, timeSchema.nullish()]
  ])
) as Record<(typeof days)[number], z.ZodBoolean> &
  Record<`${(typeof days)[number]}_${"start" | "end"}`, ReturnType<typeof timeSchema.nullish>>;
/** Normalize omitted day times without changing enabled flags or overnight intervals. */
export const availabilitySourceSchema = z
  .object({ id: navigatorIdSchema, ...availabilitySourceShape })
  .transform((record) =>
    availabilitySchema.parse({
      ...record,
      ...Object.fromEntries(
        days.flatMap((day) => [
          [`${day}_start`, record[`${day}_start`] ?? null],
          [`${day}_end`, record[`${day}_end`] ?? null]
        ])
      )
    })
  );
/** GeoJSON preserves source longitude/latitude ordering and validates coordinate ranges. */
export const geopointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)])
});
/** Accept structured GeoJSON or its serialized source representation without guessing coordinates. */
const geopointSourceSchema = z
  .preprocess((value) => {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }, geopointSchema.nullish())
  .transform((value) => value ?? null);
/**
 * Retain only usable public HTTP(S) destinations; no inferred URLs for external content.
 * @param value - Optional source URL.
 * @returns A validated destination or null.
 */
export function navigatorUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const result = z.url().safeParse(value);
  return result.success && /^https?:\/\//i.test(result.data) ? result.data : null;
}
const locationText = {
  title: z.string().nullish(),
  address: z.string().nullish(),
  zip: z.string().nullish(),
  city: z.string().nullish(),
  country: z.string().nullish(),
  location_address: z.string().nullish()
};
/** Embedded physical location, independent of an institution's service regions or program forms. */
export const locationSchema = z.object({
  id: navigatorIdSchema,
  title: nullableOutput(z.string()),
  url: nullableOutput(z.url()),
  address: nullableOutput(z.string()),
  zip: nullableOutput(z.string()),
  city: nullableOutput(z.string()),
  country: nullableOutput(z.string()),
  location_address: nullableOutput(z.string()),
  location_geopoint: nullableOutput(geopointSchema),
  vendor: navigatorVendorSchema,
  opening_hours: nullableOutput(availabilitySchema)
});
/** Expanded location boundary excludes provider identifiers, reviewers and reverse content. */
export const locationSourceSchema = z
  .object({
    id: navigatorIdSchema,
    ...locationText,
    url: z.string().nullish(),
    location_geopoint: geopointSourceSchema,
    vendor: navigatorVendorSchema,
    opening_hours: availabilitySourceSchema.nullish()
  })
  .transform((record) =>
    locationSchema.parse({
      ...record,
      ...Object.fromEntries(
        Object.keys(locationText).map((name) => [
          name,
          record[name as keyof typeof locationText] ?? null
        ])
      ),
      url: navigatorUrl(record.url),
      opening_hours: record.opening_hours ?? null
    })
  );
/** Lightweight location identity available in the index; no opening hours are inferred from an ID. */
export const indexedLocationSchema = locationSchema.pick({
  id: true,
  title: true,
  city: true,
  country: true,
  location_geopoint: true
});
/** Index locations are partial and do not carry the source vendor or full weekly schedule. */
export const indexedLocationSourceSchema = z
  .object({
    id: navigatorIdSchema,
    title: z.string().nullish(),
    city: z.string().nullish(),
    country: z.string().nullish(),
    location_geopoint: geopointSourceSchema
  })
  .transform((record) =>
    indexedLocationSchema.parse({
      ...record,
      title: record.title ?? null,
      city: record.city ?? null,
      country: record.country ?? null
    })
  );
/** Native schedule fields selected for nested location expansion. */
export const availabilityFields = [
  "id",
  ...days.flatMap((day) => [day, `${day}_start` as const, `${day}_end` as const])
] satisfies QueryFields<Schema, Availability>;
/**
 * Shared selected location projection reused by programs, institutions and future desks.
 */
export const locationFields = [
  "id",
  "title",
  "url",
  "address",
  "zip",
  "city",
  "country",
  "location_address",
  "location_geopoint",
  "vendor",
  { opening_hours: availabilityFields }
] satisfies QueryFields<Schema, Location>;
/** Program provider attribution retains its own provenance rather than inheriting its parent vendor. */
export const institutionReferenceSchema = z.object({
  id: navigatorIdSchema,
  title: z.string(),
  type: institutionTypeSchema,
  source_url: nullableOutput(z.url()),
  logo: nullableOutput(assetSchema),
  vendor: navigatorVendorSchema
});
/** Minimal institution expansion; never recursively fetch provider programs or locations here. */
export const institutionReferenceSourceSchema = z
  .object({
    id: navigatorIdSchema,
    title: z.string(),
    type: institutionTypeSchema,
    path: z.string(),
    logo: imageAssetSourceSchema,
    vendor: navigatorVendorSchema
  })
  .transform((record) =>
    institutionReferenceSchema.parse({
      ...record,
      source_url: useSourceUrl(record.path)
    })
  );
/** Index provider attribution cannot assume unselected provenance fields. */
export const indexedInstitutionSchema = institutionReferenceSchema.omit({
  vendor: true
});
/** Flattened index provider projection, distinct from a source junction. */
export const indexedInstitutionSourceSchema = z
  .object({
    id: navigatorIdSchema,
    title: z.string(),
    type: institutionTypeSchema,
    path: z.string(),
    logo: imageAssetSourceSchema
  })
  .transform((record) =>
    indexedInstitutionSchema.parse({ ...record, source_url: useSourceUrl(record.path) })
  );
/** Minimal provider fields sufficient for attribution and links. */
export const institutionReferenceFields = [
  "id",
  "title",
  "type",
  "path",
  "logo",
  "vendor"
] as const;
