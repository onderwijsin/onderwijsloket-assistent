import { enforceRateLimit } from "@onderwijsin/nuxt-simple-rate-limiter/runtime";
import { isError, type H3Event } from "h3";
import { schedulingRateLimit } from "./config";
import { SchedulingError } from "./errors";

/** Consume quota only immediately before event creation, never for MCP reads.
 * @param event - Current MCP request; IP comes from runtime context/socket, not untrusted headers.
 * @returns Resolves when permitted, otherwise a sanitized failure with retry timing.
 */
export async function enforceSchedulingRateLimit(event: H3Event): Promise<void> {
  try {
    await enforceRateLimit(event, schedulingRateLimit);
  } catch (error) {
    if (isError(error) && error.statusCode === 429) {
      const until =
        error.data && typeof error.data === "object" && "bannedUntil" in error.data
          ? error.data.bannedUntil
          : undefined;
      throw new SchedulingError(
        "RATE_LIMITED",
        typeof until === "number" ? new Date(until).toISOString() : undefined
      );
    }
    // An unavailable quota store must never permit event creation.
    throw new SchedulingError("UNAVAILABLE");
  }
}
