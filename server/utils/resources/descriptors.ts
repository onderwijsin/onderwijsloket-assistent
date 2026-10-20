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
