export const showId = "550e8400-e29b-41d4-a716-446655440060";
export const seasonId = "550e8400-e29b-41d4-a716-446655440061";
export const episodeId = "550e8400-e29b-41d4-a716-446655440062";
export const videoId = "550e8400-e29b-41d4-a716-446655440063";
export const hostId = "550e8400-e29b-41d4-a716-446655440064";
export const mediaId = "550e8400-e29b-41d4-a716-446655440065";
export const mediaTaxonomyId = "00000000-0000-0000-0000-000000000001";
export const hostRecord = {
  id: hostId,
  title: "Presenter",
  first_name: "Alex",
  last_name: null,
  description: "Podcast host",
  image: null,
  linkedin: null,
  email: "private-host@example.test"
};
export const mediaProfile = {
  id: "550e8400-e29b-41d4-a716-446655440066",
  first_name: "Sam",
  last_name: null,
  path: "/ervaringen/sam",
  image: null
};
export const showReference = {
  id: showId,
  title: "Education conversations",
  path: "/podcasts/education-conversations",
  artwork: null
};
export const seasonRecord = { id: seasonId, season_number: 1, year: 2026, show: { id: showId } };
const taxonomies = Object.fromEntries(
  ["sectors", "audiences", "phases", "roles", "topics", "tracks"].map((name) => [
    name,
    [
      {
        [name + "_id"]: {
          id: mediaTaxonomyId,
          title: "Teaching",
          name: "Teaching",
          slug: "teaching",
          description: null
        }
      }
    ]
  ])
);
export const mediaDocument = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "An education conversation." }] }]
};
export const showRecord = {
  ...showReference,
  ...taxonomies,
  slug: "education-conversations",
  date_updated: null,
  creator_name: "Education team",
  tagline: "Conversations about education",
  podcast_status: "ongoing",
  description: mediaDocument,
  header_image: null,
  trailer: { service: "directus", source: mediaId },
  external_urls: [{ name: "spotify", url: "https://example.test/show" }],
  hosts: [{ podcast_hosts_id: hostRecord }],
  seasons: [seasonRecord]
};
export const episodeRecord = {
  ...taxonomies,
  id: episodeId,
  title: "First conversation",
  slug: "first-conversation",
  path: "/podcasts/first-conversation",
  date_updated: null,
  publication_date: "2999-01-01T00:00:00",
  duration: 0,
  episode_number: 0,
  show: showReference,
  season: seasonRecord,
  hosts: [{ podcast_hosts_id: hostRecord }],
  guests: [{ profiles_id: mediaProfile }],
  body: mediaDocument,
  audio: { service: "directus", source: mediaId },
  transcript_string: "An exact transcript. ".repeat(1500),
  transcript_string_with_speakers: "Alex: An exact speaker transcript.",
  speaker_map: [{ speaker: 0, name: "Alex" }],
  external_urls: [{ name: "spotify", url: "https://example.test/episode" }]
};
export const videoRecord = {
  ...taxonomies,
  id: videoId,
  title: "Teaching interview",
  slug: "teaching-interview",
  path: "/videos/teaching-interview",
  date_updated: null,
  publication_date: "2999-01-01T00:00:00",
  duration: 2,
  profiles: [{ profiles_id: mediaProfile }],
  body: mediaDocument,
  video: { service: "directus", id: mediaId },
  transcript_string: "A video transcript.",
  transcript_string_with_speakers: null,
  speaker_map: null,
  chapters: [
    { label: "Introduction", time: 0 },
    { label: "Teaching", time: 60 }
  ]
};
