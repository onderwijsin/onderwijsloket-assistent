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
  /**
   * Serialize a nested document using the shared Markdown renderer.
   *
   * @param document - Source document to hydrate or render.
   * @returns Serialized Markdown for the nested document.
   */
  renderDocument(document: JSONContent): string;
  /**
   * Report incomplete or unsupported document content.
   *
   * @param message - Warning text describing incomplete or unsupported content.
   * @returns Nothing; records a rendering warning.
   */
  warn(message: string): void;
}

/**
 * Build the relation renderers for one document and its nested documents.
 *
 * @param context - Asset settings, nested-document renderer and warning callback.
 * @returns A renderer accepting hydrated relation attributes and returning block Markdown.
 */
export function createRelationMarkdownRenderer(context: RelationRenderContext) {
  /**
   * Resolve a related-record link with collection-specific path and label fallbacks.
   *
   * @param item - Expanded related record.
   * @param collection - Related collection name used to resolve path conventions.
   * @param customLabel - Optional label overriding the related record title.
   * @returns A Markdown link using the related record path and title fallbacks.
   */
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

  /**
   * Render an editor button as a link.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns The button label as a Markdown link or plain escaped text.
   */
  function renderButton(data: ContentRecord): string {
    return renderMarkdownLink(data.label, data.to);
  }

  /**
   * Render the expanded mention target and report unresolved references.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns The target link, or a visible unresolved-mention placeholder.
   */
  function renderMention(data: ContentRecord): string {
    // Directus stores this as M2A, but the editor allows only one mention target.
    const target = getContentRecords(data.item)[0];
    if (!target || !isContentRecord(target.item)) {
      context.warn("Unresolved mention target.");
      return escapeMarkdownText(getContentText(data.title)) || "[Unresolved mention]";
    }

    return renderRelatedLink(target.item, target.collection, data.title);
  }

  /**
   * Render a resolved image asset and its alternative text.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns Markdown image syntax, or a visible placeholder when the asset is missing.
   */
  function renderImage(data: ContentRecord): string {
    const source = resolveContentAsset(data.image, context.assetBaseUrl);
    if (!source) {
      context.warn("Image asset is missing.");
      return "[Image unavailable]";
    }

    const altText = escapeMarkdownText(getContentText(data.alt_text));
    return `![${altText}](<${source}>)`;
  }

  /**
   * Render a callout title, nested content and actions as a blockquote.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns A blockquote containing the title, nested document and action links.
   */
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

  /**
   * Render editor-sorted content cards as a Markdown list.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns An ordered-by-editor bullet list of links, descriptions and optional images.
   */
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

  /**
   * Render expanded related content while preserving unresolved-item warnings.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns A bullet list of related-record links, retaining placeholders for unresolved items.
   */
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

  /**
   * Link a valid chapter timestamp to its media asset.
   *
   * @param chapter - Chapter label and playback time in seconds.
   * @param mediaUrl - Resolved media URL to which the chapter offset is appended.
   * @returns A timestamped chapter link, or null for an invalid playback time.
   */
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

  /**
   * Render audio or video metadata, artwork and chapter links.
   *
   * @param data - Hydrated payload for the editor block.
   * @returns Media, artwork and chapter links, or a title fallback for a missing asset.
   */
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

  /**
   * Dispatch a hydrated relation to its collection-specific Markdown renderer.
   *
   * @param attributes - Editor-node attributes identifying the related collection and junction.
   * @returns Markdown for the hydrated block, or a placeholder for an unresolved or unsupported relation.
   */
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
