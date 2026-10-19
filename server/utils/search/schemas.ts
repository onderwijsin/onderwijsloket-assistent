import { z } from "zod";
import { nullableOutput } from "../mcp-schema";

/** Search facets use index values rather than the Directus taxonomy ID filter contract. */
export const searchFiltersSchema = z
  .record(
    z.string().min(1).max(100),
    z
      .array(z.union([z.string().min(1).max(300), z.boolean(), z.number()]))
      .min(1)
      .max(50)
  )
  .describe(
    "Facet names mapped to selected values from get_facets. AND between fields, OR within each array. Use actual facet values, not the taxonomy IDs from get_filters or operator expressions."
  );

/** Shared discovery inputs; collections select their own index, never callers. */
export const searchOptionsSchema = z.strictObject({
  query: z
    .string()
    .trim()
    .max(500)
    .default("")
    .describe("Full-text query. Omit or use an empty string to browse using index ranking."),
  filters: searchFiltersSchema.optional(),
  page: z
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(1)
    .describe("One-based page. Keep query, filters and page_size unchanged when advancing."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(10)
    .describe("Maximum discovery results per page, from 1 to 25.")
});

/** One query-centered excerpt; Algolia's match markers are represented as Markdown bold text. */
export const snippetSchema = z.object({
  field: z.string().describe("Index attribute containing the matching excerpt."),
  text: z
    .string()
    .describe("A short query-centered excerpt. Matched terms are surrounded by ** markers."),
  match_level: z
    .enum(["partial", "full"])
    .describe("Whether some or all query terms matched this attribute; not a relevance score.")
});

/** Minimal discovery record; full content and taxonomy metadata come from get_record. */
export const searchRecordSchema = z.object({
  id: z.uuid().describe("Record ID accepted by get_record."),
  collection: z.string().describe("Collection name for subsequent tool calls."),
  title: z.string().describe("Record title from the search index."),
  slug: z.string().describe("Record URL slug from the search index."),
  description: z
    .string()
    .describe("Short description from search results; may lag behind record updates."),
  source_url: nullableOutput(z.url()).describe("Canonical page to cite."),
  snippet: nullableOutput(snippetSchema).describe(
    "Matching context when a query was supplied. Null for browsing or when no matched snippet is available."
  )
});

/** Validated search response, with index counts and pagination limits left visible to callers. */
export const searchResultSchema = z.object({
  collection: z.string().describe("Collection name for subsequent tool calls."),
  query: z.string().describe("Normalized query applied to the index."),
  records: z
    .array(searchRecordSchema)
    .max(25)
    .describe(
      "Lightweight hits in index relevance order. Use get_record for full content and metadata."
    ),
  page: z.number().int().positive(),
  page_size: z.number().int().min(1).max(25),
  total: z
    .number()
    .int()
    .nonnegative()
    .describe("Index match count; inspect total_is_exact before treating it as exact."),
  total_is_exact: z.boolean(),
  total_pages: z
    .number()
    .int()
    .nonnegative()
    .describe(
      "Pages accessible within the search pagination limit; may not cover every matching hit."
    ),
  has_more: z.boolean(),
  retrieved_at: z.iso
    .datetime()
    .describe("UTC time when this response was assembled; not the source update time.")
});

/** Optional facet selection and query/filter context for dynamic counts. */
export const facetsOptionsSchema = searchOptionsSchema.pick({ query: true, filters: true }).extend({
  facets: z
    .array(z.string().min(1).max(100))
    .min(1)
    .max(20)
    .optional()
    .describe(
      "Facet names from a previous get_facets response. Omit to return all configured countable facets."
    ),
  max_values: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(100)
    .describe(
      "Maximum returned values per facet. A facet may have additional values beyond this limit."
    )
});

/** Facet counts apply to the exact supplied query and filters, including the facet's own filter. */
export const facetsResultSchema = z.object({
  collection: z.string().describe("Collection name for subsequent tool calls."),
  query: z.string().describe("Normalized query applied to the index."),
  filters: searchFiltersSchema,
  facets: z.array(
    z.object({
      name: z.string().describe("Use this exact index attribute as a search filter key."),
      values: z.array(
        z.object({
          value: z.string().describe("Use this exact value in a filter array."),
          count: z.number().int().nonnegative()
        })
      )
    })
  ),
  max_values: z.number().int().positive(),
  counts_are_exact: z
    .boolean()
    .describe(
      "Whether the returned facet counts are exact. Does not imply all facet values were returned."
    ),
  retrieved_at: z.iso
    .datetime()
    .describe("UTC time when this response was assembled; not the source update time.")
});

export type SearchOptions = z.output<typeof searchOptionsSchema>;
export type SearchResult = z.output<typeof searchResultSchema>;
export type FacetsOptions = z.output<typeof facetsOptionsSchema>;
export type FacetsResult = z.output<typeof facetsResultSchema>;
