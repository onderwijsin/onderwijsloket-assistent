import { describe, expect, it, vi } from "vitest";
import { asSchema, jsonSchema, tool } from "ai";
import { z } from "zod";
import { normalizeOpenAIChatTools } from "../../server/utils/chat/tool-schema";

describe("OpenAI chat tool schemas", () => {
  it("removes nested key constraints while retaining UUID validation and execution", async () => {
    const execute = vi.fn();
    const original = tool({
      inputSchema: z.object({ selections: z.record(z.uuid(), z.uuid()).default({}) }),
      execute
    });
    const tools = normalizeOpenAIChatTools({ routes: original });
    const schema = asSchema(tools.routes!.inputSchema);
    const providerSchema = await schema.jsonSchema;
    expect(providerSchema.properties?.selections).not.toHaveProperty("propertyNames");
    expect(providerSchema.properties?.selections).toHaveProperty("additionalProperties");
    expect(await schema.validate!({ selections: { invalid: "invalid" } })).toMatchObject({
      success: false
    });
    expect(await schema.validate!({})).toEqual({ success: true, value: { selections: {} } });
    expect(tools.routes!.execute).toBe(execute);
    expect((await asSchema(original.inputSchema).jsonSchema).properties?.selections).toHaveProperty(
      "propertyNames"
    );
  });

  it("preserves literal properties and default data named propertyNames", async () => {
    const input = {
      type: "object" as const,
      properties: {
        propertyNames: { type: "string" as const },
        arguments: { type: "object" as const, propertyNames: { type: "string" as const } }
      },
      default: { propertyNames: "keep" },
      anyOf: [{ propertyNames: { type: "string" as const } }]
    };
    const tools = normalizeOpenAIChatTools({ prompt: tool({ inputSchema: jsonSchema(input) }) });
    const schema = await asSchema(tools.prompt!.inputSchema).jsonSchema;
    expect(schema.properties?.propertyNames).toEqual({ type: "string" });
    expect(schema.default).toEqual({ propertyNames: "keep" });
    expect(schema.anyOf).toEqual([{}]);
    expect(schema.properties?.arguments).not.toHaveProperty("propertyNames");
    expect(input.properties.arguments).toHaveProperty("propertyNames");
  });
});
