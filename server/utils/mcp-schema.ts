import { z } from "zod";

/**
 * Preserve required-but-nullable output fields as explicit anyOf branches for MCP clients.
 *
 * @param schema - Output schema that also accepts an explicit null.
 * @returns An explicit nullable union preserving the non-null schema contract.
 */
export function nullableOutput<Schema extends z.ZodType>(schema: Schema) {
  // Zod compacts bare primitive unions into type arrays. Metadata on the null branch keeps
  // anyOf intact without changing validation, requiredness or the non-null branch's constraints.
  return z.union([schema, z.null().describe("No value is available for this field.")]);
}
