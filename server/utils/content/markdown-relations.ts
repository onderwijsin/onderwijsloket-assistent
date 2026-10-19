import type { JSONContent } from "@tiptap/core";
import type { ContentMarkdownOptions } from "./types";
import { isContentRecord } from "./types";
import {
  escapeMarkdownText,
  getContentRecords,
  getContentText,
  getSortedContentItems,
  renderMarkdownBlockquote,
  renderMarkdownLink,
  resolveContentAsset
} from "./markdown-formatting";

type ContentRecord = Record<string, unknown>;

interface RelationRenderContext extends ContentMarkdownOptions {
  renderDocument(document: JSONContent): string;
  warn(message: string): void;
}

/** Build the relation renderers for one document and its nested documents. */
export function createRelationMarkdownRenderer(context: RelationRenderContext) {
  function renderRelatedLink(
    item: ContentRecord,
    collection: unknown,
    customLabel?: unknown
  ): string {
    // Sectors have a root-level route derived from their slug rather than a stored path.
    const sectorPath = collection === "sectors" && item.slug ? `/${item.slug}` : null;
    const destination = item.path ?? sectorPath;
    const label = customLabel || item.title || item.name;
    return renderMarkdownLink(label, destination);
  }

  function renderButton(data: ContentRecord): string {
    return renderMarkdownLink(data.label, data.to);
  }

  function renderMention(data: ContentRecord): string {
    // Directus stores this as M2A, but the editor allows only one mention target.
    const target = getContentRecords(data.item)[0];
    if (!target || !isContentRecord(target.item)) {
      context.warn("Unresolved mention target.");
      return escapeMarkdownText(getContentText(data.title)) || "[Unresolved mention]";
    }

    return renderRelatedLink(target.item, target.collection, data.title);
  }

  function renderImage(data: ContentRecord): string {
    const source = resolveContentAsset(data.image, context.assetBaseUrl);
    if (!source) {
      context.warn("Image asset is missing.");
      return "[Image unavailable]";
    }

    const altText = escapeMarkdownText(getContentText(data.alt_text));
    return `![${altText}](<${source}>)`;
  }

  function renderCallout(data: ContentRecord): string {
    const sections: string[] = [];
    if (data.title) {
      sections.push(`**${escapeMarkdownText(getContentText(data.title))}**`);
    }

    // Injection has already resolved any editor nodes inside the callout's description.
    if (isContentRecord(data.description)) {
      sections.push(context.renderDocument(data.description));
    } else if (typeof data.description === "string") {
      sections.push(escapeMarkdownText(data.description));
    }

    for (const action of getContentRecords(data.actions)) {
      sections.push(renderMarkdownLink(action.label, action.to));
    }

    return renderMarkdownBlockquote(sections.filter(Boolean).join("\n\n"));
  }

  function renderContentList(data: ContentRecord): string {
    const items: string[] = [];
    for (const item of getSortedContentItems(data.items)) {
      const parts = [renderMarkdownLink(item.title, item.link)];
      if (item.description) {
        parts.push(escapeMarkdownText(getContentText(item.description)));
      }
      if (item.mediatype === "image") {
        const source = resolveContentAsset(item.image, context.assetBaseUrl);
        if (source) {
          const altText = escapeMarkdownText(getContentText(item.title));
          parts.push(`![${altText}](<${source}>)`);
        }
      }
      items.push(`- ${parts.join(" — ")}`);
    }
    return items.join("\n");
  }

  function renderRelatedContentList(data: ContentRecord): string {
    const items: string[] = [];
    for (const junction of getSortedContentItems(data.items)) {
      if (!isContentRecord(junction.item)) {
        context.warn("Unresolved related content item.");
        items.push("- [Related content unavailable]");
        continue;
      }

      const item = junction.item;
      const link = renderRelatedLink(item, junction.collection);
      const description =
        typeof item.description === "string" ? ` — ${escapeMarkdownText(item.description)}` : "";
      items.push(`- ${link}${description}`);
    }
    return items.join("\n");
  }

  function renderChapter(chapter: ContentRecord, mediaUrl: string): string | null {
    const time = Number(chapter.time);
    if (!Number.isFinite(time) || time < 0) {
      return null;
    }

    const minutes = Math.floor(time / 60);
    const seconds = String(Math.floor(time % 60)).padStart(2, "0");
    const label = `${minutes}:${seconds} ${getContentText(chapter.label)}`;
    return `- ${renderMarkdownLink(label, `${mediaUrl}#t=${time}`)}`;
  }

  function renderMediaPlayer(data: ContentRecord): string {
    const isAudio = data.type === "audio";
    const media = isAudio ? data.audio : data.video;
    // Current payloads use `source`; older records use `id` for the same asset reference.
    const assetId = isContentRecord(media) ? (media.source ?? media.id) : media;
    const source = resolveContentAsset(assetId, context.assetBaseUrl);
    const title = `${isAudio ? "Audio" : "Video"}: ${getContentText(data.title)}`;
    if (!source) {
      context.warn("Media asset is missing.");
      return escapeMarkdownText(title);
    }

    const sections = [renderMarkdownLink(title, source)];
    const artwork = resolveContentAsset(data.artwork, context.assetBaseUrl);
    if (artwork) {
      const altText = escapeMarkdownText(getContentText(data.title));
      sections.push(`![${altText}](<${artwork}>)`);
    }
    if (data.artist) {
      sections.push(escapeMarkdownText(getContentText(data.artist)));
    }
    for (const chapter of getContentRecords(data.chapters)) {
      const markdown = renderChapter(chapter, source);
      if (markdown) {
        sections.push(markdown);
      }
    }
    return sections.join("\n\n");
  }

  return function renderRelation(attributes: ContentRecord = {}): string {
    const collection = getContentText(attributes.collection);
    if (!isContentRecord(attributes.data)) {
      return `[Unresolved ${escapeMarkdownText(collection || "editor node")}]`;
    }

    const data = attributes.data;
    switch (collection) {
      case "buttons":
        return renderButton(data);
      case "mentions":
        return renderMention(data);
      case "images":
        return renderImage(data);
      case "callouts":
        return renderCallout(data);
      case "content_lists":
        return renderContentList(data);
      case "related_content_lists":
        return renderRelatedContentList(data);
      case "mediaplayers":
        return renderMediaPlayer(data);
      default:
        context.warn(`Unsupported editor node collection: ${collection}.`);
        return `[Unsupported ${escapeMarkdownText(collection)}]`;
    }
  };
}
