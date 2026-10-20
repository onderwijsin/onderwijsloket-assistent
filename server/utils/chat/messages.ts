import { validateUIMessages, type ToolSet } from "ai";
import type { ChatRequest } from "./request";

/**
 * Validate MCP tool history while excluding provider-specific reasoning/search state.
 * @param messages - Boundary-checked conversation supplied by the chat transport.
 * @param tools - This request's discovered MCP tools and adapters.
 * @returns SDK UI messages retaining tool inputs/results needed for follow-up turns.
 */
export async function prepareChatMessages(messages: ChatRequest["messages"], tools: ToolSet) {
  const replay = messages
    .map((message) => ({
      id: message.id,
      role: message.role,
      parts: message.parts
        .filter((part) => {
          if (part.type === "text" || part.type === "step-start") return true;
          if (part.type === "dynamic-tool") return part.toolName !== "web_search";
          return part.type.startsWith("tool-") && part.type !== "tool-web_search";
        })
        .map((part) =>
          Object.fromEntries(
            Object.entries(part).filter(
              ([key]) => key !== "providerMetadata" && key !== "callProviderMetadata"
            )
          )
        )
    }))
    .filter((message) => message.parts.length > 0);
  // The SDK validates schemas for static tool parts; normalize dynamic MCP parts first.
  for (const message of replay) {
    message.parts = message.parts.map((part) => {
      if (part.type === "text" || part.type === "step-start") return part;
      const name = part.type === "dynamic-tool" ? part.toolName : String(part.type).slice(5);
      if (typeof name !== "string" || !Object.hasOwn(tools, name)) {
        throw new Error("Unknown chat tool in history");
      }
      return { ...part, type: `tool-${name}` };
    });
  }
  return validateUIMessages({ messages: replay, tools });
}
