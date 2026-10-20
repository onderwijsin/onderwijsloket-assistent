import { z } from "zod";
import { readTaxonomy } from "./read-taxonomy";
import { taxonomySchema } from "./taxonomy";
import type { TaxonomyCollection } from "./taxonomy";

/**
 * Describe the same small filter vocabulary for any concrete list tool.
 * @param operation - Tool-name schema; literal for a collection, string for shared discovery.
 * @returns Typed filter descriptors without embedding collection record schemas.
 */
function createFilterDescriptor(operation: z.ZodType<string>) {
  const descriptorFields = {
    name: z.string(),
    description: z.string().describe("Meaning and usage of this filter."),
    operations: z.array(operation)
  };

  /** Shared discovery contract; operators explain behavior rather than introducing a query DSL. */
  const taxonomyDescriptors = z.discriminatedUnion("type", [
    z.object({
      ...descriptorFields,
      type: z.literal("string"),
      operator: z.literal("eq"),
      enum: z.array(z.string()).optional(),
      lookup: z
        .object({ collection: z.string(), tool: z.string(), path: z.string().optional() })
        .optional()
    }),
    z.object({ ...descriptorFields, type: z.literal("boolean"), operator: z.literal("eq") }),
    z.object({
      ...descriptorFields,
      type: z.literal("integer"),
      operator: z.literal("eq"),
      minimum: z.literal(0)
    }),
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
  return z.union([
    taxonomyDescriptors,
    z.object({
      ...descriptorFields,
      type: z.literal("array"),
      operator: z.literal("in"),
      items: z.object({
        type: z.literal("string"),
        format: z.string().optional(),
        pattern: z.string().optional()
      }),
      minItems: z.literal(1),
      maxItems: z.literal(50),
      lookup: z.object({ collection: z.string(), tool: z.string(), path: z.string().optional() })
    })
  ]);
}

/** Common filter vocabulary used by the registry's discovery boundary. */
export const filterDescriptorSchema = createFilterDescriptor(z.string());
type FilterDescriptor = z.output<typeof filterDescriptorSchema>;

/**
 * Build a shared result envelope without coupling it to article metadata or records.
 * @param collection - Allowed public collection identifiers.
 * @param operation - Allowed list-tool names in the descriptors.
 * @returns A portable discovery output schema.
 */
export function createFiltersOutputSchema(
  collection: z.ZodType<string>,
  operation: z.ZodType<string> = z.string()
) {
  return z.object({
    collection,
    combination: z.string().describe("How conditions combine across and within filter fields."),
    instructions: z.string().describe("How to translate these definitions into list arguments."),
    filters: z.array(createFilterDescriptor(operation)),
    retrieved_at: z.iso
      .datetime()
      .describe("UTC response time. Taxonomy choices may be cached for up to one minute.")
  });
}

/** Shared result type for filter discovery, independent of the collection's records. */
export type CollectionFiltersResult = z.output<ReturnType<typeof createFiltersOutputSchema>>;

/** A filter's input validation and discovery data stay together to prevent contract drift. */
interface FilterDefinition<Schema extends z.ZodType = z.ZodType> {
  schema: Schema;
  /**
   * Describe this filter for list-record discovery.
   *
   * @param name - Name of the field, node or mark being defined.
   * @returns The filter descriptor, including current taxonomy choices where applicable.
   */
  describe(name: string): Promise<FilterDescriptor>;
}

/**
 * Reusable equality filter for title, slug or other short text fields.
 *
 * @param description - Client-facing explanation of the filter and its matching behavior.
 * @returns An optional text schema and its equality-filter discovery descriptor.
 */
export function exactTextFilter(description: string) {
  return {
    schema: z.string().trim().min(1).max(200).optional().describe(description),
    /**
     * Describe this filter for list-record discovery.
     *
     * @param name - Name of the field, node or mark being defined.
     * @returns The filter descriptor, including current taxonomy choices where applicable.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return { name, description, type: "string", operator: "eq", operations: ["list_articles"] };
    }
  } satisfies FilterDefinition;
}

/**
 * Define a source enum equality filter with portable discovery choices.
 * @param values - Exact source classification values from the generated model.
 * @param description - Meaning of the classification for list filtering.
 * @returns A validated optional enum and matching discovery descriptor.
 */
export function enumFilter<const Values extends readonly string[]>(
  values: Values,
  description: string
) {
  return {
    schema: z.enum(values).optional().describe(description),
    /**
     * Advertise accepted source codes rather than mutable search facet labels.
     * @param name - Public filter key.
     * @returns Enum equality descriptor routed to the consuming list tool.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return {
        name,
        description,
        type: "string",
        operator: "eq",
        enum: [...values],
        operations: ["list_articles"]
      };
    }
  } satisfies FilterDefinition;
}

/**
 * Advertise a nonnegative whole-number equality filter, preserving episode zero.
 * @param description - Native numeric field meaning.
 * @returns Optional integer validation and matching discovery metadata.
 */
export function integerFilter(description: string) {
  return {
    schema: z.number().int().nonnegative().optional().describe(description),
    /**
     * @param name - Public field key.
     * @returns Integer equality descriptor.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return {
        name,
        description,
        type: "integer",
        operator: "eq",
        minimum: 0,
        operations: ["list_articles"]
      };
    }
  } satisfies FilterDefinition;
}

/**
 * Reusable boolean equality filter; false remains an explicit filter value.
 *
 * @param description - Client-facing explanation of the filter and its matching behavior.
 * @returns An optional boolean schema and its equality-filter discovery descriptor.
 */
export function booleanFilter(description: string) {
  return {
    schema: z.boolean().optional().describe(description),
    /**
     * Describe this filter for list-record discovery.
     *
     * @param name - Name of the field, node or mark being defined.
     * @returns The filter descriptor, including current taxonomy choices where applicable.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return { name, description, type: "boolean", operator: "eq", operations: ["list_articles"] };
    }
  } satisfies FilterDefinition;
}

/**
 * Build one taxonomy filter, obtaining dynamic choices through the shared one-minute cache.
 *
 * @param collection - Collection name or definition used by this operation.
 * @returns An optional taxonomy-ID array schema and dynamically loaded discovery choices.
 */
export function taxonomyFilter(collection: TaxonomyCollection) {
  const description = `Match any selected ${collection}. Supply 1–50 IDs from get_filters, not titles or slugs; combined with other filter fields using AND.`;
  return {
    schema: z.array(taxonomySchema.shape.id).min(1).max(50).optional().describe(description),
    /**
     * Describe this filter for list-record discovery.
     *
     * @param name - Name of the field, node or mark being defined.
     * @returns The filter descriptor, including current taxonomy choices where applicable.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return {
        name,
        description,
        type: "array",
        operator: "in",
        operations: ["list_articles"],
        items: { type: "string", pattern: z.toJSONSchema(taxonomySchema.shape.id).pattern! },
        minItems: 1,
        maxItems: 50,
        values: await readTaxonomy([collection])
      };
    }
  } satisfies FilterDefinition;
}

/**
 * Describe bounded related-record ID selection without enumerating every target record.
 * @param collection - Public collection whose list result supplies the target IDs.
 * @param tool - Concrete list tool providing accepted target IDs.
 * @param id - Validator for target identities, independent of taxonomy GUIDs.
 * @param path - Optional nested target-ID path in each list record (for embedded supporting records).
 * @returns Matching input and relation-lookup discovery metadata.
 */
export function relationIdFilter(
  collection: string,
  tool: string,
  id: z.ZodType<string>,
  path?: string
) {
  const description = `Match any of 1–50 IDs from ${path ?? collection} returned by ${tool}; use target IDs, not labels or parent record IDs.`;
  return {
    schema: z.array(id).min(1).max(50).optional().describe(description),
    /**
     * Describe related-record lookup and ID validation.
     * @param name - Public filter key.
     * @returns A bounded array descriptor referencing its lookup tool.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      const json = z.toJSONSchema(id);
      return {
        name,
        description,
        type: "array",
        operator: "in",
        operations: [tool],
        items: {
          type: "string",
          ...(typeof json.format === "string" ? { format: json.format } : {}),
          ...(typeof json.pattern === "string" ? { pattern: json.pattern } : {})
        },
        minItems: 1,
        maxItems: 50,
        lookup: { collection, tool, ...(path ? { path } : {}) }
      };
    }
  } satisfies FilterDefinition;
}

/**
 * Describe a single related-record ID, for nullable M2O fields such as program location.
 * @param collection - Public collection supplying the nested identifier.
 * @param tool - Concrete list tool to discover identifiers.
 * @param id - Boundary validator for one target ID.
 * @param path - Target ID path within the lookup result.
 * @returns Single-ID equality validation and discovery metadata.
 */
export function relationIdEqualityFilter(
  collection: string,
  tool: string,
  id: z.ZodType<string>,
  path: string
) {
  const description = `Match the ID from ${path} returned by ${tool}; use the related record ID, not a parent ID or label.`;
  return {
    schema: id.optional().describe(description),
    /**
     * Advertise equality on a related ID with an explicit discovery path.
     * @param name - Public filter name.
     * @returns Lookup metadata for a single related ID.
     */
    async describe(name: string): Promise<FilterDescriptor> {
      return {
        name,
        description,
        type: "string",
        operator: "eq",
        operations: [tool],
        lookup: { collection, tool, path }
      };
    }
  } satisfies FilterDefinition;
}

/**
 * Select taxonomy dimensions once and retain their exact keys in the inferred input type.
 *
 * @param names - Taxonomy collections to expose as filter dimensions.
 * @returns Taxonomy filter definitions keyed by the selected collection names.
 */
export function taxonomyFilters<const Names extends readonly TaxonomyCollection[]>(names: Names) {
  return Object.fromEntries(names.map((name) => [name, taxonomyFilter(name)])) as {
    [Name in Names[number]]: ReturnType<typeof taxonomyFilter>;
  };
}

/**
 * Derive validation, discovery output and filters() from the same collection filter definitions.
 *
 * @param collection - Collection name or definition used by this operation.
 * @param fields - Filter definitions keyed by their public argument names.
 * @param options - Concrete list-tool routing; omit the collection argument for dedicated tools.
 * @returns The combined input schema, discovery output schema and filters method.
 */
export function defineCollectionFilters<
  const Name extends string,
  Fields extends Record<string, FilterDefinition>
>(
  collection: Name,
  fields: Fields,
  options: { listTool?: string; collectionArgument?: boolean } = {}
) {
  // Object.fromEntries loses mapped keys; every schema below comes directly from the same field entry.
  const shape = Object.fromEntries(
    Object.entries(fields).map(([name, field]) => [name, field.schema])
  ) as {
    [Key in keyof Fields]: Fields[Key]["schema"];
  };
  const listTool = options.listTool ?? "list_articles";
  const filtersOutput = createFiltersOutputSchema(z.literal(collection), z.literal(listTool));
  return {
    filterSchema: z.strictObject(shape),
    filtersOutput,
    /**
     * Discover all configured filters or fail, rather than returning incomplete choices.
     *
     * @returns Validated filter definitions with current taxonomy choices.
     */
    async filters(): Promise<z.output<typeof filtersOutput>> {
      const filters = await Promise.all(
        Object.entries(fields).map(async ([name, field]) => ({
          ...(await field.describe(name)),
          operations: [listTool]
        }))
      );
      return {
        collection,
        combination: "AND between dimensions; OR within each dimension",
        instructions: `Call ${listTool}${options.collectionArgument === false ? "" : ` with collection: "${collection}"`} and filters keyed by the names below. Use IDs from values for taxonomy arrays, not titles or slugs. Pass plain scalar values or ID arrays; do not send operator objects. Omit unused filters. String filters are exact matches, not full-text search. Choices do not include record-match counts.`,
        filters,
        retrieved_at: new Date().toISOString()
      };
    }
  };
}
