import type { Resource } from "@modelcontextprotocol/sdk/types.js";

/**
 * Package validated output consistently for structured and text-only MCP clients.
 * @param result - Output already validated against the tool's published schema.
 * @param resources - Descriptors for explicitly registered, readable representations only.
 * @returns Structured content, a JSON fallback and optional resource links.
 */
export function toolResult<Result extends object>(result: Result, resources: Resource[] = []) {
  return {
    structuredContent: result,
    content: [
      { type: "text" as const, text: JSON.stringify(result) },
      ...resources.map((resource) => ({ type: "resource_link" as const, ...resource }))
    ]
  };
}
