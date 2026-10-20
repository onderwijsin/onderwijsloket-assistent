import { z } from "zod";
import {
  asset,
  assetSchema,
  imageAssetSourceSchema,
  supportingIdSchema
} from "./supporting-content";
import { nullableOutput } from "./mcp-schema";
import { navigatorUrl } from "./navigator-content";
import { useSourceUrl } from "./use-source-url";
import { collectionRelationLimit } from "./collection-relations";
import { resourceContent } from "./resources";
import { escapeMarkdownText } from "./content/markdown-formatting";

/** Podcast release state is domain metadata, independent of Directus visibility. */
export const podcastStatusSchema = z.enum(["ongoing", "ended", "planned"]);
/** Public host attribution excludes email, private users and reverse series/episode graphs. */
export const hostSchema = z.object({
  id: supportingIdSchema,
  title: z.string(),
  first_name: z.string(),
  last_name: nullableOutput(z.string()),
  description: nullableOutput(z.string()),
  image: nullableOutput(assetSchema),
  linkedin: nullableOutput(z.url())
});
/** Minimal selected host fields; featured guests use the separate profile projection. */
export const hostFields = [
  "id",
  "title",
  "first_name",
  "last_name",
  "description",
  "image",
  "linkedin"
] as const;
/** Validate selected host metadata and normalize optional public text/URLs. */
export const hostSourceSchema = z
  .object({
    id: supportingIdSchema,
    title: z.string(),
    first_name: z.string(),
    last_name: z.string().nullish(),
    description: z.string().nullish(),
    image: imageAssetSourceSchema,
    linkedin: z.string().nullish()
  })
  .transform((row) => ({
    ...row,
    last_name: row.last_name ?? null,
    description: row.description ?? null,
    linkedin: navigatorUrl(row.linkedin)
  }))
  .pipe(hostSchema);
/** Bounded series identity inside episodes; no reverse episodes/seasons expansion. */
export const showReferenceSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  source_url: nullableOutput(z.url()),
  artwork: nullableOutput(assetSchema)
});
/** Explicit source series reference for episode projections. */
export const showReferenceFields = ["id", "title", "path", "artwork"] as const;
/** Minimal source series boundary. */
export const showReferenceSourceSchema = z
  .object({ id: z.uuid(), title: z.string(), path: z.string(), artwork: imageAssetSourceSchema })
  .transform(({ path, ...row }) => ({ ...row, source_url: useSourceUrl(path) }))
  .pipe(showReferenceSchema);
/** Season ownership remains explicit, including an unavailable parent identity. */
export const seasonSchema = z.object({
  id: z.uuid(),
  season_number: z.number().int().nonnegative(),
  year: z.number().int(),
  show_id: nullableOutput(z.uuid())
});
/** Selected season fields never include all season episodes. */
export const seasonFields = ["id", "season_number", "year", { show: ["id"] }] as const;
/** Source season boundary strips users and reverse episode relations. */
export const seasonSourceSchema = z
  .object({
    id: z.uuid(),
    season_number: z.number().int().nonnegative(),
    year: z.number().int(),
    show: z.object({ id: z.uuid() }).nullable()
  })
  .transform(({ show, ...row }) => ({ ...row, show_id: show?.id ?? null }))
  .pipe(seasonSchema);
/**
 * Bound show seasons and omit orphan/mismatched parents rather than attaching unrelated seasons.
 * @param rows - Selected season records including a sentinel row.
 * @param showId - Actual owning series ID.
 * @returns Ordered seasons and explicit relation completeness.
 */
export function normalizeSeasons(rows: z.output<typeof seasonSchema>[], showId: string) {
  const selected = rows.slice(0, collectionRelationLimit);
  return {
    records: selected
      .filter((row) => row.show_id === showId)
      .sort((a, b) => a.season_number - b.season_number || a.id.localeCompare(b.id)),
    truncated: rows.length > collectionRelationLimit,
    warnings: selected.some((row) => row.show_id !== showId)
      ? ["Seasons with unavailable or mismatched show IDs were omitted."]
      : []
  };
}
const platformSchema = z.enum(["spotify", "apple_podcasts", "castbox", "pocket_casts", "podimo"]);
/** Native platform labels and safe destinations; unavailable URLs remain explicit null. */
export const platformLinksSchema = nullableOutput(
  z.array(z.object({ name: platformSchema, url: nullableOutput(z.url()) }))
);
/** Source platform projection, without guessing URLs for unrecognized destinations. */
export const platformLinksSourceSchema = z
  .array(z.object({ name: platformSchema.nullish(), url: z.string().nullish() }))
  .nullish();
/** Nullable speaker identity metadata is kept separate from transcript text. */
export const speakerMapSchema = nullableOutput(
  z.array(z.object({ speaker: nullableOutput(z.number().int().nonnegative()), name: z.string() }))
);
/** Source maps can omit a speaker index; retain the name with null identity rather than guessing an index. */
export const speakerMapSourceSchema = z
  .array(z.object({ speaker: z.number().int().nonnegative().nullish(), name: z.string() }))
  .nullish()
  .transform((rows) => rows?.map((row) => ({ ...row, speaker: row.speaker ?? null })) ?? null)
  .pipe(speakerMapSchema);
/** Video chapter offsets are seconds, as specified by source field metadata. */
export const chaptersSchema = nullableOutput(
  z.array(z.object({ label: z.string(), time: z.number().nonnegative().int() }))
);
const mediaReferenceSource = z.object({
  service: z.literal("directus"),
  source: z.uuid().optional(),
  id: z.uuid().optional()
});
/**
 * Normalize verified Directus media references to Cloudinary video delivery (also used for audio).
 * @param value - Native service/source or legacy service/id JSON.
 * @param field - Field name used to contextualize incomplete media metadata.
 * @returns Public asset or null, plus warnings; no playback/release policy is applied locally.
 */
export function normalizeMedia(value: unknown, field: string) {
  if (value == null) return { value: null, warnings: [`No ${field} asset is available.`] };
  const result = mediaReferenceSource.safeParse(value);
  if (!result.success)
    return { value: null, warnings: [`Unsupported or invalid ${field} asset reference.`] };
  const id = result.data.source ?? result.data.id;
  if (!id || (result.data.source && result.data.id && result.data.source !== result.data.id))
    return { value: null, warnings: [`Missing or conflicting ${field} asset identity.`] };
  return { value: asset(id, "video"), warnings: [] };
}
/**
 * Retain platform identity and report invalid public URLs through parent warnings.
 * @param rows - Selected source platform links.
 * @returns Nullable public links and URL warnings.
 */
export function normalizePlatforms(rows: z.output<typeof platformLinksSourceSchema>) {
  const links =
    rows?.flatMap((row) =>
      row.name == null ? [] : [{ name: row.name, url: navigatorUrl(row.url) }]
    ) ?? null;
  return {
    value: links,
    warnings: [
      ...(rows?.some((row) => row.name == null)
        ? ["Incomplete external platform link omitted."]
        : []),
      ...(links?.some((row) => row.url === null)
        ? ["Unavailable or invalid external platform URL."]
        : [])
    ]
  };
}
/**
 * Render body and transcript as distinct sections, preserving metadata-only resources with notices.
 * @param record - Native readable media fields, without binary data.
 * @returns Resource Markdown; source transcript strings remain unchanged in JSON.
 */
export function mediaResourceContent(record: {
  title: string;
  content: string | null;
  transcript_string: string | null;
  transcript_string_with_speakers: string | null;
}) {
  const transcript = record.transcript_string_with_speakers?.trim()
    ? record.transcript_string_with_speakers
    : record.transcript_string;
  return [
    record.content ?? `# ${escapeMarkdownText(record.title)}\n\n${resourceContent(null)}`,
    "## Transcript",
    transcript?.trim()
      ? escapeMarkdownText(transcript)
      : "> **Notice:** No transcript is available."
  ].join("\n\n");
}
