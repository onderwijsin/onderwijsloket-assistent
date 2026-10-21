import { useRuntimeConfig } from "nitropack/runtime";
import { createSavvyCalClient } from "./client";
import { createSchedulingService } from "./service";
import { SchedulingError } from "./errors";
import type { SchedulingLanguage } from "./config";
import { toolResult } from "../tool-result";

/** Resolve only the server-private credential; no credential enters tool arguments or output.
 * @returns Scheduling workflow bound to the restricted API adapter.
 */
export function useSchedulingService() {
  return createSchedulingService(createSavvyCalClient(useRuntimeConfig().scheduling.apiKey));
}

/** Convert all failures to safe MCP errors without upstream bodies or contact details.
 * @param language - Preferred user-facing language.
 * @param action - Scheduling operation.
 * @returns Structured success or a protocol error with an actionable failure message.
 */
export async function schedulingTool(language: SchedulingLanguage, action: () => Promise<object>) {
  try {
    return toolResult(await action());
  } catch (error) {
    const failure = error instanceof SchedulingError ? error : new SchedulingError("UNAVAILABLE");
    const fallback =
      language === "nl"
        ? "Het is niet gelukt om de afspraak te plannen... Probeer het nog eens in een nieuwe chatsessie, of plan je afspraak [via onze website](https://onderwijsloket.com/adviesgesprek)."
        : "The appointment could not be scheduled. Try again in a new chat session, or book [through our website](https://onderwijsloket.com/adviesgesprek).";
    const uncertainty =
      language === "nl"
        ? "Mogelijk is de afspraak wel aangemaakt. Controleer je bevestigingsmail voordat je opnieuw boekt. Niet automatisch opnieuw proberen."
        : "The booking may have been created. Check your confirmation email before booking again. Do not retry automatically.";
    const message = failure.code === "BOOKING_UNCERTAIN" ? `${fallback}\n${uncertainty}` : fallback;
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            code: failure.code,
            message,
            ...(failure.retryAt ? { retry_at: failure.retryAt } : {}),
            ...(failure.code === "FORM_NOT_CONFIGURED"
              ? {
                  guidance:
                    "Required form choices have not been configured. Do not invent answers; use the website booking link."
                }
              : {}),
            ...(failure.code === "BOOKING_UNCERTAIN"
              ? {
                  guidance:
                    language === "nl"
                      ? "Mogelijk is de afspraak wel aangemaakt. Controleer je bevestigingsmail voordat je opnieuw boekt. Niet automatisch opnieuw proberen."
                      : "The booking may have been created. Check your confirmation email before booking again. Do not retry automatically."
                }
              : {})
          })
        }
      ]
    };
  }
}
