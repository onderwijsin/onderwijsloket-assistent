import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { readItems, type Query } from "@directus/sdk";
import type { Schema, RegionalEducationDesk } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/collections/definition";
import {
  defineCollectionFilters,
  exactTextFilter,
  booleanFilter,
  taxonomyFilter
} from "../utils/taxonomy/collection-filters";
import { taxonomySchema, createTaxonomySourceSchema } from "../utils/taxonomy/taxonomy";
import { collectionRelationSchema, collectionRelationLimit } from "../utils/collections/relations";
import { nullableOutput } from "../utils/mcp-schema";
import {
  navigatorIdSchema,
  navigatorUrl,
  locationSchema,
  locationSourceSchema,
  locationFields,
  availabilitySchema,
  availabilitySourceSchema,
  availabilityFields
} from "../utils/projections/navigator";
import { areaSchema, areaSourceSchema, areaFields } from "../utils/projections/service-areas";
import { assetSchema, imageAssetSourceSchema } from "../utils/projections/supporting";
import { useSourceUrl } from "../utils/use-source-url";
import { renderContentDocument } from "../utils/content/render-content-document";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = navigatorIdSchema.describe(
  "Desk identifier from list_regional_education_desks or search_regional_education_desks."
);
// Live source values extend stale generated enum unions; retain their exact spelling.
const activitySchema = z.enum([
  "webinars",
  "informatiebijeenkomsten",
  "meeloopdagen op school",
  "open dagen (universiteit)",
  "open dagen (school)",
  "open dagen (opleiding)",
  "anders"
]);
const contentTypeSchema = z.enum([
  "video's",
  "podcasts",
  "ervaringen",
  "blogs",
  "nieuws",
  "kennisartikelen",
  "anders"
]);
const responseTimeSchema = z.enum([
  "1 werkdag",
  "2 werkdagen",
  "1 werkweek",
  "Zo snel mogelijk",
  "zo snel mogelijk"
]);
const serviceTypeSchema = z.enum([
  "oriëntatie",
  "oriëntatieactiviteiten",
  "matching",
  "vacatures",
  "zij-instroom"
] satisfies (
  | NonNullable<RegionalEducationDesk["service_links"]>[number]["type"]
  | "oriëntatieactiviteiten"
)[]);
const filters = defineCollectionFilters(
  "regional_education_desks",
  {
    title: exactTextFilter(
      "Exact desk title; use search_regional_education_desks for text or region/city discovery."
    ),
    slug: exactTextFilter("Exact desk page slug."),
    sectors: taxonomyFilter("sectors"),
    has_consultation_service: booleanFilter("Whether the desk offers a consultation service."),
    has_physical_location: booleanFilter(
      "Whether the desk advertises physical visits; inspect location and warnings separately."
    ),
    appointment_for_visit: booleanFilter("Whether an appointment is required for a visit.")
  },
  { listTool: "list_regional_education_desks", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("regional_education_desks"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  source_url: nullableOutput(z.url()),
  date_updated: nullableOutput(z.string()),
  website: nullableOutput(z.url()),
  email: nullableOutput(z.string()),
  phone: nullableOutput(z.string()),
  has_consultation_service: z.boolean(),
  has_physical_location: z.boolean(),
  appointment_for_visit: z.boolean(),
  area: nullableOutput(areaSchema),
  location: nullableOutput(locationSchema),
  logo: nullableOutput(assetSchema),
  sectors: z.array(taxonomySchema),
  regions: nullableOutput(z.array(z.string())),
  cities_municipalities: nullableOutput(z.string()),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  date_updated: z.string().nullish(),
  website: z.string().nullish(),
  email: z.string().nullish(),
  phone: z.string().nullish(),
  has_consultation_service: z.boolean(),
  has_physical_location: z.boolean(),
  appointment_for_visit: z.boolean(),
  area: areaSourceSchema.nullable(),
  location: locationSourceSchema.nullish(),
  logo: imageAssetSourceSchema,
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  regions: z.array(z.string()).nullish(),
  cities_municipalities: z.string().nullish()
});
const serviceLinkSource = z.object({
  url: z.string(),
  type: serviceTypeSchema,
  domain: z.string()
});
const detailSourceSchema = sourceSchema.extend({
  description: z.unknown(),
  consultation_service_description: z.unknown(),
  consultation_service_url: z.string().nullish(),
  phone_availability: availabilitySourceSchema.nullish(),
  email_response_time: responseTimeSchema.nullish(),
  service_links: z.array(serviceLinkSource).nullish(),
  orientation_activity_types: z.array(activitySchema).nullish(),
  content_types: z.array(contentTypeSchema).nullish()
});
const sorts = ["title", "-title", "date_updated", "-date_updated"] as const;
/**
 * Select service coverage independently of physical location and phone schedules.
 * @param args - Validated list arguments.
 * @param id - Optional detail identity.
 * @returns Typed, bounded source query; visibility remains a Directus responsibility.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const { sectors, ...scalar } = args.filters ?? {};
  return {
    fields: [
      "id",
      "title",
      "slug",
      "path",
      "date_updated",
      "website",
      "email",
      "phone",
      "has_consultation_service",
      "has_physical_location",
      "appointment_for_visit",
      "regions",
      "cities_municipalities",
      "logo",
      { area: [...areaFields] },
      { location: locationFields },
      { sectors: ["id", { sectors_id: ["id", "title", "slug", "description"] }] },
      ...(id
        ? ([
            "description",
            "consultation_service_description",
            "consultation_service_url",
            "email_response_time",
            "service_links",
            "orientation_activity_types",
            "content_types",
            { phone_availability: availabilityFields }
          ] as const)
        : [])
    ],
    deep: { sectors: { _limit: collectionRelationLimit + 1, _sort: ["id"] } },
    filter: {
      ...(id ? { id: { _eq: id } } : {}),
      ...Object.fromEntries(Object.entries(scalar).map(([key, value]) => [key, { _eq: value }])),
      ...(sectors ? { sectors: { sectors_id: { id: { _in: sectors } } } } : {})
    },
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, RegionalEducationDesk>;
}
/**
 * Flatten desk sectors and preserve unavailable service coverage explicitly.
 * @param record - Validated source projection.
 * @returns Desk summary with independent relation warnings.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "regional_education_desks",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    website: navigatorUrl(record.website),
    email: record.email ?? null,
    phone: record.phone ?? null,
    location: record.location ?? null,
    regions: record.regions ?? null,
    cities_municipalities: record.cities_municipalities ?? null,
    sectors: record.sectors.records,
    relations_truncated: record.sectors.truncated ? ["sectors"] : [],
    content_warnings: [
      ...record.sectors.warnings,
      ...(!record.area ? ["Service area is unavailable; coverage cannot be determined."] : []),
      ...(record.has_physical_location && !record.location
        ? ["Desk advertises a physical location, but its location is unavailable."]
        : []),
      ...(record.website && !navigatorUrl(record.website)
        ? ["Unavailable or invalid desk website URL."]
        : [])
    ]
  });
}
/** Regional guidance services are distinct from training providers and physical teaching locations. */
const desks = defineMcpCollection({
  name: "regional_education_desks",
  cache: cacheDurations.collections.regional_education_desks,
  id: idSchema,
  description:
    "The regional_education_desks collection describes regional organizations that guide people interested in working in education. It helps prospective entrants and advisers find local support, consultation services, orientation activities and public contact options. Each desk includes its service area, regional and municipality labels, relevant education sectors and, where available, a physical meeting location. Detail records keep the desk description and consultation-service description separate, with scheduling links, service links, phone availability and email response expectations. Coverage describes a service region rather than a teaching location; sampled interior points are search approximations and do not establish exact eligibility. Use educational_institutions and programs for training providers and study pathways. Inspect warnings when coverage or an advertised location is unavailable, and contact the desk to confirm services or appointments.",
  operations: {
    list: "list_regional_education_desks",
    get: "get_regional_education_desk",
    search: "search_regional_education_desks"
  },
  resources: [
    { uri_template: "onderwijsloket://regional_education_desks/{id}", mime_type: "text/markdown" }
  ],
  summary: summarySchema,
  detail: summarySchema.extend({
    description: nullableOutput(z.string()),
    consultation_service_description: nullableOutput(z.string()),
    consultation_service_url: nullableOutput(z.url()),
    phone_availability: nullableOutput(availabilitySchema),
    email_response_time: nullableOutput(responseTimeSchema),
    service_links: nullableOutput(
      z.array(
        z.object({ url: nullableOutput(z.url()), type: serviceTypeSchema, domain: z.string() })
      )
    ),
    orientation_activity_types: nullableOutput(z.array(activitySchema)),
    content_types: nullableOutput(z.array(contentTypeSchema)),
    truncated: z.boolean()
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "regional_education_desks",
    indexName: "regional_education_desks",
    filterSchema: z.strictObject({
      "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      has_consultation_service: z.array(z.boolean()).min(1).max(2).optional(),
      orientation_activity_types: z.array(activitySchema).min(1).max(50).optional(),
      content_types: z.array(contentTypeSchema).min(1).max(50).optional()
    }),
    attributes: [
      "id",
      "title",
      "slug",
      "path",
      "regions",
      "has_consultation_service",
      "has_physical_location",
      "appointment_for_visit"
    ],
    recordSchema: z.object({
      collection: z.literal("regional_education_desks"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      source_url: nullableOutput(z.url()),
      regions: nullableOutput(z.array(z.string())),
      has_consultation_service: z.boolean(),
      has_physical_location: z.boolean(),
      appointment_for_visit: z.boolean(),
      snippet: nullableOutput(snippetSchema)
    }),
    /**
     * Keep indexed search hits lightweight; retrieve geometry, schedules and bodies from the source.
     * @param hit - Untrusted index projection.
     * @param context - Collection and matched snippet.
     * @returns Candidate search result without provider grid points or fabricated location data.
     */
    mapHit(hit, context) {
      return {
        ...hit,
        collection: "regional_education_desks",
        id: hit.id ?? hit.objectID,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        regions: hit.regions ?? null,
        snippet: context.snippet
      };
    }
  }),
  /**
   * Keep contacts, coverage and schedules beside the two separately rendered descriptions.
   * @param record - Validated detail.
   * @returns Public resource metadata without duplicated prose.
   */
  resourceMetadata({
    description: _description,
    consultation_service_description: _consultation,
    ...record
  }) {
    return record;
  },
  /**
   * List bounded desk summaries without rich descriptions or phone schedules.
   * @param args - Validated source filters and page.
   * @returns Summary page and continuation flag.
   */
  async list(args) {
    const rows = await readCollectionRecords(
      "regional_education_desks",
      readItems("regional_education_desks", buildQuery(args)),
      sourceSchema
    );
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * Render desk and consultation descriptions independently, preserving nullable content.
   * @param id - Validated desk UUID.
   * @returns Full source detail with separate phone and location schedules.
   */
  async get(id) {
    const [record] = await readCollectionRecords(
      "regional_education_desks",
      readItems(
        "regional_education_desks",
        buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)
      ),
      detailSourceSchema
    );
    if (!record)
      throw createError({
        statusCode: 404,
        message: "NOT_FOUND: Regional education desk not found."
      });
    const options = { assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl };
    const description = renderContentDocument(record.description, [], {
      ...options,
      ensureHeadingOne: true,
      metadata: { title: record.title }
    });
    const consultation = renderContentDocument(
      record.consultation_service_description,
      [],
      options
    );
    const service_links =
      record.service_links?.map((link) => ({ ...link, url: navigatorUrl(link.url) })) ?? null;
    const consultation_service_url = navigatorUrl(record.consultation_service_url);
    const summary = summarize(record);
    return {
      ...summary,
      description: description.markdown,
      consultation_service_description: consultation.markdown,
      consultation_service_url,
      phone_availability: record.phone_availability ?? null,
      email_response_time: record.email_response_time ?? null,
      service_links,
      orientation_activity_types: record.orientation_activity_types ?? null,
      content_types: record.content_types ?? null,
      truncated: description.truncated || consultation.truncated,
      content_warnings: [
        ...summary.content_warnings,
        ...description.warnings,
        ...consultation.warnings.map((w) => `consultation_service_description: ${w}`),
        ...(record.consultation_service_url && !consultation_service_url
          ? ["Unavailable or invalid consultation service URL."]
          : []),
        ...(service_links?.some((link) => !link.url)
          ? ["Unavailable or invalid service link URL."]
          : [])
      ]
    };
  },
  filters: filters.filters
});
export default desks;
