import { readItems, type Query } from "@directus/sdk";
import type { Schema, Video } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/define-mcp-collection";
import {
  defineCollectionFilters,
  exactTextFilter,
  relationIdFilter,
  taxonomyFilters
} from "../utils/taxonomy/collection-filters";
import { taxonomySchema, createTaxonomySourceSchema } from "../utils/taxonomy/taxonomy";
import { collectionRelationSchema } from "../utils/collection-relations";
import {
  assetSchema,
  profileSchema,
  profileSourceSchema,
  profileFields,
  supportingIdSchema,
  supportingRelationBounds
} from "../utils/supporting-content";
import {
  normalizeMedia,
  speakerMapSchema,
  speakerMapSourceSchema,
  chaptersSchema,
  mediaResourceContent
} from "../utils/media-content";
import { nullableOutput } from "../utils/mcp-schema";
import { renderContentDocument } from "../utils/content/render-content-document";
import { useSourceUrl } from "../utils/use-source-url";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z.uuid().describe("Record ID returned by list_videos or search_videos.");
const taxonomyNames = ["sectors", "audiences", "phases", "roles", "topics", "tracks"] as const;
const relationNames = [
  "sectors",
  "audiences",
  "phases",
  "roles",
  "topics",
  "tracks",
  "profiles"
] as const;
const targetKeys = {
  sectors: "sectors_id",
  audiences: "audiences_id",
  phases: "phases_id",
  roles: "roles_id",
  topics: "topics_id",
  tracks: "tracks_id",
  profiles: "profiles_id"
} as const;
const filters = defineCollectionFilters(
  "videos",
  {
    title: exactTextFilter("Exact title; use search_videos for text search."),
    slug: exactTextFilter("Exact page slug."),
    ...taxonomyFilters(taxonomyNames),
    profiles: relationIdFilter("videos", "list_videos", supportingIdSchema, "profiles[].id")
  },
  { listTool: "list_videos", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("videos"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  source_url: nullableOutput(z.url()),
  date_updated: nullableOutput(z.string()),
  publication_date: nullableOutput(z.string()),
  duration: z
    .number()
    .nonnegative()
    .describe("Native source duration value; unit is not verified. Do not assume seconds."),
  sectors: z.array(taxonomySchema),
  audiences: z.array(taxonomySchema),
  phases: z.array(taxonomySchema),
  roles: z.array(taxonomySchema),
  topics: z.array(taxonomySchema),
  tracks: z.array(taxonomySchema),
  profiles: z.array(profileSchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  date_updated: z.string().nullish(),
  publication_date: z.string().nullish(),
  duration: z.number().nonnegative(),
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  audiences: collectionRelationSchema("audiences_id", createTaxonomySourceSchema("audiences")),
  phases: collectionRelationSchema("phases_id", createTaxonomySourceSchema("phases")),
  roles: collectionRelationSchema("roles_id", createTaxonomySourceSchema("roles")),
  topics: collectionRelationSchema("topics_id", createTaxonomySourceSchema("topics")),
  tracks: collectionRelationSchema("tracks_id", createTaxonomySourceSchema("tracks")),
  profiles: collectionRelationSchema("profiles_id", profileSourceSchema)
});
const detailSourceSchema = sourceSchema.extend({
  body: z.unknown(),
  video: z.unknown(),
  transcript_string: z.string().nullish(),
  transcript_string_with_speakers: z.string().nullish(),
  speaker_map: speakerMapSourceSchema,
  chapters: chaptersSchema.optional()
});
const sorts = ["title", "-title", "publication_date", "-publication_date"] as const;
/**
 * Select bounded native media relations; detail alone requests documents and transcripts.
 * @param args - Parsed collection filters, sort and pagination.
 * @param id - Optional detail identifier.
 * @returns Typed query without local publication or playback gates.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...(args.filters?.title !== undefined ? { title: { _eq: args.filters.title } } : {}),
    ...(args.filters?.slug !== undefined ? { slug: { _eq: args.filters.slug } } : {})
  };
  for (const name of relationNames)
    if (args.filters?.[name])
      Object.assign(filter, {
        [name]: { [targetKeys[name]]: { id: { _in: args.filters[name] } } }
      });
  return {
    fields: [
      "id",
      "title",
      "slug",
      "path",
      "date_updated",
      "publication_date",
      "duration",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { audiences: [{ audiences_id: ["id", "title"] }] },
      { phases: [{ phases_id: ["id", "title", "description"] }] },
      { roles: [{ roles_id: ["id", "name", "path", "description"] }] },
      { topics: [{ topics_id: ["id", "name", "path", "description"] }] },
      { tracks: [{ tracks_id: ["id", "name", "path", "description"] }] },
      { profiles: [{ profiles_id: profileFields }] },
      ...(id
        ? ([
            "body",
            "video",
            "transcript_string",
            "transcript_string_with_speakers",
            "speaker_map",
            "chapters"
          ] as const)
        : [])
    ],
    filter,
    deep: { ...supportingRelationBounds(relationNames) },
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Video>;
}
/**
 * Validate selected source records and sanitize provider failures.
 * @param query - Native list or detail projection.
 * @param schema - Matching boundary validator.
 * @returns Typed records without exposing raw source errors.
 */
async function readRecords<T extends z.ZodType>(query: ReturnType<typeof buildQuery>, schema: T) {
  try {
    return z.array(schema).parse(await useDirectusServer(readItems("videos", query)));
  } catch {
    throw createError({
      statusCode: 502,
      message: "UPSTREAM_UNAVAILABLE: videos data could not be retrieved or validated."
    });
  }
}
/**
 * Flatten attribution and taxonomy relationships while preserving source completeness.
 * @param record - Validated source summary.
 * @returns Public summary with independent document/relation reporting.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "videos",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    publication_date: record.publication_date ?? null,
    ...Object.fromEntries(relationNames.map((name) => [name, record[name].records])),
    content_warnings: relationNames.flatMap((name) => record[name].warnings),
    relations_truncated: relationNames.filter((name) => record[name].truncated)
  });
}
/** Native collection definition; supporting people and seasons remain embedded. */
const collection = defineMcpCollection({
  name: "videos",
  id: idSchema,
  description:
    "The videos collection describes video interviews, explainers and experience stories about working in Dutch education. It helps prospective entrants and advisers discover relevant media through education sectors, roles, topics and featured participant profiles. Details include a readable body, source video reference, publication metadata, native duration, available transcripts, speaker mappings and chapter offsets. Featured profiles identify the people appearing in a video and are distinct from podcast hosts or editorial authors. Personal experience complements factual guidance; a missing transcript is never inferred from the body or a search snippet. Use source_url for attribution and current viewing context; discoverability does not establish playback availability.",
  operations: { list: "list_videos", get: "get_video", search: "search_videos" },
  resources: [{ uri_template: "onderwijsloket://videos/{id}", mime_type: "text/markdown" }],
  summary: summarySchema,
  detail: summarySchema.extend({
    content: nullableOutput(z.string()),
    video: nullableOutput(assetSchema),
    transcript_string: nullableOutput(z.string()),
    transcript_string_with_speakers: nullableOutput(z.string()),
    speaker_map: speakerMapSchema,
    truncated: z.boolean(),
    chapters: chaptersSchema
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "videos",
    indexName: "videos",
    filterSchema: z.strictObject({
      "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "audiences.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "phases.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "roles.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "topics.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "tracks.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional()
    }),
    attributes: ["id", "title", "slug", "path", "duration", "publication_date"],
    recordSchema: z.object({
      collection: z.literal("videos"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      source_url: nullableOutput(z.url()),
      snippet: nullableOutput(snippetSchema),
      duration: z.number().nonnegative(),
      publication_date: nullableOutput(z.string())
    }),
    /**
     * Map verified partial index metadata; never expose transcripts as search result bodies.
     * @param hit - Untrusted index projection.
     * @param context - Collection identity and matched snippet.
     * @returns Candidate hit validated by the collection-specific search schema.
     */
    mapHit(hit, context) {
      return {
        ...hit,
        collection: "videos",
        id: hit.id ?? hit.objectID,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        publication_date: hit.publication_date ?? null,
        snippet: context.snippet
      };
    }
  }),
  /**
   * @param record - Validated detail.
   * @returns Public front matter without duplicated body/transcripts.
   */
  resourceMetadata({
    content: _content,
    transcript_string: _transcript,
    transcript_string_with_speakers: _speakers,
    ...record
  }) {
    return record;
  },
  /**
   * @param args - Parsed list arguments.
   * @returns Bounded summaries and continuation flag.
   */
  async list(args) {
    const rows = await readRecords(buildQuery(args), sourceSchema);
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * @param id - Validated record identity.
   * @returns Nullable readable content and native media detail.
   */
  async get(id) {
    const [record] = await readRecords(
      buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id),
      detailSourceSchema
    );
    if (!record)
      throw createError({ statusCode: 404, message: "NOT_FOUND: videos record not found." });
    const media = normalizeMedia(record.video, "video");
    const rendered = renderContentDocument(record.body, [], {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: { title: record.title }
    });
    const summary = summarize(record);
    return {
      ...summary,
      content: rendered.markdown,
      video: media.value,
      transcript_string: record.transcript_string ?? null,
      transcript_string_with_speakers: record.transcript_string_with_speakers ?? null,
      speaker_map: record.speaker_map ?? null,
      chapters: record.chapters ?? null,
      truncated: rendered.truncated,
      content_warnings: [
        ...summary.content_warnings,
        ...rendered.warnings,
        ...media.warnings,
        ...(record.speaker_map?.some((row) => row.speaker === null)
          ? [
              "Some speaker mappings lack a speaker identifier; names are retained without inferred attribution."
            ]
          : []),
        ...(!record.transcript_string?.trim() && !record.transcript_string_with_speakers?.trim()
          ? ["No transcript is available."]
          : [])
      ]
    };
  },
  filters: filters.filters
});
export default collection;
/**
 * @param record - Validated detail.
 * @returns Separate body and transcript sections with shared missing-content notices.
 */
export function resourceBody(record: z.output<typeof collection.getOutput>["record"]) {
  return mediaResourceContent(record);
}
