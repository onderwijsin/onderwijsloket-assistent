import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { schedulingLinkInput, schedulingLinkOutput } from "../../utils/scheduling/schemas";
import { schedulingTool, useSchedulingService } from "../../utils/scheduling/tool";

/** Discover fresh form metadata only when personal consultation is appropriate. */
export default defineMcpTool({
  name: "get_scheduling_link",
  group: "scheduling",
  description:
    "Start scheduling only when the user explicitly requests personal consultation or a complex question remains unresolved after consulting available knowledge. Do not routinely offer appointments. Choose nl for Dutch or en for English according to preferred consultation language; clarify other languages. Returns current link metadata, durations and required form fields with configured choices. booking_ready=false means required choice configuration is missing: do not invent options. A free, roughly 20-minute one-to-one telephone consultation; the adviser calls the user. Next use get_scheduling_slots.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: schedulingLinkInput.shape,
  outputSchema: schedulingLinkOutput.shape,
  /** Retrieve fresh metadata and preparation guidance.
   * @param args - Preferred consultation language.
   * @returns Current form or sanitized scheduling failure.
   */
  handler: (args) => schedulingTool(args.language, () => useSchedulingService().getLink(args))
});
