import { resourceContent } from "../utils/resources";
import { escapeMarkdownText } from "../utils/content/markdown-formatting";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema, Sector } from "#directus";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection } from "../utils/define-mcp-collection";
import type { McpListOptions } from "../utils/define-mcp-collection";
import { defineCollectionFilters, exactTextFilter } from "../utils/taxonomy/collection-filters";
import { nullableOutput } from "../utils/mcp-schema";
import { useSourceUrl } from "../utils/use-source-url";
import { collectionRelationSchema, collectionRelationLimit } from "../utils/collection-relations";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z
  .guid()
  .describe("Sector identifier; the same GUID is used by sector taxonomy filters.");
const filters = defineCollectionFilters(
  "sectors",
  {
    title: exactTextFilter("Exact sector title; use search_sectors for text search."),
    slug: exactTextFilter("Exact sector page slug."),
    code: exactTextFilter("Exact sector code.")
  },
  { listTool: "list_sectors", collectionArgument: false }
);
const scalarSchema = z.object({
  id: idSchema,
  title: z.string(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  code: z.string(),
  description: z.string(),
  alt_names: z.array(z.string()).nullish(),
  icon: z.string().nullish(),
  date_updated: z.string().nullish()
});
const summarySchema = z.object({
  collection: z.literal("sectors"),
  id: idSchema,
  title: z.string(),
  slug: z.string(),
  code: z.string(),
  description: z.string(),
  alt_names: nullableOutput(z.array(z.string())),
  icon: nullableOutput(z.string()),
  date_updated: nullableOutput(z.string()),
  source_url: nullableOutput(z.url())
});
const textSections = {
  introduction: z.string().nullish(),
  roles_content: z.string().nullish(),
  routes_content: z.string().nullish(),
  salary_content: z.string().nullish(),
  costs_content: z.string().nullish()
};
const sectionNames = [
  "introduction",
  "roles_content",
  "routes_content",
  "salary_content",
  "costs_content"
] as const;
const contentReference = z.object({
  id: z.uuid(),
  title: z.string(),
  path: z.string()
});
const faqReference = z.object({
  id: z.uuid(),
  question: z.string()
});
const actionSchema = z.object({
  label: z.string(),
  link: z.string(),
  internal: z.boolean().nullish()
});
const cardSchema = z.object({
  title: z.string(),
  description: z.string(),
  link: z.string().nullish(),
  link_label: z.string().nullish(),
  link_internal: z.boolean().nullish(),
  icon: z.string().nullish()
});
const detailSourceSchema = scalarSchema.extend({
  ...textSections,
  costs_actions: z.array(actionSchema).nullish(),
  salary_cards: z.array(cardSchema).nullish(),
  featured_articles: collectionRelationSchema("articles_id", contentReference),
  featured_faqs: collectionRelationSchema("faqs_id", faqReference),
  featured_media: z.array(
    z.object({
      id: z.number(),
      sort: z.number().nullish(),
      collection: z.enum(["videos", "podcast_episodes", "testimonials"]),
      item: contentReference.nullable()
    })
  )
});
const sorts = ["title", "-title", "sort", "-sort"] as const;

/**
 * Build sector queries, bounding reference arrays and avoiding reverse collections.
 * @param args - Parsed exact filters, sort and pagination.
 * @param id - Optional identifier selecting detail content.
 * @returns A typed source query; null sort values follow the source database ordering.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  return {
    fields: [
      "id",
      "title",
      "slug",
      "code",
      "description",
      "alt_names",
      "icon",
      "date_updated",
      ...(id
        ? [
            ...sectionNames,
            "costs_actions" as const,
            "salary_cards" as const,
            {
              featured_articles: ["id" as const, { articles_id: ["id", "title", "path"] as const }]
            },
            { featured_faqs: ["id" as const, { faqs_id: ["id", "question"] as const }] },
            {
              featured_media: [
                "id" as const,
                "collection" as const,
                "sort" as const,
                {
                  item: {
                    videos: ["id", "title", "path"] as const,
                    podcast_episodes: ["id", "title", "path"] as const,
                    testimonials: ["id", "title", "path"] as const
                  }
                }
              ]
            }
          ]
        : [])
    ],
    filter: {
      ...(id ? { id: { _eq: id } } : {}),
      ...(args.filters?.title ? { title: { _eq: args.filters.title } } : {}),
      ...(args.filters?.slug ? { slug: { _eq: args.filters.slug } } : {}),
      ...(args.filters?.code ? { code: { _eq: args.filters.code } } : {})
    },
    ...(id
      ? {
          deep: {
            featured_articles: {
              _limit: collectionRelationLimit + 1,
              _sort: ["id"]
            },
            featured_faqs: {
              _limit: collectionRelationLimit + 1,
              _sort: ["id"]
            },
            featured_media: { _limit: collectionRelationLimit + 1, _sort: ["sort", "id"] }
          }
        }
      : {}),
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Sector>;
}

/**
 * Read source records while keeping permission and validation errors private.
 * @param query - Exact field projection and relation bounds.
 * @param schema - Summary or detail source validator.
 * @returns Validated source rows, or a sanitized provider error.
 */
async function readSectors<T extends z.ZodType>(query: ReturnType<typeof buildQuery>, schema: T) {
  try {
    return z.array(schema).parse(await useDirectusServer(readItems("sectors", query)));
  } catch {
    throw createError({
      statusCode: 502,
      message: "UPSTREAM_UNAVAILABLE: Sector data could not be retrieved or validated."
    });
  }
}

/**
 * Normalize sector metadata and its verified root-level canonical page route.
 * @param record - Validated sector.
 * @returns Public summary retaining its shared taxonomy identity.
 */
function summarize(record: z.output<typeof scalarSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "sectors",
    source_url: useSourceUrl(`/${record.slug}`),
    alt_names: record.alt_names ?? null,
    icon: record.icon ?? null,
    date_updated: record.date_updated ?? null
  });
}

/**
 * Normalize a source link without inventing a canonical page for external destinations.
 * @param value - Source URL or local path.
 * @returns A validated HTTP(S) URL, or null for unsupported protocols.
 */
function linkUrl(value: string | null | undefined) {
  if (!value) return null;
  const local = useSourceUrl(value);
  const parsed = z.url().safeParse(local ?? value);
  return parsed.success && /^https?:\/\//.test(parsed.data) ? parsed.data : null;
}
const searchAdapter = defineCollectionSearch({
  name: "sectors",
  indexName: "sectors",
  filterSchema: z.strictObject({}),
  recordSchema: z.object({
    collection: z.literal("sectors"),
    id: idSchema,
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    source_url: nullableOutput(z.url()),
    snippet: nullableOutput(snippetSchema)
  }),
  attributes: ["id", "title", "slug", "description"],
  /**
   * Normalize an indexed record into its collection-specific hit projection.
   * @param hit - Untrusted indexed attributes.
   * @param context - Matched snippet and collection context.
   * @returns A candidate hit validated by the adapter's public record schema.
   */
  mapHit(hit, context) {
    const record = scalarSchema
      .pick({ id: true, title: true, slug: true, description: true })
      .parse(hit);
    return {
      ...record,
      collection: "sectors",
      source_url: useSourceUrl(`/${record.slug}`),
      snippet: context.snippet
    };
  }
});

/** Sector reference pages coexist with the same sector IDs in taxonomy filters. */
export default defineMcpCollection({
  name: "sectors",
  id: idSchema,
  description:
    "The sectors collection describes the sectors of the Dutch education system, from primary through higher education, and helps people explore what working in each sector involves. Unlike other shared taxonomies, sectors also contain their own guidance: introductions, professional roles, routes into education, salary information and training costs, supported by actions and featured articles, FAQs and media references. These records underpin the website’s “Working in …” pages. Use sector details for an overview of a working environment and its entry routes; the same sector IDs also categorize and filter content across collections.",
  operations: { list: "list_sectors", get: "get_sector", search: "search_sectors" },
  resources: [{ uri_template: "onderwijsloket://sectors/{id}", mime_type: "text/markdown" }],
  /**
   * Keep actions, references and completeness metadata alongside rendered guidance sections.
   * @param record - Validated sector detail, destructured to omit section bodies.
   * @returns Source metadata, actions, featured references and completeness fields.
   */
  resourceMetadata({
    introduction: _introduction,
    roles_content: _roles,
    routes_content: _routes,
    salary_content: _salary,
    costs_content: _costs,
    ...record
  }) {
    return record;
  },
  summary: summarySchema,
  detail: summarySchema.extend({
    ...(Object.fromEntries(
      sectionNames.map((name) => [
        name,
        nullableOutput(z.string()).describe("Plain source text; not a Tiptap document.")
      ])
    ) as Record<(typeof sectionNames)[number], ReturnType<typeof nullableOutput<z.ZodString>>>),
    costs_actions: nullableOutput(
      z.array(
        z.object({
          label: z.string(),
          link: nullableOutput(z.url()),
          internal: nullableOutput(z.boolean())
        })
      )
    ),
    salary_cards: nullableOutput(
      z.array(
        z.object({
          title: z.string(),
          description: z.string(),
          link: nullableOutput(z.url()),
          link_label: nullableOutput(z.string()),
          link_internal: nullableOutput(z.boolean()),
          icon: nullableOutput(z.string())
        })
      )
    ),
    featured_articles: z.array(
      z.object({ id: z.uuid(), title: z.string(), source_url: nullableOutput(z.url()) })
    ),
    featured_faqs: z.array(
      z.object({ id: z.uuid(), question: z.string(), source_url: nullableOutput(z.url()) })
    ),
    featured_media: z.array(
      z.object({
        collection: z.enum(["videos", "podcast_episodes", "testimonials"]),
        id: z.uuid(),
        title: z.string(),
        source_url: nullableOutput(z.url())
      })
    ),
    content_warnings: z.array(z.string()),
    relations_truncated: z.array(z.string())
  }),
  ...filters,
  sorts,
  searchOptions: searchAdapter.searchOptions.omit({ filters: true }),
  searchResult: searchAdapter.searchResult,
  search: searchAdapter.search,
  /**
   * @param args - Parsed sector filters and pagination.
   * @returns A page of sector summaries.
   */
  async list(args) {
    const rows = await readSectors(buildQuery(args), scalarSchema);
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * @param id - Validated sector/taxonomy identifier.
   * @returns Named text sections and ordered bounded featured references.
   */
  async get(id) {
    const [record] = await readSectors(
      buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id),
      detailSourceSchema
    );
    if (!record) throw createError({ statusCode: 404, message: "NOT_FOUND: Sector not found." });
    const media = record.featured_media.slice(0, collectionRelationLimit);
    return {
      ...summarize(record),
      introduction: record.introduction ?? null,
      roles_content: record.roles_content ?? null,
      routes_content: record.routes_content ?? null,
      salary_content: record.salary_content ?? null,
      costs_content: record.costs_content ?? null,
      costs_actions:
        record.costs_actions?.map((action) => ({
          ...action,
          link: linkUrl(action.link),
          internal: action.internal ?? null
        })) ?? null,
      salary_cards:
        record.salary_cards?.map((card) => ({
          ...card,
          link: linkUrl(card.link),
          link_label: card.link_label ?? null,
          link_internal: card.link_internal ?? null,
          icon: card.icon ?? null
        })) ?? null,
      featured_articles: record.featured_articles.records.map((article) => ({
        id: article.id,
        title: article.title,
        source_url: useSourceUrl(article.path)
      })),
      featured_faqs: record.featured_faqs.records.map((faq) => ({
        id: faq.id,
        question: faq.question,
        source_url: null
      })),
      featured_media: media.flatMap((row) =>
        row.item
          ? [
              {
                collection: row.collection,
                id: row.item.id,
                title: row.item.title,
                source_url: useSourceUrl(row.item.path)
              }
            ]
          : []
      ),
      content_warnings: [
        ...record.featured_articles.warnings,
        ...record.featured_faqs.warnings,
        ...(media.some((row) => row.item === null) ? ["Unavailable featured media omitted."] : [])
      ],
      relations_truncated: [
        ...(record.featured_articles.truncated ? ["featured_articles"] : []),
        ...(record.featured_faqs.truncated ? ["featured_faqs"] : []),
        ...(record.featured_media.length > collectionRelationLimit ? ["featured_media"] : [])
      ]
    };
  },
  /** @returns Exact-value filter rules for sector lists. */
  filters: filters.filters
});

/**
 * Render sector plain-text guidance as named Markdown sections; references remain in front matter.
 * @param record - Validated sector detail with separately named content sections.
 * @returns Markdown guidance without synthesizing missing sections.
 */
export function sectorResourceContent(
  record: { title: string; description: string } & Record<
    (typeof sectionNames)[number],
    string | null
  >
) {
  const headings = {
    introduction: "Introduction",
    roles_content: "Roles",
    routes_content: "Routes",
    salary_content: "Salary",
    costs_content: "Costs"
  };
  const body = [
    escapeMarkdownText(record.description),
    ...sectionNames.flatMap((name) =>
      record[name]?.trim() ? [`## ${headings[name]}`, escapeMarkdownText(record[name])] : []
    )
  ]
    .filter((part) => part.trim())
    .join("\n\n");
  return [`# ${escapeMarkdownText(record.title)}`, resourceContent(body)].join("\n\n");
}
