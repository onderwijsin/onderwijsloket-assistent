import { z } from "zod";
import type { UIMessage } from "ai";

const partSchema = z.looseObject({ type: z.string() }).superRefine((part, context) => {
  if ((part.type === "text" || part.type === "reasoning") && typeof part.text !== "string") {
    context.addIssue({ code: "custom", message: "Missing message text" });
  }
});
const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(partSchema)
});
const conversationSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  titleSource: z.enum(["fallback", "generated", "manual"]).default("manual"),
  titleRequested: z.boolean().default(true),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  draft: z.string(),
  messages: z.array(messageSchema)
});
const stateSchema = z.object({
  conversations: z.array(conversationSchema),
  activeId: z.string().nullable(),
  sidebarCollapsed: z.boolean(),
  settings: z.object({
    model: z.enum(["gpt-6-luna", "mistral-medium-latest"]),
    webSearch: z.boolean(),
    extendedThinking: z.boolean()
  })
});

/**
 * Discard unfinished tool calls when reopening a stopped or interrupted conversation.
 * @param messages - Stored SDK messages from an earlier chat instance.
 * @returns Replayable messages with completed tool results and settled text parts.
 */
export function restoreChatMessages(messages: UIMessage[]): UIMessage[] {
  return messages
    .map((message) => ({
      ...message,
      parts: message.parts
        .filter((part) => {
          if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
            return (
              "state" in part &&
              ["output-available", "output-error", "output-denied"].includes(String(part.state))
            );
          }
          return true;
        })
        .map((part) =>
          part.type === "text" || part.type === "reasoning"
            ? { ...part, state: "done" as const }
            : part
        )
    }))
    .filter((message) => message.parts.some((part) => part.type !== "step-start"));
}

/**
 * Validate localStorage at the persistence boundary so damaged state cannot break startup.
 * @param value - Serialized persisted Pinia state.
 * @returns Validated local data, or an empty patch that keeps the store defaults.
 */
export function deserializeChatState(value: string): Record<string, unknown> {
  try {
    const result = stateSchema.safeParse(JSON.parse(value));
    if (!result.success) return {};
    return {
      ...result.data,
      conversations: result.data.conversations.map((chat) => ({
        ...chat,
        messages: restoreChatMessages(chat.messages as UIMessage[])
      }))
    };
  } catch {
    return {};
  }
}
