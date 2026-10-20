import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema, Testimonial } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/collections/definition";
import { nullableOutput } from "../utils/mcp-schema";
import {
  defineCollectionFilters,
  exactTextFilter,
  taxonomyFilters,
  relationIdFilter
} from "../utils/taxonomy/collection-filters";
import { createTaxonomySourceSchema, taxonomySchema } from "../utils/taxonomy/taxonomy";
import { collectionRelationSchema } from "../utils/collections/relations";
import {
  authorSchema,
  profileSchema,
  authorSourceSchema,
  profileSourceSchema,
  authorFields,
  profileFields,
  supportingRelationBounds,
  supportingIdSchema
} from "../utils/projections/supporting";
import { renderContentDocument } from "../utils/content/render-content-document";
import { editorNodeFields } from "../utils/content/editor-node-fields";
import { useSourceUrl } from "../utils/use-source-url";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z
  .uuid()
  .describe("Testimonial ID returned by list_testimonials or search_testimonials.");
const taxonomyNames = ["sectors", "audiences", "phases", "roles", "topics", "tracks"] as const;
const relationNames = [...taxonomyNames, "authors", "profiles"] as const;
const filters = defineCollectionFilters(
  "testimonials",
  {
    title: exactTextFilter("Exact testimonial title; use search_testimonials for text search."),
    slug: exactTextFilter("Exact testimonial slug."),
    ...taxonomyFilters(taxonomyNames),
    authors: relationIdFilter(
      "testimonials",
      "list_testimonials",
      supportingIdSchema,
      "authors[].id"
    ),
    profiles: relationIdFilter(
      "testimonials",
      "list_testimonials",
      supportingIdSchema,
      "profiles[].id"
    )
  },
  { listTool: "list_testimonials", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("testimonials"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  summary: z.string(),
  source_url: nullableOutput(z.url()),
  date_updated: nullableOutput(z.string()),
  publication_date: nullableOutput(z.string()),
  sectors: z.array(taxonomySchema),
  audiences: z.array(taxonomySchema),
  phases: z.array(taxonomySchema),
  roles: z.array(taxonomySchema),
  topics: z.array(taxonomySchema),
  tracks: z.array(taxonomySchema),
  authors: z.array(authorSchema),
  profiles: z.array(profileSchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  description: z.string(),
  summary: z.string(),
  date_updated: z.string().nullish(),
  publication_date: z.string().nullish(),
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  audiences: collectionRelationSchema("audiences_id", createTaxonomySourceSchema("audiences")),
  phases: collectionRelationSchema("phases_id", createTaxonomySourceSchema("phases")),
  roles: collectionRelationSchema("roles_id", createTaxonomySourceSchema("roles")),
  topics: collectionRelationSchema("topics_id", createTaxonomySourceSchema("topics")),
  tracks: collectionRelationSchema("tracks_id", createTaxonomySourceSchema("tracks")),
  authors: collectionRelationSchema("authors_id", authorSourceSchema),
  profiles: collectionRelationSchema("profiles_id", profileSourceSchema)
});
const detailSourceSchema = sourceSchema.extend({ body: z.unknown(), editor_nodes: z.unknown() });
const sorts = ["title", "-title", "publication_date", "-publication_date"] as const;

/**
 * Build bounded native testimonial projections with domain filters and stable ID ordering.
 * @param args - Validated list filters, sort and pagination.
 * @param id - Optional record ID selecting body/editor nodes for detail reads.
 * @returns A typed query without publication or visibility policy.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...(args.filters?.title ? { title: { _eq: args.filters.title } } : {}),
    ...(args.filters?.slug ? { slug: { _eq: args.filters.slug } } : {})
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
      "description",
      "summary",
      "date_updated",
      "publication_date",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { audiences: [{ audiences_id: ["id", "title"] }] },
      { phases: [{ phases_id: ["id", "title", "description"] }] },
      { roles: [{ roles_id: ["id", "name", "path", "description"] }] },
      { topics: [{ topics_id: ["id", "name", "path", "description"] }] },
      { tracks: [{ tracks_id: ["id", "name", "path", "description"] }] },
      { authors: [{ authors_id: authorFields }] },
      { profiles: [{ profiles_id: profileFields }] },
      ...(id ? ["body" as const, { editor_nodes: editorNodeFields }] : [])
    ],
    deep: supportingRelationBounds(relationNames),
    filter,
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Testimonial>;
}
/**
 * Flatten taxonomy, editorial authors and featured participants into separate public arrays.
 * @param record - Validated testimonial source.
 * @returns Summary with explicit relation completeness and source timestamps.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "testimonials",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    publication_date: record.publication_date ?? null,
    ...Object.fromEntries(relationNames.map((name) => [name, record[name].records])),
    content_warnings: relationNames.flatMap((name) => record[name].warnings),
    relations_truncated: relationNames.filter((name) => record[name].truncated)
  });
}
const searchFilters = z.strictObject({
  "audiences.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "authors.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "phases.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "roles.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "topics.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
  "tracks.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional()
});
/** Personal experiences complement factual guidance; they do not establish general eligibility. */
export default defineMcpCollection({
  name: "testimonials",
  cache: cacheDurations.collections.testimonials,
  id: idSchema,
  operations: { list: "list_testimonials", get: "get_testimonial", search: "search_testimonials" },
  resources: [{ uri_template: "onderwijsloket://testimonials/{id}", mime_type: "text/markdown" }],
  description:
    "The testimonials collection contains personal stories from people working in or transitioning into education. These accounts help prospective education professionals explore different experiences of entering the profession and working in educational roles, complementing the factual explanations in articles and FAQs. Stories combine readable narrative content and embedded editorial blocks with role, sector, audience, career-phase, topic and pathway context. Editorial authors identify the contributors responsible for a story, while featured profiles identify the people whose experiences it presents. Use testimonials for individual perspectives and examples; they do not establish general eligibility rules or replace factual guidance.",
  summary: summarySchema,
  detail: summarySchema.extend({ content: nullableOutput(z.string()), truncated: z.boolean() }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "testimonials",
    indexName: "testimonials",
    filterSchema: searchFilters,
    attributes: ["id", "title", "slug", "path", "description", "publication_date"],
    recordSchema: z.object({
      collection: z.literal("testimonials"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      description: z.string(),
      publication_date: nullableOutput(z.string()),
      source_url: nullableOutput(z.url()),
      snippet: nullableOutput(snippetSchema)
    }),
    /**
     * Map only verified index fields and identity; status/date never gate a returned story.
     * @param hit - Untrusted indexed projection.
     * @param context - Validated collection context and matched snippet.
     * @returns Candidate lightweight record for public-schema validation.
     */
    mapHit(hit, context) {
      return {
        collection: "testimonials",
        id: hit.id ?? hit.objectID,
        title: hit.title,
        slug: hit.slug,
        description: hit.description,
        publication_date: hit.publication_date ?? null,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        snippet: context.snippet
      };
    }
  }),
  /**
   * Select attribution and completeness metadata without duplicating the story body.
   * @param record - Validated testimonial detail.
   * @returns YAML front matter retaining source publication metadata without enforcing it.
   */
  resourceMetadata({ content: _content, ...record }) {
    return record;
  },
  /**
   * Retrieve a bounded page of story summaries with authors and featured profiles.
   * @param args - Validated domain filters and pagination.
   * @returns Summaries and continuation flag.
   */
  async list(args) {
    const rows = await readCollectionRecords(
      "testimonials",
      readItems("testimonials", buildQuery(args)),
      sourceSchema
    );
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * Render a complete personal story with its existing editor-node pipeline.
   * @param id - Validated testimonial UUID.
   * @returns Story Markdown, attribution and independent content/relation completeness metadata.
   */
  async get(id) {
    const [record] = await readCollectionRecords(
      "testimonials",
      readItems("testimonials", buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record)
      throw createError({ statusCode: 404, message: "NOT_FOUND: Testimonial not found." });
    const summary = summarize(record);
    const rendered = renderContentDocument(record.body, record.editor_nodes, {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: record
    });
    return {
      ...summary,
      content: rendered.markdown,
      content_warnings: [...summary.content_warnings, ...rendered.warnings],
      truncated: rendered.truncated
    };
  },
  /** @returns Filter rules and taxonomy choices with sanitized source failures. */
  async filters() {
    try {
      return await filters.filters();
    } catch {
      throw createError({
        statusCode: 502,
        message: "UPSTREAM_UNAVAILABLE: Testimonial filters could not be retrieved or validated."
      });
    }
  }
});
