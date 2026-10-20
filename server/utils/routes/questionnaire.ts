import { z } from "zod";
import { routeIdSchema, routeOptionSchema, routeQuestionsOutput } from "./schemas";
import { nullableOutput } from "../mcp-schema";

/** Validated internal questionnaire, including the distinct answer prerequisite relation. */
export const routeQuestionSchema = z.object({
  id: routeIdSchema,
  question: z.string(),
  description: nullableOutput(z.string()),
  answers: z.array(
    routeOptionSchema.extend({
      prerequisites: z.array(z.object({ id: routeIdSchema, question_id: routeIdSchema }))
    })
  )
});
export type RouteQuestion = z.infer<typeof routeQuestionSchema>;
type Selections = Record<string, string>;

/**
 * Evaluate OR within each prerequisite question and AND across prerequisite questions.
 * @param prerequisites - Required alternative answers grouped by their owning questions.
 * @param selections - Validated question-to-answer state.
 * @returns Whether every prerequisite question has an accepted answer selected.
 */
export function isRouteAnswerAvailable(
  prerequisites: RouteQuestion["answers"][number]["prerequisites"],
  selections: Selections
): boolean {
  const groups = new Map<string, Set<string>>();
  for (const prerequisite of prerequisites) {
    const options = groups.get(prerequisite.question_id) ?? new Set<string>();
    options.add(prerequisite.id);
    groups.set(prerequisite.question_id, options);
  }
  return [...groups].every(([question, options]) => options.has(selections[question] ?? ""));
}

/**
 * Revalidate stateless selections after edits and source changes, clearing invalid downstream state.
 * @param questions - Complete ordered questionnaire whose dependencies refer to earlier questions.
 * @param submitted - Client-supplied selections, including any stale choices.
 * @returns Canonical selections, removals, available choices and the next question.
 */
export function evaluateRouteQuestions(questions: RouteQuestion[], submitted: Selections) {
  const selections = { ...submitted };
  const removed: z.infer<typeof routeQuestionsOutput>["removed_selections"] = [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const [questionId, answerId] of Object.entries(selections)) {
    const question = byId.get(questionId);
    if (!question || !question.answers.some((answer) => answer.id === answerId)) {
      removed.push({
        question_id: questionId,
        answer_id: answerId,
        reason: question ? "unknown_answer" : "unknown_question"
      });
      delete selections[questionId];
    }
  }
  // Ordered backward-only prerequisites make one forward pass a fixed-point cleanup.
  let blocked = false;
  for (const question of questions) {
    const answerId = selections[question.id];
    const answer = question.answers.find((option) => option.id === answerId);
    if (answer && (blocked || !isRouteAnswerAvailable(answer.prerequisites, selections))) {
      removed.push({
        question_id: question.id,
        answer_id: answer.id,
        reason: blocked ? "out_of_order" : "unavailable_answer"
      });
      delete selections[question.id];
    }
    if (!selections[question.id]) blocked = true;
  }
  const nextIndex = questions.findIndex((question) => !selections[question.id]);
  return routeQuestionsOutput.parse({
    retrieved_at: new Date().toISOString(),
    selections,
    removed_selections: removed,
    complete: questions.length > 0 && nextIndex === -1,
    next_question_id: nextIndex === -1 ? null : questions[nextIndex]!.id,
    questions: questions.map((question, index) => ({
      id: question.id,
      question: question.question,
      description: question.description,
      enabled: nextIndex === -1 || index <= nextIndex,
      selected_answer_id: selections[question.id] ?? null,
      answers: question.answers
        .filter((answer) => isRouteAnswerAvailable(answer.prerequisites, selections))
        .map(({ prerequisites: _prerequisites, ...answer }) => answer)
    }))
  });
}
