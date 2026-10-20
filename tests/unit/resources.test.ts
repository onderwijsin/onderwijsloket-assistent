import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { parse } from "yaml";
import {
  describeResource,
  resourceUri,
  listResources,
  serveResource
} from "../../server/utils/resources";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));
beforeEach(() => {
  read.mockReset();
});

vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn
}));

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

  it("omits absent descriptor fields so cached catalogue metadata remains stable", () => {
    const descriptor = describeResource("faqs", { id: "faq-1", title: "Question?" });
    expect(descriptor).not.toHaveProperty("description");
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
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

  const collection = { name: "programs" as const, getInput: { shape: { id: z.string() } } };

  it("lists over 1500 records using root-only pages, tolerating a smaller source page cap", async () => {
    const records = Array.from({ length: 1501 }, (_, i) => ({
      id: String(i),
      title: `Program ${i}`
    }));
    read.mockImplementation(async (command) => {
      const query = command().params;
      expect(query.fields).toEqual(["id", "title", "date_updated"]);
      expect(query.limit).toBe(250);
      expect(query).not.toHaveProperty("deep");
      expect(query).not.toHaveProperty("filter");
      return records.slice(query.offset, query.offset + 100);
    });
    const result = await listResources(collection)();
    expect(result.resources).toHaveLength(1501);
    expect(new Set(result.resources.map((value) => value.uri)).size).toBe(1501);
    expect(read).toHaveBeenCalledTimes(17);
    expect(result.resources[0]).toMatchObject({ title: "Program 0", description: "" });
  });

  it("uses FAQ questions as descriptor labels", async () => {
    read.mockResolvedValueOnce([{ id: "faq-1", question: "Question?" }]).mockResolvedValueOnce([]);
    const result = await listResources({ ...collection, name: "faqs" })();
    expect(result.resources[0]?.title).toBe("Question?");
    expect(read.mock.calls[0]![0]().params.fields).toEqual(["id", "question", "date_updated"]);
  });

  it("serializes concurrent collection reads and releases the queue after failure", async () => {
    let active = 0;
    let peak = 0;
    read.mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await Promise.resolve();
      active--;
      return [];
    });
    await Promise.all([
      listResources(collection)(),
      listResources({ ...collection, name: "sectors" })()
    ]);
    expect(peak).toBe(1);
    read.mockRejectedValueOnce(new Error("provider secret"));
    await expect(listResources(collection)()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect(await listResources(collection)()).toEqual({ resources: [] });
  });

  it("rejects repeated pages and malformed rows without exposing provider details", async () => {
    read.mockResolvedValue([{ id: "same", title: "Title" }]);
    await expect(listResources(collection)()).rejects.toMatchObject({ code: -32603 });
    for (const row of [{ id: null, title: "Title" }, { id: "ok" }, { id: "ok", title: 12 }]) {
      read.mockResolvedValueOnce([row]);
      await expect(listResources(collection)()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    }
  });

  it("serves the existing Markdown body using collection-provided metadata", async () => {
    const document = { id, content: "# Body\n\nFull content", title: "An example" };
    const get = vi.fn(async () => ({ record: document }));
    const handler = serveResource({
      name: "examples",
      id: z.uuid(),
      content: (record) => record.content,
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

  it.each([null, "", "   "])(
    "adds a shared notice for absent body content (%j), preserving metadata",
    async (content) => {
      const handler = serveResource({
        name: "examples",
        id: z.uuid(),
        get: async () => ({ record: { title: "Metadata-only record", content } }),
        content: (record) => record.content,
        metadata: (record) => ({ title: record.title })
      });
      const result = await handler(uri, { id });
      expect(result.contents[0]!.text).toContain("> **Notice:** No body content is available.");
      expect(result.contents[0]!.text).toContain("title: Metadata-only record");
    }
  );

  it("uses the collection identity and content mappings without requiring article fields", async () => {
    const get = vi.fn(async () => ({ record: { question: "Question?", answer: "Answer." } }));
    const handler = serveResource({
      name: "faqs",
      id: z.literal("faq-1"),
      get,
      content: (record) => record.answer,
      metadata: (record) => ({ question: record.question })
    });
    const result = await handler(new URL("onderwijsloket://faqs/faq-1"), { id: "faq-1" });
    expect(result.contents[0]?.text).toContain("Answer.");
    expect(get).toHaveBeenCalledWith("faq-1");
    await expect(handler(uri, { id })).rejects.toMatchObject({ code: -32602 });
  });

  it("validates IDs before fetching and preserves safe protocol error semantics", async () => {
    const get = vi.fn<() => Promise<{ record: { content: string } }>>();
    const handler = serveResource({
      name: "examples",
      id: z.uuid(),
      content: (record) => record.content,
      get
    });
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
