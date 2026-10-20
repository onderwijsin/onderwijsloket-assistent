import { z } from "zod";

/** Fetch one sentinel row beyond the public bound so partial relations are explicit. */
export const collectionRelationLimit = 100;

/**
 * Validate and flatten an expanded junction, reporting missing targets and relation limits.
 * @param key - Actual junction target key, never a guessed record identifier.
 * @param target - Public target projection including any source normalization.
 * @returns A source-boundary schema with bounded records and completeness metadata.
 */
export function collectionRelationSchema<Key extends string, Target extends z.ZodType>(
  key: Key,
  target: Target
) {
  return z.array(z.object({ [key]: target.nullable() })).transform((rows) => ({
    records: rows
      .slice(0, collectionRelationLimit)
      .flatMap((row) => (row[key] == null ? [] : [row[key]])),
    warnings: rows.slice(0, collectionRelationLimit).some((row) => row[key] == null)
      ? [`Unavailable related record in ${key}.`]
      : [],
    truncated: rows.length > collectionRelationLimit
  }));
}

/**
 * Bound parent junctions with a sentinel row and deterministic source junction ordering.
 * @param names - Parent relation names being expanded.
 * @returns Deep query options without visibility or publication policy.
 */
export function collectionRelationBounds(names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [name, { _limit: collectionRelationLimit + 1, _sort: ["id"] }])
  );
}
