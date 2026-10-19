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
  description: string;
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
    description: record.description,
    mimeType: "text/markdown",
    ...(updated && !Number.isNaN(updated.getTime())
      ? { annotations: { lastModified: updated.toISOString() } }
      : {})
  };
}

/**
 * Supply the native template list callback with every descriptor, fetching summaries in batches.
 *
 * @param collection - Public collection name and its summary-listing method.
 * @returns A cached callback returning the complete resource catalogue; failures reject without caching partial results.
 */
export function listResources(collection: {
  name: string;
  /**
   * Retrieve a page of collection summaries.
   *
   * @param options - Summary page number and page size.
   * @returns Summary records and whether another page is available.
   */
  list(options: { page: number; page_size: number }): Promise<{
    records: ResourceRecord[];
    has_more: boolean;
  }>;
}) {
  return defineCachedFunction(
    async () => {
      try {
        const resources: Resource[] = [];
        // The SDK's template callback returns one complete catalogue. Batch upstream reads,
        // without introducing a second pagination protocol or loading document bodies.
        for (let page = 1; ; page++) {
          const result = await collection.list({ page, page_size: 25 });
          resources.push(
            ...result.records.map((record) => describeResource(collection.name, record))
          );
          if (!result.has_more) return { resources };
        }
      } catch {
        throw new McpError(
          ErrorCode.InternalError,
          `UPSTREAM_UNAVAILABLE: ${collection.name} resources could not be listed.`
        );
      }
    },
    {
      name: "resource-catalogue",
      maxAge: cacheDurations.resourceCatalogue,
      swr: false,
      /**
       * Isolate cached data by its configured identifier.
       *
       * @returns The stable identifier used to isolate the cache entry.
       */
      getKey: () => collection.name
    }
  );
}

/**
 * Create a Markdown resource handler using the collection's validated get method and metadata.
 *
 * @param options - Collection name, validated record getter and optional front matter selector.
 * @returns An MCP template read handler accepting a URI and ID variables and returning Markdown with front matter.
 */
export function serveResource<Document extends { content: string }>(options: {
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
    // Collection get methods currently accept UUIDs. Validate before the upstream call so
    // malformed template variables produce a client error rather than an internal error.
    const id = z.uuid().safeParse(variables.id);
    if (!id.success) throw new McpError(ErrorCode.InvalidParams, "Invalid resource ID.");
    try {
      const { record } = await options.get(id.data);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: "text/markdown",
            text: withFrontMatter(record.content, options.metadata?.(record))
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
