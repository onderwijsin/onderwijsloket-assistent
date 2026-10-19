import { z } from "zod";
import type { TaxonomyCollection } from "./taxonomy";
import { createTaxonomySourceSchema } from "./taxonomy";

/** Flatten Directus M2M junctions into normalized taxonomy metadata, skipping null targets. */
export function createTaxonomyRelationSchema(collection: TaxonomyCollection) {
  // Directus exposes targets inside junction rows, e.g. { topics_id: { ... } }.
  const key = `${collection}_id`;
  return z
    .array(z.object({ [key]: createTaxonomySourceSchema(collection).nullable() }))
    .nullish()
    .transform((rows) => (rows ?? []).flatMap((row) => (row[key] ? [row[key]] : [])));
}
