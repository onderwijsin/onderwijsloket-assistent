import { fileURLToPath } from "node:url";
import { fetch, setup } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

/** Inspect the serialized schemas, including nested items and union branches. */
function assertSingleTypeSchemas(value: unknown): void {
  if (!value || typeof value !== "object") return;
  if ("type" in value) expect(Array.isArray(value.type)).toBe(false);
  for (const child of Object.values(value)) assertSingleTypeSchemas(child);
}

describe("application", async () => {
  await setup({
    rootDir: fileURLToPath(new URL("../../", import.meta.url)),
    dev: false,
    build: true,
    server: true,
    browser: false,
    setupTimeout: 180_000,
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

  it("exposes only the five Directus tools over MCP", async () => {
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
      "get_filters",
      "get_record",
      "list_collections",
      "list_records"
    ]);
  });

  it("calls catalogue tools and rejects unknown collections through MCP", async () => {
    async function call(name: string, args: Record<string, unknown>) {
      const response = await fetch("/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: { name, arguments: args }
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
    const catalogue = await call("list_collections", {});
    expect(
      catalogue.result.structuredContent.collections.map((item: { name: string }) => item.name)
    ).toEqual(["articles"]);
    expect(catalogue.result.structuredContent.collections[0].capabilities).toMatchObject({
      list: true,
      get: true,
      filters: true,
      search: false,
      facets: false
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
});
