import { describe, expect, it } from "vitest";
import { z } from "zod";
import { nullableOutput } from "../../server/utils/mcp-schema";

describe("nullable MCP output schemas", () => {
  it.each([z.string(), z.boolean(), z.url()])(
    "preserves explicit null branches and requiredness",
    (field) => {
      const schema = z.object({ value: nullableOutput(field).describe("Field description") });
      const json = z.toJSONSchema(schema);
      expect(json.required).toEqual(["value"]);
      expect(json.properties?.value).toMatchObject({
        description: "Field description",
        anyOf: [expect.any(Object), { type: "null", description: expect.any(String) }]
      });
      expect(schema.safeParse({ value: null }).success).toBe(true);
      expect(schema.safeParse({}).success).toBe(false);
    }
  );

  it("retains non-null validation and schema constraints", () => {
    const schema = nullableOutput(z.url());
    expect(schema.safeParse("https://onderwijsloket.com").success).toBe(true);
    expect(schema.safeParse("not a URL").success).toBe(false);
    expect(z.toJSONSchema(schema).anyOf?.[0]).toMatchObject({ type: "string", format: "uri" });
  });
});
