import { readItems } from "@directus/sdk";
import { createError } from "h3";
import { z } from "zod";
import { readCollectionRecords } from "../collections/read-records";
import { routeIdSchema } from "./schemas";
import { routeQuestionSchema } from "./questionnaire";

const questionSource = z.object({
  id: routeIdSchema,
  question: z.string(),
  description: z.string().nullish(),
  sort: z.number().nullish()
});
const answerSource = z.object({
  id: routeIdSchema,
  question: routeIdSchema,
  title: z.string(),
  description: z.string().nullish(),
  sort: z.number().nullish()
});
const prerequisiteSource = z.object({
  id: z.number().int(),
  route_answers_id: routeIdSchema,
  related_route_answers_id: routeIdSchema
});

/**
 * Report incomplete or inconsistent questionnaire data without exposing provider details.
 * @returns A safe upstream error; this is structural validation, not a publication gate.
 */
export function routeSourceError() {
  return createError({
    statusCode: 502,
    message: "UPSTREAM_UNAVAILABLE: Route data could not be retrieved or validated."
  });
}

/**
 * Read complete source pages, tolerating upstream page caps and rejecting non-advancing results.
 * @param read - Explicitly projected page query with stable ordering.
 * @param maximum - Maximum supported rows; overflow fails rather than matching partial data.
 * @returns All visible rows up to an empty page, never a silently truncated catalogue.
 */
export async function readRoutePages<T extends { id: string | number }>(
  read: (offset: number, limit: number) => Promise<T[]>,
  maximum = 10000
): Promise<T[]> {
  const rows: T[] = [];
  const seen = new Set<string | number>();
  for (;;) {
    const page = await read(rows.length, Math.min(100, maximum + 1 - rows.length));
    if (!page.length) return rows;
    for (const row of page) {
      if (seen.has(row.id) || rows.length >= maximum) throw routeSourceError();
      seen.add(row.id);
      rows.push(row);
    }
  }
}

/**
 * Load the entire ordered questionnaire and prerequisite graph through bounded root queries.
 * @returns Questions with normalized answer prerequisites, validated against earlier questions.
 */
export async function readRouteQuestions() {
  const questions = await readRoutePages(
    (offset, limit) =>
      readCollectionRecords(
        "route_questions",
        readItems("route_questions", {
          fields: ["id", "question", "description", "sort"],
          sort: ["sort", "id"],
          offset,
          limit
        }),
        questionSource
      ),
    100
  );
  if (!questions.length) throw routeSourceError();
  const answers = await readRoutePages(
    (offset, limit) =>
      readCollectionRecords(
        "route_answers",
        readItems("route_answers", {
          fields: ["id", "question", "title", "description", "sort"],
          filter: { question: { _in: questions.map((question) => question.id) } },
          sort: ["sort", "id"],
          offset,
          limit
        }),
        answerSource
      ),
    1000
  );
  const dependencies = answers.length
    ? await readRoutePages((offset, limit) =>
        readCollectionRecords(
          "route_answers_route_answers",
          readItems("route_answers_route_answers", {
            fields: ["id", "route_answers_id", "related_route_answers_id"],
            filter: { route_answers_id: { _in: answers.map((answer) => answer.id) } },
            sort: ["id"],
            offset,
            limit
          }),
          prerequisiteSource
        )
      )
    : [];
  const byAnswer = new Map(answers.map((answer) => [answer.id, answer]));
  const questionIndex = new Map(questions.map((question, index) => [question.id, index]));
  for (const answer of answers) {
    if (!questionIndex.has(answer.question)) throw routeSourceError();
  }
  for (const dependency of dependencies) {
    const dependent = byAnswer.get(dependency.route_answers_id);
    const prerequisite = byAnswer.get(dependency.related_route_answers_id);
    if (
      !dependent ||
      !prerequisite ||
      questionIndex.get(prerequisite.question)! >= questionIndex.get(dependent.question)!
    ) {
      throw routeSourceError();
    }
  }
  return questions.map((question) =>
    routeQuestionSchema.parse({
      id: question.id,
      question: question.question,
      description: question.description ?? null,
      answers: answers
        .filter((answer) => answer.question === question.id)
        .map((answer) => ({
          id: answer.id,
          title: answer.title,
          description: answer.description ?? null,
          prerequisites: dependencies
            .filter((dependency) => dependency.route_answers_id === answer.id)
            .map((dependency) => ({
              id: dependency.related_route_answers_id,
              question_id: byAnswer.get(dependency.related_route_answers_id)!.question
            }))
        }))
    })
  );
}
