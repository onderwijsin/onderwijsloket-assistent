import type { ContentNode, EditorNode } from "./types";
import { contentNodeSchema, editorNodesSchema, isContentRecord } from "./types";

const MAX_DOCUMENT_NODES = 10000;
const MAX_DOCUMENT_DEPTH = 40;

interface RelationScope {
  rows: EditorNode[];
  ancestors: ReadonlySet<string>;
}

/**
 * Resolve editor-node junctions into attrs.data without mutating the fetched document or rows.
 *
 * @param document - Source document to hydrate or render.
 * @param editorNodes - Fetched editor-node junctions used to resolve embedded relations.
 * @returns A cloned hydrated document, warnings and a traversal-truncation flag.
 */
export function injectContentData(document: unknown, editorNodes: unknown = []) {
  const source = contentNodeSchema.parse(document);
  const initialScope: RelationScope = {
    rows: editorNodesSchema.parse(editorNodes ?? []),
    ancestors: new Set()
  };
  const warnings = new Set<string>();
  let visitedNodes = 0;
  let truncated = false;

  /**
   * Resolve one embedded relation and hydrate any nested documents.
   *
   * @param attributes - Editor-node attributes identifying the related collection and junction.
   * @param scope - Available junction rows and the current relation ancestry.
   * @param depth - Current traversal depth, checked against the document limit.
   * @returns Cloned attributes containing resolved data, or an unresolved placeholder with a warning.
   */
  function hydrateRelation(
    attributes: Record<string, unknown> = {},
    scope: RelationScope,
    depth: number
  ): Record<string, unknown> {
    const id = String(attributes.id ?? "");
    const collection = String(attributes.collection ?? "");
    const junction = scope.rows.find((row) => row.id === id && row.collection === collection);

    // Only fetched junction data is authoritative; never reuse attrs.data from the source JSON.
    const result: Record<string, unknown> = { ...attributes, data: undefined };
    if (!junction || !isContentRecord(junction.item)) {
      warnings.add(`Unresolved editor node: ${collection || "unknown"}/${id}.`);
      return result;
    }

    const key = `${collection}/${id}`;
    if (scope.ancestors.has(key)) {
      warnings.add(`Cyclic editor node: ${key}.`);
      return result;
    }

    const payload = structuredClone(junction.item);
    const nestedScope: RelationScope = {
      // Callout-local rows take precedence, while the surrounding document remains available.
      rows: [...editorNodesSchema.parse(payload.editor_nodes ?? []), ...scope.rows],
      // Track ancestry rather than all visited IDs: repeated mentions in separate branches are valid.
      ancestors: new Set([...scope.ancestors, key])
    };

    // A node may contain another document, such as a callout's `description` field.
    for (const [field, value] of Object.entries(payload)) {
      if (isContentRecord(value) && value.type === "doc") {
        payload[field] = visitNode(contentNodeSchema.parse(value), nestedScope, depth + 1);
      }
    }
    result.data = payload;
    return result;
  }

  /**
   * Clone and hydrate a document node while enforcing traversal limits.
   *
   * @param node - Content node to render or normalize.
   * @param scope - Available junction rows and the current relation ancestry.
   * @param depth - Current traversal depth, checked against the document limit.
   * @returns A hydrated node, or an omission marker when traversal limits are reached.
   */
  function visitNode(node: ContentNode, scope: RelationScope, depth: number): ContentNode {
    visitedNodes += 1;
    // Both limits apply across the whole document, including documents nested inside relations.
    if (visitedNodes > MAX_DOCUMENT_NODES || depth > MAX_DOCUMENT_DEPTH) {
      truncated = true;
      warnings.add("Document traversal limit reached.");
      return {
        type: "paragraph",
        content: [{ type: "text", text: "[Content omitted: traversal limit]" }]
      };
    }

    const result: ContentNode = { ...node, attrs: node.attrs ? { ...node.attrs } : undefined };
    if (result.type === "relation-block" || result.type === "relation-inline-block") {
      result.attrs = hydrateRelation(result.attrs, scope, depth);
    }
    if (result.marks) {
      result.marks = result.marks.map((mark) => {
        if (mark.type !== "relation-mark") {
          return mark;
        }
        return { ...mark, attrs: hydrateRelation(mark.attrs, scope, depth) };
      });
    }
    if (result.content) {
      result.content = result.content.map((child) => visitNode(child, scope, depth + 1));
    }
    return result;
  }

  const hydratedDocument = visitNode(source, initialScope, 0);
  return { document: hydratedDocument, warnings: [...warnings], truncated };
}
