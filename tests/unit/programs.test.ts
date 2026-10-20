import programs, { programResourceContent } from "../../server/collections/programs";
import {
  institutionRecord,
  institutionId,
  secondInstitutionId,
  programRecord,
  programId,
  programFormRecord,
  locationId,
  trackId
} from "../fixtures/institutions-and-programs";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
const { read, search } = vi.hoisted(() => ({ read: vi.fn(), search: vi.fn() }));
vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: read }));
vi.mock("../../server/utils/search/algolia-client", () => ({
  useAlgoliaClient: () => ({ searchSingleIndex: search })
}));
vi.mock("nitropack/runtime", () => ({
  cachedFunction: (fn: unknown) => fn,
  defineCachedFunction: (fn: unknown) => fn,
  useRuntimeConfig: () => ({
    public: { directus: { assetBaseUrl: "https://assets.example.test" } }
  })
}));
beforeEach(() => {
  read.mockReset();
  search.mockReset();
});

describe("program structure and variants", () => {
  it("preserves multiple providers, native degree labels, codes and a single location without fabricating program text", async () => {
    read.mockResolvedValue([programRecord]);
    const { record } = await programs.get(programId);
    expect(record.degrees).toEqual(["Bachelor of Education"]);
    expect(record).toMatchObject({
      croho: "00123",
      crebo: "00045",
      vendor: "onderwijsloket"
    });
    expect(
      record.educational_institutions.map((provider) => [provider.id, provider.vendor])
    ).toEqual([
      [institutionId, "hovi"],
      [secondInstitutionId, "kiesmbo"]
    ]);
    expect(record.location?.id).toBe(locationId);
    expect(record.program_forms.map((form) => form.description)).toEqual([
      "Part-time pathway.",
      "Full-time pathway."
    ]);
    expect(record.program_forms[1]?.track).toBeNull();
    expect(record).not.toHaveProperty("content");
    expect(record).not.toHaveProperty("description");
    expect(JSON.stringify(record)).not.toMatch(
      /private-source-id|private-study-number|internal@example|reviewers|status/
    );
    expect(record.content_warnings).toEqual([]);
    const query = read.mock.calls[0]![0]().params;
    expect(query.deep.program_forms).toEqual({ _limit: 101, _sort: ["sort", "id"] });
    expect(JSON.stringify(query)).not.toMatch(/status|reviewed_by|hovi_id|study_number/);
  });
  it("excludes synchronization bookkeeping from all nested outputs and resource metadata", async () => {
    const withSync = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(withSync);
      if (value && typeof value === "object")
        return {
          ...Object.fromEntries(
            Object.entries(value).map(([key, child]) => [key, withSync(child)])
          ),
          last_sync: "private-sync-marker"
        };
      return value;
    };
    read.mockResolvedValue([withSync(programRecord)]);
    const { record } = await programs.get(programId);
    for (const value of [
      record,
      programs.resourceMetadata!(record),
      z.toJSONSchema(programs.getOutput),
      read.mock.calls[0]![0]().params
    ]) {
      expect(JSON.stringify(value)).not.toMatch(/last_sync|private-sync-marker/);
    }
  });
  it("keeps form sections and metadata distinct in its Markdown resource", async () => {
    read.mockResolvedValue([programRecord]);
    const { record } = await programs.get(programId);
    const markdown = programResourceContent(record);
    expect(markdown).toContain("CROHO: 00123");
    expect(markdown).toContain("## Providers");
    expect(markdown).toContain("## Part-time\n\nPart-time pathway.");
    expect(markdown).toContain("## Program form 2\n\nFull-time pathway.");
    const metadata = programs.resourceMetadata!(record);
    expect(metadata.program_forms).toHaveLength(2);
    expect(JSON.stringify(metadata)).not.toContain("Part-time pathway.");
  });
  it("maps source enums, registry codes and relation IDs while omitting form descriptions from lists", async () => {
    read.mockResolvedValue([programRecord, programRecord]);
    const result = await programs.list({
      page: 2,
      page_size: 1,
      filters: {
        croho: "00123",
        crebo: "00045",
        type: "croho_program",
        level: "bachelor",
        financing: "government",
        vendor: "onderwijsloket",
        educational_institutions: [institutionId],
        location: locationId,
        school_subjects: [trackId]
      }
    });
    expect(result.has_more).toBe(true);
    expect(result.records[0]).not.toHaveProperty("program_forms");
    const query = read.mock.calls[0]![0]().params;
    expect(query).toMatchObject({
      limit: 2,
      offset: 1,
      filter: {
        croho: { _eq: "00123" },
        financing: { _eq: "government" },
        educational_institutions: { educational_institutions_id: { id: { _in: [institutionId] } } },
        school_subjects: { school_subjects_id: { id: { _in: [trackId] } } },
        location: { id: { _eq: locationId } }
      }
    });
    expect(JSON.stringify(query.fields)).not.toContain("program_forms");
    expect(programs.filterSchema.safeParse({ degrees: ["b_ed"] }).success).toBe(false);
    expect(programs.filterSchema.safeParse({ location: [locationId] }).success).toBe(false);
    expect(programs.filterSchema.safeParse({ level: "university" }).success).toBe(false);
  });
  it("omits orphan and mismatched form parents with warnings rather than attaching them to a program", async () => {
    read.mockResolvedValue([
      {
        ...programRecord,
        program_forms: [
          programFormRecord,
          { ...programFormRecord, program_id: null },
          { ...programFormRecord, program_id: institutionId }
        ]
      }
    ]);
    const { record } = await programs.get(programId);
    expect(record.program_forms).toHaveLength(1);
    expect(record.content_warnings).toContain(
      "Program forms with missing or mismatched parent IDs were omitted."
    );
  });
  it("bounds variant and provider relations independently of Markdown traversal limits", async () => {
    read.mockResolvedValue([
      {
        ...programRecord,
        program_forms: Array.from({ length: 101 }, () => programFormRecord),
        educational_institutions: Array.from({ length: 101 }, () => ({
          educational_institutions_id: institutionRecord
        }))
      }
    ]);
    const { record } = await programs.get(programId);
    expect(record.program_forms).toHaveLength(100);
    expect(record.educational_institutions).toHaveLength(100);
    expect(record.relations_truncated).toEqual(["educational_institutions", "program_forms"]);
    expect(record.truncated).toBe(false);
  });
  it("accepts the live associate level missing from the generated union", async () => {
    read.mockResolvedValue([{ ...programRecord, level: "associate" }]);
    expect((await programs.list()).records[0]?.level).toBe("associate");
    expect(programs.filterSchema.safeParse({ level: "associate" }).success).toBe(true);
  });
  it("retains null location/degrees and reports missing form descriptions and unsupported relation nodes", async () => {
    read.mockResolvedValue([
      {
        ...programRecord,
        location: null,
        degrees: null,
        educational_institutions: [{ educational_institutions_id: null }],
        program_forms: [
          { ...programFormRecord, description: null, url: "javascript:alert(1)" },
          {
            ...programFormRecord,
            id: "550e8400-e29b-41d4-a716-446655440037",
            description: {
              type: "doc",
              content: [{ type: "relation-block", attrs: { id: "missing", collection: "buttons" } }]
            }
          }
        ]
      }
    ]);
    const { record } = await programs.get(programId);
    expect(record.location).toBeNull();
    expect(record.degrees).toBeNull();
    expect(record.program_forms[0]?.content_warnings).toContain(
      "No content document is available."
    );
    expect(record.program_forms[0]?.description).toBeNull();
    expect(programResourceContent(record)).toContain("> **Notice:** No body content is available.");
    expect(record.program_forms[0]?.url).toBeNull();
    expect(record.program_forms[1]?.content_warnings.length).toBeGreaterThan(0);
    expect(record.content_warnings.join()).toContain("program_forms.");
  });
  it("discovers program provider and location IDs through real lookup tools without a standalone location tool", async () => {
    read.mockResolvedValue([]);
    const result = await programs.filters();
    expect(result.filters.find((field) => field.name === "location")).toMatchObject({
      type: "string",
      operator: "eq",
      lookup: { collection: "programs", tool: "list_programs", path: "location.id" }
    });
    expect(result.filters.find((field) => field.name === "educational_institutions")).toMatchObject(
      { lookup: { collection: "educational_institutions", tool: "list_educational_institutions" } }
    );
    expect(result.filters.some((field) => field.name === "degrees")).toBe(false);
  });
});

describe("program errors and search", () => {
  it("sanitizes source errors, rejects malformed expansions and distinguishes missing records", async () => {
    for (const [collection, id, row] of [
      [programs, programId, { ...programRecord, program_forms: [programFormRecord.id] }]
    ] as const) {
      read.mockResolvedValueOnce([row]);
      await expect(collection.get(id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
      read.mockRejectedValueOnce(new Error("provider secret"));
      await expect(collection.get(id)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
      read.mockResolvedValueOnce([]);
      await expect(collection.get(id)).rejects.toThrow("NOT_FOUND");
      read.mockClear();
      await expect(collection.get("bad-id")).rejects.toThrow();
      expect(read).not.toHaveBeenCalled();
    }
    read.mockRejectedValueOnce(new Error("provider secret"));
    await expect(programs.filters()).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  });
  it("uses verified plural degrees and singular track facet paths with flattened provider metadata", async () => {
    search.mockResolvedValueOnce({ facets: { degrees: { "Bachelor of Education": 1 } } });
    search.mockResolvedValueOnce({
      hits: [
        {
          ...programRecord,
          objectID: programId,
          educational_institutions: programRecord.educational_institutions.map(
            (row) => row.educational_institutions_id
          )
        }
      ],
      nbHits: 1,
      nbPages: 1
    });
    const result = await programs.search({ filters: { degrees: ["Bachelor of Education"] } });
    expect(result.records[0]?.degrees).toEqual(["Bachelor of Education"]);
    expect(result.records[0]?.educational_institutions).toHaveLength(2);
    expect(result.records[0]?.educational_institutions[0]).not.toHaveProperty("vendor");
    expect(result.records[0]).not.toHaveProperty("program_forms");
    expect(
      programs.searchInput.safeParse({
        collection: "programs",
        filters: { "program_forms.track.name": ["Part-time"] }
      }).success
    ).toBe(true);
    for (const filters of [
      { degree: ["b_ed"] },
      { "program_forms.tracks.name": ["Part-time"] },
      { vendor: ["hovi"] }
    ])
      expect(programs.searchInput.safeParse({ collection: "programs", filters }).success).toBe(
        false
      );
  });
  it("exports portable schemas and actual resource templates for the collection", () => {
    for (const collection of [programs]) {
      for (const schema of [
        collection.listOutput,
        collection.getOutput,
        collection.searchOutput,
        collection.filtersOutput
      ])
        expect(() => z.toJSONSchema(schema)).not.toThrow();
      expect(collection.metadata.resources).toEqual([
        { uri_template: `onderwijsloket://${collection.name}/{id}`, mime_type: "text/markdown" }
      ]);
    }
  });
});
