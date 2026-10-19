import { z } from "zod";
import { readTaxonomy } from "./read-taxonomy";
import { taxonomySchema } from "./taxonomy";
import type { TaxonomyCollection } from "./taxonomy";

const operations = z.array(z.literal("list_records"));
const descriptorFields = {
  name: z.string(),
  description: z.string().describe("Meaning and usage of this filter."),
  operations
};

/** Shared discovery contract; operators explain behavior rather than introducing a query DSL. */
const filterDescriptor = z.discriminatedUnion("type", [
  z.object({ ...descriptorFields, type: z.literal("string"), operator: z.literal("eq") }),
  z.object({ ...descriptorFields, type: z.literal("boolean"), operator: z.literal("eq") }),
  z.object({
    ...descriptorFields,
    type: z.literal("array"),
    operator: z.literal("in"),
    items: z.object({ type: z.literal("string"), pattern: z.string() }),
    minItems: z.literal(1),
    maxItems: z.literal(50),
    values: z
      .array(taxonomySchema)
      .describe(
        "Current choices. Submit their id fields; choices do not imply matching record counts."
      )
  })
]);

type FilterDescriptor = z.output<typeof filterDescriptor>;

/** A filter's input validation and discovery data stay together to prevent contract drift. */
interface FilterDefinition<Schema extends z.ZodType = z.ZodType> {
  schema: Schema;
  describe(name: string): Promise<FilterDescriptor>;
}

/** Reusable equality filter for title, slug or other short text fields. */
export function exactTextFilter(description: string) {
  return {
    schema: z.string().trim().min(1).max(200).optional().describe(description),
    async describe(name: string): Promise<FilterDescriptor> {
      return { name, description, type: "string", operator: "eq", operations: ["list_records"] };
    }
  } satisfies FilterDefinition;
}

/** Reusable boolean equality filter; false remains an explicit filter value. */
export function booleanFilter(description: string) {
  return {
    schema: z.boolean().optional().describe(description),
    async describe(name: string): Promise<FilterDescriptor> {
      return { name, description, type: "boolean", operator: "eq", operations: ["list_records"] };
    }
  } satisfies FilterDefinition;
}

/** Build one taxonomy filter, obtaining dynamic choices through the shared one-minute cache. */
export function taxonomyFilter(collection: TaxonomyCollection) {
  const description = `Match any selected ${collection}. Supply 1–50 IDs from get_filters, not titles or slugs; combined with other filter fields using AND.`;
  return {
    schema: z.array(taxonomySchema.shape.id).min(1).max(50).optional().describe(description),
    async describe(name: string): Promise<FilterDescriptor> {
      return {
        name,
        description,
        type: "array",
        operator: "in",
        operations: ["list_records"],
        items: { type: "string", pattern: z.toJSONSchema(taxonomySchema.shape.id).pattern! },
        minItems: 1,
        maxItems: 50,
        values: await readTaxonomy([collection])
      };
    }
  } satisfies FilterDefinition;
}

/** Select taxonomy dimensions once and retain their exact keys in the inferred input type. */
export function taxonomyFilters<const Names extends readonly TaxonomyCollection[]>(names: Names) {
  return Object.fromEntries(names.map((name) => [name, taxonomyFilter(name)])) as {
    [Name in Names[number]]: ReturnType<typeof taxonomyFilter>;
  };
}

/** Derive validation, discovery output and filters() from the same collection filter definitions. */
export function defineCollectionFilters<
  const Name extends string,
  Fields extends Record<string, FilterDefinition>
>(collection: Name, fields: Fields) {
  // Object.fromEntries loses mapped keys; every schema below comes directly from the same field entry.
  const shape = Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.schema])
  ) as {
    [Key in keyof Fields]: Fields[Key]["schema"];
  };
  const filtersOutput = z.object({
    collection: z.literal(collection),
    combination: z.string().describe("How conditions combine across and within filter fields."),
    instructions: z
      .string()
      .describe("How to translate these definitions into list_records arguments."),
    filters: z.array(filterDescriptor),
    retrieved_at: z.iso
      .datetime()
      .describe("UTC response time. Taxonomy choices may be cached for up to one minute.")
  });
  return {
    filterSchema: z.strictObject(shape),
    filtersOutput,
    /** Discover all configured filters or fail, rather than returning incomplete choices. */
    async filters(): Promise<z.output<typeof filtersOutput>> {
      const filters = await Promise.all(
        Object.entries(fields).map(([name, field]) => field.describe(name))
      );
      return {
        collection,
        combination: "AND between dimensions; OR within each dimension",
        instructions: `Call list_records with collection: "${collection}" and filters keyed by the names below. Use IDs from values for taxonomy arrays, not titles or slugs. Pass plain scalar values or ID arrays; do not send operator objects. Omit unused filters. String filters are exact matches, not full-text search. Choices do not include record-match counts.`,
        filters,
        retrieved_at: new Date().toISOString()
      };
    }
  };
}
