import { describe, expect, it } from "vitest";
import { createTaxonomyRelationSchema } from "../../server/utils/taxonomy/create-taxonomy-relation-schema";
import {
  createTaxonomySourceSchema,
  taxonomyCollections
} from "../../server/utils/taxonomy/taxonomy";

const id = "00000000-0000-0000-0000-000000000001";

describe("createTaxonomyRelationSchema", () => {
  it.each(taxonomyCollections)(
    "normalizes %s junctions using the lookup metadata contract",
    (collection) => {
      const label = ["sectors", "phases", "audiences"].includes(collection) ? "title" : "name";
      const record = { id, [label]: "Label", slug: "label", description: "Description" };
      const result = createTaxonomyRelationSchema(collection).parse([
        { [`${collection}_id`]: record }
      ]);
      expect(result).toEqual([{ id, title: "Label", slug: "label", description: "Description" }]);
      expect(result).toEqual([createTaxonomySourceSchema(collection).parse(record)]);
    }
  );

  it("handles missing arrays, null targets and absent metadata", () => {
    const schema = createTaxonomyRelationSchema("audiences");
    expect(schema.parse(undefined)).toEqual([]);
    expect(schema.parse(null)).toEqual([]);
    expect(
      schema.parse([{ audiences_id: null }, { audiences_id: { id, title: "Overstappers" } }])
    ).toEqual([{ id, title: "Overstappers", slug: null, description: null }]);
  });

  it("rejects malformed junction targets and incorrect label fields", () => {
    const schema = createTaxonomyRelationSchema("topics");
    expect(schema.safeParse([{ topics_id: { id, title: "Wrong label" } }]).success).toBe(false);
    expect(schema.safeParse([{ topics_id: "unexpanded-id" }]).success).toBe(false);
    expect(schema.safeParse([{ roles_id: { id, name: "Wrong junction" } }]).success).toBe(false);
  });
});
