import { cacheCollectionDetail } from "./cache-detail";
import {
  collectionMetadataSchema,
  collectionOperationsSchema,
  collectionResourceSchema
} from "./metadata";
import {
  searchOptionsSchema,
  searchResultSchema,
  facetsOptionsSchema,
  facetsResultSchema
} from "../search/schemas";
import type { FacetsOptions, FacetsResult } from "../search/schemas";
import { createError } from "h3";
import type { Schema } from "#directus";
import { z } from "zod";

/** Parsed options supplied to a collection's list implementation. */
export type McpListOptions<
  Filters extends z.ZodObject,
  Sorts extends readonly [string, ...string[]]
> = {
  filters?: z.output<Filters>;
  page: number;
  page_size: number;
  sort: Sorts[number];
};

/**
 * Define a collection once for both direct callers and MCP tools.
 * Wrap list/get with validation and response envelopes; filters supplies its own discovery response.
 * Summary/detail schemas must describe output data without source-normalization transforms.
 *
 * @param collection - Collection schemas, operation implementations and discovery metadata.
 * @returns The collection definition with validated methods, discovery metadata and MCP input/output schemas.
 * @throws Error when search lacks an operation name or the detail cache TTL is invalid.
 */
export function defineMcpCollection<
  const Name extends keyof Schema & string,
  Summary extends z.ZodObject,
  Detail extends z.ZodObject,
  Filters extends z.ZodObject,
  const Sorts extends readonly [string, ...string[]],
  FilterOutput extends z.ZodObject,
  Id extends z.ZodType<string>,
  SearchInput extends z.ZodObject = typeof searchOptionsSchema,
  SearchOutput extends z.ZodObject = typeof searchResultSchema
>(collection: {
  name: Name;
  description: string;
  id: Id;
  /** Detail caching is opt-in for definitions; production collections use config/cache.ts. */
  cache?: { detail: number | false };
  operations: { list: string; get: string; search?: string };
  resources?: z.output<typeof collectionResourceSchema>[];
  searchOptions?: SearchInput;
  searchResult?: SearchOutput;
  summary: Summary;
  detail: Detail;
  filterSchema: Filters;
  sorts: Sorts;
  filtersOutput: FilterOutput;
  /**
   * Optional index-backed discovery operations; advertised only when supplied.
   *
   * @param options - Parsed query, selected facets or filters, and operation-specific limits.
   * @returns Validated lightweight search results with query context and pagination.
   */
  search?(options: z.output<NoInfer<SearchInput>>): Promise<z.output<NoInfer<SearchOutput>>>;
  /**
   * Discover facet values and counts for the supplied search context.
   *
   * @param options - Parsed query, selected facets or filters, and operation-specific limits.
   * @returns Validated facet values and counts for the supplied query and filters.
   */
  facets?(options: FacetsOptions): Promise<FacetsResult>;
  /**
   * Collection-specific front matter fields; serialization belongs to the shared content utility.
   *
   * @param record - Record whose metadata is being normalized.
   * @returns Collection-specific fields to serialize as resource front matter.
   */
  resourceMetadata?(record: z.output<Detail>): Record<string, unknown>;
  /**
   * Retrieve a page of collection summaries.
   *
   * @param options - Parsed filters, sort order, page number and page size.
   * @returns Summary records and whether another page is available.
   */
  list(
    options: McpListOptions<Filters, Sorts>
  ): Promise<{ records: z.output<Summary>[]; has_more: boolean }>;
  /**
   * Retrieve one complete collection record.
   *
   * @param id - Record identifier.
   * @returns The record matching the detail schema, without a response envelope.
   */
  get(id: string): Promise<z.output<Detail>>;
  /**
   * Discover supported filter rules and current choices.
   *
   * @returns Validated filter definitions with current taxonomy choices.
   */
  filters(): Promise<z.output<FilterOutput>>;
}) {
  if (collection.search && !collection.operations.search) {
    throw new Error("Search-capable collections require a concrete search tool name.");
  }
  const getRecord = cacheCollectionDetail(
    collection.name,
    collection.detail,
    (id) => collection.get(id),
    collection.cache?.detail
  );
  const collectionInput = {
    collection: z.literal(collection.name).describe("Collection name returned by list_collections.")
  };
  const listInput = z.strictObject({
    ...collectionInput,
    filters: collection.filterSchema
      .optional()
      .describe(
        "Optional filters. Conditions across fields use AND; IDs within a taxonomy use OR. Discover taxonomy IDs with get_filters; omit unused fields."
      ),
    page: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(1)
      .describe(
        "One-based page number. Increment while has_more is true; keep filters, sort and page_size unchanged."
      ),
    page_size: z
      .number()
      .int()
      .min(1)
      .max(25)
      .default(10)
      .describe("Maximum records per page (1–25); defaults to 10."),
    // The first declared sort is also the collection default.
    sort: z
      .enum(collection.sorts)
      .default(collection.sorts[0])
      .describe(
        "Sort field; a leading minus means descending. Defaults to the first declared sort."
      )
  });
  const getInput = z.strictObject({
    ...collectionInput,
    id: collection.id
  });
  const listOutput = z.object({
    records: z
      .array(collection.summary)
      .max(25)
      .describe(`Matching record summaries. Use ${collection.operations.get} for full detail.`),
    page: z.number().int().positive(),
    page_size: z.number().int().min(1).max(25),
    has_more: z.boolean().describe("Whether another page is available."),
    retrieved_at: z.iso
      .datetime()
      .describe("UTC time when this response was assembled; not the source update time.")
  });
  const getOutput = z.object({
    record: collection.detail,
    retrieved_at: z.iso
      .datetime()
      .describe("UTC time when this response was assembled; not the source update time.")
  });
  // Defaults retain the original article contract for definitions without search adapters.
  const searchOptions = (collection.searchOptions ?? searchOptionsSchema) as SearchInput;
  const searchResult = (collection.searchResult ?? searchResultSchema) as SearchOutput;
  // Preserve concrete shape inference while adding the collection literal for MCP discovery.
  const searchInput = z.strictObject({
    ...searchOptions.shape,
    ...collectionInput
  } as SearchInput["shape"] & typeof collectionInput);
  const searchOutput = z.object({ ...searchResult.shape, ...collectionInput } as Omit<
    SearchOutput["shape"],
    "collection"
  > &
    typeof collectionInput);
  const facetsInput = facetsOptionsSchema.extend(collectionInput);
  const facetsOutput = facetsResultSchema.extend({ collection: z.literal(collection.name) });
  const metadataSchema = collectionMetadataSchema.extend({
    name: z.literal(collection.name),
    sorts: z.array(z.enum(collection.sorts)),
    operations: collectionOperationsSchema.optional(),
    resources: z.array(collectionResourceSchema).optional()
  });
  return {
    ...collection,
    metadataSchema,
    searchInput,
    searchOutput,
    facetsInput,
    facetsOutput,
    /**
     * Validate search boundaries consistently across collections.
     *
     * @param input - Caller-supplied options; omitted values use the collection defaults.
     * @returns Validated lightweight search results with query context and pagination.
     */
    async search(input: Partial<z.input<SearchInput>> = {}) {
      const args = { ...input, collection: collection.name };
      searchInput.parse(args);
      if (!collection.search)
        throw createError({
          statusCode: 501,
          message: "UNSUPPORTED_OPERATION: Search is not available for this collection."
        });
      const { collection: _name, ...options } = args;
      const result = searchResult.parse(await collection.search(searchOptions.parse(options)));
      searchOutput.parse(result);
      return result;
    },
    /**
     * Validate facet discovery and its dynamic response contract.
     *
     * @param input - Caller-supplied options; omitted values use the collection defaults.
     * @returns Validated facet values and counts for the supplied query and filters.
     */
    async facets(input: z.input<typeof facetsOptionsSchema> = {}) {
      const args = facetsInput.parse({ ...input, collection: collection.name });
      if (!collection.facets)
        throw createError({
          statusCode: 501,
          message: "UNSUPPORTED_OPERATION: Facets are not available for this collection."
        });
      return facetsOutput.parse(await collection.facets(args));
    },
    /**
     * Validate dynamic discovery results against the advertised output contract.
     *
     * @returns Validated filter definitions with current taxonomy choices.
     */
    async filters() {
      return collection.filtersOutput.parse(await collection.filters());
    },
    collectionInput,
    listInput,
    getInput,
    listOutput,
    getOutput,
    /**
     * Validate options and normalize the list response for every caller.
     *
     * @param input - Caller-supplied options; omitted values use the collection defaults.
     * @returns Validated record summaries, pagination and response timestamp.
     */
    async list(input: Omit<z.input<typeof listInput>, "collection"> = {}) {
      const args = listInput.parse({ ...input, collection: collection.name });
      const result = await collection.list(args);
      return listOutput.parse({
        ...result,
        page: args.page,
        page_size: args.page_size,
        retrieved_at: new Date().toISOString()
      });
    },
    /**
     * Validate the identifier and normalize the detail response for every caller.
     *
     * @param id - Record identifier.
     * @returns Validated record detail and response timestamp.
     */
    async get(id: string) {
      const recordId = collection.id.parse(id);
      return getOutput.parse({
        record: await getRecord(recordId),
        retrieved_at: new Date().toISOString()
      });
    },
    metadata: {
      name: collection.name,
      description: collection.description,
      // Required methods are available now; advertise search/facets only when implemented.
      capabilities: {
        list: true,
        get: true,
        filters: true,
        search: Boolean(collection.search),
        facets: Boolean(collection.facets)
      },
      fields: Object.keys(collection.summary.shape),
      detail_fields: Object.keys(collection.detail.shape).filter(
        (key) => !(key in collection.summary.shape)
      ),
      // Derive this separately from record fields: some dimensions are filterable but not returned.
      filterable_fields: Object.keys(collection.filterSchema.shape),
      sorts: [...collection.sorts],
      pagination: { default_page_size: 10, max_page_size: 25, first_page: 1 as const },
      operations: {
        list: collection.operations.list,
        get: collection.operations.get,
        filters: "get_filters",
        search: collection.search ? (collection.operations.search ?? null) : null,
        facets: collection.facets ? "get_facets" : null
      },
      resources: collection.resources ?? []
    }
  };
}
