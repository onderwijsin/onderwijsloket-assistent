import { cacheDurations } from "../../../config/cache";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { cachedFunction } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";

import type { Taxonomy, TaxonomyCollection } from "./taxonomy";
import { createTaxonomySourceSchema, taxonomyCollections } from "./taxonomy";

/**
 * Fetch and validate one taxonomy collection through the shared lookup cache.
 *
 * @param collection - Collection name or definition used by this operation.
 * @returns Validated and normalized records for the selected taxonomy collection.
 */
const readCachedTaxonomy = cachedFunction(
  async (collection: TaxonomyCollection): Promise<Taxonomy[]> => {
    const query = { limit: -1, sort: ["id" as const] };
    // These collections use different label fields, and not all have a slug or description.
    // Keep projections explicit so Directus never receives a field that does not exist.
    let records: unknown;
    switch (collection) {
      case "audiences":
        records = await useDirectusServer(
          readItems(collection, { ...query, fields: ["id", "title"] })
        );
        break;
      case "phases":
        records = await useDirectusServer(
          readItems(collection, { ...query, fields: ["id", "title", "description"] })
        );
        break;
      case "sectors":
        records = await useDirectusServer(
          readItems(collection, { ...query, fields: ["id", "title", "slug", "description"] })
        );
        break;
      default:
        records = await useDirectusServer(
          readItems<Schema, typeof collection, Query<Schema, Schema[typeof collection][number]>>(
            collection,
            { ...query, fields: ["id", "name", "path", "description"] }
          )
        );
    }
    // Validate before caching, so a malformed response cannot become a cached lookup.
    return z.array(createTaxonomySourceSchema(collection)).parse(records);
  },
  {
    name: "read-taxonomy-archive-urls",
    maxAge: cacheDurations.taxonomy,
    // Refresh expired values before returning; filter discovery must not serve stale choices.
    swr: false,
    /**
     * Isolate cached data by its configured identifier.
     *
     * @param collection - Collection name or definition used by this operation.
     * @returns The stable identifier used to isolate the cache entry.
     */
    getKey: (collection: TaxonomyCollection) => collection
  }
);

/**
 * Read selected taxonomies (all by default), caching each collection for one minute.
 *
 * @param selected - Taxonomy collections to read; omitted selects all supported collections.
 * @returns Normalized values from the selected taxonomies, using the shared per-collection cache.
 */
export async function readTaxonomy(
  selected: readonly TaxonomyCollection[] = taxonomyCollections
): Promise<Taxonomy[]> {
  const names = [...new Set(z.array(z.enum(taxonomyCollections)).parse(selected))];
  try {
    const results = await Promise.all(
      names.map(async (name) => {
        const records = await readCachedTaxonomy(name);
        if (!records) throw new Error("Taxonomy lookup did not return a result.");
        return records;
      })
    );
    return results.flat();
  } catch {
    throw createError({
      statusCode: 502,
      message: "UPSTREAM_UNAVAILABLE: Taxonomy data could not be retrieved or validated."
    });
  }
}
