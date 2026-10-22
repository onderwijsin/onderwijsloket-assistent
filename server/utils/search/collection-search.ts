import { cacheDurations } from "../../../config/cache";
import { z } from "zod";
import { createError } from "h3";
import { defineCachedFunction } from "nitropack/runtime";
import { useAlgoliaClient } from "./algolia-client";
import { findSearchSnippet } from "./snippets";
import { useSourceUrl } from "../use-source-url";
import {
  geoSearchFields,
  geoSearchMetadataSchema,
  geoHitSchema,
  resolveGeoSearch,
  geoSearchParams,
  geoHitMetadata
} from "./geo";
import {
  searchRecordSchema,
  searchFiltersSchema,
  searchOptionsSchema,
  createSearchResultSchema
} from "./schemas";
import type { SearchOptions, FacetsOptions, FacetsResult } from "./schemas";

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
export function defineCollectionSearch<
  RecordSchema extends z.ZodObject = typeof searchRecordSchema,
  Filters extends z.ZodObject | typeof searchFiltersSchema = typeof searchFiltersSchema,
  Geo extends "indexed_location" | "service_area_grid" | undefined = undefined
>(options: {
  name: string;
  indexName: string;
  recordSchema?: RecordSchema;
  filterSchema?: Filters;
  attributes?: readonly string[];
  /** Enable location/radius inputs and describe the meaning of indexed point distances. */
  geoSearch?: Geo;
  /**
   * Map untrusted provider hits into the collection's public output.
   * @param hit - Untrusted provider attributes from the explicit projection.
   * @param context - Collection identity and query-matched snippet.
   * @returns A candidate public hit, validated by recordSchema before use.
   */
  mapHit?: (
    hit: Record<string, unknown>,
    context: {
      collection: string;
      snippet: ReturnType<typeof findSearchSnippet>;
    }
  ) => unknown;
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
  const recordSchema = (options.recordSchema ?? searchRecordSchema) as RecordSchema;
  const filterSchema = (options.filterSchema ?? searchFiltersSchema) as Filters;
  const geoOptions = searchOptionsSchema.extend(geoSearchFields);
  const filtersField = filterSchema.optional();
  // Preserve the opt-in fields in each collection's inferred input contract.
  const geoFields = (options.geoSearch ? geoSearchFields : {}) as Geo extends undefined
    ? {}
    : typeof geoSearchFields;
  const searchOptions = z.strictObject({
    ...searchOptionsSchema.shape,
    ...geoFields,
    filters: filtersField
  });
  const geoField = geoHitSchema
    .optional()
    .describe("Distance metadata, present only for location search.");
  const geoRecordSchema = z.object({
    ...recordSchema.shape,
    geo: geoField
  } as RecordSchema["shape"] & { geo: typeof geoField });
  const ordinaryResult = createSearchResultSchema(recordSchema);
  const geographicResult = createSearchResultSchema(geoRecordSchema).extend({
    records: z
      .array(geoRecordSchema)
      .max(25)
      .describe(
        "Lightweight hits, sorted by distance when location is supplied and by index relevance otherwise. Use the detail tool for complete records."
      ),
    geo: geoSearchMetadataSchema
      .optional()
      .describe("Resolved location and applied radius, present only for location search.")
  });
  const searchResult = (
    options.geoSearch ? geographicResult : ordinaryResult
  ) as Geo extends undefined ? typeof ordinaryResult : typeof geographicResult;
  const facetNames =
    options.filterSchema instanceof z.ZodObject
      ? Object.keys(options.filterSchema.shape)
      : undefined;

  /**
   * Constrain dynamic provider facet names to the collection's static search contract.
   * @param args - Query context containing selected filters and optional facet names.
   * @returns Nothing; rejects unsupported public filter names before provider access.
   * @throws H3Error when a facet name is unavailable or filter values fail validation.
   */
  function validateFacets(args: { filters?: SearchOptions["filters"]; facets?: string[] }) {
    if (
      facetNames &&
      [...Object.keys(args.filters ?? {}), ...(args.facets ?? [])].some(
        (name) => !facetNames.includes(name)
      )
    ) {
      throw createError({
        statusCode: 400,
        message: "INVALID_FILTER: Unknown or unavailable facet. Call get_facets for current names."
      });
    }
    if (args.filters && !filterSchema.safeParse(args.filters).success) {
      throw createError({
        statusCode: 400,
        message: "INVALID_FILTER: Invalid facet values for this collection."
      });
    }
  }
  return {
    searchOptions,
    searchResult,
    /**
     * Retrieve lightweight discovery records with index-generated query context.
     *
     * @param input - Validated query, filters and pagination for this collection.
     * @returns Validated lightweight search results with query context and pagination.
     */
    async search(input: z.output<typeof searchOptions>) {
      const parsed = searchOptions.parse(input);
      const args = searchOptionsSchema.strip().parse(parsed);
      const geo = options.geoSearch
        ? await resolveGeoSearch(geoOptions.parse(parsed), options.geoSearch)
        : undefined;
      try {
        validateFacets(args);
        const response = await useAlgoliaClient().searchSingleIndex<Record<string, unknown>>({
          indexName: options.indexName,
          searchParams: {
            query: args.query,
            page: args.page - 1,
            hitsPerPage: args.page_size,
            facetFilters: await buildFacetFilters(options.indexName, args.filters),
            attributesToRetrieve: [
              ...new Set(["objectID", ...(options.attributes ?? Object.values(fields))])
            ],
            attributesToSnippet: args.query ? ["*:30"] : [],
            attributesToHighlight: [],
            highlightPreTag: "**",
            highlightPostTag: "**",
            analytics: false,
            ...(geo ? geoSearchParams(geo) : {})
          }
        });
        const pagination = paginationSchema.parse(response);
        const records = response.hits.map((hit) => {
          const path = hit[fields.path];
          const snippet = args.query ? findSearchSnippet(hit._snippetResult) : null;
          const record = options.mapHit
            ? recordSchema.parse(options.mapHit(hit, { collection: options.name, snippet }))
            : recordSchema.parse({
                id: hit[fields.id] ?? hit.objectID,
                collection: options.name,
                title: hit[fields.title],
                slug: hit[fields.slug] ?? "",
                description: hit[fields.description] ?? "",
                source_url: typeof path === "string" ? useSourceUrl(path) : null,
                snippet
              });
          return geo ? { ...record, geo: geoHitMetadata(hit._rankingInfo) } : record;
        });
        return searchResult.parse({
          collection: options.name,
          query: args.query,
          records,
          ...(geo ? { geo } : {}),
          page: args.page,
          page_size: args.page_size,
          total: pagination.nbHits,
          total_is_exact: response.exhaustive?.nbHits ?? response.exhaustiveNbHits ?? false,
          total_pages: pagination.nbPages,
          has_more: args.page < pagination.nbPages,
          retrieved_at: new Date().toISOString()
        });
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
          validateFacets(args);
          const response = await useAlgoliaClient().searchSingleIndex({
            indexName: options.indexName,
            searchParams: {
              query: args.query,
              facetFilters: await buildFacetFilters(options.indexName, args.filters, args.facets),
              facets: args.facets ?? facetNames ?? ["*"],
              maxValuesPerFacet: args.max_values,
              hitsPerPage: 0,
              attributesToRetrieve: [],
              attributesToHighlight: [],
              analytics: false
            }
          });
          const rawCounts = facetCountsSchema.parse(response.facets ?? {});
          const counts = facetNames
            ? Object.fromEntries(
                Object.entries(rawCounts).filter(([name]) => facetNames.includes(name))
              )
            : rawCounts;
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
 * @throws H3Error preserving input errors with status 400 or reporting other search failures as status 502.
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
