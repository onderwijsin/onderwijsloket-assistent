import { z } from "zod";
import { getHeader, getRequestIP, readBody, type H3Event } from "h3";
import type { ToolAnalyticsProps } from "./plausible";

const toolCallSchema = z.object({
  method: z.literal("tools/call"),
  params: z.object({
    name: z.string(),
    arguments: z
      .object({
        collection: z.string().optional(),
        query: z.string().optional()
      })
      .optional()
  })
});

type CollectionTool = {
  name?: string;
  inputSchema?: { collection?: z.ZodType };
};

/** Request details retained until the tool completes; excludes unrelated arguments. */
export type ToolCallDetails = Pick<ToolAnalyticsProps, "tool" | "collection" | "data">;

/** Capture analytics before the SDK consumes the stream, preserving its request body. */
export async function readToolCallDetails(
  event: H3Event,
  tools: readonly CollectionTool[],
  includeData: boolean
): Promise<ToolCallDetails | undefined> {
  let body: unknown;
  try {
    // Web requests need a clone; h3 caches Node bodies for the transport to replay.
    body = event.web?.request ? await event.web.request.clone().json() : await readBody(event);
  } catch {
    return;
  }

  const parsed = toolCallSchema.safeParse(body);
  if (!parsed.success) return;

  const { name, arguments: args } = parsed.data.params;
  const schema = tools.find((tool) => tool.name === name)?.inputSchema?.collection;
  const collection = schema?.safeParse(args?.collection);
  const details: ToolCallDetails = {
    tool: name,
    collection:
      collection?.success && typeof collection.data === "string" ? collection.data : "unknown"
  };

  const supportsQuery = name === "search_collection" || name === "get_facets";
  if (includeData && supportsQuery && args?.query) {
    details.data = args.query.slice(0, 500);
  }
  return details;
}

/** Forward attribution headers without trusting arbitrary X-Forwarded-For chains. */
export function getToolAnalyticsHeaders(event: H3Event): Record<string, string> {
  const headers: Record<string, string> = {
    "user-agent": getHeader(event, "user-agent") || "Onderwijsloket MCP"
  };
  const ip = getHeader(event, "cf-connecting-ip") || getRequestIP(event);
  if (ip) headers["x-forwarded-for"] = ip;
  return headers;
}
