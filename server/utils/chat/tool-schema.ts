import { asSchema, jsonSchema, type ToolSet } from "ai";

type JsonSchema = Awaited<ReturnType<typeof asSchema>["jsonSchema"]>;

/** Remove unsupported key constraints only at JSON Schema locations, preserving property names and data. */
function withoutPropertyNames(schema: JsonSchema): JsonSchema {
  const result = { ...schema };
  delete result.propertyNames;
  for (const key of ["properties", "patternProperties", "definitions", "$defs"] as const) {
    const entries = result[key];
    if (entries) {
      result[key] = Object.fromEntries(
        Object.entries(entries).map(([name, child]) => [name, normalize(child)])
      );
    }
  }
  for (const key of [
    "additionalProperties",
    "additionalItems",
    "contains",
    "not",
    "if",
    "then",
    "else"
  ] as const) {
    const child = result[key];
    if (child != null) result[key] = normalize(child);
  }
  if (result.items != null) {
    result.items = Array.isArray(result.items)
      ? result.items.map(normalize)
      : normalize(result.items);
  }
  for (const key of ["allOf", "anyOf", "oneOf"] as const) {
    if (result[key]) result[key] = result[key].map(normalize);
  }
  if (result.dependencies) {
    result.dependencies = Object.fromEntries(
      Object.entries(result.dependencies).map(([name, child]) => [
        name,
        Array.isArray(child) ? child : normalize(child)
      ])
    );
  }
  return result;
}

/** Boolean schemas have no keywords to normalize. */
function normalize(schema: JsonSchema | boolean): JsonSchema | boolean {
  return typeof schema === "boolean" ? schema : withoutPropertyNames(schema);
}

/**
 * Adapt OpenAI tool inputs without weakening the original local validation or mutating MCP schemas.
 * @param tools - Discovered MCP tools and local chat adapters.
 * @returns Tools with OpenAI-compatible input schemas and unchanged execution contracts.
 */
export function normalizeOpenAIChatTools(tools: ToolSet): ToolSet {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => {
      const original = asSchema(tool.inputSchema);
      return [
        name,
        {
          ...tool,
          inputSchema: jsonSchema(async () => withoutPropertyNames(await original.jsonSchema), {
            validate: original.validate
          })
        }
      ];
    })
  );
}
