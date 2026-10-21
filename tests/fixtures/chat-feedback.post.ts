import { defineEventHandler, readValidatedBody } from "h3";
import { z } from "zod";
import { chatRequestSchema } from "../../server/utils/chat/request";
import { feedbackInput } from "../../server/utils/feedback/schemas";
import { connectChatMcp } from "../../server/utils/chat/mcp";

/** Exercise production local MCP dispatch without an LLM or live storage.
 * @param event - Synthetic chat and feedback input, mounted only by the e2e suite.
 * @returns The production feedback tool result after real HTTP/local dispatch.
 */
export default defineEventHandler(async (event) => {
  const input = await readValidatedBody(
    event,
    z.object({
      chat: chatRequestSchema,
      feedback: feedbackInput
    }).parse
  );
  const session = await connectChatMcp(event, input.chat);
  try {
    return await session.tools.submit_feedback!.execute!(input.feedback, {
      toolCallId: "feedback-fixture",
      messages: [],
      context: {}
    });
  } finally {
    await session.close();
  }
});
