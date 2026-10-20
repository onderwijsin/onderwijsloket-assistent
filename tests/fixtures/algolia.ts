import { deskRecord } from "./regional-education-desks";
import { institutionRecord, programRecord } from "./institutions-and-programs";
import { testimonialRecord } from "./article-evidence-and-testimonials";
import { faqId, sectorId } from "./faqs-and-sectors";
import { createServer } from "node:http";
import { once } from "node:events";
import { articleId } from "./directus";

/** HTTP fixture for the SDK's query endpoint; real client serialization and auth stay in the test. */
export async function createAlgoliaFixture() {
  const requests: { path: string; params: Record<string, unknown> }[] = [];
  const articleHits = [
    {
      id: articleId,
      objectID: articleId,
      title: "Alpha",
      description: "Description",
      slug: "alpha",
      path: "/kennisbank/artikelen/alpha",
      english: false,
      topics: ["Salaris"]
    },
    {
      id: "00f81660-a2e4-48af-b8d7-98ce338de448",
      objectID: "00f81660-a2e4-48af-b8d7-98ce338de448",
      title: "Beta",
      description: "Description",
      slug: "beta",
      path: "/beta",
      english: false,
      topics: ["Career paths"]
    },
    {
      id: "00f81660-a2e4-48af-b8d7-98ce338de449",
      objectID: "00f81660-a2e4-48af-b8d7-98ce338de449",
      title: "Gamma",
      description: "Description",
      slug: "gamma",
      path: "/gamma",
      english: true,
      topics: ["Salaris"]
    }
  ];
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    if (
      request.headers["x-algolia-api-key"] !== "fixture-algolia-token" ||
      request.headers["x-algolia-application-id"] !== "fixture-app"
    ) {
      response.statusCode = 403;
      response.end(JSON.stringify({ message: "Expected fixture credentials" }));
      return;
    }
    const index = request.url?.split("/")[3];
    if (
      request.method !== "POST" ||
      ![
        "articles",
        "faqs",
        "sectors",
        "testimonials",
        "programs",
        "educational_institutions",
        "regional_education_desks"
      ].includes(index ?? "") ||
      !request.url?.split("?")[0]?.endsWith("/query")
    ) {
      response.statusCode = 404;
      response.end(
        JSON.stringify({ message: "Unexpected endpoint; index settings are not available" })
      );
      return;
    }
    const hits =
      index === "regional_education_desks"
        ? [{ ...deskRecord, objectID: deskRecord.id, topics: ["Teaching"], english: false }]
        : index === "programs"
          ? [
              {
                ...programRecord,
                educational_institutions: programRecord.educational_institutions.map(
                  (row) => row.educational_institutions_id
                ),
                objectID: programRecord.id,
                topics: ["Teaching"],
                english: false
              }
            ]
          : index === "educational_institutions"
            ? [
                {
                  ...institutionRecord,
                  objectID: institutionRecord.id,
                  topics: ["Teaching"],
                  english: false
                }
              ]
            : index === "testimonials"
              ? [
                  {
                    ...testimonialRecord,
                    objectID: testimonialRecord.id,
                    topics: ["Teaching"],
                    english: false
                  }
                ]
              : index === "articles"
                ? articleHits
                : [
                    {
                      id: index === "faqs" ? faqId : sectorId,
                      objectID: index === "faqs" ? faqId : sectorId,
                      question: "Can I teach?",
                      title: "Primary education",
                      description: "Primary education guidance",
                      slug: "primary",
                      path: "/primary",
                      status: "published",
                      english: false,
                      topics: ["Teaching"]
                    }
                  ];
    let body = "";
    for await (const chunk of request) body += chunk;
    const params = JSON.parse(body);
    requests.push({ path: request.url, params });
    if (params.query === "provider-error") {
      response.statusCode = 403;
      response.end(JSON.stringify({ message: "fixture Algolia secret" }));
      return;
    }
    if (params.query === "malformed") {
      response.end(JSON.stringify({ hits: [{ objectID: "invalid" }], nbHits: 1, nbPages: 1 }));
      return;
    }
    const selected = hits.filter(
      (hit) =>
        params.query !== "no-results" &&
        (params.facetFilters ?? []).every((group: string[]) =>
          group.some((filter) => {
            const colon = filter.indexOf(":");
            const name = filter.slice(0, colon);
            const value = filter.slice(colon + 1).replace(/^\\-/, "-");
            if (index === "regional_education_desks") {
              const values =
                name === "sectors.title"
                  ? deskRecord.sectors.map((row) => row.sectors_id.title)
                  : name === "has_consultation_service"
                    ? [String(deskRecord.has_consultation_service)]
                    : name === "content_types"
                      ? deskRecord.content_types
                      : name === "orientation_activity_types"
                        ? deskRecord.orientation_activity_types
                        : [];
              return values.includes(value);
            }
            return name === "english"
              ? String(hit.english) === value
              : name === "topics.name"
                ? hit.topics.includes(value)
                : value === "Leraar";
          })
        )
    );
    const names = params.facets?.includes("*")
      ? index === "regional_education_desks"
        ? [
            "sectors.title",
            "has_consultation_service",
            "orientation_activity_types",
            "content_types"
          ]
        : index === "programs"
          ? [
              "type",
              "level",
              "degrees",
              "roles.name",
              "sectors.title",
              "qualifications.name",
              "school_subjects.name",
              "program_forms.track.name",
              "educational_institutions.title"
            ]
          : index === "educational_institutions"
            ? ["type"]
            : index === "testimonials"
              ? [
                  "audiences.title",
                  "authors.name",
                  "phases.title",
                  "roles.name",
                  "sectors.title",
                  "topics.name",
                  "tracks.name"
                ]
              : index === "sectors"
                ? []
                : index === "faqs"
                  ? ["english", "topics.name", "sectors.title", "audiences.title", "phases.title"]
                  : ["english", "topics.name", "roles.name"]
      : (params.facets ?? []);
    const facets = Object.fromEntries(
      names.map((name: string) => {
        const counts: Record<string, number> = {};
        for (const hit of selected) {
          const values =
            index === "regional_education_desks"
              ? name === "sectors.title"
                ? deskRecord.sectors.map((row) => row.sectors_id.title)
                : name === "has_consultation_service"
                  ? [String(deskRecord.has_consultation_service)]
                  : name === "content_types"
                    ? deskRecord.content_types
                    : name === "orientation_activity_types"
                      ? deskRecord.orientation_activity_types
                      : []
              : name === "english"
                ? [String(hit.english)]
                : name === "topics.name"
                  ? hit.topics
                  : ["Leraar"];
          for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
        }
        return [
          name,
          Object.fromEntries(Object.entries(counts).slice(0, params.maxValuesPerFacet ?? 100))
        ];
      })
    );
    const page = params.page ?? 0;
    const size = params.hitsPerPage ?? 20;
    response.end(
      JSON.stringify({
        hits: selected.slice(page * size, page * size + size).map((hit) => ({
          ...Object.fromEntries(
            Object.entries(hit).filter(([key]) => params.attributesToRetrieve?.includes(key))
          ),
          objectID: hit.objectID,
          ...(params.attributesToSnippet?.length
            ? {
                _snippetResult: {
                  title: { value: hit.title, matchLevel: "none" },
                  bodyString: {
                    value: `A useful **${params.query}** excerpt from the indexed article body.`,
                    matchLevel: "full"
                  }
                }
              }
            : {})
        })),
        nbHits: selected.length,
        nbPages: size ? Math.ceil(selected.length / size) : 0,
        page,
        hitsPerPage: size,
        facets,
        exhaustive: { nbHits: true, facetsCount: true },
        query: params.query ?? ""
      })
    );
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Algolia fixture did not bind a port.");
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
    async close() {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  };
}
