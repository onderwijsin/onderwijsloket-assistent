import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { z } from "zod";
import { createFaqCollection } from "../fixtures/faq-collection";
import { createCollectionRegistry } from "../../server/utils/collections/registry";
import { toolResult } from "../../server/utils/tool-result";
import articles from "../../server/collections/articles";

vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn
}));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: vi.fn() }));
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));

/** Real SDK protocol checks complement the production HTTP suite without exposing the fixture. */
describe("heterogeneous MCP schemas", () => {
  it("advertises and executes FAQ-specific contracts alongside unchanged article IDs", async () => {
    const { collection: faq, get } = createFaqCollection();
    const registry = createCollectionRegistry([articles, faq]);
    const server = new McpServer({ name: "collection-fixture", version: "1.0.0" });
    server.registerTool(
      "get_faq",
      {
        inputSchema: faq.getInput.omit({ collection: true }),
        outputSchema: faq.getOutput
      },
      async ({ id }) => toolResult(await faq.get(id))
    );
    server.registerTool(
      "list_faqs",
      {
        inputSchema: faq.listInput.omit({ collection: true }),
        outputSchema: faq.listOutput
      },
      async (args) => toolResult(await faq.list(args))
    );
    server.registerTool(
      "search_faqs",
      {
        inputSchema: faq.searchInput.omit({ collection: true }),
        outputSchema: faq.searchOutput
      },
      async (args) => toolResult(await faq.search(args))
    );
    server.registerTool(
      "get_article",
      {
        inputSchema: articles.getInput.omit({ collection: true }),
        outputSchema: articles.getOutput
      },
      async ({ id }) => toolResult(await articles.get(id))
    );
    server.registerTool(
      "describe_collection",
      {
        inputSchema: registry.collectionInput,
        outputSchema: registry.metadataSchema
      },
      async ({ collection }) =>
        toolResult(registry.metadataSchema.parse(registry.resolve(collection).metadata))
    );
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    try {
      await server.connect(serverTransport);
      await client.connect(clientTransport);
      const { tools } = await client.listTools();
      const getFaq = tools.find(({ name }) => name === "get_faq")!;
      expect(getFaq.inputSchema.properties).toEqual({
        id: expect.objectContaining({ type: "string", pattern: "^faq-\\d+$" })
      });
      const getArticle = tools.find(({ name }) => name === "get_article")!;
      expect(getArticle.inputSchema.properties?.id).toMatchObject({ format: "uuid" });
      const searchFaq = tools.find(({ name }) => name === "search_faqs")!;
      expect(JSON.stringify(searchFaq.outputSchema)).toContain('"question"');
      expect(JSON.stringify(searchFaq.outputSchema)).not.toContain('"slug"');
      expect(JSON.stringify(searchFaq.inputSchema)).not.toContain('"english"');
      for (const tool of tools) expect(tool.outputSchema?.type).toBe("object");
      const result = await client.callTool({ name: "get_faq", arguments: { id: "faq-1" } });
      expect(result.isError).not.toBe(true);
      expect(faq.getOutput.safeParse(result.structuredContent).success).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify(result.structuredContent) }
      ]);
      const list = await client.callTool({
        name: "list_faqs",
        arguments: { filters: { english: false } }
      });
      expect(faq.listOutput.safeParse(list.structuredContent).success).toBe(true);
      search.mockResolvedValue({
        hits: [{ objectID: "faq-1", question: "Can I teach?" }],
        nbHits: 1,
        nbPages: 1
      });
      const found = await client.callTool({ name: "search_faqs", arguments: {} });
      expect(found.isError).not.toBe(true);
      expect(faq.searchOutput.safeParse(found.structuredContent).success).toBe(true);
      expect(found.content).toEqual([
        { type: "text", text: JSON.stringify(found.structuredContent) }
      ]);
      const invalid = await client.callTool({ name: "get_faq", arguments: { id: "invalid" } });
      expect(invalid.isError).toBe(true);
      const wrongFilter = await client.callTool({
        name: "list_faqs",
        arguments: { filters: { slug: "invalid" } }
      });
      expect(wrongFilter.isError).toBe(true);
      expect(get).toHaveBeenCalledTimes(1);
      const unknown = await client.callTool({
        name: "describe_collection",
        arguments: { collection: "routes" }
      });
      expect(unknown.isError).toBe(true);
      expect(z.toJSONSchema(faq.getOutput)).not.toHaveProperty("anyOf");
    } finally {
      await client.close();
      await server.close();
    }
  });
});
