import { vi } from "vitest";
import { z } from "zod";
import { defineMcpCollection } from "../../server/utils/define-mcp-collection";
import {
  defineCollectionFilters,
  exactTextFilter,
  booleanFilter
} from "../../server/utils/taxonomy/collection-filters";
import { defineCollectionSearch } from "../../server/utils/search/collection-search";
import { nullableOutput } from "../../server/utils/mcp-schema";
import { snippetSchema } from "../../server/utils/search/schemas";

/** Synthetic FAQ fixture, deliberately unlike articles; never imported by the production registry. */
export function createFaqCollection() {
  const id = z
    .string()
    .regex(/^faq-\d+$/)
    .describe("Synthetic FAQ identifier, not a UUID.");
  const summary = z.object({ collection: z.literal("faqs"), id, question: z.string() });
  const record = {
    collection: "faqs" as const,
    id: "faq-1",
    question: "Can I teach?",
    answer: "A synthetic answer."
  };
  const list = vi.fn(async () => ({ records: [record], has_more: false }));
  const get = vi.fn(async () => record);
  const filters = defineCollectionFilters(
    "faqs",
    {
      question: exactTextFilter("Exact question."),
      english: booleanFilter("Language flag.")
    },
    { listTool: "list_faqs", collectionArgument: false }
  );
  const search = defineCollectionSearch({
    name: "faqs",
    indexName: "fixture_faqs",
    filterSchema: z.strictObject({
      "topics.name": z.array(z.string().min(1).max(300)).min(1).max(50).optional()
    }),
    recordSchema: summary.extend({ snippet: nullableOutput(snippetSchema) }),
    attributes: ["id", "question"],
    mapHit: (hit, context) => ({
      collection: context.collection,
      id: hit.id ?? hit.objectID,
      question: hit.question,
      snippet: context.snippet
    })
  });
  const collection = defineMcpCollection({
    name: "faqs",
    description: "Synthetic question and answer collection for contract tests.",
    id,
    operations: { list: "list_faqs", get: "get_faq", search: "search_faqs" },
    summary,
    detail: summary.extend({ answer: z.string().min(1) }),
    sorts: ["question", "-question"],
    ...filters,
    ...search,
    list,
    get
  });
  return { collection, list, get, record };
}
