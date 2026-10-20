import { readItems } from "@directus/sdk";
import { useDirectusServer } from "@onderwijsin/nuxt-directus-client/runtime/server";
import type { Schema } from "#directus";
import { defineCachedFunction } from "nitropack/runtime";
import { cacheDurations } from "../../config/cache";
import type { ReadResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { withFrontMatter } from "./content/front-matter";
import type { Resource } from "@modelcontextprotocol/sdk/types.js";

interface ResourceRecord {
  id: string;
  title: string;
  description?: string | null;
  date_updated?: string | null;
}

/**
 * Build a project resource identifier for any collection; this is not a browser URL.
 *
 * @param collection - Public collection name.
 * @param id - Record identifier.
 * @returns The collection record URI for MCP resource reads.
 */
export function resourceUri(collection: string, id: string): string {
  return `onderwijsloket://${collection}/${id}`;
}

/**
 * Describe a Markdown record for MCP resource links without fetching its document body.
 *
 * @param collection - Public collection name.
 * @param record - Record whose metadata is being normalized.
 * @returns A Markdown resource descriptor with an optional valid update annotation.
 */
export function describeResource(collection: string, record: ResourceRecord): Resource {
  const updated = record.date_updated ? new Date(record.date_updated) : null;
  return {
    uri: resourceUri(collection, record.id),
    name: record.id,
    title: record.title,
    ...(typeof record.description === "string" ? { description: record.description } : {}),
    mimeType: "text/markdown",
    ...(updated && !Number.isNaN(updated.getTime())
      ? { annotations: { lastModified: updated.toISOString() } }
      : {})
  };
}

/** Internal descriptor page size, independent of the public record-tool pagination limit. */
export const resourceCataloguePageSize = 250;
let catalogueQueue: Promise<void> = Promise.resolve();

/**
 * Serialize catalogue page reads in this runtime; a failed read always releases the next caller.
 * @param read - One descriptor-only source request.
 * @returns The source response, without retaining a request event or client credential.
 */
async function queueCatalogueRead<T>(read: () => Promise<T>): Promise<T> {
  const previous = catalogueQueue;
  let release!: () => void;
  catalogueQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await read();
  } finally {
    release();
  }
}

/**
 * Supply a complete resource catalogue using only root identity, label and update metadata.
 * @param collection - Registered collection identity and its existing record-ID validator.
 * @returns Cached, coalesced catalogue callback; no public list method or nested relation is used.
 */
export function listResources(collection: {
  name: Extract<
    keyof Schema,
    "articles" | "faqs" | "sectors" | "testimonials" | "programs" | "educational_institutions"
  >;
  getInput: { shape: { id: z.ZodType<string> } };
}) {
  const label = collection.name === "faqs" ? "question" : "title";
  const sourceSchema = z.array(
    z.object({
      id: collection.getInput.shape.id,
      title: z.string().optional(),
      question: z.string().optional(),
      date_updated: z.string().nullish()
    })
  );
  return defineCachedFunction(
    async () => {
      try {
        const resources: Resource[] = [];
        const seen = new Set<string>();
        for (let offset = 0; ;) {
          const rows = sourceSchema.parse(
            await queueCatalogueRead(() =>
              useDirectusServer(
                collection.name === "faqs"
                  ? readItems("faqs", {
                      fields: ["id", "question", "date_updated"],
                      sort: ["id"],
                      limit: resourceCataloguePageSize,
                      offset
                    })
                  : readItems(collection.name, {
                      fields: ["id", "title", "date_updated"],
                      sort: ["id"],
                      limit: resourceCataloguePageSize,
                      offset
                    })
              )
            )
          );
          if (rows.length === 0) return { resources };
          for (const row of rows) {
            // A non-advancing provider page must fail rather than loop or cache a partial catalogue.
            if (seen.has(row.id)) throw new Error("Repeated catalogue record.");
            seen.add(row.id);
            resources.push({
              ...describeResource(collection.name, {
                id: row.id,
                title: z.string().parse(row[label]),
                date_updated: row.date_updated
              }),
              // Suppress the SDK's long template-description fallback on every listed record.
              // Empty metadata survives cache serialization and does not invent domain content.
              description: ""
            });
          }
          // Continue through an empty page: even a lower upstream page cap cannot truncate discovery.
          offset += rows.length;
        }
      } catch {
        throw new McpError(
          ErrorCode.InternalError,
          `UPSTREAM_UNAVAILABLE: ${collection.name} resources could not be listed.`
        );
      }
    },
    {
      name: "resource-catalogue-descriptors",
      maxAge: cacheDurations.resourceCatalogue,
      swr: false,
      /** @returns A collection-scoped key; Nitro coalesces concurrent cold requests for this key. */
      getKey: () => collection.name
    }
  );
}

/**
 * Make absent content explicit in every Markdown resource without inventing a source body.
 * @param markdown - Rendered source content, or null when unavailable.
 * @returns Existing Markdown or a visible notice referring readers to the resource metadata.
 */
export function resourceContent(markdown: string | null | undefined): string {
  return markdown?.trim()
    ? markdown
    : "> **Notice:** No body content is available. Any available record information is provided in the metadata.";
}

/**
 * Create a Markdown resource handler using the collection's validated get method and metadata.
 *
 * @param options - Collection name, ID schema, getter, Markdown selector and optional front matter selector.
 * @returns An MCP template read handler accepting a URI and ID variables and returning Markdown with front matter.
 */
export function serveResource<Document>(options: {
  id: z.ZodType<string>;
  /**
   * Select the collection-specific Markdown representation.
   * @param record - Validated detail returned by the collection getter.
   * @returns The readable resource body.
   */
  content(record: Document): string | null;
  name: string;
  /**
   * Retrieve one complete collection record.
   *
   * @param id - Record identifier.
   * @returns An envelope containing the retrieved document.
   */
  get(id: string): Promise<{ record: Document }>;
  /**
   * Select front matter fields from the retrieved document.
   *
   * @param record - Record whose metadata is being normalized.
   * @returns Record metadata to serialize as YAML front matter.
   */
  metadata?(record: Document): Record<string, unknown>;
}) {
  return (async (uri, variables) => {
    // Validate with the same collection-specific identity contract as its get tool.
    const id = options.id.safeParse(variables.id);
    if (!id.success) throw new McpError(ErrorCode.InvalidParams, "Invalid resource ID.");
    try {
      const { record } = await options.get(id.data);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: withFrontMatter(
              resourceContent(options.content(record)),
              options.metadata?.(record)
            )
          }
        ]
      };
    } catch (error) {
      if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `NOT_FOUND: ${options.name} resource not found.`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `UPSTREAM_UNAVAILABLE: ${options.name} resource could not be retrieved or validated.`
      );
    }
  }) satisfies ReadResourceTemplateCallback;
}
