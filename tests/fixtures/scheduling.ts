import { createServer } from "node:http";
import { once } from "node:events";
import {
  schedulingLinks,
  schedulingChoices,
  type SchedulingLanguage
} from "../../server/utils/scheduling/config";

/** Synthetic provider contract; production data and appointments are never used.
 * @param language - Consultation language.
 * @returns Synthetic link metadata with an attribution field and one text question.
 */
export function schedulingFixtureLink(language: SchedulingLanguage = "nl") {
  const configured = schedulingLinks[language];
  return {
    id: configured.id,
    slug: configured.slug,
    name: "Telephone consultation",
    state: "active",
    description: "Synthetic consultation",
    default_duration: 20,
    durations: [20],
    fields: [
      {
        id: configured.attributionField,
        label: language === "nl" ? "Boeking via" : "Booking via",
        type: "hidden",
        is_required: false
      },
      { id: "field_topic", label: "Question", type: "long_text", is_required: true }
    ]
  };
}

/** Minimal confirmed phone event returned by the synthetic provider.
 * @param language - Consultation language.
 * @param start - Selected ISO timestamp.
 * @returns Synthetic event response, without real personal data.
 */
export function schedulingFixtureEvent(language: SchedulingLanguage, start: string) {
  return {
    id: "event_fixture",
    state: "confirmed",
    start_at: start,
    end_at: new Date(Date.parse(start) + 20 * 60000).toISOString(),
    organizer: { display_name: "Fixture Adviser" },
    link: { id: schedulingLinks[language].id },
    is_group_session: false,
    payment: null,
    location_settings: [{ type: "phone" }],
    conferencing: null
  };
}

/** Local HTTP upstream for the real ofetch adapter used by MCP e2e tests.
 * @returns Fixture server, recorded requests and a controllable missing-choice form.
 */
export async function createSchedulingFixture() {
  const requests: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const startAt = new Date(Date.now() + 86400000).toISOString();
  const endAt = new Date(Date.parse(startAt) + 20 * 60000).toISOString();
  const state = { missingChoices: false };
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (request.headers.authorization !== "Bearer fixture-savvycal-token") {
      response.writeHead(403).end("{}");
      return;
    }
    const url = new URL(request.url!, "http://localhost");
    const language = url.pathname.includes(schedulingLinks.nl.id) ? "nl" : "en";
    if (!url.pathname.startsWith(`/v1/links/${schedulingLinks[language].id}`)) {
      response.writeHead(404).end("{}");
      return;
    }
    let body: Record<string, unknown> | undefined;
    if (request.method === "POST") {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
    requests.push({ method: request.method!, path: request.url!, ...(body ? { body } : {}) });
    if (request.method === "POST" && url.pathname.endsWith("/events")) {
      response.end(JSON.stringify(schedulingFixtureEvent(language, String(body!.start_at))));
    } else if (request.method === "GET" && url.pathname.endsWith("/slots")) {
      const from = Date.parse(url.searchParams.get("from")!);
      const until = Date.parse(url.searchParams.get("until")!);
      response.end(
        JSON.stringify(
          Date.parse(startAt) >= from && Date.parse(endAt) <= until
            ? [{ start_at: startAt, end_at: endAt, duration: 20, rank: 1 }]
            : []
        )
      );
    } else if (
      request.method === "GET" &&
      url.pathname === `/v1/links/${schedulingLinks[language].id}`
    ) {
      const link = schedulingFixtureLink(language);
      link.fields.push(
        ...Object.entries(schedulingChoices[language]).map(([id, field]) => ({
          id,
          label: field.label,
          type: field.type,
          is_required: true
        }))
      );
      if (state.missingChoices)
        link.fields.push({
          id: "field_education",
          label: "Education",
          type: "select",
          is_required: true
        });
      response.end(JSON.stringify(link));
    } else response.writeHead(404).end("{}");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Fixture did not bind");
  return {
    requests,
    state,
    startAt,
    endAt,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      )
  };
}
