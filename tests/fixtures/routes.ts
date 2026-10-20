/** Deterministic synthetic UUIDs for the route flow; no real user or source records. */
export function routeFixtureId(value: number) {
  return `550e8400-e29b-41d4-a716-${String(value).padStart(12, "0")}`;
}
export const questionIds = [1, 2, 3, 4].map(routeFixtureId);
export const answerIds = [11, 12, 13, 21, 22, 31, 32, 41, 42].map(routeFixtureId);
export const routeId = routeFixtureId(100);
export const routeSelections = {
  [questionIds[0]!]: answerIds[0]!,
  [questionIds[1]!]: answerIds[3]!,
  [questionIds[2]!]: answerIds[5]!,
  [questionIds[3]!]: answerIds[7]!
};
export const routeQuestions = questionIds.map((id, index) => ({
  id,
  question: `Question ${index + 1}`,
  description: null,
  sort: index
}));
export const routeAnswers = answerIds.map((id, index) => ({
  id,
  question: questionIds[index < 3 ? 0 : index < 5 ? 1 : index < 7 ? 2 : 3]!,
  title: `Answer ${index + 1}`,
  description: null,
  sort: index
}));
export const routeDependencies = [
  { id: 1, route_answers_id: answerIds[5]!, related_route_answers_id: answerIds[0]! },
  { id: 2, route_answers_id: answerIds[5]!, related_route_answers_id: answerIds[1]! },
  { id: 3, route_answers_id: answerIds[5]!, related_route_answers_id: answerIds[3]! },
  { id: 4, route_answers_id: answerIds[7]!, related_route_answers_id: answerIds[5]! }
];
const steps = [1, 2].map((number) => ({
  id: number,
  sort: number,
  route_steps_id: {
    id: routeFixtureId(200 + number),
    short_title: `Step ${number}`,
    long_title: `Complete step ${number}`,
    duration_in_months: number === 1 ? null : 12,
    body: {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: `Step ${number} body.` }] }]
    },
    articles: [
      {
        articles_id: {
          id: "00f81660-a2e4-48af-b8d7-98ce338de447",
          title: "Further reading",
          path: "/kennisbank/artikelen/alpha"
        }
      }
    ],
    faqs: [{ faqs_id: { id: "550e8400-e29b-41d4-a716-446655440010", question: "Can I teach?" } }]
  }
}));
export const routeRecord = {
  id: routeId,
  title: "Teaching pathway",
  path: `/routes/${routeId}`,
  duration_in_months: 18,
  description: null,
  route_steps: steps,
  requires_answers: [answerIds[0]!, answerIds[5]!]
};

/**
 * Implement the tested source subset predicate, stable paging and projected route source tables.
 * @param collection - Requested route or questionnaire source table.
 * @param params - Directus SDK query parameters.
 * @returns Synthetic records or undefined for an unrelated collection.
 */
export function routeFixtureRows(
  collection: string,
  params: Record<string, unknown>
): unknown[] | undefined {
  const filter =
    typeof params.filter === "string" ? JSON.parse(params.filter) : (params.filter ?? {});
  const offset = Number(params.offset ?? 0);
  // A lower upstream cap verifies that callers advance by actual rows, not requested limits.
  const limit = Math.min(2, Number(params.limit ?? 100));
  if (collection === "route_questions") return routeQuestions.slice(offset, offset + limit);
  if (collection === "route_answers") return routeAnswers.slice(offset, offset + limit);
  if (collection === "route_answers_route_answers")
    return routeDependencies.slice(offset, offset + limit);
  if (collection !== "routes") return undefined;
  if (filter.id?._eq) return filter.id._eq === routeId ? [routeRecord] : [];
  const selected = new Set(filter.requires_answers?._none?.route_answers_id?._nin ?? []);
  const routes = [
    { ...routeRecord, id: routeFixtureId(90), duration_in_months: 0, requires_answers: [] },
    ...Array.from({ length: 3005 }, (_, index) => ({
      ...routeRecord,
      id: routeFixtureId(100 + index),
      path: `/routes/${routeFixtureId(100 + index)}`,
      duration_in_months: 18 + index
    })),
    {
      ...routeRecord,
      id: routeFixtureId(9999),
      duration_in_months: 1,
      requires_answers: [answerIds[2]!]
    }
  ];
  return routes
    .filter((route) => route.requires_answers.every((answer) => selected.has(answer)))
    .sort(
      (left, right) =>
        left.duration_in_months - right.duration_in_months || left.id.localeCompare(right.id)
    )
    .slice(offset, offset + limit);
}
