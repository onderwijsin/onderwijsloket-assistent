import { listMcpTools } from "@nuxtjs/mcp-toolkit/server";

/**
 * List request-visible tools grouped by their declared group.
 * @param event - Current request used to evaluate tool visibility.
 * @returns JSON-friendly tool summaries, with ungrouped tools under `default`.
 */
export default defineEventHandler(async (event) => {
  const tools = await listMcpTools({ event });
  return Object.groupBy(tools, (tool) => tool.group ?? "default");
});
