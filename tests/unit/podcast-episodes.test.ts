import { beforeEach, it, expect, vi } from "vitest";
import { z } from "zod";
import episodes, { resourceBody } from "../../server/collections/podcast-episodes";
import {
  episodeRecord,
  episodeId,
  showId,
  seasonId,
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
      ...episodeRecord,
      status: "draft",
      last_sync: "secret",
      transcript_raw: { secret: "processing" },
      user_updated: "private"
    }
  ]);
  const { record } = await episodes.get(episodeId);
  expect(record.id).toBe(episodeId);
  expect(record.content_warnings).toEqual([]);
  expect(
    JSON.stringify([record, episodes.resourceMetadata!(record), read.mock.calls[0]![0]().params])
  ).not.toMatch(/last_sync|private-host|transcript_raw|user_updated|status.*published/);
  expect(JSON.stringify(read.mock.calls[0]![0]().params.filter)).not.toContain("status");
  expect(record).not.toHaveProperty("editor_nodes");
  expect(record.hosts[0]?.id).toBe(hostId);
  expect(record.guests[0]?.first_name).toBe("Sam");
  expect(record.season?.id).toBe(seasonId);
  expect(record.show?.id).toBe(showId);
  expect(record.audio?.url).toContain("/video/upload/");
  expect(record.episode_number).toBe(0);
  expect(record.duration).toBe(0);
  expect(record.publication_date).toContain("2999");
  expect(record.transcript_string).toBe(episodeRecord.transcript_string);
  expect(record.transcript_string!.length).toBeGreaterThan(20000);
  expect(record.speaker_map).toEqual([{ speaker: 0, name: "Alex" }]);
  expect(resourceBody(record)).toContain("## Transcript");
  expect(episodes.resourceMetadata!(record)).not.toHaveProperty("transcript_string");
});
it("translates source filters, stable pagination and junction targets without fetching bodies or transcripts", async () => {
  read.mockResolvedValue([episodeRecord, episodeRecord]);
  const result = await episodes.list({
    filters: {
      show: showId,
      season: seasonId,
      episode_number: 0,
      hosts: [hostId],
      guests: ["550e8400-e29b-41d4-a716-446655440066"],
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
  expect(query.filter.episode_number).toEqual({ _eq: 0 });
  expect(query.filter.show).toEqual({ id: { _eq: showId } });
  expect(query.filter.hosts).toEqual({ podcast_hosts_id: { id: { _in: [hostId] } } });
});
it("preserves nullable documents and missing relationships without fabricating content", async () => {
  read.mockResolvedValue([
    {
      ...episodeRecord,
      body: null,
      transcript_string: null,
      transcript_string_with_speakers: null,
      speaker_map: null,
      show: null,
      season: null,
      audio: null
    }
  ]);
  const { record } = await episodes.get(episodeId);
  expect(record.content).toBeNull();
  expect(record.transcript_string).toBeNull();
  expect(resourceBody(record)).toContain("No transcript is available.");
  expect(resourceBody(record)).toContain("No body content is available.");
  expect(record.show).toBeNull();
  expect(record.season).toBeNull();
  expect(record.content_warnings.join()).toContain("show is unavailable");
});
it("does not associate a season with an unrelated show", async () => {
  read.mockResolvedValue([
    { ...episodeRecord, season: { ...episodeRecord.season, show: { id: mediaId } } }
  ]);
  const { record } = await episodes.get(episodeId);
  expect(record.season).toBeNull();
  expect(record.show?.id).toBe(showId);
  expect(record.content_warnings.join()).toContain("mismatched show");
});
it("reports bounded and unavailable related records independently of body traversal", async () => {
  read.mockResolvedValue([
    {
      ...episodeRecord,
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
  const { record } = await episodes.get(episodeId);
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
  await expect(episodes.get(episodeId)).rejects.not.toThrow("provider secret");
  await expect(episodes.get(episodeId)).rejects.toThrow("NOT_FOUND");
  await expect(episodes.get(episodeId)).rejects.toThrow("UPSTREAM_UNAVAILABLE");
  expect(episodes.listInput.safeParse({ filters: { arbitrary: true } }).success).toBe(false);
});
it("advertises portable resource contracts and descriptor-only catalogue queries", async () => {
  for (const schema of [
    episodes.listInput,
    episodes.getOutput,
    episodes.searchInput,
    episodes.searchOutput,
    episodes.filtersOutput
  ])
    expect(() => z.toJSONSchema(schema)).not.toThrow();
  expect(episodes.resources).toEqual([
    { uri_template: "onderwijsloket://podcast_episodes/{id}", mime_type: "text/markdown" }
  ]);
  read
    .mockResolvedValueOnce([{ id: episodeId, title: episodeRecord.title }])
    .mockResolvedValueOnce([]);
  expect((await listResources(episodes)()).resources[0]?.name).toBe(episodeId);
  expect(read.mock.calls[0]![0]().params.fields).toEqual(["id", "title", "date_updated"]);
  read.mockResolvedValue([episodeRecord]);
  const handler = serveResource({
    name: episodes.name,
    id: episodes.getInput.shape.id,
    get: episodes.get,
    content: resourceBody,
    metadata: episodes.resourceMetadata
  });
  const result = await handler(new URL(`onderwijsloket://podcast_episodes/${episodeId}`), {
    id: episodeId
  });
  expect(result.contents[0]!.text).toContain("An education conversation.");
});
it("keeps search projections lightweight and facets restricted to verified index names", async () => {
  search.mockResolvedValue({
    hits: [{ ...episodeRecord, objectID: episodeId }],
    nbHits: 1,
    nbPages: 1,
    facets: Object.fromEntries(
      [
        "audiences.title",
        "phases.title",
        "sectors.title",
        "roles.name",
        "topics.name",
        "tracks.name",
        "show.title"
      ].map((name) => [name, { Teaching: 1 }])
    )
  });
  const result = await episodes.search({ filters: { "sectors.title": ["Teaching"] } });
  expect(result.records[0]?.id).toBe(episodeId);
  expect(result.records[0]).not.toHaveProperty("transcript_string");
  expect(result.records[0]).not.toHaveProperty("body");
  expect(search.mock.calls.at(-1)![0].searchParams.attributesToRetrieve).not.toContain(
    "transcript_string"
  );
  expect((await episodes.facets({})).facets).toHaveLength(7);
  expect(episodes.searchInput.safeParse({ filters: { "hosts.email": ["secret"] } }).success).toBe(
    false
  );
  search.mockRejectedValueOnce(new Error("provider secret"));
  await expect(episodes.search({})).rejects.toThrow("UPSTREAM_UNAVAILABLE");
});
it("preserves incomplete source speaker maps and skips empty platform placeholders with warnings", async () => {
  read.mockResolvedValue([
    { ...episodeRecord, speaker_map: [{ name: "Unassigned" }], external_urls: [{}] }
  ]);
  const { record } = await episodes.get(episodeId);
  expect(record.speaker_map).toEqual([{ name: "Unassigned", speaker: null }]);
  expect(record.external_urls).toEqual([]);
  expect(record.content_warnings.join()).toContain("lack a speaker identifier");
  expect(record.content_warnings.join()).toContain("Incomplete external platform link omitted");
});

it("advertises native integer and season-ID source lookup rules", async () => {
  read.mockResolvedValue([]);
  const result = await episodes.filters();
  expect(result.filters.find((field) => field.name === "episode_number")).toMatchObject({
    type: "integer",
    operator: "eq",
    minimum: 0,
    operations: ["list_podcast_episodes"]
  });
  expect(result.filters.find((field) => field.name === "season")).toMatchObject({
    lookup: { tool: "get_podcast_show", path: "seasons[].id" }
  });
});
