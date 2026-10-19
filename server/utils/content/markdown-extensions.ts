import { Mark, Node } from "@tiptap/core";
import type { AnyExtension, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { isContentRecord } from "./types";
import { getContentRecords, resolveContentLink } from "./markdown-formatting";

interface MarkdownRenderers {
  renderRelation(attributes?: Record<string, unknown>): string;
  renderDocument(document: JSONContent): string;
  warn(message: string): void;
}

/** The two editor relation nodes share their attributes and differ only in document placement. */
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
    addAttributes: () => ({
      id: { default: null },
      collection: { default: null },
      junction: { default: null },
      data: { default: null }
    }),
    renderMarkdown: (node) => renderers.renderRelation(node.attrs)
  });
}

/** Replace StarterKit's link renderer so ordinary text links use the same URL rules as blocks. */
function createLinkMark() {
  return Mark.create({
    name: "link",
    renderMarkdown: (node, helpers) => {
      const label = helpers.renderChildren(node);
      const href = resolveContentLink(node.attrs?.href);
      return href ? `[${label}](<${href.replace(/>/g, "%3E")}>)` : label;
    }
  });
}

/** Relation marks retain their existing text instead of using the mention's custom label. */
function createRelationMark() {
  return Mark.create({
    name: "relation-mark",
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

/** Markdown has no standard subscript/superscript notation; inline HTML preserves that meaning. */
function createScriptMark(name: string, tag: "sub" | "sup") {
  return Mark.create({
    name,
    renderMarkdown: (node, helpers) => `<${tag}>${helpers.renderChildren(node)}</${tag}>`
  });
}

/** Render one cell as inline Markdown and leave room for any additional colspan columns. */
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

/** Pad uneven rows so every Markdown table row has the same number of columns. */
function formatTableRow(values: string[], width: number): string {
  const columns = Array.from({ length: width }, (_, index) => values[index] ?? "");
  return `| ${columns.join(" | ")} |`;
}

/** Flatten a Tiptap table into GFM, preserving the first row as data unless it contains headers. */
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

/** Assemble standard Tiptap Markdown support and the editor-specific node and mark renderers. */
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
      renderMarkdown: (node) => renderTable(node, renderers)
    }),
    // Table serialization above handles the entire subtree; these names still belong in the schema.
    Node.create({ name: "tableRow" }),
    Node.create({ name: "tableHeader" }),
    Node.create({ name: "tableCell" })
  ];
}
