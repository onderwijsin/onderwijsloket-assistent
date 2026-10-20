import { beforeEach, it, expect, vi } from "vitest";
import { z } from "zod";
import shows from "../../server/collections/podcast-shows";
import {
  showRecord,
  showId,
  hostId,
  mediaId,
  mediaTaxonomyId
} from "../fixtures/podcasts-and-videos";
import { listResources, serveResource } from "../../server/utils/resources";
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
it("retains native attribution, source-returned visibility and safe public media without internal metadata", async () => {
  read.mockResolvedValue([
    {
      ...showRecord,
      status: "draft",
      last_sync: "secret",
      transcript_raw: { secret: "processing" },
      user_updated: "private"
    }
  ]);
  const { record } = await shows.get(showId);
  expect(record.id).toBe(showId);
  expect(record.content_warnings).toEqual([]);
  expect(
    JSON.stringify([record, shows.resourceMetadata!(record), read.mock.calls[0]![0]().params])
  ).not.toMatch(/last_sync|private-host|transcript_raw|user_updated|status.*published/);
  expect(JSON.stringify(read.mock.calls[0]![0]().params.filter)).not.toContain("status");
  expect(record).not.toHaveProperty("editor_nodes");
  expect(record.hosts[0]?.id).toBe(hostId);
  expect(record.seasons[0]?.show_id).toBe(showId);
  expect(record.trailer?.id).toBe(mediaId);
  expect(record.description).toContain("An education conversation.");
});
it("translates source filters, stable pagination and junction targets without fetching bodies or transcripts", async () => {
  read.mockResolvedValue([showRecord, showRecord]);
  const result = await shows.list({
    filters: {
      title: "Education conversations",
      podcast_status: "planned",
      hosts: [hostId],
      sectors: [mediaTaxonomyId]
    },
    page: 2,
    page_size: 1
  });
  expect(result.has_more).toBe(true);
  expect(result.records).toHaveLength(1);
  const query = read.mock.calls[0]![0]().params;
  expect(query).toMatchObject({ limit: 2, offset: 1 });
  expect(query.filter.sectors).toEqual({ sectors_id: { id: { _in: [mediaTaxonomyId] } } });
  expect(JSON.stringify(query.fields)).not.toMatch(/transcript|speaker_map|editor_nodes/);
  expect(query.fields).not.toContain("body");
  expect(result.records[0]).not.toHaveProperty("content");
  expect(query.filter.hosts).toEqual({ podcast_hosts_id: { id: { _in: [hostId] } } });
  expect(query.fields).not.toContain("description");
  expect(query.fields).not.toHaveProperty("seasons");
});
it("preserves nullable documents and missing relationships without fabricating content", async () => {
  read.mockResolvedValue([
    {
      ...showRecord,
      description: null,
      trailer: null,
      seasons: [{ ...showRecord.seasons[0], show: { id: mediaId } }]
    }
  ]);
  const { record } = await shows.get(showId);
  expect(record.description).toBeNull();
  expect(record.trailer).toBeNull();
  expect(record.seasons).toEqual([]);
  expect(record.content_warnings.join()).toContain("mismatched show");
});
it("reports bounded and unavailable related records independently of body traversal", async () => {
  read.mockResolvedValue([
    {
      ...showRecord,
      sectors: [
        { sectors_id: null },
        ...Array.from({ length: 100 }, () => ({
          sectors_id: {
            id: mediaTaxonomyId,
            title: "Teaching",
            slug: "teaching",
            description: null
          }
        }))
      ]
    }
  ]);
  const { record } = await shows.get(showId);
  expect(record.sectors).toHaveLength(99);
  expect(record.relations_truncated).toContain("sectors");
  expect(record.truncated).toBe(false);
  expect(record.content_warnings.join()).toContain("Unavailable related record");
});
it("sanitizes provider, missing and malformed record failures", async () => {
  read
    .mockRejectedValueOnce(new Error("provider secret"))
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ id: "bad" }]);
  await expect(shows.get(showId)).rejects.not.toThrow("provider secret");
  await expect(shows.get(showId)).rejects.toThrow("NOT_FOUND");
  await expect(shows.get(showId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  expect(shows.listInput.safeParse({ filters: { arbitrary: true } }).success).toBe(false);
});
it("advertises portable resource contracts and descriptor-only catalogue queries", async () => {
  for (const schema of [
    shows.listInput,
    shows.getOutput,
    shows.searchInput,
    shows.searchOutput,
    shows.filtersOutput
  ])
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  expect(shows.resources).toEqual([
    { uri_template: "onderwijsloket://podcast_shows/{id}", mime_type: "text/markdown" }
  ]);
  read.mockResolvedValueOnce([{ id: showId, title: showRecord.title }]).mockResolvedValueOnce([]);
  expect((await listResources(shows)()).resources[0]?.name).toBe(showId);
  expect(read.mock.calls[0]![0]().params.fields).toEqual(["id", "title", "date_updated"]);
  read.mockResolvedValue([showRecord]);
  const handler = serveResource({
    name: shows.name,
    id: shows.getInput.shape.id,
    get: shows.get,
    content: (record) => record.description,
    metadata: shows.resourceMetadata
  });
  const result = await handler(new URL(`onderwijsloket://podcast_shows/${showId}`), { id: showId });
  expect(result.contents[0]!.text).toContain("An education conversation.");
});
it("keeps search projections lightweight and facets restricted to verified index names", async () => {
  search.mockResolvedValue({
    hits: [{ ...showRecord, objectID: showId }],
    nbHits: 1,
    nbPages: 1,
    facets: Object.fromEntries(
      ["audiences.title", "phases.title", "sectors.title"].map((name) => [name, { Teaching: 1 }])
    )
  });
  const result = await shows.search({ filters: { "sectors.title": ["Teaching"] } });
  expect(result.records[0]?.id).toBe(showId);
  expect(result.records[0]).not.toHaveProperty("transcript_string");
  expect(result.records[0]).not.toHaveProperty("body");
  expect(search.mock.calls.at(-1)![0].searchParams.attributesToRetrieve).not.toContain(
    "transcript_string"
  );
  expect((await shows.facets({})).facets).toHaveLength(3);
  expect(shows.searchInput.safeParse({ filters: { "hosts.email": ["secret"] } }).success).toBe(
    false
  );
  search.mockRejectedValueOnce(new Error("provider secret"));
  await expect(shows.search({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
});
