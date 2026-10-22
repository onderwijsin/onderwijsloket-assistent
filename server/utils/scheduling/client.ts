import { ofetch } from "ofetch";
import { z } from "zod";
import { schedulingLinks, type SchedulingLanguage } from "./config";
import { SchedulingError } from "./errors";
import { schedulingLanguageSchema, savvyCalEventInput } from "./schemas";

/** Build a private API adapter with a fixed origin and three fixed operations.
 * @param apiKey - Server-only organisation token.
 * @param transport - Fetch implementation; injectable for synthetic tests.
 * @returns Narrow operations, never a generic authenticated request function.
 */
export function createSavvyCalClient(apiKey: string | undefined, transport = globalThis.fetch) {
  const request = ofetch.create(
    {
      baseURL: "https://api.savvycal.com/v1",
      headers: { Authorization: `Bearer ${apiKey || ""}`, Accept: "application/json" },
      timeout: 15000,
      retry: 0,
      redirect: "error"
    },
    { fetch: transport }
  );

  /**
   * Resolve only a known, fixed API path.
   * @param language - Consultation language.
   * @returns API path for the selected allowlisted link.
   * @throws SchedulingError when the language is unsupported or the API token is missing.
   */
  function linkPath(language: SchedulingLanguage) {
    const parsed = schedulingLanguageSchema.safeParse(language);
    if (!parsed.success) throw new SchedulingError("INVALID_INPUT");
    if (!apiKey?.trim()) throw new SchedulingError("NOT_CONFIGURED");
    return `/links/${schedulingLinks[parsed.data].id}`;
  }
  return {
    /** Fetch current link metadata without caching.
     * @param language - Consultation language.
     * @returns Untrusted JSON for service validation.
     */
    async getLink(language: SchedulingLanguage): Promise<unknown> {
      const path = linkPath(language);
      try {
        return await request<unknown>(path);
      } catch {
        throw new SchedulingError("UNAVAILABLE");
      }
    },
    /** Fetch one bounded availability range.
     * @param language - Consultation language.
     * @param range - Internally resolved timestamps.
     * @returns Untrusted slot array.
     */
    async getSlots(
      language: SchedulingLanguage,
      range: { from: string; until: string }
    ): Promise<unknown> {
      const path = linkPath(language);
      const parsed = z
        .strictObject({
          from: z.iso.datetime({ offset: true }),
          until: z.iso.datetime({ offset: true })
        })
        .safeParse(range);
      if (!parsed.success) throw new SchedulingError("INVALID_INPUT");
      try {
        return await request<unknown>(`${path}/slots`, { query: parsed.data });
      } catch {
        throw new SchedulingError("UNAVAILABLE");
      }
    },
    /** Create once; neither transport nor service automatically retries mutations.
     * @param language - Consultation language.
     * @param body - Validated documented request, without arbitrary metadata or options.
     * @returns Untrusted event JSON.
     */
    async createEvent(
      language: SchedulingLanguage,
      body: z.input<typeof savvyCalEventInput>
    ): Promise<unknown> {
      const path = linkPath(language);
      const parsed = savvyCalEventInput.safeParse(body);
      if (!parsed.success) throw new SchedulingError("INVALID_INPUT");
      try {
        return await request<unknown>(`${path}/events`, { method: "POST", body: parsed.data });
      } catch (error) {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? error.statusCode
            : undefined;
        // The documented authentication, not-found and validation responses reject creation.
        throw new SchedulingError(
          [401, 403, 404, 422].includes(Number(status)) ? "BOOKING_REJECTED" : "BOOKING_UNCERTAIN"
        );
      }
    }
  };
}
export type SavvyCalClient = ReturnType<typeof createSavvyCalClient>;
