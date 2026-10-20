import { defineEventHandler, readValidatedBody, createError, setResponseHeader } from "h3";
import { useRuntimeConfig } from "nitropack/runtime";
import { enforceRateLimit } from "@onderwijsin/nuxt-simple-rate-limiter/runtime";
import {
  streamText,
  convertToModelMessages,
  toUIMessageStream,
  createUIMessageStreamResponse
} from "ai";
import { chatRequestSchema } from "../utils/chat/request";
import { createChatProvider } from "../utils/chat/provider";

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
  setResponseHeader(event, "Cache-Control", "no-store");
  const result = streamText({
    ...createChatProvider(request, credentials),
    instructions:
      "Je bent de Onderwijsloket-assistent. Help gebruikers met vragen over werken in het onderwijs. Antwoord in de taal van de gebruiker. Schrijf alle zichtbare redeneersamenvattingen en bijbehorende kopjes in het Nederlands. Wees helder over onzekerheid en verzin geen bronnen. Gebruik alleen bronnen van het Onderwijsloket en verwijs alleen naar webpagina's van onderwijsloket.com.",
    messages: await convertToModelMessages(
      request.messages.filter((message) => message.parts.length > 0)
    ),
    maxOutputTokens: 10_000,
    // Avoid logging provider payloads or conversation content through the SDK's default handler.
    onError: () => {}
  });
  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      sendReasoning: request.extendedThinking,
      sendSources: request.webSearch,
      onError: () => "Het antwoord kon niet worden gegenereerd. Probeer het opnieuw."
    }),
    headers: { "Cache-Control": "no-store" }
  });
});
