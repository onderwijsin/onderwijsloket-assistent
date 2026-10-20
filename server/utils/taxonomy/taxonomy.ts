import { z } from "zod";
import { nullableOutput } from "../mcp-schema";

/** Collections supported by taxonomy lookups and relation normalization. */
export const taxonomyCollections = [
  "topics",
  "qualifications",
  "roles",
  "tracks",
  "school_subjects",
  "sectors",
  "phases",
  "audiences"
] as const;

/** A supported Directus taxonomy collection. */
export type TaxonomyCollection = (typeof taxonomyCollections)[number];

/** Shared metadata contract for lookup values and embedded taxonomy relations. */
export const taxonomySchema = z.object({
  // Existing taxonomy IDs have GUID shape but do not all use RFC UUID version bits.
  id: z
    .guid()
    .describe(
      "Opaque taxonomy identifier. Copy this id into the corresponding collection list filter array."
    ),
  title: z.string().describe("Human-readable label to select the appropriate taxonomy value."),
  slug: nullableOutput(z.string()).describe(
    "Optional URL slug; not accepted in place of a filter ID."
  ),
  description: nullableOutput(z.string()).describe("Optional explanation of this taxonomy value.")
});

/** Normalized taxonomy metadata, independent of the upstream label field. */
export type Taxonomy = z.infer<typeof taxonomySchema>;

/**
 * Validate and normalize one Directus taxonomy record into the shared contract.
 *
 * @param collection - Collection name or definition used by this operation.
 * @returns A source schema mapping the collection label and optional fields into normalized metadata.
 */
export function createTaxonomySourceSchema(collection: TaxonomyCollection) {
  // Some taxonomy collections use `title` instead of `name` for their primary label
  const label = ["sectors", "phases", "audiences"].includes(collection) ? "title" : "name";
  return z
    .object({
      id: taxonomySchema.shape.id,
      [label]: z.string(),
      slug: taxonomySchema.shape.slug.optional(),
      description: taxonomySchema.shape.description.optional()
    })
    .transform((value) => ({
      id: value.id,
      title: value[label],
      slug: value.slug ?? null,
      description: value.description ?? null
    }))
    .pipe(taxonomySchema);
}
