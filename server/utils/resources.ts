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

/** Build a project resource identifier for any collection; this is not a browser URL. */
export function resourceUri(collection: string, id: string): string {
  return `onderwijsloket://${collection}/${id}`;
}

/** Describe a Markdown record for MCP resource links without fetching its document body. */
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

/** Supply the native template list callback with every descriptor, fetching summaries in batches. */
export function listResources(collection: {
  name: string;
  list(options: { page: number; page_size: number }): Promise<{
    records: ResourceRecord[];
    has_more: boolean;
  }>;
}) {
  return async () => {
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
  };
}

/** Create a Markdown resource handler using the collection's validated get method and metadata. */
export function serveResource<Document extends { content: string }>(options: {
  name: string;
  get(id: string): Promise<{ record: Document }>;
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
