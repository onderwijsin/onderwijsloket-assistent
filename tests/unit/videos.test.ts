import { mediaResourceContent } from "../../server/utils/content/media-resource";
import { beforeEach, it, expect, vi } from "vitest";
import { z } from "zod";
import videos from "../../server/collections/videos";
import { videoRecord, videoId, mediaId, mediaTaxonomyId } from "../fixtures/podcasts-and-videos";
import { listResources } from "../../server/utils/resources/catalogue";
import { serveResource } from "../../server/utils/resources/read";
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
      ...videoRecord,
      status: "draft",
      last_sync: "secret",
      transcript_raw: { secret: "processing" },
      user_updated: "private"
    }
  ]);
  const { record } = await videos.get(videoId);
  expect(record.id).toBe(videoId);
  expect(record.content_warnings).toEqual([]);
  expect(
    JSON.stringify([record, videos.resourceMetadata!(record), read.mock.calls[0]![0]().params])
  ).not.toMatch(/last_sync|private-host|transcript_raw|user_updated|status.*published/);
  expect(JSON.stringify(read.mock.calls[0]![0]().params.filter)).not.toContain("status");
  expect(record).not.toHaveProperty("editor_nodes");
  expect(record.profiles[0]?.first_name).toBe("Sam");
  expect(record.video?.id).toBe(mediaId);
  expect(record.publication_date).toContain("2999");
  expect(record.chapters?.map((x) => x.time)).toEqual([0, 60]);
  expect(record.transcript_string).toBe(videoRecord.transcript_string);
  expect(mediaResourceContent(record)).toContain("## Transcript");
  expect(videos.resourceMetadata!(record)).not.toHaveProperty("transcript_string");
});
it("translates source filters, stable pagination and junction targets without fetching bodies or transcripts", async () => {
  read.mockResolvedValue([videoRecord, videoRecord]);
  const result = await videos.list({
    filters: { profiles: ["550e8400-e29b-41d4-a716-446655440066"], sectors: [mediaTaxonomyId] },
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
});
it("preserves nullable documents and missing relationships without fabricating content", async () => {
  read.mockResolvedValue([
    {
      ...videoRecord,
      body: null,
      transcript_string: null,
      transcript_string_with_speakers: null,
      video: null,
      chapters: null
    }
  ]);
  const { record } = await videos.get(videoId);
  expect(record.content).toBeNull();
  expect(record.transcript_string).toBeNull();
  expect(mediaResourceContent(record)).toContain("No transcript is available.");
  expect(mediaResourceContent(record)).toContain("No body content is available.");
});
it("reports bounded and unavailable related records independently of body traversal", async () => {
  read.mockResolvedValue([
    {
      ...videoRecord,
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
  const { record } = await videos.get(videoId);
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
  await expect(videos.get(videoId)).rejects.not.toThrow("provider secret");
  await expect(videos.get(videoId)).rejects.toThrow("NOT_FOUND");
  await expect(videos.get(videoId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  expect(videos.listInput.safeParse({ filters: { arbitrary: true } }).success).toBe(false);
});
it("advertises portable resource contracts and descriptor-only catalogue queries", async () => {
  for (const schema of [
    videos.listInput,
    videos.getOutput,
    videos.searchInput,
    videos.searchOutput,
    videos.filtersOutput
  ])
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  expect(videos.resources).toEqual([
    { uri_template: "onderwijsloket://videos/{id}", mime_type: "text/markdown" }
  ]);
  read.mockResolvedValueOnce([{ id: videoId, title: videoRecord.title }]).mockResolvedValueOnce([]);
  expect((await listResources(videos)()).resources[0]?.name).toBe(videoId);
  expect(read.mock.calls[0]![0]().params.fields).toEqual(["id", "title", "date_updated"]);
  read.mockResolvedValue([videoRecord]);
  const handler = serveResource({
    name: videos.name,
    id: videos.getInput.shape.id,
    get: videos.get,
    content: mediaResourceContent,
    metadata: videos.resourceMetadata
  });
  const result = await handler(new URL(`onderwijsloket://videos/${videoId}`), { id: videoId });
  expect(result.contents[0]!.text).toContain("An education conversation.");
});
it("keeps search projections lightweight and facets restricted to verified index names", async () => {
  search.mockResolvedValue({
    hits: [{ ...videoRecord, objectID: videoId }],
    nbHits: 1,
    nbPages: 1,
    facets: Object.fromEntries(
      [
        "audiences.title",
        "phases.title",
        "sectors.title",
        "roles.name",
        "topics.name",
        "tracks.name"
      ].map((name) => [name, { Teaching: 1 }])
    )
  });
  const result = await videos.search({ filters: { "sectors.title": ["Teaching"] } });
  expect(result.records[0]?.id).toBe(videoId);
  expect(result.records[0]).not.toHaveProperty("transcript_string");
  expect(result.records[0]).not.toHaveProperty("body");
  expect(search.mock.calls.at(-1)![0].searchParams.attributesToRetrieve).not.toContain(
    "transcript_string"
  );
  expect((await videos.facets({})).facets).toHaveLength(6);
  expect(videos.searchInput.safeParse({ filters: { "hosts.email": ["secret"] } }).success).toBe(
    false
  );
  search.mockRejectedValueOnce(new Error("provider secret"));
  await expect(videos.search({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
});

it("rejects malformed chapter offsets without leaking source errors", async () => {
  read.mockResolvedValue([{ ...videoRecord, chapters: [{ label: "Invalid", time: -1 }] }]);
  await expect(videos.get(videoId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
});
