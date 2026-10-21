import { getToolName, isToolUIPart, type UIMessage } from "ai";

/**
 * Regeneration truncates history: never discard a booking attempt, regardless of its result.
 * @param messages - Complete current conversation, including persisted tool parts.
 * @param messageId - Assistant response to replace, or the last message for retry.
 * @returns Whether replaying this response preserves every booking attempt.
 */
export function canRegenerateChat(messages: UIMessage[], messageId?: string): boolean {
  const index = messageId
    ? messages.findIndex((message) => message.id === messageId)
    : messages.length - 1;
  if (index < 0) return false;
  return !messages
    .slice(index)
    .some((message) =>
      message.parts.some((part) => isToolUIPart(part) && getToolName(part) === "book_appointment")
    );
}
