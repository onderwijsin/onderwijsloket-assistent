import {
  collectionRelationBounds,
  collectionRelationSchema,
  collectionRelationLimit
} from "../utils/collections/relations";
import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema, Program } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/collections/definition";
import {
  defineCollectionFilters,
  exactTextFilter,
  enumFilter,
  relationIdFilter,
  relationIdEqualityFilter,
  taxonomyFilters
} from "../utils/taxonomy/collection-filters";
import { nullableOutput } from "../utils/mcp-schema";

import {
  navigatorIdSchema,
  navigatorVendorSchema,
  programTypeSchema,
  programLevelSchema,
  financingSchema,
  locationFields,
  locationSchema,
  locationSourceSchema,
  institutionReferenceFields,
  institutionReferenceSchema,
  institutionReferenceSourceSchema,
  indexedLocationSchema,
  indexedLocationSourceSchema,
  indexedInstitutionSchema,
  indexedInstitutionSourceSchema,
  navigatorUrl
} from "../utils/projections/navigator";
import { createTaxonomySourceSchema, taxonomySchema } from "../utils/taxonomy/taxonomy";
import { useSourceUrl } from "../utils/use-source-url";
import { renderContentDocument } from "../utils/content/render-content-document";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = navigatorIdSchema.describe(
  "Program identifier returned by list_programs or search_programs."
);
const taxonomyNames = ["sectors", "qualifications", "roles", "school_subjects"] as const;
const relationNames = [...taxonomyNames, "educational_institutions"] as const;
const filters = defineCollectionFilters(
  "programs",
  {
    title: exactTextFilter("Exact program title; use search_programs for text search."),
    slug: exactTextFilter("Exact program page slug."),
    croho: exactTextFilter("Exact CROHO code as text, preserving leading zeros."),
    crebo: exactTextFilter("Exact CREBO code as text, preserving leading zeros."),
    type: enumFilter(programTypeSchema.options, "Native program classification."),
    level: enumFilter(programLevelSchema.options, "Native education level."),
    financing: enumFilter(financingSchema.options, "Native funding classification."),
    vendor: enumFilter(navigatorVendorSchema.options, "Source provenance, not an access policy."),
    ...taxonomyFilters(taxonomyNames),
    educational_institutions: relationIdFilter(
      "educational_institutions",
      "list_educational_institutions",
      navigatorIdSchema
    ),
    location: relationIdEqualityFilter(
      "programs",
      "list_programs",
      navigatorIdSchema,
      "location.id"
    )
  },
  { listTool: "list_programs", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("programs"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  source_url: nullableOutput(z.url()),
  type: programTypeSchema,
  level: programLevelSchema,
  degrees: nullableOutput(z.array(z.string())).describe(
    "Degree labels as returned by the source; use search degrees facets for filtering, not generated model codes."
  ),
  financing: nullableOutput(financingSchema),
  credits: nullableOutput(z.number()),
  croho: nullableOutput(z.string()),
  crebo: nullableOutput(z.string()),
  vendor: navigatorVendorSchema,
  date_updated: nullableOutput(z.string()),
  educational_institutions: z.array(institutionReferenceSchema),
  location: nullableOutput(locationSchema),
  sectors: z.array(taxonomySchema),
  qualifications: z.array(taxonomySchema),
  roles: z.array(taxonomySchema),
  school_subjects: z.array(taxonomySchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  type: programTypeSchema,
  level: programLevelSchema,
  degrees: z.array(z.string()).nullish(),
  financing: financingSchema.nullish(),
  credits: z.number().nullish(),
  croho: z.string().nullish(),
  crebo: z.string().nullish(),
  vendor: navigatorVendorSchema,
  date_updated: z.string().nullish(),
  location: locationSourceSchema.nullable(),
  educational_institutions: collectionRelationSchema(
    "educational_institutions_id",
    institutionReferenceSourceSchema
  ),
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  qualifications: collectionRelationSchema(
    "qualifications_id",
    createTaxonomySourceSchema("qualifications")
  ),
  roles: collectionRelationSchema("roles_id", createTaxonomySourceSchema("roles")),
  school_subjects: collectionRelationSchema(
    "school_subjects_id",
    createTaxonomySourceSchema("school_subjects")
  )
});
const formSourceSchema = z.object({
  id: navigatorIdSchema,
  program_id: navigatorIdSchema.nullable(),
  sort: z.number().nullish(),
  url: z.string().nullish(),
  description: z.unknown(),
  track: createTaxonomySourceSchema("tracks").nullable(),
  vendor: navigatorVendorSchema
});
const formSchema = z.object({
  id: navigatorIdSchema,
  sort: nullableOutput(z.number()),
  url: nullableOutput(z.url()),
  description: nullableOutput(z.string()),
  track: nullableOutput(taxonomySchema),
  vendor: navigatorVendorSchema,
  content_warnings: z.array(z.string()),
  truncated: z.boolean()
});
const detailSourceSchema = sourceSchema.extend({
  croho_name: z.string().nullish(),
  croho_sector: z.string().nullish(),
  crebo_profile: z.string().nullish(),
  program_forms: z.array(formSourceSchema)
});
const sorts = ["title", "-title", "date_updated", "-date_updated"] as const;
/**
 * Query native classifications and bounded providers/forms without claiming JSON degree filtering.
 * @param args - Validated domain filters, sort and pagination.
 * @param id - Optional detail identifier selecting form descriptions.
 * @returns Typed query, preserving target-ID junction paths and native location equality.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...Object.fromEntries(
      Object.entries(args.filters ?? {})
        .filter(
          ([key]) =>
            !relationNames.includes(key as (typeof relationNames)[number]) && key !== "location"
        )
        .map(([key, value]) => [key, { _eq: value }])
    ),
    ...(args.filters?.location ? { location: { id: { _eq: args.filters.location } } } : {})
  };
  for (const name of relationNames)
    if (args.filters?.[name])
      Object.assign(filter, { [name]: { [`${name}_id`]: { id: { _in: args.filters[name] } } } });
  return {
    fields: [
      "id",
      "title",
      "slug",
      "path",
      "type",
      "level",
      "degrees",
      "financing",
      "credits",
      "croho",
      "crebo",
      "vendor",
      "date_updated",
      { location: locationFields },
      { educational_institutions: [{ educational_institutions_id: institutionReferenceFields }] },
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { qualifications: [{ qualifications_id: ["id", "name", "path", "description"] }] },
      { roles: [{ roles_id: ["id", "name", "path", "description"] }] },
      { school_subjects: [{ school_subjects_id: ["id", "name", "path", "description"] }] },
      ...(id
        ? [
            "croho_name" as const,
            "croho_sector" as const,
            "crebo_profile" as const,
            {
              program_forms: [
                "id",
                "program_id",
                "sort",
                "url",
                "description",
                "vendor",
                { track: ["id", "name", "path", "description"] }
              ] as const
            }
          ]
        : [])
    ],
    deep: {
      ...collectionRelationBounds(relationNames),
      ...(id
        ? { program_forms: { _limit: collectionRelationLimit + 1, _sort: ["sort", "id"] } }
        : {})
    },
    filter,
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Program>;
}
/**
 * Normalize source metadata, provider identity and four taxonomy dimensions.
 * @param record - Validated source program.
 * @returns Public summary, keeping registry codes as strings and provenance per target.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "programs",
    source_url: useSourceUrl(record.path),
    degrees: record.degrees ?? null,
    financing: record.financing ?? null,
    credits: record.credits ?? null,
    croho: record.croho ?? null,
    crebo: record.crebo ?? null,
    date_updated: record.date_updated ?? null,
    ...Object.fromEntries(relationNames.map((name) => [name, record[name].records])),
    content_warnings: relationNames.flatMap((name) => record[name].warnings),
    relations_truncated: relationNames.filter((name) => record[name].truncated)
  });
}
const facetValue = z.array(z.string().min(1).max(300)).min(1).max(50).optional();
/** Programs describe concrete pathways and provider variants, not one synthesized article body. */
const programs = defineMcpCollection({
  name: "programs",
  cache: cacheDurations.collections.programs,
  id: idSchema,
  description:
    "The programs collection describes educational programs and pathways that prepare people for qualifications and roles in the Dutch education sector. For nearby study options, call search_programs with location set to a city, postcode or address and optional radius in metres (default 50000). Geo-search sorts nearest first and returns the resolved location, full address, effective radius and per-hit distances in geo metadata. Keep subject or program terms in query; omit query to browse nearby programs. It helps prospective students, career switchers and advisers compare program classifications, levels, degree labels, funding, registry codes and providers. Records link to the institutions offering a program, its teaching location, relevant qualifications, professional roles, school subjects and education sectors. Individual program forms retain their own pathway, external information link and readable description rather than merging different variants into one account. Vendor metadata identifies the origin of programs and their related providers. Use institution records for provider contacts and additional locations. Program records do not determine personalized eligibility.",
  operations: { list: "list_programs", get: "get_program", search: "search_programs" },
  resources: [{ uri_template: "onderwijsloket://programs/{id}", mime_type: "text/markdown" }],
  summary: summarySchema,
  detail: summarySchema.extend({
    croho_name: nullableOutput(z.string()),
    croho_sector: nullableOutput(z.string()),
    crebo_profile: nullableOutput(z.string()),
    program_forms: z.array(formSchema),
    truncated: z.boolean()
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "programs",
    indexName: "programs",
    geoSearch: "indexed_location",
    attributes: [
      "id",
      "title",
      "slug",
      "path",
      "type",
      "level",
      "degrees",
      "educational_institutions",
      "location"
    ],
    filterSchema: z.strictObject({
      type: facetValue,
      level: facetValue,
      degrees: facetValue,
      "qualifications.name": facetValue,
      "roles.name": facetValue,
      "sectors.title": facetValue,
      "school_subjects.name": facetValue,
      "program_forms.track.name": facetValue,
      "educational_institutions.title": facetValue
    }),
    recordSchema: z.object({
      collection: z.literal("programs"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      type: programTypeSchema,
      level: programLevelSchema,
      degrees: nullableOutput(z.array(z.string())),
      source_url: nullableOutput(z.url()),
      educational_institutions: z.array(indexedInstitutionSchema).max(collectionRelationLimit),
      location: nullableOutput(indexedLocationSchema),
      snippet: nullableOutput(snippetSchema)
    }),
    /**
     * Normalize verified flattened index providers and degree labels without fetching full descriptions.
     * @param hit - Untrusted selected index fields.
     * @param context - Collection and matched snippet.
     * @returns A candidate public search record, preserving partial index semantics.
     */
    mapHit(hit, context) {
      return {
        collection: "programs",
        id: hit.id ?? hit.objectID,
        title: hit.title,
        slug: hit.slug,
        type: hit.type,
        level: hit.level,
        degrees: hit.degrees ?? null,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        educational_institutions: z
          .array(indexedInstitutionSourceSchema)
          .max(collectionRelationLimit)
          .parse(hit.educational_institutions),
        location: hit.location == null ? null : indexedLocationSourceSchema.parse(hit.location),
        snippet: context.snippet
      };
    }
  }),
  /**
   * Retain overview, provider/location metadata and per-form completeness beside rendered form sections.
   * @param record - Validated program detail.
   * @returns Front matter excluding duplicated description bodies.
   */
  resourceMetadata(record) {
    return {
      ...record,
      program_forms: record.program_forms.map(({ description: _description, ...form }) => form)
    };
  },
  /**
   * Retrieve summary pages without reading every variant description.
   * @param args - Parsed source filters and pagination.
   * @returns Bounded program summaries and continuation flag.
   */
  async list(args) {
    const rows = await readCollectionRecords(
      "programs",
      readItems("programs", buildQuery(args)),
      sourceSchema
    );
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * Render each program form independently and verify its actual parent identity.
   * @param id - Validated program UUID.
   * @returns Structured program detail with ordered forms and explicit completeness.
   */
  async get(id) {
    const [record] = await readCollectionRecords(
      "programs",
      readItems("programs", buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record) throw createError({ statusCode: 404, message: "NOT_FOUND: Program not found." });
    const summary = summarize(record);
    const selected = record.program_forms.slice(0, collectionRelationLimit);
    const forms = selected
      .filter((form) => form.program_id === id)
      .map((form) => {
        const rendered = renderContentDocument(form.description, [], {
          assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl
        });
        const url = navigatorUrl(form.url);
        return formSchema.parse({
          ...form,
          sort: form.sort ?? null,
          url,
          description: rendered.markdown,
          content_warnings: [
            ...rendered.warnings,
            ...(form.url && url === null ? ["Unavailable or invalid program form URL."] : [])
          ],
          truncated: rendered.truncated
        });
      });
    return {
      ...summary,
      croho_name: record.croho_name ?? null,
      croho_sector: record.croho_sector ?? null,
      crebo_profile: record.crebo_profile ?? null,
      program_forms: forms,
      content_warnings: [
        ...summary.content_warnings,
        ...(selected.some((form) => form.program_id !== id)
          ? ["Program forms with missing or mismatched parent IDs were omitted."]
          : []),
        ...forms.flatMap((form) =>
          form.content_warnings.map((warning) => `program_forms.${form.id}: ${warning}`)
        )
      ],
      truncated: forms.some((form) => form.truncated),
      relations_truncated: [
        ...summary.relations_truncated,
        ...(record.program_forms.length > collectionRelationLimit ? ["program_forms"] : [])
      ]
    };
  },
  /**
   * Retrieve the supported program filters and their current choices.
   *
   * @returns Source-filter rules, taxonomy choices and provider/location lookup instructions.
   */
  async filters() {
    try {
      return await filters.filters();
    } catch {
      throw createError({
        statusCode: 502,
        message: "UPSTREAM_UNAVAILABLE: Program filters could not be retrieved or validated."
      });
    }
  }
});
export default programs;
