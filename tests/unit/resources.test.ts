import { describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  describeResource,
  resourceUri,
  listResources,
  serveResource
} from "../../server/utils/resources";

const record = { id: "example-id", title: "Title", description: "Description" };

describe("collection-independent resource descriptors", () => {
  it("builds resource links for different collections without fetching documents", () => {
    expect(resourceUri("articles", record.id)).toBe("onderwijsloket://articles/example-id");
    expect(describeResource("examples", record)).toEqual({
      uri: "onderwijsloket://examples/example-id",
      name: record.id,
      title: record.title,
      description: record.description,
      mimeType: "text/markdown"
    });
  });

  it("adds valid source update annotations and omits unknown dates", () => {
    expect(
      describeResource("examples", { ...record, date_updated: "2026-10-19T12:00:00Z" }).annotations
    ).toEqual({ lastModified: "2026-10-19T12:00:00.000Z" });
    expect(describeResource("examples", { ...record, date_updated: "invalid" })).not.toHaveProperty(
      "annotations"
    );
    expect(describeResource("examples", { ...record, date_updated: null })).not.toHaveProperty(
      "annotations"
    );
  });
});

describe("reusable resource callbacks", () => {
  const id = "00f81660-a2e4-48af-b8d7-98ce338de447";
  const uri = new URL(`onderwijsloket://examples/${id}`);

  it("lists every summary page under the supplied collection name", async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce({ records: [{ ...record, id }], has_more: true })
      .mockResolvedValueOnce({ records: [{ ...record, id: "second" }], has_more: false });
    const result = await listResources({ name: "examples", list })();
    expect(result.resources.map((item) => item.uri)).toEqual([
      uri.toString(),
      "onderwijsloket://examples/second"
    ]);
    expect(list.mock.calls).toEqual([[{ page: 1, page_size: 25 }], [{ page: 2, page_size: 25 }]]);
  });

  it("returns an empty catalogue and does not silently return partial catalogues on failure", async () => {
    const list = vi.fn().mockResolvedValueOnce({ records: [], has_more: false });
    expect(await listResources({ name: "examples", list })()).toEqual({ resources: [] });
    list
      .mockResolvedValueOnce({ records: [record], has_more: true })
      .mockRejectedValueOnce(new Error("provider secret"));
    await expect(listResources({ name: "examples", list })()).rejects.toMatchObject({
      code: -32603,
      message: expect.not.stringContaining("provider secret")
    });
  });

  it("serves the existing Markdown body using collection-provided metadata", async () => {
    const document = { id, content: "# Body\n\nFull content", title: "An example" };
    const get = vi.fn(async () => ({ record: document }));
    const handler = serveResource({
      name: "examples",
      get,
      metadata: (value) => ({ title: value.title })
    });
    const result = await handler(uri, { id });
    expect(get).toHaveBeenCalledWith(id);
    const resource = result.contents[0]!;
    expect(resource.uri).toBe(uri.toString());
    expect(resource.mimeType).toBe("text/markdown");
    const end = resource.text.indexOf("\n---\n", 4);
    expect(parse(resource.text.slice(4, end))).toEqual({ title: document.title });
    expect(resource.text.endsWith(document.content)).toBe(true);
  });

  it("validates IDs before fetching and preserves safe protocol error semantics", async () => {
    const get = vi.fn<() => Promise<{ record: { content: string } }>>();
    const handler = serveResource({ name: "examples", get });
    for (const invalid of ["invalid", [id]]) {
      await expect(handler(uri, { id: invalid })).rejects.toMatchObject({ code: -32602 });
    }
    expect(get).not.toHaveBeenCalled();
    get
      .mockRejectedValueOnce({ statusCode: 404 })
      .mockRejectedValueOnce(new Error("provider secret"));
    await expect(handler(uri, { id })).rejects.toMatchObject({
      code: -32602,
      message: expect.stringContaining("NOT_FOUND")
    });
    await expect(handler(uri, { id })).rejects.toMatchObject({
      code: -32603,
      message: expect.not.stringContaining("provider secret")
    });
  });
});
