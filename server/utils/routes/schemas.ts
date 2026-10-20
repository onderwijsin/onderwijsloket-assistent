import { z } from "zod";
import { nullableOutput } from "../mcp-schema";

/** Route identities are source UUIDs, never displayed answer labels or junction IDs. */
export const routeIdSchema = z.uuid();
/** Explicit single-select state; the server stores no questionnaire session. */
export const routeSelectionsSchema = z
  .record(routeIdSchema, routeIdSchema)
  .refine(
    (value) => Object.keys(value).length <= 100,
    "At most 100 question selections are accepted."
  );
/** Current selections may be omitted to start or reset the questionnaire. */
export const routeQuestionsInput = z.object({
  selections: routeSelectionsSchema
    .default({})
    .describe(
      "Question ID to answer ID map from the previous response, updated with the user's choice. Omit or pass {} to start over."
    )
});
/** Route matching requires a complete, valid questionnaire and supports bounded pagination. */
export const findRoutesInput = z.object({
  selections: routeSelectionsSchema.describe(
    "Complete question ID to answer ID map returned by get_route_questions. Never infer answers the user has not confirmed."
  ),
  page: z.number().int().min(1).max(10000).default(1).describe("One-based result page."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(25)
    .default(3)
    .describe("Results per page: default 3 for a preview, maximum 25. Keep this fixed when paging.")
});
/** Route detail is independently readable without completing the questionnaire. */
export const getRouteInput = z.object({
  id: routeIdSchema.describe("Route ID returned by find_routes or a known route reference.")
});
/** Public answer descriptions retain source text and no dependency internals. */
export const routeOptionSchema = z.object({
  id: routeIdSchema,
  title: z.string(),
  description: nullableOutput(z.string())
});
/** Questionnaire state contains only currently available answer options. */
export const routeQuestionsOutput = z.object({
  retrieved_at: z.string(),
  selections: z.record(routeIdSchema, routeIdSchema),
  removed_selections: z.array(
    z.object({
      question_id: routeIdSchema,
      answer_id: routeIdSchema,
      reason: z.enum(["unknown_question", "unknown_answer", "unavailable_answer", "out_of_order"])
    })
  ),
  complete: z.boolean(),
  next_question_id: nullableOutput(routeIdSchema),
  questions: z.array(
    z.object({
      id: routeIdSchema,
      question: z.string(),
      description: nullableOutput(z.string()),
      enabled: z.boolean(),
      selected_answer_id: nullableOutput(routeIdSchema),
      answers: z.array(routeOptionSchema)
    })
  )
});
/** Route cards use stored duration, never a locally recomputed total or ranking score. */
export const routeSummarySchema = z.object({
  id: routeIdSchema,
  title: nullableOutput(z.string()),
  source_url: nullableOutput(z.url()),
  duration_in_months: nullableOutput(z.number().nonnegative()),
  steps: z.array(
    z.object({
      id: routeIdSchema,
      short_title: nullableOutput(z.string()),
      duration_in_months: nullableOutput(z.number().nonnegative())
    })
  ),
  content_warnings: z.array(z.string()),
  relations_truncated: z.boolean()
});
/** Match results do not claim personal admission or professional eligibility. */
export const findRoutesOutput = z.object({
  retrieved_at: z.string(),
  selections: z.record(routeIdSchema, routeIdSchema),
  page: z.number().int().positive(),
  page_size: z.number().int().positive(),
  has_more: z.boolean(),
  sort: z.literal("duration_in_months,id"),
  records: z.array(routeSummarySchema)
});
const articleLinkSchema = z.object({
  id: routeIdSchema,
  title: z.string(),
  source_url: nullableOutput(z.url())
});
/** Detail exposes ordered readable steps and references to existing article/FAQ tools. */
export const routeDetailSchema = routeSummarySchema.extend({
  description: nullableOutput(z.string()),
  truncated: z.boolean(),
  steps: z.array(
    z.object({
      id: routeIdSchema,
      short_title: nullableOutput(z.string()),
      long_title: nullableOutput(z.string()),
      duration_in_months: nullableOutput(z.number().nonnegative()),
      body: nullableOutput(z.string()),
      articles: z.array(articleLinkSchema),
      faqs: z.array(z.object({ id: routeIdSchema, question: z.string() })),
      content_warnings: z.array(z.string()),
      truncated: z.boolean(),
      relations_truncated: z.boolean()
    })
  )
});
/** Detail response uses the shared retrieved-at envelope convention. */
export const getRouteOutput = z.object({ retrieved_at: z.string(), record: routeDetailSchema });
