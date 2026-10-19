import type { QueryFields } from "@directus/sdk";
import type {
  Schema,
  Button,
  Callout,
  Image,
  Mediaplayer,
  ContentList,
  RelatedContentList,
  Mention
} from "#directus";

// Select the fields needed to preserve content and links in Markdown; omit visual styling.
const articleReference = ["id", "title", "path", "description"] as const;
const relatedContent = {
  articles: articleReference,
  testimonials: ["id", "title", "path", "description"],
  videos: ["id", "title", "path"],
  podcast_episodes: ["id", "title", "path"],
  podcast_shows: ["id", "title", "path", "tagline"],
  sectors: ["id", "title", "slug", "description"],
  programs: ["id", "title", "path"],
  educational_institutions: ["id", "title", "path"],
  regional_education_desks: ["id", "title", "path"]
} as const;

// The current Onderwijsloket mention renderer links articles only.
const mentions = [
  "id",
  "title",
  { item: ["id", "collection", { item: { articles: articleReference } }] }
] satisfies QueryFields<Schema, Mention>;
const blocks = {
  buttons: ["id", "label", "to"] satisfies QueryFields<Schema, Button>,
  callouts: [
    "id",
    "title",
    "description",
    "actions",
    {
      // Callout descriptions are documents with their own junction IDs and mention scope.
      editor_nodes: ["id", "collection", { item: { mentions } }]
    }
  ] satisfies QueryFields<Schema, Callout>,
  images: ["id", "alt_text", "image"] satisfies QueryFields<Schema, Image>,
  mediaplayers: [
    "id",
    "title",
    "artist",
    "type",
    "audio",
    "video",
    "artwork",
    "chapters"
  ] satisfies QueryFields<Schema, Mediaplayer>,
  content_lists: [
    "id",
    { items: ["id", "title", "description", "link", "image", "mediatype", "sort"] }
  ] satisfies QueryFields<Schema, ContentList>,
  related_content_lists: [
    "id",
    { items: ["collection", "sort", { item: relatedContent }] }
  ] satisfies QueryFields<Schema, RelatedContentList>,
  mentions
};

/** Shared Directus projection for every document's editor_nodes relation. */
export const editorNodeFields = ["id", "collection", { item: blocks }] as const;
