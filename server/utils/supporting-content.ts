import { z } from "zod";
import { joinURL } from "ufo";
import { nullableOutput } from "./mcp-schema";
import { useSourceUrl } from "./use-source-url";
import { collectionRelationLimit } from "./collection-relations";

/** Supporting IDs remain opaque: they identify targets, never junction rows. */
export const supportingIdSchema = z.string().min(1).max(200);
/** Public asset reference; no file browsing or extraction is exposed. */
export const assetSchema = z.object({ id: supportingIdSchema, url: nullableOutput(z.url()) });
const fileSource = z.union([
  supportingIdSchema,
  z.object({ id: supportingIdSchema, type: z.string().nullish() })
]);
/** Public editorial attribution, distinct from a featured participant. */
export const authorSchema = z.object({
  id: supportingIdSchema,
  name: z.string(),
  first_name: z.string(),
  job_title: nullableOutput(z.string()),
  image: nullableOutput(assetSchema)
});
/** Minimal featured-person attribution; profile biography expansion remains outside this group. */
export const profileSchema = z.object({
  id: supportingIdSchema,
  first_name: z.string(),
  last_name: nullableOutput(z.string()),
  source_url: nullableOutput(z.url()),
  image: nullableOutput(assetSchema)
});
/** External evidence URL, separate from an Onderwijsloket canonical page. */
export const sourceSchema = z.object({
  id: supportingIdSchema,
  title: z.string(),
  description: nullableOutput(z.string()),
  url: nullableOutput(z.url())
});
/** Download reference only; no inferred PDF text or document search. */
export const documentSchema = z.object({
  id: supportingIdSchema,
  title: z.string(),
  description: nullableOutput(z.string()),
  asset: nullableOutput(assetSchema)
});

/**
 * Normalize a public HTTP(S) evidence URL, reporting invalid values through the parent warnings.
 * @param value - Untrusted source URL string.
 * @returns A safe absolute URL or null.
 */
function evidenceUrl(value: string) {
  const parsed = z.url().safeParse(value);
  return parsed.success && /^https?:\/\//i.test(parsed.data) ? parsed.data : null;
}
/**
 * Construct the documented public Cloudinary delivery reference for a selected file.
 * @param file - Selected file ID or minimal expanded file projection.
 * @param kind - Cloudinary asset delivery type.
 * @returns Public asset identity and URL; sensitive file metadata is never copied.
 */
function asset(file: z.output<typeof fileSource>, kind: "image"): z.output<typeof assetSchema> {
  const id = typeof file === "string" ? file : file.id;
  return {
    id,
    url: joinURL(
      `https://res.cloudinary.com/onderwijsin/${kind}/upload/onderwijsloket-directus/production`,
      encodeURIComponent(id)
    )
  };
}
/**
 * Use the verified PDF/image delivery mapping; preserve unknown file identities without guessing URLs.
 * @param file - Minimal selected file metadata or an unexpanded identifier.
 * @returns An asset reference with null URL when its delivery type is unverified.
 */
function documentAsset(file: z.output<typeof fileSource>) {
  if (
    typeof file !== "string" &&
    (file.type === "application/pdf" || file.type?.startsWith("image/"))
  )
    return asset(file, "image");
  return { id: typeof file === "string" ? file : file.id, url: null };
}
/** Source validator strips staff and reverse relations before attribution normalization. */
export const authorSourceSchema = z
  .object({
    id: supportingIdSchema,
    name: z.string(),
    first_name: z.string(),
    job_title: z.string().nullish(),
    image: fileSource.nullish()
  })
  .transform((record) => ({
    ...record,
    job_title: record.job_title ?? null,
    image: record.image ? asset(record.image, "image") : null
  }))
  .pipe(authorSchema);
/** Minimal profile projection intentionally omits body, video avatar and reverse content. */
export const profileSourceSchema = z
  .object({
    id: supportingIdSchema,
    first_name: z.string(),
    last_name: z.string().nullish(),
    path: z.string(),
    image: fileSource.nullish()
  })
  .transform((record) => ({
    id: record.id,
    first_name: record.first_name,
    last_name: record.last_name ?? null,
    source_url: useSourceUrl(record.path),
    image: record.image ? asset(record.image, "image") : null
  }))
  .pipe(profileSchema);
/** External evidence normalization retains invalid URLs as explicit nulls. */
export const evidenceSourceSchema = z
  .object({
    id: supportingIdSchema,
    title: z.string(),
    description: z.string().nullish(),
    url: z.string()
  })
  .transform((record) => ({
    ...record,
    description: record.description ?? null,
    url: evidenceUrl(record.url)
  }))
  .pipe(sourceSchema);
/** A missing selected file remains visible as a missing document asset, not a fabricated download. */
export const documentSourceSchema = z
  .object({
    id: supportingIdSchema,
    title: z.string(),
    description: z.string().nullish(),
    asset: fileSource.nullable()
  })
  .transform((record) => ({
    ...record,
    description: record.description ?? null,
    asset: record.asset ? documentAsset(record.asset) : null
  }))
  .pipe(documentSchema);

/** Shared author projection used by article and testimonial parents. */
export const authorFields = ["id", "name", "first_name", "job_title", "image"] as const;
/** Minimal featured-profile projection, excluding biography and staff fields. */
export const profileFields = ["id", "first_name", "last_name", "path", "image"] as const;
/** Source citations require the original external URL, not a partial search-index reference. */
export const sourceFields = ["id", "title", "description", "url"] as const;
/** Documents fetch only the asset identifier needed for the public delivery URL. */
export const documentFields = ["id", "title", "description", { asset: ["id", "type"] }] as const;
/**
 * Bound parent junctions with a sentinel row and deterministic source junction ordering.
 * @param names - Parent relation names being expanded.
 * @returns Deep query options without visibility or publication policy.
 */
export function supportingRelationBounds(names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [name, { _limit: collectionRelationLimit + 1, _sort: ["id"] }])
  );
}
