import { showRecord, episodeRecord, videoRecord } from "./podcasts-and-videos";
import { deskRecord } from "./regional-education-desks";
import { institutionRecord, programRecord } from "./institutions-and-programs";
import { testimonialRecord, supportingRelations } from "./article-evidence-and-testimonials";
import { faqRecord, sectorRecord } from "./faqs-and-sectors";
import { createServer } from "node:http";
import { once } from "node:events";

export const articleId = "00f81660-a2e4-48af-b8d7-98ce338de447";
export const topicId = "00000000-0000-0000-0000-000000000001";
export const longBody = "Article body. ".repeat(2000);

const taxonomy = {
  id: topicId,
  name: "Career paths",
  slug: "career-paths",
  description: "Routes into education"
};
const baseArticle = {
  id: articleId,
  ...supportingRelations,
  title: "Alpha",
  slug: "alpha",
  path: "/kennisbank/artikelen/alpha",
  description: "An introduction",
  summary: "A summary",
  english: false,
  date_updated: null,
  topics: [{ topics_id: taxonomy }],
  body: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: longBody }] },
      { type: "relation-block", attrs: { id: "advice", collection: "buttons" } },
      { type: "relation-block", attrs: { id: "image", collection: "images" } }
    ]
  },
  editor_nodes: [
    { id: "advice", collection: "buttons", item: { label: "Advice", to: "/advies" } },
    { id: "image", collection: "images", item: { alt_text: "Classroom", image: "classroom-id" } }
  ]
};
const articles = [
  baseArticle,
  { ...baseArticle, id: "00f81660-a2e4-48af-b8d7-98ce338de448", title: "Beta", slug: "beta" },
  {
    ...baseArticle,
    id: "00f81660-a2e4-48af-b8d7-98ce338de449",
    title: "Gamma",
    slug: "gamma",
    english: true
  }
];

/** Real HTTP boundary for the Directus SDK; intentionally implements only the queries under test. */
export async function createDirectusFixture() {
  const requests: URL[] = [];
  const state = {
    failingTaxonomy: "",
    articleResponse: "",
    extraArticles: 0,
    extraPrograms: 0,
    missingInstitutionDescription: false,
    deskResponse: "",
    mediaResponse: ""
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://fixture.local");
    requests.push(url);
    response.setHeader("content-type", "application/json");
    if (request.method !== "GET" || request.headers.authorization !== "Bearer fixture-token") {
      response.statusCode = 401;
      response.end(
        JSON.stringify({
          errors: [{ message: "Expected fixture credentials and a read request." }]
        })
      );
      return;
    }
    const collection = url.pathname.split("/").pop();
    const filter = JSON.parse(url.searchParams.get("filter") ?? "{}");
    if (
      filter.title?._eq === "upstream-error" ||
      collection === state.failingTaxonomy ||
      (collection === "articles" && state.articleResponse === "unavailable")
    ) {
      response.statusCode = 403;
      response.end(JSON.stringify({ errors: [{ message: "fixture upstream secret" }] }));
      return;
    }
    if (filter.title?._eq === "upstream-invalid") {
      response.end(JSON.stringify({ data: [{ id: "malformed" }] }));
      return;
    }
    if (["podcast_shows", "podcast_episodes", "videos"].includes(collection ?? "")) {
      if (state.mediaResponse === "unavailable") {
        response.statusCode = 403;
        response.end(JSON.stringify({ errors: [{ message: "fixture media secret" }] }));
        return;
      }
      const source =
        collection === "podcast_shows"
          ? showRecord
          : collection === "podcast_episodes"
            ? episodeRecord
            : videoRecord;
      const row: Record<string, unknown> =
        state.mediaResponse === "missing-content"
          ? {
              ...source,
              body: null,
              description: null,
              transcript_string: null,
              transcript_string_with_speakers: null
            }
          : source;
      const rows =
        state.mediaResponse === "invalid"
          ? [{ id: "invalid" }]
          : [row].filter((row) =>
              Object.entries(filter).every(([key, condition]) => {
                const operation = condition as { _eq?: unknown; id?: { _eq: unknown } };
                if ("_eq" in operation) return row[key] === operation._eq;
                if (operation.id)
                  return (row[key] as { id?: string } | null)?.id === operation.id._eq;
                const target =
                  key === "hosts"
                    ? "podcast_hosts_id"
                    : key === "guests" || key === "profiles"
                      ? "profiles_id"
                      : key + "_id";
                return (
                  (row[key] as Record<string, { id: string }>[] | undefined)?.some((item) =>
                    JSON.stringify(condition).includes(item[target]?.id ?? "missing")
                  ) ?? false
                );
              })
            );
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Number(url.searchParams.get("limit") ?? 10);
      const page = rows.slice(offset, offset + limit);
      response.end(
        JSON.stringify({
          data:
            url.searchParams.get("fields") === "id,title,date_updated"
              ? page.map((row) => ({
                  id: row.id,
                  title: "title" in row ? row.title : undefined,
                  date_updated: null
                }))
              : page
        })
      );
      return;
    }
    if (collection === "regional_education_desks") {
      if (state.deskResponse === "unavailable") {
        response.statusCode = 403;
        response.end(JSON.stringify({ errors: [{ message: "fixture upstream secret" }] }));
        return;
      }
      const fields = url.searchParams.get("fields");
      const source =
        state.deskResponse === "missing-content"
          ? { ...deskRecord, description: null, consultation_service_description: null }
          : state.deskResponse === "missing-area"
            ? { ...deskRecord, area: null, location: null }
            : deskRecord;
      const rows =
        state.deskResponse === "invalid"
          ? [{ id: "malformed" }]
          : [source].filter((row) =>
              Object.entries(filter).every(([key, value]) => {
                const operation = value as { _eq?: unknown };
                return "_eq" in operation
                  ? (row as Record<string, unknown>)[key] === operation._eq
                  : key === "sectors" &&
                      JSON.stringify(value).includes(deskRecord.sectors[0]!.sectors_id.id);
              })
            );
      const offset = Number(url.searchParams.get("offset") ?? 0),
        limit = Number(url.searchParams.get("limit") ?? 10);
      const page = rows.slice(offset, offset + limit);
      response.end(
        JSON.stringify({
          data:
            fields === "id,title,date_updated"
              ? page.map((row) => ({
                  id: row.id,
                  title: "title" in row ? row.title : undefined,
                  date_updated: null
                }))
              : page
        })
      );
      return;
    }
    if (collection === "programs" && url.searchParams.get("fields") === "id,title,date_updated") {
      const rows = [
        programRecord,
        ...Array.from({ length: state.extraPrograms }, (_, i) => ({
          id: `10000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
          title: `Program ${i}`,
          date_updated: null
        }))
      ]
        .map(({ id, title, date_updated }) => ({ id, title, date_updated }))
        .sort((a, b) => a.id.localeCompare(b.id));
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      response.end(JSON.stringify({ data: rows.slice(offset, offset + limit) }));
      return;
    }
    if (collection === "programs" || collection === "educational_institutions") {
      const row =
        collection === "programs"
          ? programRecord
          : {
              ...institutionRecord,
              ...(state.missingInstitutionDescription ? { description: null } : {})
            };
      const matches = Object.entries(filter).every(([key, value]) => {
        const condition = value as { _eq?: unknown };
        if ("_eq" in condition) return (row as Record<string, unknown>)[key] === condition._eq;
        return key === "educational_institutions" || key === "location" || key === "locations";
      });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      response.end(JSON.stringify({ data: matches && offset === 0 ? [row] : [] }));
      return;
    }
    if (
      collection === "testimonials" ||
      collection === "faqs" ||
      (collection === "sectors" &&
        (url.searchParams.get("fields")?.includes("code") ||
          url.searchParams.get("fields") === "id,title,date_updated"))
    ) {
      const source =
        collection === "testimonials"
          ? testimonialRecord
          : collection === "faqs"
            ? faqRecord
            : sectorRecord;
      const catalogue = [source];
      const rows = catalogue.filter((row) => {
        const scalar = row as Record<string, unknown>;
        return Object.entries(filter).every(([key, condition]) => {
          const operation = condition as { _eq?: unknown; [key: string]: unknown };
          if ("_eq" in operation) return scalar[key] === operation._eq;
          if (collection === "testimonials" && key === "authors")
            return JSON.stringify(operation).includes("author-1");
          if (collection === "testimonials" && key === "profiles")
            return JSON.stringify(operation).includes("profile-1");
          if (key === "articles") return JSON.stringify(operation).includes(articleId);
          return (
            ["sectors", "topics", "phases", "audiences"].includes(key) &&
            JSON.stringify(operation).includes(topicId)
          );
        });
      });
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 10);
      response.end(JSON.stringify({ data: rows.slice(offset, offset + limit) }));
      return;
    }
    if (collection === "articles") {
      const catalogue = [
        ...articles,
        ...Array.from({ length: state.extraArticles }, (_, index) => ({
          ...baseArticle,
          id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          title: `Zulu ${String(index + 1).padStart(2, "0")}`
        }))
      ];
      let result = catalogue.filter(
        (article) =>
          (!filter.id || article.id === filter.id._eq) &&
          (!filter.title || article.title === filter.title._eq) &&
          (!filter.slug || article.slug === filter.slug._eq) &&
          (!filter.english || article.english === filter.english._eq) &&
          (!filter.topics || filter.topics.topics_id.id._in.includes(topicId))
      );
      const sort = url.searchParams.get("sort") ?? "title,id";
      result = result.toSorted(
        (a, b) => a.title.localeCompare(b.title) * (sort.startsWith("-") ? -1 : 1)
      );
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? result.length);
      response.end(JSON.stringify({ data: result.slice(offset, offset + limit) }));
      return;
    }
    if (
      ![
        "topics",
        "qualifications",
        "roles",
        "tracks",
        "school_subjects",
        "sectors",
        "phases",
        "audiences"
      ].includes(collection!)
    ) {
      response.statusCode = 404;
      response.end(JSON.stringify({ errors: [{ message: "Unknown fixture collection." }] }));
      return;
    }
    const titleBased = ["sectors", "audiences", "phases"].includes(collection!);
    response.end(
      JSON.stringify({
        data: [
          {
            id: topicId,
            [titleBased ? "title" : "name"]: "Career paths",
            ...(!["audiences", "phases"].includes(collection!) ? { slug: "career-paths" } : {}),
            ...(collection !== "audiences" ? { description: "Routes into education" } : {})
          }
        ]
      })
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Fixture server did not bind a port.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    state,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  };
}
