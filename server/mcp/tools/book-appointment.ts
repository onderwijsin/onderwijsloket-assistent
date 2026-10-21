import { defineMcpTool, getSdkServer, useMcpServer } from "@nuxtjs/mcp-toolkit/server";
import { useEvent } from "nitropack/runtime";
import { schedulingBookingInput, schedulingBookingOutput } from "../../utils/scheduling/schemas";
import { schedulingTool, useSchedulingService } from "../../utils/scheduling/tool";
import { protectBooking } from "../../utils/scheduling/replay";
import { enforceSchedulingRateLimit } from "../../utils/scheduling/rate-limit";

/** The only scheduling mutation: create one explicitly confirmed consultation. */
export default defineMcpTool({
  name: "book_appointment",
  group: "scheduling",
  description:
    "Create a real one-to-one telephone appointment only after the user explicitly confirms the selected slot, name, email, international phone number, time zone and completed current booking form. Normalize phone numbers to international format internally using established country context; never ask users to format numbers or separately confirm formatting. Clarify the country only when ambiguous. Use get_scheduling_link first; never invent answers, field IDs or options. Supply all required answers using exact returned choices, reusing confirmed information from the conversation. The server sets hidden booking attribution from the MCP client name, refreshes link/form and availability, and enforces the hourly creation quota. Display the returned message. Never retry automatically: BOOKING_UNCERTAIN may already have created the appointment; check confirmation email first. Cancel or reschedule through that email.",
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },
  inputSchema: schedulingBookingInput.shape,
  outputSchema: schedulingBookingOutput.shape,
  /** Book with trusted connection attribution and a mandatory server-side quota guard.
   * @param args - Explicitly confirmed booking details.
   * @returns Minimal confirmation or sanitized scheduling failure.
   */
  handler: (args) =>
    schedulingTool(args.language, () => {
      const event = useEvent();
      return protectBooking(args, (markAttempted) =>
        useSchedulingService().book(args, {
          clientName:
            event.context.schedulingClientName ??
            getSdkServer(useMcpServer().server).getClientVersion()?.name,
          beforeCreate: async () => {
            await enforceSchedulingRateLimit(event);
            await markAttempted();
          }
        })
      );
    })
});
