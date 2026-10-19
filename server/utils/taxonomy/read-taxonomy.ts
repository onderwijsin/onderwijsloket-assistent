import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { cachedFunction } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";

import type { Taxonomy, TaxonomyCollection } from "./taxonomy";
import { createTaxonomySourceSchema, taxonomyCollections } from "./taxonomy";

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
            { ...query, fields: ["id", "name", "slug", "description"] }
          )
        );
    }
    // Validate before caching, so a malformed response cannot become a cached lookup.
    return z.array(createTaxonomySourceSchema(collection)).parse(records);
  },
  {
    name: "read-taxonomy",
    maxAge: 60,
    // Refresh expired values before returning; filter discovery must not serve stale choices.
    swr: false,
    getKey: (collection: TaxonomyCollection) => collection
  }
);

/** Read selected taxonomies (all by default), caching each collection for one minute. */
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
