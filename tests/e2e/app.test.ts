import { createAlgoliaFixture } from "../fixtures/algolia";
import { parse } from "yaml";
import { articleId, topicId, longBody, createDirectusFixture } from "../fixtures/directus";
import { fileURLToPath } from "node:url";
import { fetch, setup } from "@nuxt/test-utils/e2e";
import { afterAll, describe, expect, it } from "vitest";

/** Inspect the serialized schemas, including nested items and union branches. */
function assertSingleTypeSchemas(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if ("type" in value) expect(Array.isArray(value.type)).toBe(false);
  for (const child of Object.values(value)) assertSingleTypeSchemas(child);
}

/** Send protocol requests through the production MCP endpoint, accepting JSON and SSE replies. */
async function rpc(method: string, params: Record<string, unknown> = {}) {
  const response = await fetch("/mcp", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream"
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method,
      params
    })
  });
  const text = await response.text();
  const payload = text.startsWith("data:")
    ? text
        .split("\n")
        .find((line) => line.startsWith("data:"))!
        .slice(5)
    : text;
  return JSON.parse(payload);
}

/** Preserve the tool-call shorthand for the existing contract tests. */
function call(name: string, args: Record<string, unknown>) {
  return rpc("tools/call", { name, arguments: args });
}

describe("application", async () => {
  const directus = await createDirectusFixture();
  const algolia = await createAlgoliaFixture();
  afterAll(() => algolia.close());
  afterAll(() => directus.close());
  await setup({
    rootDir: fileURLToPath(new URL("../../", import.meta.url)),
    dev: false,
    build: true,
    server: true,
    browser: false,
    setupTimeout: 180_000,
    // Runtime overrides keep article calls local while retaining normal build-time schema setup.
    env: {
      NUXT_ALGOLIA_APPLICATION_ID: "fixture-app",
      NUXT_ALGOLIA_TOKEN: "fixture-algolia-token",
      NUXT_ALGOLIA_HOST: algolia.baseUrl,
      NUXT_DIRECTUS_CLIENT_BASE_URL: directus.baseUrl,
      NUXT_DIRECTUS_CLIENT_PROXY_TOKEN: "fixture-token",
      NUXT_PUBLIC_DIRECTUS_ASSET_BASE_URL: "https://assets.example.test"
    },
    nuxtConfig: {
      devtools: { enabled: false },
      nitro: { preset: "node-server" }
    }
  });

  it("serves the application HTML", async () => {
    const response = await fetch("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('id="__nuxt"');
  });

  it("exposes the seven collection tools over MCP", async () => {
    const response = await fetch("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    const payload = text.startsWith("data:")
      ? text
          .split("\n")
          .find((line) => line.startsWith("data:"))!
          .slice(5)
      : text;
    const result = JSON.parse(payload);
    // Check the wire contract: schema conversion must retain descriptions and output definitions.
    for (const tool of result.result.tools) {
      assertSingleTypeSchemas(tool.inputSchema);
      assertSingleTypeSchemas(tool.outputSchema);
      expect(tool.outputSchema?.type).toBe("object");
      expect(Object.keys(tool.outputSchema.properties).length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(40);
    }
    const listTool = result.result.tools.find(
      (tool: { name: string }) => tool.name === "list_records"
    );
    expect(listTool.inputSchema.properties.filters.properties.topics.description).toContain(
      "get_filters"
    );
    expect(listTool.inputSchema.properties.filters.properties.title.description).toContain("Exact");
    expect(listTool.inputSchema.properties.page.default).toBe(1);
    expect(result.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "describe_collection",
      "get_facets",
      "get_filters",
      "get_record",
      "list_collections",
      "list_records",
      "search_collection"
    ]);
  });

  it("keeps MCP guidance and schemas independent of infrastructure providers", async () => {
    const initialized = await rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "guidance-test", version: "1.0" }
    });
    const tools = await rpc("tools/list");
    const templates = await rpc("resources/templates/list");
    const catalogue = await call("list_collections", {});
    const description = await call("describe_collection", { collection: "articles" });
    for (const response of [initialized, tools, templates, catalogue, description]) {
      expect(JSON.stringify(response)).not.toMatch(/directus|algolia/i);
    }
  });

  it("calls catalogue tools and rejects unknown collections through MCP", async () => {
    const catalogue = await call("list_collections", {});
    expect(
      catalogue.result.structuredContent.collections.map((item: { name: string }) => item.name)
    ).toEqual(["articles"]);
    expect(catalogue.result.structuredContent.collections[0].capabilities).toMatchObject({
      list: true,
      get: true,
      filters: true,
      search: true,
      facets: true
    });
    const description = await call("describe_collection", { collection: "articles" });
    expect(description.result.structuredContent.filterable_fields).toEqual([
      "title",
      "slug",
      "english",
      "sectors",
      "qualifications",
      "audiences",
      "phases",
      "roles",
      "topics",
      "tracks"
    ]);
    const invalid = await call("describe_collection", { collection: "directus_users" });
    expect(invalid.result?.isError || invalid.error).toBeTruthy();
  });
  it("lists filtered pages through MCP and the real Directus HTTP client", async () => {
    const args = {
      collection: "articles",
      page_size: 1,
      filters: { english: false, topics: [topicId] }
    };
    const first = (await call("list_records", args)).result;
    expect(first.isError).not.toBe(true);
    expect(first.structuredContent).toMatchObject({ page: 1, page_size: 1, has_more: true });
    expect(first.structuredContent.records[0]).toMatchObject({
      title: "Alpha",
      topics: [{ id: topicId, title: "Career paths" }]
    });
    expect(first.structuredContent.records[0]).not.toHaveProperty("content");
    expect(JSON.parse(first.content[0].text)).toEqual(first.structuredContent);
    const second = (await call("list_records", { ...args, page: 2 })).result;
    expect(second.structuredContent).toMatchObject({
      page: 2,
      has_more: false,
      records: [{ title: "Beta" }]
    });
    const query = directus.requests.at(-1)!;
    expect(query.searchParams.get("offset")).toBe("1");
    expect(query.searchParams.get("limit")).toBe("2");
    expect(JSON.parse(query.searchParams.get("filter")!)).toEqual({
      english: { _eq: false },
      topics: { topics_id: { id: { _in: [topicId] } } }
    });
    expect(query.searchParams.get("fields")).not.toContain("body");
  });

  it("renders complete article Markdown and embedded relations through MCP", async () => {
    const result = (await call("get_record", { collection: "articles", id: articleId })).result;
    expect(result.isError).not.toBe(true);
    const record = result.structuredContent.record;
    expect(record.content).toContain("# Alpha\n\nAn introduction");
    expect(record.content).toContain(longBody.trim());
    expect(record.content.length).toBeGreaterThan(20000);
    expect(record.content).toContain("[Advice](<https://onderwijsloket.com/advies>)");
    expect(record.content).toContain("![Classroom](<https://assets.example.test/classroom-id>)");
    expect(record).toMatchObject({ content_warnings: [], truncated: false, date_updated: null });
    expect(record).not.toHaveProperty("editor_nodes");
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    expect(directus.requests.at(-1)!.searchParams.get("fields")).toContain("editor_nodes");
  });

  it("reports taxonomy failures, retries and caches successful dynamic filter discovery", async () => {
    directus.state.failingTaxonomy = "topics";
    try {
      const failed = (await call("get_filters", { collection: "articles" })).result;
      expect(failed.isError).toBe(true);
      expect(JSON.stringify(failed)).toContain("UPSTREAM_UNAVAILABLE");
      expect(JSON.stringify(failed)).not.toContain("fixture upstream secret");
    } finally {
      directus.state.failingTaxonomy = "";
    }
    const result = (await call("get_filters", { collection: "articles" })).result;
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent.filters).toHaveLength(10);
    expect(
      result.structuredContent.filters.find((field: { name: string }) => field.name === "topics")
    ).toMatchObject({ type: "array", values: [{ id: topicId, title: "Career paths" }] });
    const count = directus.requests.length;
    await call("get_filters", { collection: "articles" });
    expect(directus.requests).toHaveLength(count);
  });

  it("rejects invalid MCP arguments before making upstream requests", async () => {
    for (const [name, args] of [
      ["list_records", { collection: "articles", page_size: 26 }],
      ["list_records", { collection: "articles", filters: { english: "false" } }],
      ["get_record", { collection: "articles", id: "invalid" }]
    ] as const) {
      const count = directus.requests.length;
      const result = await call(name, args);
      expect(result.result?.isError || result.error).toBeTruthy();
      expect(directus.requests).toHaveLength(count);
    }
  });

  it("returns safe MCP errors for absent, unavailable and malformed records", async () => {
    const missing = (
      await call("get_record", {
        collection: "articles",
        id: "00f81660-a2e4-48af-b8d7-98ce338de999"
      })
    ).result;
    expect(missing.isError).toBe(true);
    expect(JSON.stringify(missing)).toContain("NOT_FOUND");
    for (const title of ["upstream-error", "upstream-invalid"]) {
      const result = (await call("list_records", { collection: "articles", filters: { title } }))
        .result;
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("UPSTREAM_UNAVAILABLE");
      expect(JSON.stringify(result)).not.toContain("fixture upstream secret");
    }
  });
  it("advertises the article resource template and resources capability", async () => {
    const initialized = await rpc("initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "resource-test", version: "1.0" }
    });
    expect(initialized.result.capabilities.resources).toBeDefined();
    const templates = await rpc("resources/templates/list");
    expect(templates.result.resourceTemplates).toEqual([
      expect.objectContaining({
        name: "articles",
        uriTemplate: "onderwijsloket://articles/{id}",
        mimeType: "text/markdown"
      })
    ]);
  });

  it("rejects invalid resource requests and returns sanitized protocol errors", async () => {
    for (const [method, params] of [
      ["resources/read", { uri: "onderwijsloket://articles/not-a-uuid" }],
      ["resources/read", { uri: "onderwijsloket://unknown/record" }]
    ] as const) {
      const count = directus.requests.length;
      expect((await rpc(method, params)).error.code).toBe(-32602);
      expect(directus.requests).toHaveLength(count);
    }
    const missing = await rpc("resources/read", {
      uri: "onderwijsloket://articles/00f81660-a2e4-48af-b8d7-98ce338de999"
    });
    expect(missing.error.message).toContain("NOT_FOUND");
    directus.state.articleResponse = "unavailable";
    try {
      const failed = await rpc("resources/read", {
        uri: "onderwijsloket://articles/00f81660-a2e4-48af-b8d7-98ce338de448"
      });
      expect(failed.error.code).toBe(-32603);
      expect(failed.error.message).toContain("UPSTREAM_UNAVAILABLE");
      expect(JSON.stringify(failed)).not.toContain("fixture upstream secret");
      const catalogue = await rpc("resources/list");
      expect(catalogue.error.code).toBe(-32603);
      expect(JSON.stringify(catalogue)).not.toContain("fixture upstream secret");
    } finally {
      directus.state.articleResponse = "";
    }
  });
  it("lists the full resource catalogue through the template, fetching summaries in batches", async () => {
    directus.state.extraArticles = 24;
    try {
      const count = directus.requests.length;
      const result = (await rpc("resources/list")).result;
      expect(result.resources).toHaveLength(27);
      expect(new Set(result.resources.map((item: { uri: string }) => item.uri)).size).toBe(27);
      expect(result.resources[0]).toMatchObject({
        uri: `onderwijsloket://articles/${articleId}`,
        title: "Alpha",
        mimeType: "text/markdown"
      });
      const requests = directus.requests.slice(count);
      expect(requests).toHaveLength(2);
      expect(requests.map((url) => url.searchParams.get("offset"))).toEqual(["0", "25"]);
      for (const url of requests) expect(url.searchParams.get("fields")).not.toContain("body");
      expect((await rpc("resources/list")).result.resources).toEqual(result.resources);
      expect(directus.requests).toHaveLength(count + 2);
    } finally {
      directus.state.extraArticles = 0;
    }
  });

  it("reads article resources with metadata and the same full Markdown returned by tools", async () => {
    const uri = `onderwijsloket://articles/${articleId}`;
    const readsBefore = directus.requests.length;
    const resource = (await rpc("resources/read", { uri })).result.contents[0];
    const tool = (await call("get_record", { collection: "articles", id: articleId })).result;
    expect(resource).toMatchObject({ uri, mimeType: "text/markdown" });
    // The earlier get_record warmed the same article cache used by resource reads.
    expect(directus.requests).toHaveLength(readsBefore);
    const end = resource.text.indexOf("\n---\n", 4);
    expect(parse(resource.text.slice(4, end))).toMatchObject({
      id: articleId,
      topics: ["Career paths"],
      truncated: false,
      content_warnings: []
    });
    expect(resource.text.endsWith(tool.structuredContent.record.content)).toBe(true);
    expect(resource.text.length).toBeGreaterThan(20000);
    expect(tool.content[1]).toMatchObject({
      type: "resource_link",
      uri,
      mimeType: "text/markdown"
    });
    const list = (await call("list_records", { collection: "articles", page_size: 1 })).result;
    expect(list.content[1]).toMatchObject({ type: "resource_link", uri });
  });

  it("discovers live index facets and searches lightweight records with query snippets", async () => {
    const facets = (await call("get_facets", { collection: "articles" })).result;
    expect(facets.isError).not.toBe(true);
    const requestsAfter = algolia.requests.length;
    const repeated = (await call("get_facets", { collection: "articles" })).result;
    expect(repeated.structuredContent).toEqual(facets.structuredContent);
    expect(algolia.requests).toHaveLength(requestsAfter);
    expect(facets.structuredContent).toMatchObject({ counts_are_exact: true });
    expect(facets.structuredContent.facets.map((facet: { name: string }) => facet.name)).toEqual([
      "english",
      "topics.name",
      "roles.name"
    ]);
    const result = (
      await call("search_collection", {
        collection: "articles",
        query: "classroom",
        page_size: 1,
        filters: { english: [false] }
      })
    ).result;
    expect(result.isError).not.toBe(true);
    expect(result.structuredContent).toMatchObject({
      total: 2,
      total_is_exact: true,
      page: 1,
      total_pages: 2,
      has_more: true
    });
    expect(result.structuredContent.records[0]).toMatchObject({
      id: articleId,
      title: "Alpha",
      snippet: {
        field: "bodyString",
        text: expect.stringContaining("**classroom**"),
        match_level: "full"
      }
    });
    expect(result.structuredContent.records[0]).not.toHaveProperty("bodyString");
    expect(result.structuredContent.records[0]).not.toHaveProperty("content");
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
    expect(result.content[1]).toMatchObject({
      type: "resource_link",
      uri: `onderwijsloket://articles/${articleId}`
    });
    expect(algolia.requests.at(-1)!.params).toMatchObject({
      page: 0,
      hitsPerPage: 1,
      facetFilters: [["english:false"]],
      attributesToSnippet: ["*:30"],
      analytics: false
    });
    expect(algolia.requests.at(-1)!.params.attributesToRetrieve).not.toContain("bodyString");
    const second = (
      await call("search_collection", {
        collection: "articles",
        query: "classroom",
        page_size: 1,
        page: 2,
        filters: { english: [false] }
      })
    ).result;
    expect(second.structuredContent).toMatchObject({
      page: 2,
      has_more: false,
      records: [{ title: "Beta" }]
    });
    expect(
      algolia.requests.filter(
        ({ params }) => params.hitsPerPage === 0 && params.maxValuesPerFacet === 1
      )
    ).toHaveLength(1);
  });

  it("supports browsing, facet-filtered counts, AND/OR selection and empty results", async () => {
    const filters = { "topics.name": ["Salaris", "Career paths"], english: [false] };
    const browse = (await call("search_collection", { collection: "articles", filters })).result;
    expect(browse.structuredContent.records).toHaveLength(2);
    expect(
      browse.structuredContent.records.every(
        (record: { snippet: unknown }) => record.snippet === null
      )
    ).toBe(true);
    const facets = (
      await call("get_facets", { collection: "articles", filters, facets: ["topics.name"] })
    ).result;
    expect(facets.structuredContent.facets).toEqual([
      {
        name: "topics.name",
        values: [
          { value: "Career paths", count: 1 },
          { value: "Salaris", count: 1 }
        ]
      }
    ]);
    const empty = (await call("search_collection", { collection: "articles", query: "no-results" }))
      .result;
    expect(empty.structuredContent).toMatchObject({
      records: [],
      total: 0,
      total_pages: 0,
      has_more: false
    });
  });

  it("validates search boundaries and does not leak provider failures or private config", async () => {
    for (const [name, args] of [
      ["search_collection", { collection: "articles", page: 0 }],
      ["search_collection", { collection: "articles", filters: { unknown: ["value"] } }],
      ["get_facets", { collection: "articles", facets: ["unknown"] }]
    ] as const) {
      const failed = await call(name, args);
      expect(failed.result?.isError || failed.error).toBeTruthy();
    }
    for (const query of ["provider-error", "malformed"]) {
      const failed = (await call("search_collection", { collection: "articles", query })).result;
      expect(failed.isError).toBe(true);
      expect(JSON.stringify(failed)).toContain("UPSTREAM_UNAVAILABLE");
      expect(JSON.stringify(failed)).not.toContain("fixture Algolia secret");
      expect(JSON.stringify(failed)).not.toContain("fixture-algolia-token");
    }
    expect(await (await fetch("/")).text()).not.toContain("fixture-algolia-token");
  });
});
