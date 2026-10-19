import { cacheDurations } from "../../../config/cache";
import { z } from "zod";
import { createError } from "h3";
import { defineCachedFunction } from "nitropack/runtime";
import { useAlgoliaClient } from "./algolia-client";
import { findSearchSnippet } from "./snippets";
import { useSourceUrl } from "../use-source-url";
import { searchRecordSchema } from "./schemas";
import type { SearchOptions, SearchResult, FacetsOptions, FacetsResult } from "./schemas";

const paginationSchema = z.object({
  nbHits: z.number().int().nonnegative(),
  nbPages: z.number().int().nonnegative()
});
const facetCountsSchema = z.record(
  z.string(),
  z.record(z.string(), z.number().int().nonnegative())
);

/**
 * Discover countable facet attributes through search; this works without settings-read permission.
 *
 * @param indexName - Configured collection search index.
 * @returns Countable facet names discovered for the configured index.
 */
const readFacetNames = defineCachedFunction(
  async (indexName: string) => {
    const response = await useAlgoliaClient().searchSingleIndex({
      indexName,
      searchParams: {
        query: "",
        facets: ["*"],
        hitsPerPage: 0,
        maxValuesPerFacet: 1,
        attributesToRetrieve: [],
        attributesToHighlight: [],
        analytics: false
      }
    });
    return Object.keys(facetCountsSchema.parse(response.facets ?? {}));
  },
  {
    name: "algolia-facet-names",
    maxAge: cacheDurations.facetNames,
    swr: false,
    /**
     * Isolate cached data by its configured identifier.
     *
     * @param indexName - Configured collection search index.
     * @returns The stable identifier used to isolate the cache entry.
     */
    getKey: (indexName: string) => indexName
  }
);

/**
 * Translate plain facet arrays into Algolia's AND-of-ORs syntax, validating dynamic attribute names.
 *
 * @param indexName - Configured collection search index.
 * @param filters - Selected facet values, combined with AND across fields and OR within each field.
 * @param facets - Optional facet names to validate alongside the selected filters.
 * @returns Validated facet expressions in AND-of-ORs form.
 */
async function buildFacetFilters(
  indexName: string,
  filters: SearchOptions["filters"],
  facets?: string[]
) {
  const names = [...Object.keys(filters ?? {}), ...(facets ?? [])];
  if (names.length) {
    const available = await readFacetNames(indexName);
    if (!available) throw new Error("Facet discovery did not return a result.");
    if (names.some((name) => !available.includes(name))) {
      throw createError({
        statusCode: 400,
        message: "INVALID_FILTER: Unknown or unavailable facet. Call get_facets for current names."
      });
    }
  }
  return Object.entries(filters ?? {}).map(([name, values]) =>
    values.map((value) => `${name}:${String(value).replace(/^-/, "\\-")}`)
  );
}

/**
 * Define index selection and optional record-field mappings without duplicating index settings.
 *
 * @param options - Collection name, configured index and optional result-field mappings.
 * @returns Collection-scoped search and cached facet-discovery methods.
 */
export function defineCollectionSearch(options: {
  name: string;
  indexName: string;
  fields?: Partial<Record<"id" | "title" | "description" | "slug" | "path", string>>;
}) {
  const fields = {
    id: "id",
    title: "title",
    description: "description",
    slug: "slug",
    path: "path",
    ...options.fields
  };
  return {
    /**
     * Retrieve lightweight discovery records with index-generated query context.
     *
     * @param args - Validated operation arguments, including filters and pagination where supported.
     * @returns Validated lightweight search results with query context and pagination.
     */
    async search(args: SearchOptions): Promise<SearchResult> {
      try {
        const response = await useAlgoliaClient().searchSingleIndex<Record<string, unknown>>({
          indexName: options.indexName,
          searchParams: {
            query: args.query,
            page: args.page - 1,
            hitsPerPage: args.page_size,
            facetFilters: await buildFacetFilters(options.indexName, args.filters),
            attributesToRetrieve: [...new Set(["objectID", ...Object.values(fields)])],
            attributesToSnippet: args.query ? ["*:30"] : [],
            attributesToHighlight: [],
            highlightPreTag: "**",
            highlightPostTag: "**",
            analytics: false
          }
        });
        const pagination = paginationSchema.parse(response);
        const records = response.hits.map((hit) => {
          const path = hit[fields.path];
          return searchRecordSchema.parse({
            id: hit[fields.id] ?? hit.objectID,
            collection: options.name,
            title: hit[fields.title],
            slug: hit[fields.slug] ?? "",
            description: hit[fields.description] ?? "",
            source_url: typeof path === "string" ? useSourceUrl(path) : null,
            snippet: args.query ? findSearchSnippet(hit._snippetResult) : null
          });
        });
        return {
          collection: options.name,
          query: args.query,
          records,
          page: args.page,
          page_size: args.page_size,
          total: pagination.nbHits,
          total_is_exact: response.exhaustive?.nbHits ?? response.exhaustiveNbHits ?? false,
          total_pages: pagination.nbPages,
          has_more: args.page < pagination.nbPages,
          retrieved_at: new Date().toISOString()
        };
      } catch (error) {
        throwSearchError(error);
      }
    },

    /**
     * Retrieve dynamic facet values and counts for the caller's query and selected filters.
     *
     * @param args - Validated operation arguments, including filters and pagination where supported.
     * @returns Validated facet values and counts for the supplied query and filters.
     */
    facets: defineCachedFunction(
      async (args: FacetsOptions): Promise<FacetsResult> => {
        try {
          const response = await useAlgoliaClient().searchSingleIndex({
            indexName: options.indexName,
            searchParams: {
              query: args.query,
              facetFilters: await buildFacetFilters(options.indexName, args.filters, args.facets),
              facets: args.facets ?? ["*"],
              maxValuesPerFacet: args.max_values,
              hitsPerPage: 0,
              attributesToRetrieve: [],
              attributesToHighlight: [],
              analytics: false
            }
          });
          const counts = facetCountsSchema.parse(response.facets ?? {});
          return {
            collection: options.name,
            query: args.query,
            filters: args.filters ?? {},
            max_values: args.max_values,
            facets: formatFacets(counts),
            counts_are_exact:
              response.exhaustive?.facetsCount ?? response.exhaustiveFacetsCount ?? false,
            retrieved_at: new Date().toISOString()
          };
        } catch (error) {
          throwSearchError(error);
        }
      },
      {
        name: `collection-facets-${options.name}-${options.indexName}`,
        maxAge: cacheDurations.facets,
        swr: false
      }
    )
  };
}

/**
 * Preserve invalid-filter errors while keeping provider details private.
 *
 * @param error - Error to translate into the public search error contract.
 * @returns Never returns; throws a sanitized error or preserves an invalid-filter error.
 */
function throwSearchError(error: unknown): never {
  if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 400)
    throw error;
  throw createError({
    statusCode: 502,
    message: "UPSTREAM_UNAVAILABLE: Search data could not be retrieved or validated."
  });
}

/**
 * Put the most common values first, with stable alphabetical ordering for ties.
 *
 * @param counts - Facet values and their match counts.
 * @returns Facet descriptors with values sorted by descending count, then alphabetically.
 */
function formatFacets(counts: z.output<typeof facetCountsSchema>): FacetsResult["facets"] {
  return Object.entries(counts).map(([name, countsByValue]) => {
    const values = Object.entries(countsByValue).map(([value, count]) => ({ value, count }));
    values.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    return { name, values };
  });
}
