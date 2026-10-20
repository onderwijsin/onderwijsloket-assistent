import { z } from "zod";
import { nullableOutput } from "../mcp-schema";

/** Shared discovery metadata; record schemas remain collection-specific. */
export const collectionMetadataSchema = z.object({
  name: z.string().describe("Collection name used in tool arguments."),
  description: z.string().describe("Content and purpose of this collection."),
  capabilities: z
    .object({
      list: z.boolean(),
      get: z.boolean(),
      filters: z.boolean(),
      search: z.boolean(),
      facets: z.boolean()
    })
    .describe("Available operations. False means the operation is not implemented."),
  fields: z.array(z.string()).describe("Fields included in collection list summaries."),
  detail_fields: z
    .array(z.string())
    .describe("Additional fields returned by the collection detail tool."),
  filterable_fields: z
    .array(z.string())
    .describe(
      "Accepted keys under the collection list filters. Call get_filters for matching rules and current taxonomy choices."
    ),
  sorts: z
    .array(z.string())
    .describe("Accepted sorts; the first is the default. Minus means descending."),
  pagination: z
    .object({
      default_page_size: z.number().int().positive(),
      max_page_size: z.number().int().positive(),
      first_page: z.literal(1)
    })
    .describe("Pagination defaults and limits for collection lists.")
});

/** Names of the concrete tools implementing each supported operation. */
export const collectionOperationsSchema = z.object({
  list: z.string(),
  get: z.string(),
  filters: z.string(),
  search: nullableOutput(z.string()),
  facets: nullableOutput(z.string())
});

/** Optional resource representation, registered explicitly by the collection. */
export const collectionResourceSchema = z.object({
  uri_template: z.string(),
  mime_type: z.string()
});
