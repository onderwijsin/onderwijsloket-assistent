# Podcast series, episodes and videos

Implemented `podcast_shows`, `podcast_episodes` and `videos`. Videos were added to the requested scope after the original inventory. Shared helpers normalize hosts, season ownership, platform links, media asset references and speaker metadata; collection definitions retain native fields and separate static tools. There are now ten core collections, thirty-four tools and ten Markdown resource templates.

## Operations and filtering

| Collection         | Record tools                                                              | Source-list filters                                                                                                                                   | Search facets                                                                      |
| ------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `podcast_shows`    | `list_podcast_shows`, `get_podcast_show`, `search_podcast_shows`          | Exact title/slug/creator_name, native podcast_status, host IDs, sectors/audiences/phases IDs                                                          | sectors.title, audiences.title, phases.title                                       |
| `podcast_episodes` | `list_podcast_episodes`, `get_podcast_episode`, `search_podcast_episodes` | Exact title/slug, show/season ID, nonnegative integer episode_number including zero, host/guest IDs, sectors/audiences/phases/roles/topics/tracks IDs | Same six taxonomy labels, plus show.title                                          |
| `videos`           | `list_videos`, `get_video`, `search_videos`                               | Exact title/slug, featured profile IDs, the same six taxonomy IDs                                                                                     | sectors.title, audiences.title, phases.title, roles.name, topics.name, tracks.name |

Source lists use the existing one-based paging contract (default 10, maximum 25), select one sentinel row, and use ID as a stable secondary sort. Shows sort by title/date_updated in either direction, episodes by publication_date/episode_number, and videos by title/publication_date. Shared discovery advertises all operations, native schemas, supported filters and resources. Search facet labels are distinct from source relation IDs. Hosts, guests, profiles and seasons are discovered through their parent projections; they do not become standalone tools. Episode season lookup uses `get_podcast_show` → `seasons[].id`.

Each collection has `onderwijsloket://{collection}/{id}` resources/templates and tool links. Catalogue discovery uses the existing queued, cached root-only descriptor queries, never full media records, descriptions, transcripts or nested relations. Readable resources remain Markdown, with media links in metadata rather than binary resource bodies.

## Native records and attribution

Shows expose identity, source URL/update date, creator_name, tagline, podcast_status, artwork, hosts and three taxonomies. Detail adds nullable Markdown description, header image, trailer asset, platform links and bounded seasons. Episodes are retrieved through `list_podcast_episodes` filtered by show, rather than an unbounded reverse episode graph. `podcast_status` is the series lifecycle, independent of Directus publication policy.

Episodes expose identity, source URL/update date, publication_date, native duration, episode_number, nullable show/season, hosts, guests and six taxonomies. Detail adds nullable Markdown `content`, audio asset, transcript_string, transcript_string_with_speakers, speaker_map and platform links. Hosts use `hosts.podcast_hosts_id`; guests use `guests.profiles_id`, keeping presenters and featured people distinct.

Videos expose identity, source URL/update date, publication_date, native duration, six taxonomies and featured profiles via `profiles.profiles_id`. Detail adds nullable Markdown content, video asset, nullable transcript variants, speaker_map and chapters. Videos have no invented article description, show, season or editor_nodes relation.

Host attribution is `{id,title,first_name,last_name,description,image,linkedin}` with optional values normalized to null and HTTP(S) LinkedIn links validated. Host email, user fields and reverse episode/show arrays are never selected. Featured profiles reuse the existing minimal public profile projection.

Seasons retain `{id,season_number,year,show_id}`. Source series/season references do not recursively expand episodes. Show detail bounds seasons to 100 plus a sentinel, verifies ownership and orders by season_number then ID. Orphan/mismatched seasons are omitted with warnings. Episode show/season relations returned as unavailable remain explicit nulls with warnings; a season whose show identity cannot be matched is not attached to the episode. Bare unexpanded IDs fail boundary validation rather than becoming fabricated references. Taxonomy, host and profile relations are independently bounded to 100 and report missing targets/truncation.

## Media, transcripts and missing content

The source stores audio/trailers as `{service:"directus",source:UUID}` and videos as `{service:"directus",id:UUID}`. Both normalize to `{id,url}` using the documented Cloudinary `video/upload/onderwijsloket-directus/production/{id}` delivery type, which also serves audio. Missing, unsupported, invalid or conflicting references become null with a warning; no alternate provider URL is guessed. Images retain their existing image delivery mapping. Public asset references do not assert present playback availability.

Duration values are preserved as finite nonnegative source numbers, including zero. Source field metadata does not state their unit, so tools and schemas do not label them seconds or convert them. Video `chapters[].time` is explicitly seconds according to source field metadata. Chapters retain native labels/order and nonnegative integer offsets. All observed live chapters were null; the declared chapter shape and zero-offset behavior are covered by synthetic tests.

Readable transcripts and speaker-attributed transcripts are preserved as separate nullable strings without a detail character cap. The raw processing transcript is excluded. A speaker map is nullable; each item retains a name and a nonnegative integer speaker index, or null when the source omitted its index. Missing indices emit a warning and never receive an invented position or attribution. Empty platform placeholders are omitted with a warning; named links with invalid/missing destinations retain a null URL with a warning. Source platform labels remain native enums.

Resources render body/description separately from the transcript. Speaker-attributed transcript text is preferred when available, otherwise the plain transcript is used. No transcript is generated from body text or snippets. Missing body content follows the [global missing-body contract](../collection-resources.md#missing-body-content); missing transcript text has its own visible notice. JSON content remains null when absent. Front matter keeps attribution, media links, speaker maps, chapters, source timestamps and completeness metadata without duplicating body/transcript text.

`truncated` refers to document traversal, independently of relation bounds. Source text and source-returned future publication dates are retained. There are no local publication filters, status guards, playback/release-date gates or synchronization timestamps; follow [data access responsibilities](../data-access.md).

## Evidence and verification

Read-only checks on 2026-10-20 used the configured service credentials. The [Media family](https://docs.onderwijsloket.com/data-model/families/media), [index reference](https://docs.onderwijsloket.com/search/collections) and [Cloudinary delivery guide](https://docs.onderwijsloket.com/misc/cloudinary) establish the intended relationships and delivery mapping. Live source/index counts were 3 shows, 55 episodes and 37 videos. Exact source list projections, detail reads for all 95 records, ID mappings, search facets and descriptor-only catalogues are checked without committing live names, bodies, contact details or credentials as fixtures.

Source null cases include trailers, transcripts, speaker maps, platform lists and video chapters. Live speaker maps also contain names without speaker indices, and an episode has an empty platform placeholder. These schema discrepancies have synthetic regressions. No index settings or source records are modified.

Collection-based unit tests and the production Node HTTP suite cover native shapes, all tools/resources, portable schemas, source filters and episode zero, strict search facets, source-date preservation, long transcripts, missing text notices, safe media/URLs, omitted internal fields, ownership, relation bounds, catalogue discovery and sanitized failures. Runtime code adds no dependency or Node-only API. A deployed Cloudflare Workers instance and successful binary playback of every media URL remain outside verification.
