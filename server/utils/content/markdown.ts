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

/** Keep children of unknown nodes: Tiptap would otherwise discard the entire unsupported subtree. */
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

/** Serialize one hydrated document, sharing a warning set with its nested callout documents. */
export function contentToMarkdown(document: JSONContent, options: ContentMarkdownOptions) {
  const warnings = new Set<string>();
  const warn = (message: string) => {
    warnings.add(message);
  };

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
