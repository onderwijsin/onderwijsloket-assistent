import { cacheDurations } from "../../config/cache";
import { readCollectionRecords } from "../utils/collections/read-records";
import { describeResource } from "../utils/resources/descriptors";
import { useRuntimeConfig } from "nitropack/runtime";
import { contentNodeSchema } from "../utils/content/types";
import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Faq, Schema } from "#directus";
import { createError } from "h3";
import { z } from "zod";
import { defineMcpCollection } from "../utils/collections/definition";
import type { McpListOptions } from "../utils/collections/definition";
import { nullableOutput } from "../utils/mcp-schema";
import {
  defineCollectionFilters,
  exactTextFilter,
  booleanFilter,
  taxonomyFilters,
  relationIdFilter
} from "../utils/taxonomy/collection-filters";
import { createTaxonomySourceSchema, taxonomySchema } from "../utils/taxonomy/taxonomy";
import { renderContentDocument } from "../utils/content/render-content-document";
import { useSourceUrl } from "../utils/use-source-url";
import { collectionRelationSchema, collectionRelationLimit } from "../utils/collections/relations";
import { defineCollectionSearch } from "../utils/search/collection-search";
import { snippetSchema } from "../utils/search/schemas";

const idSchema = z.uuid().describe("FAQ identifier returned by list_faqs or search_faqs.");
const taxonomyNames = ["sectors", "audiences", "phases", "topics"] as const;
const filters = defineCollectionFilters(
  "faqs",
  {
    question: exactTextFilter("Exact question; use search_faqs for text search."),
    english: booleanFilter("Match the language flag exactly; omit for either language."),
    ...taxonomyFilters(taxonomyNames),
    articles: relationIdFilter("articles", "list_articles", z.uuid())
  },
  { listTool: "list_faqs", collectionArgument: false }
);
const summarySchema = z.object({
  collection: z.literal("faqs"),
  id: idSchema,
  question: z.string(),
  source_url: nullableOutput(z.url()),
  date_updated: nullableOutput(z.string()),
  english: nullableOutput(z.boolean()),
  sectors: z.array(taxonomySchema),
  audiences: z.array(taxonomySchema),
  phases: z.array(taxonomySchema),
  topics: z.array(taxonomySchema),
  content_warnings: z.array(z.string()),
  relations_truncated: z.array(z.string())
});
const articleSource = z.object({
  id: z.uuid(),
  title: z.string(),
  path: z.string()
});
const articleReference = z.object({
  id: z.uuid(),
  title: z.string(),
  source_url: nullableOutput(z.url())
});
/**
 * Select the taxonomy projection and preserve missing-target warnings.
 * @param name - Shared taxonomy collection.
 * @returns A bounded source relation normalized to the existing taxonomy contract.
 */
function taxonomyRelation(name: (typeof taxonomyNames)[number]) {
  return collectionRelationSchema(`${name}_id`, createTaxonomySourceSchema(name));
}
const sourceSchema = z.object({
  id: idSchema,
  question: z.string(),

  date_updated: z.string().nullish(),
  english: z.boolean().nullish(),
  sectors: taxonomyRelation("sectors"),
  audiences: taxonomyRelation("audiences"),
  phases: taxonomyRelation("phases"),
  topics: taxonomyRelation("topics")
});
const detailSourceSchema = sourceSchema.extend({
  answer: contentNodeSchema.nullish(),
  articles: collectionRelationSchema("articles_id", articleSource)
});
const sorts = ["question", "-question", "date_updated", "-date_updated"] as const;

/**
 * Select FAQs and bounded relation targets with stable pagination.
 * @param args - Parsed exact filters, sort and one-based pagination.
 * @param id - Optional identifier selecting a detail record.
 * @returns A typed Directus query; answer and article links are fetched only for details.
 */
function buildQuery(args: McpListOptions<typeof filters.filterSchema, typeof sorts>, id?: string) {
  const filter = {
    ...(id ? { id: { _eq: id } } : {}),
    ...(args.filters?.question !== undefined ? { question: { _eq: args.filters.question } } : {}),
    ...(args.filters?.english !== undefined ? { english: { _eq: args.filters.english } } : {}),
    ...(args.filters?.articles
      ? { articles: { articles_id: { id: { _in: args.filters.articles } } } }
      : {})
  };
  for (const name of taxonomyNames)
    if (args.filters?.[name])
      Object.assign(filter, { [name]: { [`${name}_id`]: { id: { _in: args.filters[name] } } } });
  return {
    fields: [
      "id",
      "question",
      "date_updated",
      "english",
      { sectors: [{ sectors_id: ["id", "title", "slug", "description"] }] },
      { audiences: [{ audiences_id: ["id", "title"] }] },
      { phases: [{ phases_id: ["id", "title", "description"] }] },
      { topics: [{ topics_id: ["id", "name", "path", "description"] }] },
      ...(id
        ? ["answer" as const, { articles: [{ articles_id: ["id", "title", "path"] as const }] }]
        : [])
    ],
    deep: {
      ...Object.fromEntries(
        taxonomyNames.map((name) => [
          name,
          {
            _limit: collectionRelationLimit + 1,
            _sort: ["id"]
          }
        ])
      ),
      ...(id
        ? {
            articles: {
              _limit: collectionRelationLimit + 1,
              _sort: ["id"]
            }
          }
        : {})
    },
    filter,
    sort: [args.sort, "id"],
    limit: id ? 1 : args.page_size + 1,
    offset: id ? 0 : (args.page - 1) * args.page_size
  } satisfies Query<Schema, Faq>;
}

/**
 * Flatten bounded taxonomy projections into the public FAQ summary.
 * @param record - Validated FAQ source.
 * @returns Summary metadata with explicit relation completeness warnings.
 */
function summarize(record: z.output<typeof sourceSchema>) {
  return summarySchema.parse({
    ...record,
    collection: "faqs",
    source_url: null,
    date_updated: record.date_updated ?? null,
    english: record.english ?? null,
    ...Object.fromEntries(taxonomyNames.map((name) => [name, record[name].records])),
    content_warnings: taxonomyNames.flatMap((name) => record[name].warnings),
    relations_truncated: taxonomyNames.filter((name) => record[name].truncated)
  });
}
const search = defineCollectionSearch({
  name: "faqs",
  indexName: "faqs",
  filterSchema: z.strictObject({
    "audiences.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
    "phases.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
    "sectors.title": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
    "topics.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional(),
    english: z
      .array(z.union([z.boolean(), z.enum(["true", "false"])]))
      .min(1)
      .max(50)
      .optional()
  }),
  recordSchema: z.object({
    collection: z.literal("faqs"),
    id: idSchema,
    question: z.string(),
    source_url: nullableOutput(z.url()),
    snippet: nullableOutput(snippetSchema)
  }),
  attributes: ["id", "question"],
  /**
   * Normalize an indexed record into its collection-specific hit projection.
   * @param hit - Untrusted indexed attributes.
   * @param context - Matched snippet and collection context.
   * @returns A candidate hit validated by the adapter's public record schema.
   */
  mapHit(hit, context) {
    return {
      collection: "faqs",
      id: hit.id ?? hit.objectID,
      question: hit.question,
      source_url: null,
      snippet: context.snippet
    };
  }
});

/** Question/answer guidance; native question/answer record and resource mappings. */
export default defineMcpCollection({
  name: "faqs",
  cache: cacheDurations.collections.faqs,
  id: idSchema,
  description:
    "The faqs collection contains short, factual questions and answers about working in education. FAQs help prospective education professionals and advisers find concise explanations of common questions during orientation and career planning. Each record preserves its native question and answer, with education-sector, audience, career-phase and topic context. Related article references connect a quick answer to more detailed guidance. Use FAQs for focused questions and articles for broader explanations; FAQ records do not have their own verified canonical page.",
  operations: { list: "list_faqs", get: "get_faq", search: "search_faqs" },
  resources: [{ uri_template: "onderwijsloket://faqs/{id}", mime_type: "text/markdown" }],
  /**
   * Preserve native question metadata and completeness warnings outside the answer body.
   * @param record - Validated FAQ detail, destructured to omit the rendered answer.
   * @returns Source metadata, related references and completeness fields.
   */
  resourceMetadata({ answer: _answer, ...record }) {
    return record;
  },
  summary: summarySchema,
  detail: summarySchema.extend({
    answer: nullableOutput(z.string()).describe("Answer as Markdown."),
    articles: z.array(articleReference),
    truncated: z.boolean()
  }),
  ...filters,
  ...search,
  sorts,
  /**
   * Read and normalize a page of FAQ summaries.
   *
   * @param args - Parsed FAQ filters and pagination.
   * @returns A page of normalized FAQ summaries.
   */
  async list(args) {
    const rows = await readCollectionRecords(
      "faqs",
      readItems("faqs", buildQuery(args)),
      sourceSchema
    );
    return {
      records: rows.slice(0, args.page_size).map(summarize),
      has_more: rows.length > args.page_size
    };
  },
  /**
   * Read one FAQ detail record with its bounded relations.
   *
   * @param id - Validated FAQ identifier.
   * @returns Readable answer and bounded related article references.
   */
  async get(id) {
    const [record] = await readCollectionRecords(
      "faqs",
      readItems("faqs", buildQuery({ page: 1, page_size: 1, sort: sorts[0] }, id)),
      detailSourceSchema
    );
    if (!record) throw createError({ statusCode: 404, message: "NOT_FOUND: FAQ not found." });
    const summary = summarize(record);
    const rendered = renderContentDocument(record.answer, [], {
      assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl
    });
    return {
      ...summary,
      answer: rendered.markdown,
      truncated: rendered.truncated,
      articles: record.articles.records.map((article) => ({
        id: article.id,
        title: article.title,
        source_url: useSourceUrl(article.path)
      })),
      content_warnings: [
        ...summary.content_warnings,
        ...record.articles.warnings,
        ...rendered.warnings
      ],
      relations_truncated: [
        ...summary.relations_truncated,
        ...(record.articles.truncated ? ["articles"] : [])
      ]
    };
  },
  /**
   * Retrieve the supported FAQ filters and their current choices.
   *
   * @returns Filter rules and current taxonomy choices, or a sanitized upstream failure.
   */
  async filters() {
    try {
      return await filters.filters();
    } catch {
      throw createError({
        statusCode: 502,
        message: "UPSTREAM_UNAVAILABLE: FAQ filters could not be retrieved or validated."
      });
    }
  }
});

/**
 * Describe FAQ resources using their native question, without inventing article metadata.
 * @param record - Summary, detail or search projection with FAQ identity.
 * @returns A Markdown descriptor without a fabricated page URL or description.
 */
export function describeFaqResource(record: {
  id: string;
  question: string;
  date_updated?: string | null;
}) {
  return describeResource("faqs", {
    id: record.id,
    title: record.question,
    date_updated: record.date_updated
  });
}
