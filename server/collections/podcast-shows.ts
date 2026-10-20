import {
  collectionRelationBounds,
  collectionRelationSchema,
  collectionRelationLimit
} from "../utils/collections/relations";
import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { readItems, type Query } from "@directus/sdk";
import type { Schema, PodcastShow } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection, type McpListOptions } from "../utils/collections/definition";
import {
  defineCollectionFilters,
  exactTextFilter,
  enumFilter,
  relationIdFilter,
  taxonomyFilters
} from "../utils/taxonomy/collection-filters";
import { taxonomySchema, createTaxonomySourceSchema } from "../utils/taxonomy/taxonomy";
import {
  assetSchema,
  imageAssetSourceSchema,
  supportingIdSchema
} from "../utils/projections/supporting";
import {
  podcastStatusSchema,
  hostSchema,
  hostSourceSchema,
  hostFields,
  seasonSchema,
  seasonSourceSchema,
  seasonFields,
  normalizeSeasons,
  platformLinksSchema,
  platformLinksSourceSchema,
  normalizePlatforms,
  normalizeMedia
} from "../utils/projections/media";
import { nullableOutput } from "../utils/mcp-schema";
import { renderContentDocument } from "../utils/content/render-content-document";
import { useSourceUrl } from "../utils/use-source-url";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z
  .uuid()
  .describe("Record ID returned by list_podcast_shows or search_podcast_shows.");
const taxonomyNames = ["sectors", "audiences", "phases"] as const;
const relationNames = ["sectors", "audiences", "phases", "hosts"] as const;
const targetKeys = {
  sectors: "sectors_id",
  audiences: "audiences_id",
  phases: "phases_id",
  hosts: "podcast_hosts_id"
} as const;
const filters = defineCollectionFilters(
  "podcast_shows",
  {
    title: exactTextFilter("Exact title; use search_podcast_shows for text search."),
    slug: exactTextFilter("Exact page slug."),
    ...taxonomyFilters(taxonomyNames),
    creator_name: exactTextFilter("Exact series creator name."),
    podcast_status: enumFilter(
      podcastStatusSchema.options,
      "Series release state; independent of publication visibility."
    ),
    hosts: relationIdFilter("podcast_shows", "list_podcast_shows", supportingIdSchema, "hosts[].id")
  },
  { listTool: "list_podcast_shows", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("podcast_shows"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  source_url: nullableOutput(z.url()),
  date_updated: nullableOutput(z.string()),
  creator_name: z.string(),
  tagline: z.string(),
  podcast_status: podcastStatusSchema,
  artwork: nullableOutput(assetSchema),
  sectors: z.array(taxonomySchema),
  audiences: z.array(taxonomySchema),
  phases: z.array(taxonomySchema),
  hosts: z.array(hostSchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const sourceSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  path: z.string(),
  date_updated: z.string().nullish(),
  creator_name: z.string(),
  tagline: z.string(),
  podcast_status: podcastStatusSchema,
  artwork: imageAssetSourceSchema,
  sectors: collectionRelationSchema("sectors_id", createTaxonomySourceSchema("sectors")),
  audiences: collectionRelationSchema("audiences_id", createTaxonomySourceSchema("audiences")),
  phases: collectionRelationSchema("phases_id", createTaxonomySourceSchema("phases")),
  hosts: collectionRelationSchema("podcast_hosts_id", hostSourceSchema)
});
const detailSourceSchema = sourceSchema.extend({
  description: z.unknown(),
  header_image: imageAssetSourceSchema,
  trailer: z.unknown(),
  external_urls: platformLinksSourceSchema,
  seasons: z.array(seasonSourceSchema)
});
const sorts = ["title", "-title", "date_updated", "-date_updated"] as const;
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
    ...(args.filters?.creator_name !== undefined
      ? { creator_name: { _eq: args.filters.creator_name } }
      : {}),
    ...(args.filters?.podcast_status !== undefined
      ? { podcast_status: { _eq: args.filters.podcast_status } }
      : {})
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
      "creator_name",
      "tagline",
      "podcast_status",
      "artwork",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { audiences: [{ audiences_id: ["id", "title"] }] },
      { phases: [{ phases_id: ["id", "title", "description"] }] },
      { hosts: [{ podcast_hosts_id: hostFields }] },
      ...(id
        ? ([
            "description",
            "header_image",
            "trailer",
            "external_urls",
            { seasons: seasonFields }
          ] as const)
        : [])
    ],
    filter,
    deep: {
      ...collectionRelationBounds(relationNames),
      ...(id
        ? { seasons: { _limit: collectionRelationLimit + 1, _sort: ["season_number", "id"] } }
        : {})
    },
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, PodcastShow>;
}
/**
 * Flatten attribution and taxonomy relationships while preserving source completeness.
 * @param record - Validated source summary.
 * @returns Public summary with independent document/relation reporting.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "podcast_shows",
    source_url: useSourceUrl(record.path),
    date_updated: record.date_updated ?? null,
    ...Object.fromEntries(relationNames.map((name) => [name, record[name].records])),
    content_warnings: relationNames.flatMap((name) => record[name].warnings),
    relations_truncated: relationNames.filter((name) => record[name].truncated)
  });
}
/** Native collection definition; supporting people and seasons remain embedded. */
const collection = defineMcpCollection({
  name: "podcast_shows",
  cache: cacheDurations.collections.podcast_shows,
  id: idSchema,
  description:
    "The podcast_shows collection describes podcast series about working in Dutch education, including their purpose, creator, tagline, hosts and release state. It helps prospective education professionals and advisers discover conversations and personal experiences relevant to their interests. Series details include a readable description, artwork, platform links, optional trailer and bounded seasons with explicit show ownership. Hosts are editorial presenters, distinct from featured guest profiles. Retrieve episodes through list_podcast_episodes filtered by show ID rather than assuming a series embeds its entire episode catalogue. Personal accounts complement factual guidance and do not establish general eligibility rules.",
  operations: {
    list: "list_podcast_shows",
    get: "get_podcast_show",
    search: "search_podcast_shows"
  },
  resources: [{ uri_template: "onderwijsloket://podcast_shows/{id}", mime_type: "text/markdown" }],
  summary: summarySchema,
  detail: summarySchema.extend({
    description: nullableOutput(z.string()),
    header_image: nullableOutput(assetSchema),
    trailer: nullableOutput(assetSchema),
    external_urls: platformLinksSchema,
    seasons: z.array(seasonSchema),
    truncated: z.boolean()
  }),
  ...filters,
  sorts,
  ...defineCollectionSearch({
    name: "podcast_shows",
    indexName: "podcast_shows",
    filterSchema: z.strictObject({
      "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "audiences.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
      "phases.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional()
    }),
    attributes: [
      "id",
      "title",
      "slug",
      "path",
      "creator_name",
      "tagline",
      "podcast_status",
      "artwork"
    ],
    recordSchema: z.object({
      collection: z.literal("podcast_shows"),
      id: idSchema,
      title: z.string(),
      slug: z.string(),
      source_url: nullableOutput(z.url()),
      snippet: nullableOutput(snippetSchema),
      creator_name: z.string(),
      tagline: z.string(),
      podcast_status: podcastStatusSchema,
      artwork: nullableOutput(assetSchema)
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
        collection: "podcast_shows",
        id: hit.id ?? hit.objectID,
        source_url: typeof hit.path === "string" ? useSourceUrl(hit.path) : null,
        artwork: imageAssetSourceSchema.parse(hit.artwork),
        snippet: context.snippet
      };
    }
  }),
  /**
   * @param record - Validated detail.
   * @returns Public front matter without duplicated body/transcripts.
   */
  resourceMetadata({ description: _description, ...record }) {
    return record;
  },
  /**
   * @param args - Parsed list arguments.
   * @returns Bounded summaries and continuation flag.
   */
  async list(args) {
    const rows = await readCollectionRecords(
      "podcast_shows",
      readItems("podcast_shows", buildQuery(args)),
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
      "podcast_shows",
      readItems("podcast_shows", buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record)
      throw createError({ statusCode: 404, message: "NOT_FOUND: podcast_shows record not found." });
    const seasons = normalizeSeasons(record.seasons, record.id);
    const media = normalizeMedia(record.trailer, "trailer");
    const platforms = normalizePlatforms(record.external_urls);
    const rendered = renderContentDocument(record.description, [], {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: { title: record.title }
    });
    const summary = summarize(record);
    return {
      ...summary,
      description: rendered.markdown,
      header_image: record.header_image,
      trailer: media.value,
      external_urls: platforms.value,
      seasons: seasons.records,
      truncated: rendered.truncated,
      relations_truncated: [
        ...summary.relations_truncated,
        ...(seasons.truncated ? ["seasons"] : [])
      ],
      content_warnings: [
        ...summary.content_warnings,
        ...rendered.warnings,
        ...media.warnings,
        ...platforms.warnings,
        ...seasons.warnings
      ]
    };
  },
  filters: filters.filters
});
export default collection;
