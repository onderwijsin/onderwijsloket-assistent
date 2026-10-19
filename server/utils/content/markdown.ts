import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";
import type { ContentMarkdownOptions } from "./types";
import { createContentMarkdownExtensions } from "./markdown-extensions";
import { createRelationMarkdownRenderer } from "./markdown-relations";

const supportedNodes = new Set([
  "doc",
  "text",
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "hardBreak",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "relation-block",
  "relation-inline-block"
]);

/**
 * Keep children of unknown nodes: Tiptap would otherwise discard the entire unsupported subtree.
 *
 * @param node - Content node to render or normalize.
 * @param warn - Callback receiving warnings about unsupported or incomplete content.
 * @returns A normalized document subtree retaining children of unsupported nodes.
 */
function normalizeContentNodes(node: JSONContent, warn: (message: string) => void): JSONContent {
  const result = {
    ...node,
    content: node.content?.map((child) => normalizeContentNodes(child, warn))
  };
  if (result.type && !supportedNodes.has(result.type)) {
    warn(`Unsupported document node: ${result.type}.`);
    return {
      type: "paragraph",
      content: result.content ?? [{ type: "text", text: `[Unsupported ${result.type}]` }]
    };
  }
  if (result.type === "text") {
    delete result.content;
  }
  return result;
}

/**
 * Serialize one hydrated document, sharing a warning set with its nested callout documents.
 *
 * @param document - Source document to hydrate or render.
 * @param options - Asset URL used to resolve media embedded in the document.
 * @returns Rendered Markdown and deduplicated rendering warnings.
 */
export function contentToMarkdown(document: JSONContent, options: ContentMarkdownOptions) {
  const warnings = new Set<string>();
  const warn = (message: string) => {
    warnings.add(message);
  };

  /**
   * Serialize a nested document using the shared Markdown renderer.
   *
   * @param content - Hydrated nested document to serialize.
   * @returns Serialized Markdown for the nested document.
   */
  function renderDocument(content: JSONContent): string {
    return manager.serialize(normalizeContentNodes(content, warn));
  }

  const renderRelation = createRelationMarkdownRenderer({ ...options, renderDocument, warn });
  // These callbacks run only during serialization, after the manager has been initialized.
  const manager = new MarkdownManager({
    extensions: createContentMarkdownExtensions({ renderRelation, renderDocument, warn })
  });

  return { markdown: renderDocument(document).trim(), warnings: [...warnings] };
}
