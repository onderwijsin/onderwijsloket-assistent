import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema, EducationalInstitution } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/define-mcp-collection";
import {
  defineCollectionFilters,
  exactTextFilter,
  enumFilter,
  relationIdFilter
} from "../utils/taxonomy/collection-filters";
import { nullableOutput } from "../utils/mcp-schema";
import { collectionRelationSchema, collectionRelationLimit } from "../utils/collection-relations";
import { assetSchema, imageAssetSourceSchema } from "../utils/supporting-content";
import {
  navigatorIdSchema,
  institutionTypeSchema,
  navigatorVendorSchema,
  locationFields,
  locationSchema,
  locationSourceSchema,
  indexedLocationSchema,
  indexedLocationSourceSchema,
  navigatorUrl
} from "../utils/navigator-content";
import { useSourceUrl } from "../utils/use-source-url";
import { renderContentDocument } from "../utils/content/render-content-document";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = navigatorIdSchema.describe(
  "Institution identifier returned by list_educational_institutions or search_educational_institutions."
);
const filters = defineCollectionFilters(
  "educational_institutions",
  {
    title: exactTextFilter(
      "Exact institution title; use search_educational_institutions for text search."
    ),
    slug: exactTextFilter("Exact institution page slug."),
    code: exactTextFilter("Exact institutional code."),
    brin_code: exactTextFilter("Exact BRIN registry code; preserve leading zeros."),
    type: enumFilter(institutionTypeSchema.options, "Institution type as a source code."),
    vendor: enumFilter(
      navigatorVendorSchema.options,
      "Source vendor; provenance filter, not an access policy."
    ),
    locations: relationIdFilter(
      "educational_institutions",
      "list_educational_institutions",
      navigatorIdSchema,
      "locations[].id"
    )
  },
  { listTool: "list_educational_institutions", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("educational_institutions"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  code: z.string(),
  type: institutionTypeSchema,
  source_url: nullableOutput(z.url()),
  vendor: navigatorVendorSchema,
  date_updated: nullableOutput(z.string()),
  logo: nullableOutput(assetSchema),
  main_location: nullableOutput(locationSchema),
  locations: z.array(locationSchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  code: z.string(),
  type: institutionTypeSchema,
  path: z.string(),
  vendor: navigatorVendorSchema,
  date_updated: z.string().nullish(),
  logo: imageAssetSourceSchema,
  main_location: locationSourceSchema.nullable(),
  locations: collectionRelationSchema("locations_id", locationSourceSchema)
});
const websiteSource = z.object({
  url: z.string(),
  lang: z.enum(["Nederlands", "Engels", "Overig"])
});
const detailSourceSchema = sourceSchema.extend({
  description: z.unknown(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  brin_code: z.string().nullish(),
  website: z.array(websiteSource).nullish()
});
const sorts = ["title", "-title", "date_updated", "-date_updated"] as const;
/**
 * Select bounded locations and public organizational fields without expanding all offered programs.
 * @param args - Parsed domain filters, stable sort and pagination.
 * @param id - Optional detail identifier selecting description/contact metadata.
 * @returns Typed source query with no visibility policy.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...Object.fromEntries(
      Object.entries(args.filters ?? {})
        .filter(([key]) => key !== "locations")
        .map(([key, value]) => [key, { _eq: value }])
    ),
    ...(args.filters?.locations
      ? { locations: { locations_id: { id: { _in: args.filters.locations } } } }
      : {})
  };
  return {
    fields: [
      "id",
      "title",
      "slug",
      "code",
      "type",
      "path",
      "vendor",
      "date_updated",
      "logo",
      { main_location: locationFields },
      { locations: ["id", "sort", { locations_id: locationFields }] },
      ...(id ? (["description", "email", "phone", "website", "brin_code"] as const) : [])
    ],
    deep: {
      locations: { _limit: collectionRelationLimit + 1, _sort: ["sort", "id"] }
    },
    filter,
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, EducationalInstitution>;
}
/**
 * Validate selected institution projections and sanitize upstream errors.
 * @param query - Summary or detail projection.
 * @param schema - Matching source validator.
 * @returns Normalized source records.
 */
async function readInstitutions<T extends z.ZodType>(
  query: ReturnType<typeof buildQuery>,
  schema: T
) {
  try {
    return z
      .array(schema)
      .parse(await useDirectusServer(readItems("educational_institutions", query)));
  } catch {
    throw createError({
      statusCode: 502,
      message: "UPSTREAM_UNAVAILABLE: Institution data could not be retrieved or validated."
    });
  }
}
/**
 * Preserve main and additional locations independently, reporting incomplete expansions.
 * @param record - Validated institution source.
 * @returns Public summary and source provenance.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "educational_institutions",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    locations: record.locations.records,
    content_warnings: record.locations.warnings,
    relations_truncated: record.locations.truncated ? ["locations"] : []
  });
}
/** Institutions describe real providers, distinct from their programs and physical locations. */
export default defineMcpCollection({
  name: "educational_institutions",
  id: idSchema,
  description:
    "The educational_institutions collection describes organizations offering educational programs, including vocational institutions, universities of applied sciences and universities. It helps prospective education professionals and advisers identify providers, understand their institutional context and find public contact information and teaching locations. Institution records retain organizational type, codes, language-tagged websites, descriptions, logos and separate main and additional locations. Source vendor metadata indicates provenance, while update dates indicate record freshness. Use institutions to explore providers and their locations; use programs filtered by an institution ID to discover its educational offerings rather than assuming every program is embedded in the provider record.",
  operations: {
    list: "list_educational_institutions",
    get: "get_educational_institution",
    search: "search_educational_institutions"
  },
  resources: [
    { uri_template: "onderwijsloket://educational_institutions/{id}", mime_type: "text/markdown" }
  ],
  summary: summarySchema,
  detail: summarySchema.extend({
    description: nullableOutput(z.string()).describe("Institution description as Markdown."),
    email: nullableOutput(z.string()),
    phone: nullableOutput(z.string()),
    brin_code: nullableOutput(z.string()),
    website: nullableOutput(
      z.array(z.object({ url: nullableOutput(z.url()), lang: websiteSource.shape.lang }))
    ),
    truncated: z.boolean()
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "educational_institutions",
    indexName: "educational_institutions",
    filterSchema: z.strictObject({
      type: z.array(z.string().min(1).max(300)).min(1).max(50).optional()
    }),
    attributes: ["id", "title", "slug", "path", "type", "main_location"],
    recordSchema: z.object({
      collection: z.literal("educational_institutions"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      type: institutionTypeSchema,
      source_url: nullableOutput(z.url()),
      main_location: nullableOutput(indexedLocationSchema),
      snippet: nullableOutput(snippetSchema)
    }),
    /**
     * Map verified index metadata without inventing a text description or full location schedule.
     * @param hit - Untrusted partial index projection.
     * @param context - Collection identity and matched snippet.
     * @returns Candidate public search hit.
     */
    mapHit(hit, context) {
      return {
        collection: "educational_institutions",
        id: hit.id ?? hit.objectID,
        title: hit.title,
        slug: hit.slug,
        type: hit.type,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        main_location:
          hit.main_location == null ? null : indexedLocationSourceSchema.parse(hit.main_location),
        snippet: context.snippet
      };
    }
  }),
  /**
   * Preserve locations, contacts and completeness metadata outside the description body.
   * @param record - Validated institution detail.
   * @returns YAML front matter for the resource representation.
   */
  resourceMetadata({ description: _description, ...record }) {
    return record;
  },
  /**
   * Read summary records without fetching rich descriptions or reverse program catalogues.
   * @param args - Parsed list filters and pagination.
   * @returns A bounded page with a continuation flag.
   */
  async list(args) {
    const rows = await readInstitutions(buildQuery(args), sourceSchema);
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * Render the source description with separate public contacts and location schedules.
   * @param id - Validated institution UUID.
   * @returns Readable detail and independent document/relation completeness fields.
   */
  async get(id) {
    const [record] = await readInstitutions(
      buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id),
      detailSourceSchema
    );
    if (!record)
      throw createError({ statusCode: 404, message: "NOT_FOUND: Institution not found." });
    const rendered = renderContentDocument(record.description, [], {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: { title: record.title }
    });
    const summary = summarize(record);
    const website =
      record.website?.map((site) => ({ ...site, url: navigatorUrl(site.url) })) ?? null;
    return {
      ...summary,
      description: rendered.markdown,
      email: record.email ?? null,
      phone: record.phone ?? null,
      brin_code: record.brin_code ?? null,
      website,
      truncated: rendered.truncated,
      content_warnings: [
        ...summary.content_warnings,
        ...rendered.warnings,
        ...(website?.some((site) => site.url === null)
          ? ["Unavailable or invalid institution website URL."]
          : [])
      ]
    };
  },
  /** @returns Exact source filter rules and nested location-ID lookup instructions. */
  filters: filters.filters
});
