import { createMistral } from "@ai-sdk/mistral";
import { createOpenAI } from "@ai-sdk/openai";
import type { ToolSet } from "ai";
import type { ChatRequest } from "./request";

/** Private credentials supplied by Nuxt runtime configuration. */
interface ChatCredentials {
  mistralApiKey: string;
  openaiApiKey: string;
}

/**
 * Select the provider and optional native search tool without retaining conversations.
 * @param request - Validated model and feature selections.
 * @param credentials - Server-only API keys.
 * @returns Model, tools and provider options for streamText.
 */
export function createChatProvider(
  request: ChatRequest,
  credentials: ChatCredentials
): {
  model: ReturnType<ReturnType<typeof createMistral>["chat"]>;
  tools: ToolSet;
  providerOptions: Record<string, { [key: string]: string | boolean }>;
} {
  const tools: ToolSet = {};
  if (request.model === "gpt-6-luna") {
    const openai = createOpenAI({ apiKey: credentials.openaiApiKey });
    if (request.webSearch) tools.web_search = openai.tools.webSearch({});
    return {
      model: openai.responses(request.model),
      tools,
      providerOptions: {
        openai: {
          store: false,
          reasoningEffort: request.extendedThinking ? "high" : "none",
          ...(request.extendedThinking ? { reasoningSummary: "auto" } : {})
        }
      }
    };
  }
  const mistral = createMistral({ apiKey: credentials.mistralApiKey });
  if (request.webSearch) tools.web_search = mistral.tools.webSearch({});
  return {
    model: request.webSearch ? mistral.conversation(request.model) : mistral.chat(request.model),
    tools,
    providerOptions: { mistral: { reasoningEffort: request.extendedThinking ? "high" : "none" } }
  };
}
