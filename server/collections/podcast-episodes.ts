import { mediaResourceContent } from "../utils/content/media-resource";
import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { readItems, type Query } from "@directus/sdk";
import type { Schema, PodcastEpisode } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/collections/definition";
import {
  defineCollectionFilters,
  exactTextFilter,
  integerFilter,
  relationIdFilter,
  relationIdEqualityFilter,
  taxonomyFilters
} from "../utils/taxonomy/collection-filters";
import { taxonomySchema, createTaxonomySourceSchema } from "../utils/taxonomy/taxonomy";
import { collectionRelationSchema } from "../utils/collections/relations";
import {
  assetSchema,
  profileSchema,
  profileSourceSchema,
  profileFields,
  supportingIdSchema,
  supportingRelationBounds
} from "../utils/projections/supporting";
import {
  hostSchema,
  hostSourceSchema,
  hostFields,
  showReferenceSchema,
  showReferenceSourceSchema,
  showReferenceFields,
  seasonSchema,
  seasonSourceSchema,
  seasonFields,
  platformLinksSchema,
  platformLinksSourceSchema,
  normalizePlatforms,
  normalizeMedia,
  speakerMapSchema,
  speakerMapSourceSchema
} from "../utils/projections/media";
import { nullableOutput } from "../utils/mcp-schema";
import { renderContentDocument } from "../utils/content/render-content-document";
import { useSourceUrl } from "../utils/use-source-url";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z
  .uuid()
  .describe("Record ID returned by list_podcast_episodes or search_podcast_episodes.");
const taxonomyNames = ["sectors", "audiences", "phases", "roles", "topics", "tracks"] as const;
const relationNames = [
  "sectors",
  "audiences",
  "phases",
  "roles",
  "topics",
  "tracks",
  "hosts",
  "guests"
] as const;
const targetKeys = {
  sectors: "sectors_id",
  audiences: "audiences_id",
  phases: "phases_id",
  roles: "roles_id",
  topics: "topics_id",
  tracks: "tracks_id",
  hosts: "podcast_hosts_id",
  guests: "profiles_id"
} as const;
const filters = defineCollectionFilters(
  "podcast_episodes",
  {
    title: exactTextFilter("Exact title; use search_podcast_episodes for text search."),
    slug: exactTextFilter("Exact page slug."),
    ...taxonomyFilters(taxonomyNames),
    show: relationIdEqualityFilter("podcast_shows", "list_podcast_shows", z.uuid(), "id"),
    season: relationIdEqualityFilter("podcast_shows", "get_podcast_show", z.uuid(), "seasons[].id"),
    episode_number: integerFilter("Exact episode number, including zero when present upstream."),
    hosts: relationIdFilter(
      "podcast_episodes",
      "list_podcast_episodes",
      supportingIdSchema,
      "hosts[].id"
    ),
    guests: relationIdFilter(
      "podcast_episodes",
      "list_podcast_episodes",
      supportingIdSchema,
      "guests[].id"
    )
  },
  { listTool: "list_podcast_episodes", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("podcast_episodes"),
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
  episode_number: z.number().int().nonnegative(),
  show: nullableOutput(showReferenceSchema),
  season: nullableOutput(seasonSchema),
  sectors: z.array(taxonomySchema),
  audiences: z.array(taxonomySchema),
  phases: z.array(taxonomySchema),
  roles: z.array(taxonomySchema),
  topics: z.array(taxonomySchema),
  tracks: z.array(taxonomySchema),
  hosts: z.array(hostSchema),
  guests: z.array(profileSchema),
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
  episode_number: z.number().int().nonnegative(),
  show: showReferenceSourceSchema.nullable(),
  season: seasonSourceSchema.nullable(),
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  audiences: collectionRelationSchema("audiences_id", createTaxonomySourceSchema("audiences")),
  phases: collectionRelationSchema("phases_id", createTaxonomySourceSchema("phases")),
  roles: collectionRelationSchema("roles_id", createTaxonomySourceSchema("roles")),
  topics: collectionRelationSchema("topics_id", createTaxonomySourceSchema("topics")),
  tracks: collectionRelationSchema("tracks_id", createTaxonomySourceSchema("tracks")),
  hosts: collectionRelationSchema("podcast_hosts_id", hostSourceSchema),
  guests: collectionRelationSchema("profiles_id", profileSourceSchema)
});
const detailSourceSchema = sourceSchema.extend({
  body: z.unknown(),
  audio: z.unknown(),
  transcript_string: z.string().nullish(),
  transcript_string_with_speakers: z.string().nullish(),
  speaker_map: speakerMapSourceSchema,
  external_urls: platformLinksSourceSchema
});
const sorts = [
  "publication_date",
  "-publication_date",
  "episode_number",
  "-episode_number"
] as const;
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
    ...(args.filters?.slug !== undefined ? { slug: { _eq: args.filters.slug } } : {}),
    ...(args.filters?.episode_number !== undefined
      ? { episode_number: { _eq: args.filters.episode_number } }
      : {}),
    ...(args.filters?.show ? { show: { id: { _eq: args.filters.show } } } : {}),
    ...(args.filters?.season ? { season: { id: { _eq: args.filters.season } } } : {})
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
      "episode_number",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { audiences: [{ audiences_id: ["id", "title"] }] },
      { phases: [{ phases_id: ["id", "title", "description"] }] },
      { roles: [{ roles_id: ["id", "name", "path", "description"] }] },
      { topics: [{ topics_id: ["id", "name", "path", "description"] }] },
      { tracks: [{ tracks_id: ["id", "name", "path", "description"] }] },
      { hosts: [{ podcast_hosts_id: hostFields }] },
      { guests: [{ profiles_id: profileFields }] },
      { show: showReferenceFields },
      { season: seasonFields },
      ...(id
        ? ([
            "body",
            "audio",
            "transcript_string",
            "transcript_string_with_speakers",
            "speaker_map",
            "external_urls"
          ] as const)
        : [])
    ],
    filter,
    deep: { ...supportingRelationBounds(relationNames) },
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, PodcastEpisode>;
}
/**
 * Flatten attribution and taxonomy relationships while preserving source completeness.
 * @param record - Validated source summary.
 * @returns Public summary with independent document/relation reporting.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  const season =
    record.season && record.show && record.season.show_id === record.show.id ? record.season : null;
  return summarySchema.parse({
    ...record,
    collection: "podcast_episodes",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    publication_date: record.publication_date ?? null,
    season,
    ...Object.fromEntries(relationNames.map((name) => [name, record[name].records])),
    content_warnings: [
      ...relationNames.flatMap((name) => record[name].warnings),
      ...(!record.show ? ["Episode show is unavailable."] : []),
      ...(!record.season
        ? ["Episode season is unavailable."]
        : season
          ? []
          : [
              "Episode season could not be associated with its show; missing or mismatched show identity."
            ])
    ],
    relations_truncated: relationNames.filter((name) => record[name].truncated)
  });
}
/** Native collection definition; supporting people and seasons remain embedded. */
const collection = defineMcpCollection({
  name: "podcast_episodes",
  cache: cacheDurations.collections.podcast_episodes,
  id: idSchema,
  description:
    "The podcast_episodes collection contains individual conversations in podcast series about working in education. It helps listeners and advisers discover episodes by show, season, participants and education taxonomies, then read the accompanying body and any available transcript. Each episode retains separate show and season identity, episode number, source duration, publication metadata, presenters, featured guest profiles, audio reference and platform links. Speaker mappings and transcripts preserve source attribution without inventing speakers or missing text. Hosts and guests remain distinct roles; mismatched season ownership is reported explicitly. Record discovery and media metadata do not guarantee playback availability; cite the canonical source for context and current access.",
  operations: {
    list: "list_podcast_episodes",
    get: "get_podcast_episode",
    search: "search_podcast_episodes"
  },
  resources: [
    { uri_template: "onderwijsloket://podcast_episodes/{id}", mime_type: "text/markdown" }
  ],
  summary: summarySchema,
  detail: summarySchema.extend({
    content: nullableOutput(z.string()),
    audio: nullableOutput(assetSchema),
    transcript_string: nullableOutput(z.string()),
    transcript_string_with_speakers: nullableOutput(z.string()),
    speaker_map: speakerMapSchema,
    truncated: z.boolean(),
    external_urls: platformLinksSchema
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "podcast_episodes",
    indexName: "podcast_episodes",
    filterSchema: z.strictObject({
      "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "audiences.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "phases.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "roles.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "topics.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "tracks.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "show.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional()
    }),
    attributes: [
      "id",
      "title",
      "slug",
      "path",
      "duration",
      "publication_date",
      "episode_number",
      "show"
    ],
    recordSchema: z.object({
      collection: z.literal("podcast_episodes"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      source_url: nullableOutput(z.url()),
      snippet: nullableOutput(snippetSchema),
      duration: z.number().nonnegative(),
      publication_date: nullableOutput(z.string()),
      episode_number: z.number().int().nonnegative(),
      show: nullableOutput(showReferenceSchema)
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
        collection: "podcast_episodes",
        id: hit.id ?? hit.objectID,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        publication_date: hit.publication_date ?? null,
        show: hit.show == null ? null : showReferenceSourceSchema.parse(hit.show),
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
    const rows = await readCollectionRecords(
      "podcast_episodes",
      readItems("podcast_episodes", buildQuery(args)),
      sourceSchema
    );
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
    const [record] = await readCollectionRecords(
      "podcast_episodes",
      readItems("podcast_episodes", buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record)
      throw createError({
        statusCode: 404,
        message: "NOT_FOUND: podcast_episodes record not found."
      });
    const media = normalizeMedia(record.audio, "audio");
    const platforms = normalizePlatforms(record.external_urls);
    const rendered = renderContentDocument(record.body, [], {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: { title: record.title }
    });
    const summary = summarize(record);
    return {
      ...summary,
      content: rendered.markdown,
      audio: media.value,
      transcript_string: record.transcript_string ?? null,
      transcript_string_with_speakers: record.transcript_string_with_speakers ?? null,
      speaker_map: record.speaker_map ?? null,
      external_urls: platforms.value,
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
        ...platforms.warnings,
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
