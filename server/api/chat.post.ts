import { defineEventHandler, readValidatedBody, createError, setResponseHeader } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { enforceRateLimit } from "@onderwijsin/nuxt-simple-rate-limiter/runtime";
import {
  ToolLoopAgent,
  isStepCount,
  convertToModelMessages,
  toUIMessageStream,
  createUIMessageStream,
  createUIMessageStreamResponse
} from "ai";
import { chatRequestSchema } from "../utils/chat/request";
import { createChatProvider } from "../utils/chat/provider";
import { connectChatMcp, withMcpCleanup } from "../utils/chat/mcp";
import { generateChatTitle } from "../utils/chat/title";
import { prepareChatMessages } from "../utils/chat/messages";

/**
 * Stream a stateless text conversation using the AI SDK UI message protocol.
 * @param event - Chat request carrying UI messages and optional feature selections.
 * @returns An SSE response with text, optional reasoning and search sources, or an HTTP error.
 */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, { max: 30, duration: 3600, ban: 0 });
  const request = await readValidatedBody(event, chatRequestSchema.parse);
  const credentials = useRuntimeConfig(event).chat;
  const apiKey =
    request.model === "gpt-6-luna" ? credentials.openaiApiKey : credentials.mistralApiKey;
  if (!apiKey) {
    throw createError({ statusCode: 503, statusMessage: "Chat provider is not configured." });
  }
  let mcp: Awaited<ReturnType<typeof connectChatMcp>>;
  try {
    mcp = await connectChatMcp(event);
  } catch {
    throw createError({
      statusCode: 503,
      statusMessage: "Onderwijsloket knowledge is unavailable."
    });
  }
  try {
    let messages;
    try {
      messages = await prepareChatMessages(request.messages, mcp.tools);
    } catch {
      throw createError({ statusCode: 400, statusMessage: "Invalid chat message history." });
    }
    const provider = createChatProvider(request, credentials);
    const agent = new ToolLoopAgent({
      ...provider,
      tools: { ...mcp.tools, ...provider.tools },
      instructions: `Je bent de Onderwijsloket-assistent. Help gebruikers met vragen over werken in het onderwijs. Antwoord in de taal van de gebruiker. Schrijf alle zichtbare redeneersamenvattingen en bijbehorende kopjes in het Nederlands.

Gebruik de Onderwijsloket MCP-tools als primaire kennisbron voor inhoudelijke vragen, ook als zoeken op internet uit staat. Haal relevante feiten op voordat je ze presenteert; beantwoord begroetingen zonder onnodige toolcalls. Gebruik web search alleen aanvullend wanneer ingeschakeld en verwijs alleen naar pagina's van onderwijsloket.com. Verzin geen bronnen. Gebruik mcp_get_prompt voor passende meerstapswerkwijzen en volg de opgehaalde werkwijze. Beschikbare werkwijzen: find-education-routes, compare-programs, find-local-support, find-supporting-articles, find-supporting-media, schedule-consultation. Bij een expliciet verzoek om een adviesgesprek te plannen haal je eerst schedule-consultation op met mcp_get_prompt. Gebruik de toolbeschrijving voor de vereiste argumenten. Je kunt leesbare bronnen ophalen met mcp_list_resources en mcp_read_resource. Houd bevestigde antwoorden en de canonical selections uit route-tools bij in de toolhistorie; vraag ze niet opnieuw als ze al bekend zijn.

De MCP-server geeft deze gebruiksinstructies:
${mcp.instructions}`,
      stopWhen: isStepCount(12),
      maxOutputTokens: 10_000
    });
    setResponseHeader(event, "Cache-Control", "no-store");
    const result = await agent.stream({ messages: await convertToModelMessages(messages) });
    const stream = toUIMessageStream({
      stream: result.stream,
      sendReasoning: request.extendedThinking,
      sendSources: request.webSearch,
      onError: () => "Het antwoord kon niet worden gegenereerd. Probeer het opnieuw."
    });
    const titleAbort = new AbortController();
    const combined = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.merge(stream);
        if (request.generateTitle && request.messages.length === 1) {
          const text = request.messages[0]!.parts.filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(" ");
          const title = await generateChatTitle(
            request.model,
            text,
            credentials,
            titleAbort.signal
          );
          if (title)
            writer.write({ type: "data-conversation-title", data: { title }, transient: true });
        }
      },
      onError: () => "Het antwoord kon niet worden gegenereerd. Probeer het opnieuw."
    });
    return createUIMessageStreamResponse({
      stream: withMcpCleanup(combined, async () => {
        titleAbort.abort();
        await mcp.close();
      }),
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    await mcp.close();
    throw error;
  }
});
