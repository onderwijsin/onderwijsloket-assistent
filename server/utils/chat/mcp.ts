import { createMCPClient } from "@ai-sdk/mcp";
import { useNitroApp } from "nitropack/runtime";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getRequestIP, type H3Event } from "h3";
import { INSTRUCTIONS } from "../../../config/mcp";

/**
 * Connect to this application's real MCP endpoint through Nitro's local HTTP dispatcher.
 * @param event - Current chat request, preserving request-local server context.
 * @returns Discovered tools, resource/prompt adapters, server instructions and idempotent cleanup.
 */
export async function connectChatMcp(event: H3Event) {
  const { localFetch } = useNitroApp();
  // Preserve the runtime-resolved caller address through local MCP dispatch for booking quotas.
  event.context.clientAddress = getRequestIP(event);
  const client = await createMCPClient({
    clientName: "onderwijsloket-chat",
    transport: {
      type: "http",
      url: "http://mcp.internal/mcp",
      // Always dispatch the fixed local route; never use a client-supplied host or endpoint.
      fetch: (_url, init) => localFetch("/mcp", { ...init, context: event.context })
    }
  });
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await client.close();
  };
  try {
    const [discovered, prompts] = await Promise.all([
      client.tools(),
      client.experimental_listPrompts()
    ]);
    const tools: ToolSet = {
      ...discovered,
      mcp_list_resources: tool({
        description:
          "Bekijk de leesbare Onderwijsloket-resources en URI-templates. Gebruik teruggegeven resource-URI's; verzin geen record-ID's.",
        inputSchema: z.object({ cursor: z.string().optional() }),
        execute: async ({ cursor }, { abortSignal }) => {
          const [resources, templates] = await Promise.all([
            client.listResources({ params: { cursor }, options: { signal: abortSignal } }),
            client.listResourceTemplates({ options: { signal: abortSignal } })
          ]);
          return { ...resources, ...templates };
        }
      }),
      mcp_read_resource: tool({
        description:
          "Lees de volledige brontekst of het transcript van een teruggegeven onderwijsloket:// resource. Gebruik de canonieke bronlink uit de inhoud voor citaten.",
        inputSchema: z.object({ uri: z.string().startsWith("onderwijsloket://") }),
        execute: ({ uri }, { abortSignal }) =>
          client.readResource({ uri, options: { signal: abortSignal } })
      }),
      mcp_get_prompt: tool({
        description: `Haal een bestaande Onderwijsloket-werkwijze op voor routes, opleidingsvergelijking, lokaal advies of gerelateerde bronnen. Volg de werkwijze met de beschikbare tools. Beschikbare prompts: ${JSON.stringify(prompts.prompts)}`,
        inputSchema: z.object({
          name: z
            .string()
            .refine(
              (name) => prompts.prompts.some((prompt) => prompt.name === name),
              "Unknown prompt"
            ),
          arguments: z.record(z.string(), z.string()).default({})
        }),
        execute: ({ name, arguments: args }, { abortSignal }) =>
          client.experimental_getPrompt({ name, arguments: args, options: { signal: abortSignal } })
      })
    };
    return { tools, instructions: client.instructions || INSTRUCTIONS, close };
  } catch (error) {
    await close();
    throw error;
  }
}

/**
 * Release request-local MCP connections after completion, stream errors or cancellation.
 * @param stream - Stream consumed by the chat response.
 * @param cleanup - Idempotent connection cleanup.
 * @returns A stream with the same chunks and lifecycle-bound cleanup.
 */
export function withMcpCleanup<T>(
  stream: ReadableStream<T>,
  cleanup: () => Promise<void>
): ReadableStream<T> {
  const reader = stream.getReader();
  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const result = await reader.read();
        if (result.done) {
          await cleanup();
          controller.close();
        } else {
          controller.enqueue(result.value);
        }
      } catch (error) {
        await cleanup();
        controller.error(error);
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await cleanup();
      }
    }
  });
}
