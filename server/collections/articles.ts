import { collectionRelationBounds, collectionRelationSchema } from "../utils/collections/relations";
import { readCollectionRecords } from "../utils/collections/read-records";
import {
  authorSchema,
  sourceSchema as evidenceSchema,
  documentSchema,
  authorSourceSchema,
  evidenceSourceSchema,
  documentSourceSchema,
  authorFields,
  sourceFields,
  documentFields
} from "../utils/projections/supporting";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Article, Schema } from "#directus";
import { createError } from "h3";
import { z } from "zod";
import { nullableOutput } from "../utils/mcp-schema";
import type { McpListOptions } from "../utils/collections/definition";
import { defineMcpCollection } from "../utils/collections/definition";
import { createTaxonomyRelationSchema } from "../utils/taxonomy/create-taxonomy-relation-schema";
import { taxonomySchema } from "../utils/taxonomy/taxonomy";
import {
  defineCollectionFilters,
  exactTextFilter,
  booleanFilter,
  taxonomyFilters
} from "../utils/taxonomy/collection-filters";
import { useSourceUrl } from "../utils/use-source-url";
import { cacheDurations } from "../../config/cache";
import { useRuntimeConfig } from "nitropack/runtime";
import { editorNodeFields } from "../utils/content/editor-node-fields";
import { renderContentDocument } from "../utils/content/render-content-document";

const taxonomyNames = [
  "sectors",
  "qualifications",
  "audiences",
  "phases",
  "roles",
  "topics",
  "tracks"
] as const;
const articleFilters = defineCollectionFilters(
  "articles",
  {
    title: exactTextFilter("Exact article title; not a keyword or full-text search."),
    slug: exactTextFilter("Exact article slug, without a URL or path."),
    english: booleanFilter(
      "Match the language flag exactly: true for English, false for non-English. Omit for either."
    ),
    ...taxonomyFilters(taxonomyNames)
  },
  { listTool: "list_articles", collectionArgument: false }
);

const articleSchema = z.object({
  id: z.uuid().describe("Article identifier; pass to get_article for full content."),
  title: z.string().describe("Article title."),
  slug: z.string().describe("Article URL slug."),
  description: z.string().describe("Short article description."),
  summary: z.string().describe("Article summary; full content is available through get_article."),
  date_updated: nullableOutput(z.string()).describe(
    "Source update timestamp, or null when unavailable."
  ),
  english: nullableOutput(z.boolean()).describe(
    "Whether the article is English; null means unspecified."
  )
});
const metadataSchema = z.array(taxonomySchema);
const summarySchema = articleSchema.extend({
  collection: z.literal("articles"),
  source_url: nullableOutput(z.url()).describe(
    "Canonical source URL to cite when using this article."
  ),
  sectors: metadataSchema.describe(
    "Associated education sectors with normalized taxonomy metadata."
  ),
  qualifications: metadataSchema.describe(
    "Associated qualifications with normalized taxonomy metadata."
  ),
  roles: metadataSchema.describe("Associated education roles with normalized taxonomy metadata."),
  topics: metadataSchema.describe("Associated topics with normalized taxonomy metadata."),
  tracks: metadataSchema.describe("Associated career tracks with normalized taxonomy metadata.")
});
// Keep source transforms separate from output schemas: MCP publishes the latter as JSON Schema.
const sourceSchema = articleSchema.extend({
  date_updated: articleSchema.shape.date_updated.optional().transform((value) => value ?? null),
  english: articleSchema.shape.english.optional().transform((value) => value ?? null),
  path: z.string(),
  body: z.unknown().optional(),
  editor_nodes: z.unknown().optional(),
  sectors: createTaxonomyRelationSchema("sectors"),
  qualifications: createTaxonomyRelationSchema("qualifications"),
  roles: createTaxonomyRelationSchema("roles"),
  topics: createTaxonomyRelationSchema("topics"),
  tracks: createTaxonomyRelationSchema("tracks")
});

const detailSourceSchema = sourceSchema.extend({
  sources: collectionRelationSchema("sources_id", evidenceSourceSchema),
  documents: collectionRelationSchema("documents_id", documentSourceSchema),
  authors: collectionRelationSchema("authors_id", authorSourceSchema)
});
const supportingNames = ["sources", "documents", "authors"] as const;

const sorts = ["title", "-title", "date_updated", "-date_updated"] as const;

/**
 * Build a deterministic Directus query, translating taxonomy IDs through M2M junctions.
 *
 * @param args - Validated operation arguments, including filters and pagination where supported.
 * @param id - Record identifier.
 * @returns A deterministic summary or detail query with stable sorting.
 */
function buildArticleQuery(
  args: McpListOptions<typeof articleFilters.filterSchema, typeof sorts>,
  id?: string
) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...(args.filters?.title !== undefined ? { title: { _eq: args.filters.title } } : {}),
    ...(args.filters?.slug !== undefined ? { slug: { _eq: args.filters.slug } } : {}),
    ...(args.filters?.english !== undefined ? { english: { _eq: args.filters.english } } : {})
  };
  // Filter through the junction target, e.g. topics.topics_id.id.
  for (const name of taxonomyNames) {
    const ids = args.filters?.[name];
    if (ids) Object.assign(filter, { [name]: { [`${name}_id`]: { id: { _in: ids } } } });
  }
  return {
    fields: [
      "id",
      "title",
      "slug",
      "path",
      "description",
      "summary",
      "date_updated",
      "english",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { qualifications: [{ qualifications_id: ["id", "name", "path", "description"] }] },
      { roles: [{ roles_id: ["id", "name", "path", "description"] }] },
      { topics: [{ topics_id: ["id", "name", "path", "description"] }] },
      { tracks: [{ tracks_id: ["id", "name", "path", "description"] }] },
      // List responses need metadata only; fetch documents and embedded blocks for detail reads.
      ...(id
        ? [
            "body" as const,
            { editor_nodes: editorNodeFields },
            { sources: [{ sources_id: sourceFields }] },
            { documents: [{ documents_id: documentFields }] },
            { authors: [{ authors_id: authorFields }] }
          ]
        : [])
    ],
    ...(id ? { deep: collectionRelationBounds(supportingNames) } : {}),
    filter,
    // The ID breaks ties so equal titles/dates do not shuffle between pages.
    sort: [args.sort, "id"],
    // One extra row gives has_more without a second count query. Pages are one-based.
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Article>;
}

/**
 * Normalize source fields into the shared summary contract.
 *
 * @param record - Record whose metadata is being normalized.
 * @returns The validated article summary with normalized taxonomy metadata and source URL.
 */
function summarize(record: z.infer<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "articles",
    source_url: useSourceUrl(record.path)
  });
}

/** Complete articles definition consumed by the MCP tools. */
export default defineMcpCollection({
  name: "articles",
  cache: cacheDurations.collections.articles,
  id: z
    .uuid()
    .describe("Record ID returned by list_articles or search_articles; not a taxonomy ID or slug."),
  operations: { list: "list_articles", get: "get_article", search: "search_articles" },
  resources: [{ uri_template: "onderwijsloket://articles/{id}", mime_type: "text/markdown" }],
  description:
    "The articles collection contains long-form informational content about working in education. Articles explain topics such as qualifications, career paths, legislation, and practical considerations for entering the education sector. They combine detailed explanations with summaries and taxonomy metadata, helping advisers and prospective education professionals understand their options and next steps.",
  summary: summarySchema,
  detail: summarySchema.extend({
    sources: z
      .array(evidenceSchema)
      .describe("Bounded factual citations with original external publication URLs."),
    documents: z
      .array(documentSchema)
      .describe("Bounded download references; no document text is inferred."),
    authors: z
      .array(authorSchema)
      .describe("Editorial attribution, distinct from featured people."),
    relations_truncated: z
      .array(z.string())
      .describe(
        "Supporting relation names limited to the first 100 records; independent of document truncated."
      ),
    content: nullableOutput(z.string()).describe(
      "Article body as Markdown, including resolved editor blocks."
    ),
    content_warnings: z
      .array(z.string())
      .describe(
        "Missing, unsupported or incomplete content encountered during rendering. Check before treating the text as complete."
      ),
    truncated: z
      .boolean()
      .describe(
        "True when document traversal limits omitted content. The source URL may contain more information."
      )
  }),
  ...articleFilters,
  ...defineCollectionSearch({ name: "articles", indexName: "articles" }),
  sorts,

  /**
   * Keep article-specific metadata selection with the collection, not in resource utilities.
   *
   * @param record - Record whose metadata is being normalized.
   * @returns Front matter metadata, excluding content and replacing taxonomy objects with titles.
   */
  resourceMetadata({ content: _content, ...record }) {
    return {
      ...record,
      sectors: record.sectors.map((value) => value.title),
      qualifications: record.qualifications.map((value) => value.title),
      roles: record.roles.map((value) => value.title),
      topics: record.topics.map((value) => value.title),
      tracks: record.tracks.map((value) => value.title)
    };
  },

  /**
   * Retrieve a page and detect continuation using one additional record.
   *
   * @param options - Parsed filters, sort order and pagination for the article query.
   * @returns Record summaries and whether another page is available.
   */
  async list(options) {
    const records = await readCollectionRecords(
      "articles",
      readItems("articles", buildArticleQuery(options)),
      sourceSchema
    );
    return {
      records: records.slice(0, options.page_size).map(summarize),
      has_more: records.length > options.page_size
    };
  },

  /**
   * Read one article with taxonomy metadata and readable content.
   *
   * @param id - Record identifier.
   * @returns The article with normalized metadata and rendered Markdown, shared through the detail cache.
   */
  get: async (id: string) => {
    const [record] = await readCollectionRecords(
      "articles",
      readItems("articles", buildArticleQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record) throw createError({ statusCode: 404, message: "NOT_FOUND: Article not found." });
    const rendered = renderContentDocument(record.body, record.editor_nodes, {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl,
      ensureHeadingOne: true,
      metadata: record
    });
    return {
      ...summarize(record),
      content: rendered.markdown,
      sources: record.sources.records,
      documents: record.documents.records,
      authors: record.authors.records,
      relations_truncated: supportingNames.filter((name) => record[name].truncated),
      content_warnings: [
        ...rendered.warnings,
        ...supportingNames.flatMap((name) => record[name].warnings),
        ...(record.sources.records.some((source) => source.url === null)
          ? ["Unavailable or invalid source URL."]
          : []),
        ...(record.documents.records.some((document) => document.asset?.url == null)
          ? ["Unavailable document asset."]
          : [])
      ],
      truncated: rendered.truncated
    };
  },

  /**
   * Fetch dynamic filter choices, preserving the collection's upstream error contract.
   *
   * @returns Validated filter definitions with current taxonomy choices.
   */
  async filters() {
    try {
      return await articleFilters.filters();
    } catch {
      throw createError({
        statusCode: 502,
        message: "UPSTREAM_UNAVAILABLE: Article filters could not be retrieved or validated."
      });
    }
  }
});
