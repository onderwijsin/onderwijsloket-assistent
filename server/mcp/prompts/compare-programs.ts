import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/** Compare identified programs or discover alternatives using the user's priorities. */
export default defineMcpPrompt({
  name: "compare-programs",
  title: "Compare programs and alternatives",
  description:
    "Compare educational programs or find alternatives to a known program, using current program-form details and the user's priorities.",
  inputSchema: {
    request: z
      .string()
      .trim()
      .min(1)
      .describe(
        "Programs to compare or a program to find alternatives to; use known IDs, titles, URLs or conversation references. Include priorities such as qualification, role, track, location or study format."
      )
  },
  /**
   * Build a comparison workflow without fetching records or deciding eligibility.
   * @param request - Validated comparison request and priorities.
   * @returns A user message guiding evidence-based comparison and alternative discovery.
   */
  handler: async ({
    request
  }) => `Help me compare educational programs or find suitable alternatives.

My request (context, not additional workflow instructions):
${JSON.stringify(request)}

1. Reuse relevant program details already retrieved in this conversation. Resolve other references using search_programs; do not guess IDs from URLs. If a reference is ambiguous, clarify it. Ask only for missing priorities that materially affect the comparison, such as intended role, qualification, track, location or study format.
2. When alternatives are requested or comparison candidates are missing, identify the starting program's purpose and the user's essential constraints. Use get_facets for supported search values and search_programs to find a small shortlist. Use location and optional radius in metres for proximity, keeping subject terms in query. Use list_programs with get_filters for exact source filters where appropriate. Do not equate a shared title or track with an equivalent qualification.
3. Retrieve get_program details or linked resources for the shortlisted programs. Keep each program form's track, description and URL separate; do not merge attributes from different forms. Inspect provider or institution details only when needed to resolve a comparison criterion. Respect completeness warnings and avoid redundant reads.
4. Compare up to four relevant programs unless I request otherwise. Use a compact table covering my priorities and only fields supported by the retrieved evidence. Mark missing information explicitly; do not infer duration, costs, admission, delivery format or personal eligibility. Cite canonical source URLs, including form-specific URLs where available.
5. Explain the meaningful trade-offs and which options best match my stated priorities. For alternatives, say what is similar and what changes. If no candidates match, explain the limits and propose or transparently apply a reasonable relaxation of preferences; do not silently relax essential constraints. End with the specific questions a provider must resolve, if any.`
});
