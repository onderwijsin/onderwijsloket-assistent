import {
  author,
  evidence,
  document,
  supportingRelations
} from "../fixtures/article-evidence-and-testimonials";
import { z } from "zod";
import { beforeEach, describe, expect, it, vi } from "vitest";
import articles from "../../server/collections/articles";
import { renderContentDocument } from "../../server/utils/content/render-content-document";

vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn,
  useRuntimeConfig: () => ({
    public: { directus: { assetBaseUrl: "https://assets.example.test" } }
  })
}));

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));

const article = {
  id: "00f81660-a2e4-48af-b8d7-98ce338de447",
  status: "published",
  sources: [],
  documents: [],
  authors: [],
  title: "Title",
  slug: "title",
  path: "/kennisbank/artikelen/title",
  summary: "Summary",
  description: "Description",
  user_created: { email: "private@example.test" },
  body: { type: "doc", content: [{ type: "text", text: "Body" }] }
};

beforeEach(() => {
  read.mockReset();
});

describe("article boundaries", () => {
  it("exports MCP-compatible output schemas", () => {
    expect(() => z.toJSONSchema(articles.filtersOutput)).not.toThrow();
    expect(() => z.toJSONSchema(articles.metadataSchema)).not.toThrow();
    expect(() => z.toJSONSchema(articles.listOutput)).not.toThrow();
    expect(() => z.toJSONSchema(articles.getOutput)).not.toThrow();
    expect(articles.detail.shape.content.safeParse("a".repeat(25000)).success).toBe(true);
  });
  it("advertises index discovery and validates search-specific input/output contracts", () => {
    expect(articles.metadata.capabilities).toMatchObject({ search: true, facets: true });
    expect(() => z.toJSONSchema(articles.searchOutput)).not.toThrow();
    expect(() => z.toJSONSchema(articles.facetsOutput)).not.toThrow();
    expect(articles.searchInput.parse({ collection: "articles" })).toMatchObject({
      query: "",
      page: 1,
      page_size: 10
    });
    expect(
      articles.searchInput.safeParse({ collection: "articles", filters: { english: false } })
        .success
    ).toBe(false);
    expect(
      articles.searchInput.safeParse({ collection: "articles", query: "a".repeat(501) }).success
    ).toBe(false);
    expect(
      articles.facetsInput.safeParse({ collection: "articles", max_values: 1001 }).success
    ).toBe(false);
  });
  it("rejects arbitrary collections, filters and oversized pages", () => {
    expect(articles.listInput.safeParse({ collection: "users" }).success).toBe(false);
    expect(articles.listInput.safeParse({ collection: "articles", page_size: 26 }).success).toBe(
      false
    );
    expect(articles.filterSchema.safeParse({ status: "draft" }).success).toBe(false);
    expect(articles.filterSchema.safeParse({ english: "false" }).success).toBe(false);
  });
  it("supports list() with defaults and validates methods before querying", async () => {
    read.mockResolvedValue([]);
    const result = await articles.list();
    expect(result).toMatchObject({ page: 1, page_size: 10, records: [], has_more: false });
    read.mockClear();
    await expect(articles.list({ page_size: 0 })).rejects.toThrow();
    await expect(articles.get("not-an-id")).rejects.toThrow();
    expect(read).not.toHaveBeenCalled();
  });
  it("keeps stable sorting and pagination including false filters", async () => {
    read.mockResolvedValue([]);
    await articles.list({
      page: 2,
      page_size: 10,
      filters: { english: false }
    });
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      filter: { english: { _eq: false } },
      sort: ["title", "id"],
      limit: 11,
      offset: 10
    });
    expect(query.fields).not.toContain("user_created");
  });
  it("returns summaries without the body and reports continuation", async () => {
    read.mockResolvedValue([article, article]);
    const result = await articles.list({ page_size: 1 });
    expect(result.has_more).toBe(true);
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).not.toHaveProperty("user_created");
    expect(result.records[0]).not.toHaveProperty("body");
  });
  it("filters ID reads and distinguishes missing records from provider failures", async () => {
    read.mockResolvedValueOnce([]);
    await expect(articles.get(article.id)).rejects.toThrow("NOT_FOUND");
    const command = read.mock.calls[0]![0];
    const request = command();
    expect(JSON.stringify(request)).not.toContain("status");
    expect(JSON.stringify(request)).toContain(article.id);
    read.mockRejectedValueOnce(new Error("secret token"));
    await expect(articles.get(article.id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
  it("returns readable detail without raw source fields", async () => {
    read.mockResolvedValue([article]);
    const result = await articles.get(article.id);
    expect(result.record.content).toBe("# Title\n\nDescription\n\nBody");
    expect(result.record.source_url).toBe("https://onderwijsloket.com/kennisbank/artikelen/title");
    expect(result.record).not.toHaveProperty("status");
  });
  it("requests editor-node data for details and renders hydrated content", async () => {
    read.mockResolvedValue([
      {
        ...article,
        body: {
          type: "doc",
          content: [{ type: "relation-block", attrs: { id: "button", collection: "buttons" } }]
        },
        editor_nodes: [
          { id: "button", collection: "buttons", item: { label: "Advice", to: "/advies" } }
        ]
      }
    ]);
    const result = await articles.get(article.id);
    expect(result.record.content).toContain("[Advice](<https://onderwijsloket.com/advies>)");
    expect(result.record.content_warnings).toEqual([]);
    expect(JSON.stringify(read.mock.calls[0]![0]())).toContain("editor_nodes");
  });
  it("accepts GUID-formatted taxonomy IDs without requiring RFC UUID version bits", () => {
    expect(
      articles.filterSchema.safeParse({ audiences: ["00000000-0000-0000-0000-000000000001"] })
        .success
    ).toBe(true);
  });
  it("maps taxonomy ID filters through the correct junctions", async () => {
    read.mockResolvedValue([]);
    await articles.list({
      filters: { sectors: [article.id], topics: [article.id] }
    });
    const query = read.mock.calls[0]![0]().params;
    expect(query.filter).toEqual({
      sectors: { sectors_id: { id: { _in: [article.id] } } },
      topics: { topics_id: { id: { _in: [article.id] } } }
    });
  });
  it("includes flattened taxonomy metadata in both list and detail", async () => {
    const record = {
      ...article,
      sectors: [
        {
          sectors_id: {
            id: article.id,
            title: "Primair onderwijs",
            slug: "po",
            description: "Sector description"
          }
        }
      ],
      topics: [
        {
          topics_id: {
            id: article.id,
            name: "Zij-instroom",
            slug: "zij-instroom",
            path: "/onderwerpen/zij-instroom",
            description: "Topic description"
          }
        }
      ]
    };
    read.mockResolvedValue([record]);
    const list = await articles.list();
    const detail = await articles.get(article.id);
    expect(list.records[0]!.sectors[0]).toEqual({
      id: article.id,
      title: "Primair onderwijs",
      source_url: "https://onderwijsloket.com/po",
      description: "Sector description"
    });
    expect(detail.record.topics).toEqual(list.records[0]!.topics);
    expect(detail.record.topics[0]?.source_url).toBe(
      "https://onderwijsloket.com/onderwerpen/zij-instroom"
    );
    const metadata = articles.resourceMetadata?.(detail.record);
    expect(metadata).toMatchObject({
      collection: "articles",
      sectors: ["Primair onderwijs"],
      topics: ["Zij-instroom"],
      content_warnings: [],
      truncated: false
    });
    expect(metadata).not.toHaveProperty("content");
  });
  it("retrieves normalized taxonomy choices for each article filter", async () => {
    read.mockImplementation(async (command) => {
      const request = command();
      const name = request.path.split("/").pop();
      const label = ["sectors", "audiences", "phases"].includes(name) ? "title" : "name";
      return [{ id: article.id, [label]: "Current value" }];
    });
    const first = await articles.filters();
    expect(first.filters).toHaveLength(10);
    expect(first.instructions).toContain("do not send operator objects");
    expect(first.filters.find((filter) => filter.name === "topics")).toMatchObject({
      type: "array",
      items: { type: "string", pattern: expect.any(String) },
      minItems: 1,
      maxItems: 50
    });
    expect(first.filters.find((filter) => filter.name === "sectors")).toMatchObject({
      values: [{ id: article.id, title: "Current value" }]
    });
    expect(read).toHaveBeenCalledTimes(7);
    read.mockResolvedValue([]);
    const second = await articles.filters();
    expect(second.filters.find((filter) => filter.name === "sectors")).toMatchObject({
      values: []
    });
  });

  it("rejects malformed upstream records and filter choices without leaking provider errors", async () => {
    read.mockResolvedValueOnce([{ ...article, id: "invalid" }]);
    await expect(articles.list()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    read.mockRejectedValue(new Error("provider secret"));
    await expect(articles.filters()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });

  it("translates every taxonomy dimension and exact scalar matching", async () => {
    read.mockResolvedValue([]);
    const ids = [article.id];
    await articles.list({
      filters: {
        title: " Title ",
        slug: " title ",
        sectors: ids,
        qualifications: ids,
        audiences: ids,
        phases: ids,
        roles: ids,
        topics: ids,
        tracks: ids
      }
    });
    const filter = read.mock.calls[0]![0]().params.filter;
    expect(filter.title).toEqual({ _eq: "Title" });
    expect(filter.slug).toEqual({ _eq: "title" });
    for (const name of [
      "sectors",
      "qualifications",
      "audiences",
      "phases",
      "roles",
      "topics",
      "tracks"
    ]) {
      expect(filter[name]).toEqual({ [`${name}_id`]: { id: { _in: ids } } });
    }
  });

  it("does not generate citations for untrusted absolute paths", async () => {
    for (const path of ["https://evil.test", "//evil.test", "/\\evil.test"]) {
      read.mockResolvedValue([{ ...article, path }]);
      expect((await articles.get(article.id)).record.source_url).toBeNull();
    }
  });
  it("preserves safe links, reports unresolved relations and retains long content", () => {
    const result = renderContentDocument(
      {
        type: "doc",
        content: [
          {
            type: "text",
            text: "Source",
            marks: [{ type: "link", attrs: { href: "https://example.test" } }]
          },
          { type: "relation-block", attrs: { item: "private" } },
          { type: "text", text: "a".repeat(25000) }
        ]
      },
      [],
      { assetBaseUrl: "https://assets.example.test" }
    );
    expect(result.markdown).toContain("[Source](<https://example.test>)");
    expect(result.warnings).toHaveLength(1);
    expect(result.markdown).toContain("a".repeat(25000));
    expect(result.truncated).toBe(false);
    expect(result.markdown).not.toContain("private");
  });
});

const articleWithEvidence = {
  id: "00f81660-a2e4-48af-b8d7-98ce338de447",
  title: "Guidance",
  slug: "guidance",
  description: "Factual guidance",
  summary: "Summary",
  path: "/kennisbank/artikelen/guidance",
  body: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Article body" }] }]
  },
  editor_nodes: [],
  ...supportingRelations
};

describe("article evidence and attribution", () => {
  it("expands source URLs, document assets and authors only in detail, preserving existing content", async () => {
    read.mockResolvedValue([articleWithEvidence]);
    const listed = await articles.list();
    expect(listed.records[0]).not.toHaveProperty("sources");
    expect(JSON.stringify(read.mock.calls[0]![0]().params.fields)).not.toMatch(
      /authors|documents|sources/
    );
    const { record } = await articles.get(articleWithEvidence.id);
    expect(record.sources).toEqual([
      { id: evidence.id, title: evidence.title, description: null, url: evidence.url }
    ]);
    expect(record.documents[0]?.asset).toEqual({
      id: "file-1",
      url: "https://res.cloudinary.com/onderwijsin/image/upload/onderwijsloket-directus/production/file-1"
    });
    expect(record.authors[0]).toMatchObject({
      id: author.id,
      first_name: "Editorial",
      job_title: "Editor"
    });
    expect(record.content).toContain("Article body");
    expect(record.relations_truncated).toEqual([]);
    expect(record.truncated).toBe(false);
    expect(record.content_warnings).toEqual([]);
    expect(JSON.stringify(record)).not.toMatch(/team_member|private@example|storage|status/);
    const query = read.mock.calls[1]![0]().params;
    for (const name of ["sources", "documents", "authors"])
      expect(query.deep[name]).toEqual({ _limit: 101, _sort: ["id"] });
    expect(JSON.stringify(query)).not.toMatch(/status|user_created|team_member/);
    expect(articles.resourceMetadata?.(record)).toMatchObject({
      sources: record.sources,
      documents: record.documents,
      authors: record.authors,
      relations_truncated: []
    });
  });
  it("reports missing targets, unavailable downloads and unsafe evidence URLs without hiding them", async () => {
    read.mockResolvedValue([
      {
        ...articleWithEvidence,
        sources: [
          { sources_id: { ...evidence, url: "javascript:alert(1)" } },
          { sources_id: null }
        ],
        documents: [{ documents_id: { ...document, asset: null } }]
      }
    ]);
    const { record } = await articles.get(articleWithEvidence.id);
    expect(record.sources[0]?.url).toBeNull();
    expect(record.documents[0]?.asset).toBeNull();
    expect(record.content_warnings.join()).toMatch(/Unavailable related record/);
    expect(record.content_warnings).toContain("Unavailable or invalid source URL.");
    expect(record.content_warnings).toContain("Unavailable document asset.");
  });
  it("bounds each supporting relation independently of document traversal truncation", async () => {
    read.mockResolvedValue([
      {
        ...articleWithEvidence,
        sources: Array.from({ length: 101 }, () => ({ sources_id: evidence }))
      }
    ]);
    const { record } = await articles.get(articleWithEvidence.id);
    expect(record.sources).toHaveLength(100);
    expect(record.relations_truncated).toEqual(["sources"]);
    expect(record.truncated).toBe(false);
  });
  it("rejects missing projections and unexpanded supporting junctions with sanitized errors", async () => {
    for (const row of [
      { ...articleWithEvidence, sources: undefined },
      { ...articleWithEvidence, documents: [document.id] },
      { ...articleWithEvidence, authors: [{ authors_id: author.id }] }
    ]) {
      read.mockResolvedValueOnce([row]);
      await expect(articles.get(articleWithEvidence.id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
  });
});

it("preserves missing article bodies as null despite available title and summary metadata", async () => {
  read.mockResolvedValue([{ ...articleWithEvidence, body: null }]);
  const { record } = await articles.get(articleWithEvidence.id);
  expect(record.content).toBeNull();
  expect(record.content_warnings).toContain("No content document is available.");
});
