import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineMcpCollection } from "../../server/utils/define-mcp-collection";

const id = "00f81660-a2e4-48af-b8d7-98ce338de447";

/** A second, deliberately small collection definition exercises the helper without article logic. */
function createCollection() {
  const summary = z.object({ id: z.uuid(), title: z.string() });
  const list = vi.fn(async () => ({ records: [{ id, title: "Example" }], has_more: false }));
  const get = vi.fn(async () => ({ id, title: "Example", content: "Body" }));
  const filters = vi.fn(async () => ({ values: ["Example"] }));
  const collection = defineMcpCollection({
    name: "articles",
    description: "Example collection",
    id: z.uuid(),
    operations: { list: "list_articles", get: "get_article" },
    summary,
    detail: summary.extend({ content: z.string().min(1) }),
    filterSchema: z.strictObject({ slug: z.string().optional() }),
    sorts: ["title", "-title"],
    filtersOutput: z.object({ values: z.array(z.string().min(1)) }),
    list,
    get,
    filters
  });
  return { collection, list, get, filters };
}

describe("defineMcpCollection", () => {
  it("derives discovery metadata from the definition rather than article-specific fields", () => {
    const { collection } = createCollection();
    expect(collection.metadata).toMatchObject({
      fields: ["id", "title"],
      detail_fields: ["content"],
      filterable_fields: ["slug"],
      capabilities: { list: true, get: true, filters: true, search: false, facets: false }
    });
    expect(collection.metadataSchema.parse(collection.metadata)).toEqual(collection.metadata);
  });

  it("applies defaults and keeps response timestamps separate from record data", async () => {
    const { collection, list, get } = createCollection();
    const result = await collection.list();
    expect(list).toHaveBeenCalledWith({
      collection: "articles",
      page: 1,
      page_size: 10,
      sort: "title"
    });
    expect(result).toMatchObject({ records: [{ id }], page: 1, page_size: 10, has_more: false });
    expect(z.iso.datetime().safeParse(result.retrieved_at).success).toBe(true);
    expect((await collection.get(id)).record).not.toHaveProperty("retrieved_at");
    expect(get).toHaveBeenCalledWith(id);
  });

  it("rejects invalid inputs before executing collection methods", async () => {
    const { collection, list, get } = createCollection();
    await expect(collection.list({ page: 0 })).rejects.toThrow();
    await expect(collection.list({ filters: { unknown: true } } as never)).rejects.toThrow();
    await expect(collection.get("not-an-id")).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
  });

  it("validates list, detail and filter results before they reach callers", async () => {
    const { collection, list, get, filters } = createCollection();
    list.mockResolvedValueOnce({ records: [{ id: "not-an-id", title: "Bad" }], has_more: false });
    await expect(collection.list()).rejects.toThrow();
    get.mockResolvedValueOnce({ id, title: "Example", content: "" });
    await expect(collection.get(id)).rejects.toThrow();
    filters.mockResolvedValueOnce({ values: [""] });
    await expect(collection.filters()).rejects.toThrow();
  });
  it("does not advertise or execute unconfigured search operations", async () => {
    const { collection } = createCollection();
    await expect(collection.search()).rejects.toMatchObject({ statusCode: 501 });
    await expect(collection.facets()).rejects.toMatchObject({ statusCode: 501 });
    expect(collection.metadata.capabilities).toMatchObject({ search: false, facets: false });
  });
});
