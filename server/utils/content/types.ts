import { z } from "zod";

/** Collection-independent Tiptap JSON node and mark data. */
export interface ContentNode {
  type: string;
  text?: string;
  // Payloads differ per editor node; relation renderers narrow the fields they consume.
  attrs?: Record<string, unknown>;
  content?: ContentNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** Validate document structure at the Directus boundary. */
export const contentNodeSchema: z.ZodType<ContentNode> = z.object({
  type: z.string(),
  text: z.string().optional(),
  attrs: z.record(z.string(), z.unknown()).optional(),
  get content() {
    return z.array(contentNodeSchema).optional();
  },
  marks: z
    .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
    .optional()
});

/** Editor-node junction rows, independent of their parent collection. */
export const editorNodesSchema = z.array(
  z.object({
    // Stored documents and Directus responses may use different ID scalar types.
    id: z.union([z.string(), z.number()]).transform(String),
    collection: z.string().nullish(),
    item: z.unknown().optional()
  })
);

export type EditorNode = z.infer<typeof editorNodesSchema>[number];

/**
 * Narrow arbitrary JSON payloads before inspecting relation fields.
 *
 * @param value - Value to inspect without assuming it has the expected shape.
 * @returns True when the value is a non-null object rather than an array.
 */
export function isContentRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Runtime-specific asset base; document rendering does not depend on Nuxt configuration. */
export interface ContentMarkdownOptions {
  assetBaseUrl: string;
}
