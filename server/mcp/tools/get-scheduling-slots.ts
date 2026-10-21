import { defineMcpTool } from "@nuxtjs/mcp-toolkit/server";
import { schedulingSlotsInput, schedulingSlotsOutput } from "../../utils/scheduling/schemas";
import { schedulingTool, useSchedulingService } from "../../utils/scheduling/tool";

/** Query one bounded availability window; never cache booking availability. */
export default defineMcpTool({
  name: "get_scheduling_slots",
  group: "scheduling",
  description:
    "Get available telephone consultation slots for the selected language. Start at window 0 (next 3 days). Only after no slots use next_window: days 4–7, days 8–15, then weekly. Explicit from/until dates honor user preferences and override the window index; at most 31 days per request. Do not silently broaden a preferred range. Infer the user's time zone from reliable conversation or host context, otherwise use Europe/Amsterdam. Do not ask for a time zone or infer it from chat language alone. Label times clearly, accept corrections and preserve returned timestamps. After slot selection collect current required form answers and confirm all booking details before book_appointment. Read-only calls do not consume creation quota.",
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  inputSchema: schedulingSlotsInput.shape,
  outputSchema: schedulingSlotsOutput.shape,
  /** Retrieve current availability and continuation.
   * @param args - Language and preferred dates or default window.
   * @returns Validated slots or sanitized scheduling failure.
   */
  handler: (args) => schedulingTool(args.language, () => useSchedulingService().getSlots(args))
});
