import { Mark, Node } from "@tiptap/core";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { isContentRecord } from "./types";
import { getContentRecords, resolveContentLink } from "./markdown-formatting";

interface MarkdownRenderers {
  /**
   * Dispatch a hydrated relation to its collection-specific Markdown renderer.
   *
   * @param attributes - Editor-node attributes identifying the related collection and junction.
   * @returns Markdown for the hydrated block, or a placeholder for an unresolved or unsupported relation.
   */
  renderRelation(attributes?: Record<string, unknown>): string;
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
 * The two editor relation nodes share their attributes and differ only in document placement.
 *
 * @param name - Name of the field, node or mark being defined.
 * @param renderers - Shared document and relation renderers, including the warning callback.
 * @returns A Tiptap node extension for the requested relation placement.
 */
function createRelationNode(
  name: "relation-block" | "relation-inline-block",
  renderers: MarkdownRenderers
) {
  const inline = name === "relation-inline-block";
  return Node.create({
    name,
    group: inline ? "inline" : "block",
    inline,
    atom: true,
    /**
     * Declare the attributes shared by relation nodes.
     *
     * @returns Default attributes used by relation nodes.
     */
    addAttributes: () => ({
      id: { default: null },
      collection: { default: null },
      junction: { default: null },
      data: { default: null }
    }),
    /**
     * Serialize this editor node or mark through its configured Markdown renderer.
     *
     * @param node - Content node to render or normalize.
     * @returns The node or mark serialized as Markdown.
     */
    renderMarkdown: (node) => renderers.renderRelation(node.attrs)
  });
}

/**
 * Replace StarterKit's link renderer so ordinary text links use the same URL rules as blocks.
 *
 * @returns A link mark extension that preserves text when a destination is unsupported.
 */
function createLinkMark() {
  return Mark.create({
    name: "link",
    /**
     * Serialize this editor node or mark through its configured Markdown renderer.
     *
     * @param node - Content node to render or normalize.
     * @param helpers - Tiptap Markdown helpers for rendering child content.
     * @returns The node or mark serialized as Markdown.
     */
    renderMarkdown: (node, helpers) => {
      const label = helpers.renderChildren(node);
      const href = resolveContentLink(node.attrs?.href);
      return href ? `[${label}](<${href.replace(/>/g, "%3E")}>)` : label;
    }
  });
}

/**
 * Relation marks retain their existing text instead of using the mention's custom label.
 *
 * @returns A relation mark extension that links existing child text to its target.
 */
function createRelationMark() {
  return Mark.create({
    name: "relation-mark",
    /**
     * Serialize this editor node or mark through its configured Markdown renderer.
     *
     * @param node - Content node to render or normalize.
     * @param helpers - Tiptap Markdown helpers for rendering child content.
     * @returns The node or mark serialized as Markdown.
     */
    renderMarkdown: (node, helpers) => {
      const data = node.attrs?.data;
      const target = isContentRecord(data) ? getContentRecords(data.item)[0] : undefined;
      const href =
        target && isContentRecord(target.item) ? resolveContentLink(target.item.path) : null;
      const label = helpers.renderChildren(node);
      return href ? `[${label}](<${href}>)` : label;
    }
  });
}

/**
 * Markdown has no standard subscript/superscript notation; inline HTML preserves that meaning.
 *
 * @param name - Name of the field, node or mark being defined.
 * @param tag - HTML tag used to preserve the script mark.
 * @returns A mark extension that renders child text inside the selected HTML tag.
 */
function createScriptMark(name: string, tag: "sub" | "sup") {
  return Mark.create({
    name,
    /**
     * Serialize this editor node or mark through its configured Markdown renderer.
     *
     * @param node - Content node to render or normalize.
     * @param helpers - Tiptap Markdown helpers for rendering child content.
     * @returns The node or mark serialized as Markdown.
     */
    renderMarkdown: (node, helpers) => `<${tag}>${helpers.renderChildren(node)}</${tag}>`
  });
}

/**
 * Render one cell as inline Markdown and leave room for any additional colspan columns.
 *
 * @param cell - Table cell whose children are rendered inline.
 * @param renderers - Shared document and relation renderers, including the warning callback.
 * @returns Inline cell Markdown followed by placeholders for additional spanned columns.
 */
function renderTableCell(cell: JSONContent, renderers: MarkdownRenderers): string[] {
  const colspan = Number(cell.attrs?.colspan ?? 1);
  const rowspan = Number(cell.attrs?.rowspan ?? 1);
  if (rowspan > 1 || colspan > 1) {
    renderers.warn("Merged table cells are flattened in Markdown.");
  }

  const markdown = renderers
    .renderDocument({ type: "doc", content: cell.content })
    .trim()
    .replace(/\|/g, "\\|")
    .replace(/\n/g, "<br>");
  const columnCount = Math.min(50, Math.max(1, colspan));
  return [markdown, ...Array.from({ length: columnCount - 1 }, () => "")];
}

/**
 * Pad uneven rows so every Markdown table row has the same number of columns.
 *
 * @param values - Rendered cell values in column order.
 * @param width - Number of columns required in the output row.
 * @returns One pipe-delimited Markdown table row padded to the requested width.
 */
function formatTableRow(values: string[], width: number): string {
  const columns = Array.from({ length: width }, (_, index) => values[index] ?? "");
  return `| ${columns.join(" | ")} |`;
}

/**
 * Flatten a Tiptap table into GFM, preserving the first row as data unless it contains headers.
 *
 * @param node - Content node to render or normalize.
 * @param renderers - Shared document and relation renderers, including the warning callback.
 * @returns A GFM table, or an empty string when no columns are present.
 */
function renderTable(node: JSONContent, renderers: MarkdownRenderers): string {
  const documentRows = node.content ?? [];
  const rows = documentRows.map((row) =>
    (row.content ?? []).flatMap((cell) => renderTableCell(cell, renderers))
  );
  const width = Math.max(0, ...rows.map((row) => row.length));
  if (width === 0) {
    return "";
  }

  // GFM requires a header. Insert an empty one when the source has no tableHeader cells.
  const hasHeader = documentRows[0]?.content?.some((cell) => cell.type === "tableHeader");
  const header = hasHeader ? rows.shift()! : [];
  const separator = Array.from({ length: width }, () => "---");
  return [header, separator, ...rows].map((row) => formatTableRow(row, width)).join("\n");
}

/**
 * Assemble standard Tiptap Markdown support and the editor-specific node and mark renderers.
 *
 * @param renderers - Shared document and relation renderers, including the warning callback.
 * @returns Standard and custom Tiptap extensions used by the Markdown serializer.
 */
export function createContentMarkdownExtensions(renderers: MarkdownRenderers): AnyExtension[] {
  return [
    StarterKit.configure({ link: false }),
    createRelationNode("relation-block", renderers),
    createRelationNode("relation-inline-block", renderers),
    createLinkMark(),
    createRelationMark(),
    createScriptMark("subscript", "sub"),
    createScriptMark("superscript", "sup"),
    Node.create({
      name: "table",
      group: "block",
      /**
       * Serialize this editor node or mark through its configured Markdown renderer.
       *
       * @param node - Content node to render or normalize.
       * @returns The node or mark serialized as Markdown.
       */
      renderMarkdown: (node) => renderTable(node, renderers)
    }),
    // Table serialization above handles the entire subtree; these names still belong in the schema.
    Node.create({ name: "tableRow" }),
    Node.create({ name: "tableHeader" }),
    Node.create({ name: "tableCell" })
  ];
}
