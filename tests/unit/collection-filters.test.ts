import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  booleanFilter,
  defineCollectionFilters,
  exactTextFilter,
  taxonomyFilter,
  taxonomyFilters
} from "../../server/utils/taxonomy/collection-filters";

const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../../server/utils/taxonomy/read-taxonomy", () => ({ readTaxonomy: read }));

beforeEach(() => {
  read.mockReset();
});

describe("collection filter building blocks", () => {
  it("derives input validation and discovery from the same definitions", async () => {
    const filters = defineCollectionFilters("examples", {
      title: exactTextFilter("Exact title"),
      english: booleanFilter("Language flag"),
      ...taxonomyFilters(["topics", "sectors"])
    });
    read.mockResolvedValue([]);
    expect(filters.filterSchema.parse({ title: " Title ", english: false })).toEqual({
      title: "Title",
      english: false
    });
    expect(filters.filterSchema.safeParse({ unknown: true }).success).toBe(false);
    expect(filters.filterSchema.safeParse({ topics: [] }).success).toBe(false);
    const result = await filters.filters();
    expect(result.filters.map((field) => field.name)).toEqual([
      "title",
      "english",
      "topics",
      "sectors"
    ]);
    expect(filters.filtersOutput.safeParse(result).success).toBe(true);
    expect(() => z.toJSONSchema(filters.filtersOutput)).not.toThrow();
    expect(read.mock.calls).toEqual([[["topics"]], [["sectors"]]]);
  });

  it("keeps the caller's field name when looking up a differently named taxonomy", async () => {
    const value = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Topic",
      source_url: null,
      description: null
    };
    read.mockResolvedValue([value]);
    const filters = defineCollectionFilters("examples", { subject: taxonomyFilter("topics") });
    expect((await filters.filters()).filters[0]).toMatchObject({
      name: "subject",
      type: "array",
      values: [value]
    });
    expect(filters.filterSchema.parse({ subject: [value.id] })).toEqual({ subject: [value.id] });
    expect(read).toHaveBeenCalledWith(["topics"]);
  });

  it("does not silently return partial filter discovery when a taxonomy fails", async () => {
    read.mockRejectedValue(new Error("Unavailable"));
    const filters = defineCollectionFilters("examples", { ...taxonomyFilters(["topics"]) });
    await expect(filters.filters()).rejects.toThrow("Unavailable");
  });
});
