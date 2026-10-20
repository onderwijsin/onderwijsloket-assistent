import { z } from "zod";
import { createError } from "h3";
import {
  collectionMetadataSchema,
  collectionOperationsSchema,
  collectionResourceSchema
} from "./metadata";
import { createFiltersOutputSchema } from "../taxonomy/collection-filters";
import type { CollectionFiltersResult } from "../taxonomy/collection-filters";
import { facetsOptionsSchema, facetsResultSchema } from "../search/schemas";
import type { FacetsResult } from "../search/schemas";

/** Shared discovery view; heterogeneous record operations never pass through this type. */
interface DiscoveryCollection {
  name: string;
  metadata: z.output<typeof collectionMetadataSchema> & {
    operations: z.output<typeof collectionOperationsSchema>;
    resources: z.output<typeof collectionResourceSchema>[];
  };
  /**
   * Return normalized filter rules and current choices.
   * @returns Validated discovery data for this collection.
   */
  filters(): Promise<CollectionFiltersResult>;
  /**
   * Read contextual facet counts, with defaults applied by the definition.
   * @param input - Optional query, filter, facet and limit context.
   * @returns Validated counts for this collection.
   */
  facets(input?: z.input<typeof facetsOptionsSchema>): Promise<FacetsResult>;
}

/**
 * Publish an explicit allowlist for shared discovery without erasing record schemas.
 * @param definitions - Only implemented, enabled public collection definitions.
 * @returns Discovery schemas and resolvers; record tools retain their own definitions.
 */
export function createCollectionRegistry<const Definitions extends readonly DiscoveryCollection[]>(
  definitions: Definitions
) {
  const entries = Object.freeze(definitions.map((definition) => Object.freeze({ ...definition })));
  if (!entries.length || new Set(entries.map(({ name }) => name)).size !== entries.length) {
    throw new Error("A collection registry requires unique names and at least one collection.");
  }
  if (entries.some(({ name, metadata }) => name !== metadata.name)) {
    throw new Error("Collection metadata must identify its registered collection.");
  }
  const names = z.enum(entries.map(({ name }) => name));
  const filterNames = z.enum(
    entries.filter(({ metadata }) => metadata.capabilities.filters).map(({ name }) => name)
  );
  const facetNames = z.enum(
    entries.filter(({ metadata }) => metadata.capabilities.facets).map(({ name }) => name)
  );
  const metadataSchema = collectionMetadataSchema.extend({
    name: names,
    operations: collectionOperationsSchema.optional(),
    resources: z.array(collectionResourceSchema).optional()
  });
  const filtersOutput = createFiltersOutputSchema(
    filterNames,
    z.enum(
      entries
        .filter(({ metadata }) => metadata.capabilities.filters)
        .map(({ metadata }) => metadata.operations.list)
    )
  );
  const facetsInput = facetsOptionsSchema.extend({ collection: facetNames });
  const facetsOutput = facetsResultSchema.extend({ collection: facetNames });

  /**
   * Resolve a known collection and an optional supported discovery capability.
   * @param name - Public collection name; never an arbitrary upstream table name.
   * @param operation - Capability to require before any provider operation runs.
   * @returns The registered definition, or a sanitized unknown/unsupported error.
   */
  function resolve(name: string, operation?: "filters" | "facets") {
    const definition = entries.find((entry) => entry.name === name);
    if (!definition)
      throw createError({
        statusCode: 400,
        message: "INVALID_COLLECTION: Unknown or unavailable collection."
      });
    if (operation && !definition.metadata.capabilities[operation]) {
      throw createError({
        statusCode: 501,
        message: "UNSUPPORTED_OPERATION: Operation is not available for this collection."
      });
    }
    return definition;
  }

  return {
    entries,
    collectionInput: { collection: names },
    filterInput: { collection: filterNames },
    metadataSchema,
    catalogueOutput: z.object({
      collections: z
        .array(metadataSchema)
        .describe("Available collections and their supported operations.")
    }),
    filtersOutput,
    facetsInput,
    facetsOutput,
    resolve,
    /**
     * Return discovery metadata for every explicitly enabled collection.
     * @returns Validated catalogue entries without provider requests.
     */
    catalogue() {
      return entries.map(({ metadata }) => metadataSchema.parse(metadata));
    },
    /**
     * Retrieve filter discovery only for a supported collection.
     * @param name - Public collection identifier.
     * @returns Validated rules and live choices.
     */
    async filters(name: string) {
      const result = await resolve(name, "filters").filters();
      z.literal(name).parse(result.collection);
      return filtersOutput.parse(result);
    },
    /**
     * Retrieve facet counts only for a supported collection.
     * @param input - Query context and an allowlisted collection name.
     * @returns Validated contextual counts, preserving the collection boundary.
     */
    async facets(input: z.input<typeof facetsInput>) {
      const definition = resolve(input.collection, "facets");
      const { collection: _name, ...options } = facetsInput.parse(input);
      const result = await definition.facets(options);
      z.literal(definition.name).parse(result.collection);
      return facetsOutput.parse(result);
    }
  };
}
