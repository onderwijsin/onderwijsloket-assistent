import type { ReadResourceTemplateCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { resourceContent } from "../content/resource-content";
import { withFrontMatter } from "../content/front-matter";

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
   * The getter determines the native record type; presentation selectors do not narrow it.
   * @param record - Validated detail returned by the collection getter.
   * @returns The readable resource body.
   */
  content(record: NoInfer<Document>): string | null;
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
  metadata?(record: NoInfer<Document>): Record<string, unknown>;
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
