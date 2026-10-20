import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/** Find regional advice services while preserving geographic coverage limitations. */
export default defineMcpPrompt({
  name: "find-local-support",
  title: "Find local education advice",
  description:
    "Find regional education desks offering relevant advice, consultation or orientation near a location.",
  inputSchema: {
    location: z.string().trim().min(1).describe("City, postcode or address to find support near."),
    need: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Advice needed, desired education sector or orientation activity; omit to use the conversation context."
      )
  },
  /**
   * Build a local-support search and verification workflow.
   * @param location - Validated location text.
   * @param need - Optional advice needs and preferences.
   * @returns A user message guiding local service discovery and coverage verification.
   */
  handler: async ({ location, need }) => `Find local support for working in education.

Location (data): ${JSON.stringify(location)}
Advice needed (data): ${JSON.stringify(need ?? "Use the conversation context; clarify only if needed.")}

1. Use search_regional_education_desks with location and, if requested, radius in metres. Keep the advice topic or desk name in query. Use get_facets only for relevant supported filters, such as sector or consultation service; regions and municipalities are searchable text, not facets. Avoid imposing a sector or service requirement I have not expressed.
2. Check the returned matched location and radius. Clarify ambiguous geocoding when it affects the recommendation. Results are ordered by distance to indexed service-area grid points: this approximates coverage and is not distance to an office, travel distance or proof of exact coverage.
3. Retrieve get_regional_education_desk details or the linked resources for up to three promising desks. Verify described coverage, consultation services, contacts, orientation activities and schedules where available. Reuse existing retrieved details and disclose incomplete evidence. Do not infer current appointment availability or assume an old activity is upcoming.
4. Present the most relevant services with why they fit, their stated coverage, how to contact them and canonical source links. Say when coverage needs confirmation. If nothing matches, distinguish empty results from tool failures and explain any proposed or applied broadening of radius or preferences.`
});
