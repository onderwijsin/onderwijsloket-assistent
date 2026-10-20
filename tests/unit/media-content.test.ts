import { it, expect, vi } from "vitest";
import {
  normalizeMedia,
  normalizePlatforms,
  hostSourceSchema,
  normalizeSeasons,
  seasonSourceSchema,
  mediaResourceContent
} from "../../server/utils/media-content";
import { hostRecord, mediaId, seasonRecord, showId } from "../fixtures/podcasts-and-videos";
it("normalizes verified source and legacy media identities to the video delivery type", () => {
  for (const key of ["source", "id"])
    expect(
      normalizeMedia({ service: "directus", [key]: mediaId, private: "hidden" }, "audio")
    ).toEqual({
      value: {
        id: mediaId,
        url: `https://res.cloudinary.com/onderwijsin/video/upload/onderwijsloket-directus/production/${mediaId}`
      },
      warnings: []
    });
  for (const value of [
    null,
    { service: "youtube", source: mediaId },
    { service: "directus", source: "https://evil.test" },
    { service: "directus" },
    { service: "directus", id: mediaId, source: showId }
  ]) {
    const result = normalizeMedia(value, "video");
    expect(result.value).toBeNull();
    expect(result.warnings).toHaveLength(1);
  }
});
it("strips host email and reverse collections while preserving optional public attribution", () => {
  const host = hostSourceSchema.parse({
    ...hostRecord,
    episodes: ["secret"],
    linkedin: "javascript:evil"
  });
  expect(host.linkedin).toBeNull();
  expect(host.last_name).toBeNull();
  expect(JSON.stringify(host)).not.toMatch(/email|private-host|episodes|secret/);
});
it("bounds seasons, keeps source order deterministic and reports missing/mismatched ownership", () => {
  const row = seasonSourceSchema.parse(seasonRecord);
  const result = normalizeSeasons(
    [{ ...row, show_id: null }, ...Array.from({ length: 100 }, () => row)],
    showId
  );
  expect(result.records).toHaveLength(99);
  expect(result.truncated).toBe(true);
  expect(result.warnings).toHaveLength(1);
  expect(
    normalizeSeasons([{ ...row, season_number: 2 }, row], showId).records.map(
      (x) => x.season_number
    )
  ).toEqual([1, 2]);
});
it("sanitizes platform URLs and renders separate missing body/transcript notices without inventing text", () => {
  expect(
    normalizePlatforms([{ name: "spotify", url: "javascript:evil" }]).value?.[0]?.url
  ).toBeNull();
  const markdown = mediaResourceContent({
    title: "Example",
    content: null,
    transcript_string: null,
    transcript_string_with_speakers: null
  });
  expect(markdown).toContain("No body content is available.");
  expect(markdown).toContain("No transcript is available.");
  expect(
    mediaResourceContent({
      title: "Example",
      content: "Body",
      transcript_string: "Plain",
      transcript_string_with_speakers: "Speaker: Exact"
    })
  ).toBe("Body\n\n## Transcript\n\nSpeaker: Exact");
});

vi.mock("@onderwijsin/nuxt-directus-client/runtime/server", () => ({ useDirectusServer: vi.fn() }));
vi.mock("nitropack/runtime", () => ({ defineCachedFunction: (fn: unknown) => fn }));
