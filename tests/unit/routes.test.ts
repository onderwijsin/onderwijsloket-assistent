import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import { getRouteQuestions, findRoutes, getRoute } from "../../server/utils/routes/service";
import { readRoutePages } from "../../server/utils/routes/source";
import {
  isRouteAnswerAvailable,
  evaluateRouteQuestions
} from "../../server/utils/routes/questionnaire";
import { routeQuestionsInput, findRoutesInput } from "../../server/utils/routes/schemas";
import {
  routeFixtureRows,
  routeFixtureId,
  routeRecord,
  routeSelections,
  questionIds,
  answerIds
} from "../fixtures/routes";

vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: vi.fn() }));
vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: () => ({
    public: { directus: { assetBaseUrl: "https://assets.example.test" } }
  })
}));
const requests: { path: string; params: Record<string, unknown> }[] = [];
const fetchedRouteIds: string[] = [];
const overrides = new Map<string, unknown[]>();
beforeEach(() => {
  requests.length = 0;
  fetchedRouteIds.length = 0;
  overrides.clear();
  vi.mocked(useDirectusServer).mockReset();
  vi.mocked(useDirectusServer).mockImplementation(async (command) => {
    const request = command();
    requests.push({ path: request.path, params: request.params ?? {} });
    const collection = request.path.split("/").pop()!;
    const override = overrides.get(collection);
    const offset = Number(request.params?.offset ?? 0);
    const limit = Number(request.params?.limit ?? 100);
    const rows = override
      ? override.slice(offset, offset + limit)
      : routeFixtureRows(collection, request.params ?? {});
    if (collection === "routes" && rows) {
      fetchedRouteIds.push(...rows.map((row) => (row as { id: string }).id));
    }
    return rows as never;
  });
});

describe("route questionnaire", () => {
  it("uses OR within a prerequisite question and AND across questions", () => {
    const prerequisites = [
      { id: "a", question_id: "q1" },
      { id: "b", question_id: "q1" },
      { id: "c", question_id: "q2" }
    ];
    expect(isRouteAnswerAvailable([], {})).toBe(true);
    expect(isRouteAnswerAvailable(prerequisites, { q1: "a", q2: "c" })).toBe(true);
    expect(isRouteAnswerAvailable(prerequisites, { q1: "b", q2: "c" })).toBe(true);
    expect(isRouteAnswerAvailable(prerequisites, { q1: "b" })).toBe(false);
    expect(isRouteAnswerAvailable(prerequisites, { q1: "x", q2: "c" })).toBe(false);
  });

  it("starts from source order, waits at the first unanswered question and exposes valid options", async () => {
    const state = await getRouteQuestions({});
    expect(state.questions.map((question) => question.id)).toEqual(questionIds);
    expect(state.next_question_id).toBe(questionIds[0]);
    expect(state.complete).toBe(false);
    expect(state.questions.map((question) => question.enabled)).toEqual([
      true,
      false,
      false,
      false
    ]);
    expect(state.questions[2]!.answers.map((answer) => answer.id)).toEqual([answerIds[6]]);
    const next = await getRouteQuestions({ selections: { [questionIds[0]!]: answerIds[0]! } });
    expect(next.next_question_id).toBe(questionIds[1]);
    expect((await getRouteQuestions({ selections: routeSelections })).complete).toBe(true);
  });

  it("clears dependent choices transitively after an earlier edit", async () => {
    const state = await getRouteQuestions({
      selections: { ...routeSelections, [questionIds[0]!]: answerIds[2]! }
    });
    expect(state.selections).toEqual({
      [questionIds[0]!]: answerIds[2],
      [questionIds[1]!]: answerIds[3]
    });
    expect(state.next_question_id).toBe(questionIds[2]);
    expect(state.removed_selections).toHaveLength(2);
    expect(state.complete).toBe(false);
  });

  it("removes unknown, wrong-question and out-of-order choices", async () => {
    const state = await getRouteQuestions({
      selections: {
        [routeFixtureId(999)]: answerIds[0]!,
        [questionIds[0]!]: answerIds[3]!,
        [questionIds[3]!]: answerIds[8]!
      }
    });
    expect(state.selections).toEqual({});
    expect(state.removed_selections.map((entry) => entry.reason)).toEqual([
      "unknown_question",
      "unknown_answer",
      "out_of_order"
    ]);
  });

  it("does not hardcode four questions and never completes an empty questionnaire", () => {
    const question = {
      id: questionIds[0]!,
      question: "One?",
      description: null,
      answers: [{ id: answerIds[0]!, title: "Yes", description: null, prerequisites: [] }]
    };
    expect(evaluateRouteQuestions([question], { [question.id]: answerIds[0]! }).complete).toBe(
      true
    );
    expect(evaluateRouteQuestions([], {}).complete).toBe(false);
  });

  it("rejects malformed state at the boundary", () => {
    expect(routeQuestionsInput.safeParse({ selections: { title: "answer" } }).success).toBe(false);
    expect(findRoutesInput.safeParse({ selections: {}, page_size: 26 }).success).toBe(false);
  });

  it("rejects missing, cyclic or forward prerequisite targets instead of exposing misleading options", async () => {
    for (const [dependent, prerequisite] of [
      [answerIds[0]!, routeFixtureId(999)],
      [answerIds[0]!, answerIds[0]!],
      [answerIds[0]!, answerIds[3]!]
    ]) {
      overrides.set("route_answers_route_answers", [
        {
          id: 1,
          route_answers_id: dependent,
          related_route_answers_id: prerequisite
        }
      ]);
      await expect(getRouteQuestions({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
  });
});

describe("source route matching and detail", () => {
  it("gates incomplete or stale answers before any route query", async () => {
    await expect(findRoutes({ selections: { [questionIds[0]!]: answerIds[0]! } })).rejects.toThrow(
      "INVALID_ROUTE_SELECTIONS"
    );
    await expect(
      findRoutes({ selections: { ...routeSelections, [questionIds[0]!]: answerIds[2]! } })
    ).rejects.toThrow("INVALID_ROUTE_SELECTIONS");
    expect(requests.some((request) => request.path === "/items/routes")).toBe(false);
  });

  it("matches required subsets and unrestricted routes, sorts by stored duration and pages past 25", async () => {
    const first = await findRoutes({ selections: routeSelections, page_size: 25 });
    expect(first.records).toHaveLength(25);
    expect(first.records[0]!.duration_in_months).toBe(0);
    expect(first.records[1]!.duration_in_months).toBe(18); // Stored total, not step sum (12).
    expect(first.has_more).toBe(true);
    expect(first.records.some((route) => route.id === routeFixtureId(9999))).toBe(false);
    expect(fetchedRouteIds).toHaveLength(26);
    const second = await findRoutes({ selections: routeSelections, page_size: 25, page: 2 });
    expect(second.records).toHaveLength(25);
    expect(second.has_more).toBe(true);
    expect(fetchedRouteIds).toHaveLength(52);
    expect(
      second.records.some((route) => first.records.some((other) => route.id === other.id))
    ).toBe(false);
    const request = requests.find((request) => request.path === "/items/routes")!;
    expect(request.params.filter).toEqual({
      requires_answers: { _none: { route_answers_id: { _nin: Object.values(routeSelections) } } }
    });
    expect(request.params.sort).toEqual(["duration_in_months", "id"]);
    expect(JSON.stringify(requests)).not.toContain("status");
    expect(JSON.stringify(requests)).not.toContain("date_published");
  });

  it("fetches only four summaries for a preview from more than 3,000 matching routes", async () => {
    const result = await findRoutes({ selections: routeSelections });
    expect(result.records).toHaveLength(3);
    expect(result.has_more).toBe(true);
    expect(fetchedRouteIds).toHaveLength(4);
    const routeRequests = requests.filter((request) => request.path === "/items/routes");
    for (const request of routeRequests) {
      const offset = Number(request.params.offset);
      expect(Number(request.params.limit)).toBeLessThanOrEqual(4 - offset);
      const fields = JSON.stringify(request.params.fields);
      expect(fields).not.toMatch(/body|description|articles|faqs|requires_answers|\*/);
    }
  });

  it("jumps directly to the last page without fetching earlier routes", async () => {
    const result = await findRoutes({ selections: routeSelections, page: 121, page_size: 25 });
    expect(result.records).toHaveLength(6);
    expect(result.has_more).toBe(false);
    expect(fetchedRouteIds).toHaveLength(6);
    const routeRequests = requests.filter((request) => request.path === "/items/routes");
    expect(routeRequests[0]!.params.offset).toBe(3000);
    expect(routeRequests.every((request) => Number(request.params.offset) >= 3000)).toBe(true);
    expect(result.records[0]!.id).toBe(routeFixtureId(3099));
  });

  it("reads independent detail with ordered rich steps and article/FAQ references", async () => {
    const { record } = await getRoute({ id: routeRecord.id });
    expect(requests).toHaveLength(1);
    expect(record.source_url).toBe(`https://onderwijsloket.com/routes/${routeRecord.id}`);
    expect(record.steps.map((step) => step.short_title)).toEqual(["Step 1", "Step 2"]);
    expect(record.steps[0]!.duration_in_months).toBeNull();
    expect(record.steps[0]!.body).toContain("Step 1 body.");
    expect(record.steps[0]!.articles[0]!.source_url).toBe(
      "https://onderwijsloket.com/kennisbank/artikelen/alpha"
    );
    expect(record.steps[0]!.faqs[0]!.question).toBe("Can I teach?");
    expect(record.duration_in_months).toBe(18);
    expect(record.description).toBeNull();
    expect(requests[0]!.params.deep).toMatchObject({ route_steps: { _sort: ["sort", "id"] } });
  });

  it("reports missing records and sanitizes provider/validation failures", async () => {
    await expect(getRoute({ id: routeFixtureId(999) })).rejects.toThrow("NOT_FOUND");
    vi.mocked(useDirectusServer).mockRejectedValueOnce(new Error("private upstream token"));
    await expect(getRouteQuestions({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    vi.mocked(useDirectusServer).mockResolvedValueOnce([{ id: "bad" }] as never);
    await expect(getRouteQuestions({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    vi.mocked(useDirectusServer).mockResolvedValueOnce([] as never);
    await expect(getRouteQuestions({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });

  it("preserves empty matches and unknown durations without inventing immediate eligibility", async () => {
    overrides.set("routes", []);
    const empty = await findRoutes({ selections: routeSelections });
    expect(empty.records).toEqual([]);
    expect(empty.has_more).toBe(false);
    overrides.set("routes", [{ ...routeRecord, duration_in_months: null }]);
    expect(
      (await findRoutes({ selections: routeSelections })).records[0]!.duration_in_months
    ).toBeNull();
  });

  it("reports missing relation targets and bounded timelines without recomputing totals", async () => {
    vi.mocked(useDirectusServer).mockResolvedValueOnce([
      {
        ...routeRecord,
        route_steps: [
          { route_steps_id: null },
          ...Array.from({ length: 100 }, () => ({
            route_steps_id: {
              ...routeRecord.route_steps[0]!.route_steps_id,
              body: null,
              articles: [{ articles_id: null }]
            }
          }))
        ]
      }
    ] as never);
    const { record } = await getRoute({ id: routeRecord.id });
    expect(record.relations_truncated).toBe(true);
    expect(record.steps).toHaveLength(99);
    expect(record.steps[0]!.body).toBeNull();
    expect(record.steps[0]!.articles).toEqual([]);
    expect(record.content_warnings.join(" ")).toContain("Unavailable related record");
    expect(record.duration_in_months).toBe(18);
  });

  it("rejects partial or non-advancing questionnaires instead of matching incomplete data", async () => {
    await expect(readRoutePages(async () => [{ id: "same" }])).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
    await expect(readRoutePages(async (offset) => [{ id: String(offset) }], 2)).rejects.toThrow(
      "UPSTREAM_UNAVAILABLE"
    );
    const rows = await readRoutePages(async (offset) =>
      offset < 3 ? [{ id: String(offset) }] : []
    );
    expect(rows).toHaveLength(3);
  });
});
