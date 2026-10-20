import { listMcpDefinitions } from "@nuxtjs/mcp-toolkit/server";
import { MCP_SERVER } from "../../../../config/mcp";

/**
 * Describe the server and its request-visible MCP definitions.
 * @param event - Current request used to evaluate definition visibility.
 * @returns Server identity and summaries of tools, resources and prompts.
 */
export default defineEventHandler(async (event) => {
  const { tools, resources, prompts } = await listMcpDefinitions({ event });
  return {
    ...MCP_SERVER,
    tools: tools.map(({ name, description }) => ({ name, description })),
    resources: resources.map(({ name, uri, description }) => ({ name, uri, description })),
    prompts: prompts.map(({ name, description }) => ({ name, description }))
  };
});
