import { createMCPClient } from "@ai-sdk/mcp";
import { useNitroApp } from "nitropack/runtime";
import { tool, type ToolSet } from "ai";
import { z } from "zod";
import { getHeader, getRequestIP, type H3Event } from "h3";
import { INSTRUCTIONS } from "../../../config/mcp";
import type { ChatRequest } from "./request";

/**
 * Connect to this application's real MCP endpoint through Nitro's local HTTP dispatcher.
 * @param event - Current chat request, preserving request-local server context.
 * @param request - Validated current conversation and settings, attached only to feedback submissions.
 * @returns Discovered tools, resource/prompt adapters, server instructions and idempotent cleanup.
 */
export async function connectChatMcp(event: H3Event, request?: ChatRequest) {
  const { localFetch } = useNitroApp();
  // Preserve the runtime-resolved caller address through local MCP dispatch for booking quotas.
  event.context.clientAddress = getRequestIP(event);
  event.context.schedulingClientName = "onderwijsloket-chat";
  // Request-local only: no other chats or unsent drafts are accessible here.
  event.context.feedbackChatSnapshot = request
    ? {
        conversation: { messages: request.messages },
        userAgent: getHeader(event, "user-agent")?.slice(0, 2000),
        settings: {
          model: request.model,
          webSearch: request.webSearch,
          extendedThinking: request.extendedThinking
        }
      }
    : undefined;
  const client = await createMCPClient({
    clientName: "onderwijsloket-chat",
    transport: {
      type: "http",
      url: "http://mcp.internal/mcp",
      // Always dispatch the fixed local route; never use a client-supplied host or endpoint.
      // Nitro 2 localFetch places context on req.__unenv__ and promotes only
      // _platform entries to the inner H3 event.context. Forward the allowlisted
      // request metadata there; plain context entries do not reach MCP handlers.
      /**
       * Dispatch MCP requests locally while forwarding allowlisted request context.
       * @param _url - Unused transport URL; requests always target the local MCP endpoint.
       * @param init - Transport request options, including headers and body.
       * @returns The local MCP HTTP response.
       */
      fetch: (_url, init) =>
        localFetch("/mcp", {
          ...init,
          context: {
            _platform: {
              ...event.context._platform,
              clientAddress: event.context.clientAddress,
              schedulingClientName: event.context.schedulingClientName,
              feedbackChatSnapshot: event.context.feedbackChatSnapshot
            }
          }
        })
    }
  });
  let closed = false;
  /** Close the request-local MCP client at most once. */
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
        /**
         * List MCP resources and templates with request cancellation.
         * @param options - Resource pagination cursor.
         * @param context - Tool execution context containing the abort signal.
         * @returns Combined resource descriptors and URI templates.
         */
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
        /**
         * Read an MCP resource using the caller’s cancellation signal.
         * @param options - Resource URI to read.
         * @param context - Tool execution context containing the abort signal.
         * @returns The MCP resource contents.
         */
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
        /**
         * Retrieve an advertised MCP prompt with its supplied arguments.
         * @param options - Prompt name and argument values.
         * @param context - Tool execution context containing the abort signal.
         * @returns The resolved MCP prompt messages.
         */
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
    /**
     * Forward the next chunk and clean up the MCP client on completion or failure.
     * @param controller - Controller receiving chunks, completion or errors.
     */
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
    /**
     * Cancel the source reader and release the MCP connection even if cancellation fails.
     * @param reason - Consumer-provided cancellation reason.
     */
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await cleanup();
      }
    }
  });
}
