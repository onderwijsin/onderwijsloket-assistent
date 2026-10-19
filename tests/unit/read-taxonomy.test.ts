import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { read, entries } = vi.hoisted(() => ({
  read: vi.fn(),
  entries: new Map<string, unknown>()
}));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));
vi.mock("nitropack/runtime/internal/app", () => ({
  useNitroApp: () => ({ captureError: vi.fn() })
}));
vi.mock("nitropack/runtime/internal/storage", () => ({
  useStorage: () => ({
    getItem: async (key: string) => structuredClone(entries.get(key)),
    setItem: async (key: string, value: unknown) => {
      entries.set(key, structuredClone(value));
    }
  })
}));
vi.mock("nitropack/runtime", async () => {
  const { cachedFunction } = await import("nitropack/runtime/internal/cache");
  return { cachedFunction };
});

import { readTaxonomy } from "../../server/utils/taxonomy/read-taxonomy";

const id = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  entries.clear();
  read.mockReset();
  read.mockImplementation(async (command) => {
    const name = command().path.split("/").pop();
    const label = ["sectors", "phases", "audiences"].includes(name) ? "title" : "name";
    return [
      {
        id,
        [label]: name,
        ...(!["phases", "audiences"].includes(name) ? { slug: name } : {}),
        ...(name !== "audiences" ? { description: "Description" } : {})
      }
    ];
  });
});
afterEach(() => vi.useRealTimers());

describe("readTaxonomy", () => {
  it("reads all eight taxonomies by default and normalizes available fields", async () => {
    const result = await readTaxonomy();
    expect(result).toHaveLength(8);
    expect(result.find((value) => value.title === "school_subjects")).toEqual({
      id,
      title: "school_subjects",
      slug: "school_subjects",
      description: "Description"
    });
    expect(result.find((value) => value.title === "audiences")).toEqual({
      id,
      title: "audiences",
      slug: null,
      description: null
    });
    for (const [command] of read.mock.calls) {
      expect(command().params.limit).toBe(-1);
      expect(command().params).not.toHaveProperty("offset");
    }
  });
  it("reuses Nitro cache per collection across overlapping selections and expires after one minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T10:00:00Z"));
    await readTaxonomy(["topics"]);
    await readTaxonomy(["topics", "roles"]);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(59000);
    await readTaxonomy(["topics"]);
    expect(read).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(2000);
    read.mockResolvedValue([
      { id, name: "Updated topic", slug: "updated", description: "Updated" }
    ]);
    expect(await readTaxonomy(["topics"])).toEqual([
      { id, title: "Updated topic", slug: "updated", description: "Updated" }
    ]);
    expect(read).toHaveBeenCalledTimes(3);
  });
  it("deduplicates selections and treats an empty array as no collections", async () => {
    expect(await readTaxonomy([])).toEqual([]);
    expect(read).not.toHaveBeenCalled();
    await readTaxonomy(["topics", "topics"]);
    expect(read).toHaveBeenCalledTimes(1);
  });
  it("does not cache failures or turn them into empty data", async () => {
    read.mockRejectedValueOnce(new Error("upstream secret"));
    await expect(readTaxonomy(["topics"])).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect(await readTaxonomy(["topics"])).toHaveLength(1);
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("does not cache malformed responses and accepts a corrected retry", async () => {
    read.mockResolvedValueOnce([{ id, title: "Incorrect field for topics" }]);
    await expect(readTaxonomy(["topics"])).rejects.toThrow("UPSTREAM_UNAVAILABLE");
    expect(await readTaxonomy(["topics"])).toMatchObject([{ title: "topics" }]);
    expect(read).toHaveBeenCalledTimes(2);
  });
});
