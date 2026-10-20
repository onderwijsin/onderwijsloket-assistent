import { readItems } from "@directus/sdk";
import type { Query } from "@directus/sdk";
import type { Schema, Route } from "#directus";
import { useRuntimeConfig } from "nitropack/runtime";
import { createError } from "h3";
import { z } from "zod";
import { readCollectionRecords } from "../collections/read-records";
import { collectionRelationBounds, collectionRelationSchema } from "../collections/relations";
import { renderContentDocument } from "../content/render-content-document";
import { useSourceUrl } from "../use-source-url";
import { readRouteQuestions, routeSourceError } from "./source";
import { evaluateRouteQuestions } from "./questionnaire";
import {
  routeIdSchema,
  routeQuestionsInput,
  findRoutesInput,
  findRoutesOutput,
  getRouteInput,
  getRouteOutput,
  routeSummarySchema
} from "./schemas";

const stepSource = z.object({
  id: routeIdSchema,
  short_title: z.string().nullish(),
  duration_in_months: z.number().nonnegative().nullish()
});
const routeSource = z.object({
  id: routeIdSchema,
  title: z.string().nullish(),
  path: z.string(),
  duration_in_months: z.number().nonnegative().nullish(),
  route_steps: collectionRelationSchema("route_steps_id", stepSource)
});
const detailStepSource = stepSource.extend({
  long_title: z.string().nullish(),
  body: z.unknown(),
  articles: collectionRelationSchema(
    "articles_id",
    z.object({
      id: routeIdSchema,
      title: z.string(),
      path: z.string()
    })
  ),
  faqs: collectionRelationSchema("faqs_id", z.object({ id: routeIdSchema, question: z.string() }))
});
const detailSource = routeSource.extend({
  description: z.unknown(),
  route_steps: collectionRelationSchema("route_steps_id", detailStepSource)
});
const summaryFields = [
  "id",
  "title",
  "path",
  "duration_in_months",
  { route_steps: [{ route_steps_id: ["id", "short_title", "duration_in_months"] }] }
] satisfies Query<Schema, Route>["fields"];
const detailFields = [
  "id",
  "title",
  "path",
  "duration_in_months",
  "description",
  {
    route_steps: [
      {
        route_steps_id: [
          "id",
          "short_title",
          "long_title",
          "duration_in_months",
          "body",
          { articles: [{ articles_id: ["id", "title", "path"] }] },
          { faqs: [{ faqs_id: ["id", "question"] }] }
        ]
      }
    ]
  }
] satisfies Query<Schema, Route>["fields"];

/**
 * Explicitly preserve timeline and related-link junction ordering with sentinel bounds.
 * @returns Deep options without source visibility filters.
 */
function routeDeep(): Query<Schema, Route>["deep"] {
  const order: ("sort" | "id")[] = ["sort", "id"];
  // The SDK's deep type stops at nullable junction targets; preserve the nested runtime query.
  const deep = {
    route_steps: {
      ...collectionRelationBounds(["route_steps"]).route_steps,
      _sort: order,
      route_steps_id: {
        articles: { ...collectionRelationBounds(["articles"]).articles, _sort: order },
        faqs: { ...collectionRelationBounds(["faqs"]).faqs, _sort: order }
      }
    }
  };
  return deep;
}

/**
 * Normalize a route card without synthesizing duration or source paths.
 * @param record - Validated source summary and bounded step relation.
 * @returns A public summary with explicit missing-target and truncation warnings.
 */
function summarizeRoute(record: z.output<typeof routeSource>) {
  return routeSummarySchema.parse({
    id: record.id,
    title: record.title ?? null,
    source_url: useSourceUrl(record.path),
    duration_in_months: record.duration_in_months ?? null,
    steps: record.route_steps.records.map((step) => ({
      id: step.id,
      short_title: step.short_title ?? null,
      duration_in_months: step.duration_in_months ?? null
    })),
    content_warnings: record.route_steps.warnings,
    relations_truncated: record.route_steps.truncated
  });
}

/**
 * Start or advance the stateless questionnaire using current source definitions.
 * @param input - Submitted single-select state; defaults to an empty map.
 * @returns Canonical state, removed stale choices and the next available question.
 */
export async function getRouteQuestions(input: z.input<typeof routeQuestionsInput>) {
  const args = routeQuestionsInput.parse(input);
  return evaluateRouteQuestions(await readRouteQuestions(), args.selections);
}

/**
 * Match complete selections with the source's subset predicate before bounded pagination.
 * @param input - Complete selections and stable page parameters.
 * @returns Duration-ordered matching routes; incomplete or stale state never queries routes.
 */
export async function findRoutes(input: z.input<typeof findRoutesInput>) {
  const args = findRoutesInput.parse(input);
  const state = await getRouteQuestions({ selections: args.selections });
  if (!state.complete || state.removed_selections.length) {
    throw createError({
      statusCode: 400,
      message:
        "INVALID_ROUTE_SELECTIONS: Call get_route_questions with these selections and complete the returned questionnaire before finding routes."
    });
  }
  const selected = Object.values(state.selections);
  const records: z.output<typeof routeSource>[] = [];
  const seen = new Set<string>();
  // Fill a page plus sentinel even when the provider enforces a lower page-size cap.
  while (records.length <= args.page_size) {
    const rows = await readCollectionRecords(
      "routes",
      readItems("routes", {
        fields: summaryFields,
        filter: { requires_answers: { _none: { route_answers_id: { _nin: selected } } } },
        sort: ["duration_in_months", "id"],
        offset: (args.page - 1) * args.page_size + records.length,
        limit: args.page_size + 1 - records.length,
        deep: routeDeep()
      }),
      routeSource
    );
    if (!rows.length) break;
    for (const row of rows) {
      if (seen.has(row.id)) throw routeSourceError();
      seen.add(row.id);
      records.push(row);
    }
  }
  return findRoutesOutput.parse({
    retrieved_at: new Date().toISOString(),
    selections: state.selections,
    page: args.page,
    page_size: args.page_size,
    has_more: records.length > args.page_size,
    sort: "duration_in_months,id",
    records: records.slice(0, args.page_size).map(summarizeRoute)
  });
}

/**
 * Read an individual route and render ordered step documents independently of questionnaire state.
 * @param input - Known route UUID.
 * @returns A detailed pathway with bounded article/FAQ references and completeness metadata.
 */
export async function getRoute(input: z.input<typeof getRouteInput>) {
  const { id } = getRouteInput.parse(input);
  const [record] = await readCollectionRecords(
    "routes",
    readItems("routes", {
      fields: detailFields,
      filter: { id: { _eq: id } },
      limit: 1,
      deep: routeDeep()
    }),
    detailSource
  );
  if (!record) throw createError({ statusCode: 404, message: "NOT_FOUND: Route not found." });
  const options = { assetBaseUrl: useRuntimeConfig().public.directus.assetBaseUrl };
  const description = renderContentDocument(record.description, [], options);
  const steps = record.route_steps.records.map((step) => {
    const body = renderContentDocument(step.body, [], options);
    return {
      id: step.id,
      short_title: step.short_title ?? null,
      long_title: step.long_title ?? null,
      duration_in_months: step.duration_in_months ?? null,
      body: body.markdown,
      articles: step.articles.records.map((article) => ({
        id: article.id,
        title: article.title,
        source_url: useSourceUrl(article.path)
      })),
      faqs: step.faqs.records,
      content_warnings: [...body.warnings, ...step.articles.warnings, ...step.faqs.warnings],
      truncated: body.truncated,
      relations_truncated: step.articles.truncated || step.faqs.truncated
    };
  });
  const summary = summarizeRoute(record);
  return getRouteOutput.parse({
    retrieved_at: new Date().toISOString(),
    record: {
      ...summary,
      description: description.markdown,
      steps,
      content_warnings: [
        ...summary.content_warnings,
        ...description.warnings.map((warning) => `description: ${warning}`),
        ...steps.flatMap((step) =>
          step.content_warnings.map((warning) => `steps.${step.id}: ${warning}`)
        )
      ],
      truncated: description.truncated || steps.some((step) => step.truncated),
      relations_truncated:
        summary.relations_truncated || steps.some((step) => step.relations_truncated)
    }
  });
}
