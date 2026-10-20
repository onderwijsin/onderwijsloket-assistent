import { defineEventHandler } from "h3";
import { connectChatMcp } from "../../server/utils/chat/mcp";
import { faqId } from "./faqs-and-sectors";

/** Test-only route registered by the e2e build, never by the production app. */
export default defineEventHandler(async (event) => {
  const session = await connectChatMcp(event);
  try {
    const options = { toolCallId: "fixture", messages: [], context: {} };
    return {
      toolNames: Object.keys(session.tools),
      instructions: session.instructions,
      questions: await session.tools.get_route_questions!.execute!({}, options),
      prompt: await session.tools.mcp_get_prompt!.execute!(
        { name: "find-education-routes", arguments: {} },
        options
      ),
      resource: await session.tools.mcp_read_resource!.execute!(
        { uri: `onderwijsloket://faqs/${faqId}` },
        options
      )
    };
  } finally {
    await session.close();
  }
});
