import { expect, it } from "vitest";
import type { UIMessage } from "ai";
import { canRegenerateChat } from "../../app/utils/chat-regenerate";

it("preserves booking attempts when regenerating the same or an earlier turn", () => {
  const messages: UIMessage[] = [
    { id: "before", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
    {
      id: "booking",
      role: "assistant",
      parts: [
        {
          type: "dynamic-tool",
          toolName: "book_appointment",
          toolCallId: "call",
          state: "input-available",
          input: {}
        }
      ]
    },
    { id: "after", role: "assistant", parts: [{ type: "text", text: "Follow-up" }] }
  ];
  expect(canRegenerateChat(messages, "before")).toBe(false);
  expect(canRegenerateChat(messages, "booking")).toBe(false);
  expect(canRegenerateChat(messages, "after")).toBe(true);
  expect(canRegenerateChat(messages.slice(0, 2))).toBe(false);
  expect(canRegenerateChat(messages)).toBe(true);
});
