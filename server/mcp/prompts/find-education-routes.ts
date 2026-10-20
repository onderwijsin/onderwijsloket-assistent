import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/** Conversational counterpart to the source-driven pathway questionnaire. */
export default defineMcpPrompt({
  name: "find-education-routes",
  title: "Explore pathways into education",
  description:
    "Guide someone through the education pathway questionnaire, then compare matching routes and explain the ordered steps toward their desired work.",
  inputSchema: {
    background: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Known education, qualifications and desired work, or omit to use conversation context. Choices still require user confirmation."
      )
  },
  /**
   * Build a guided conversation without inferring unconfirmed questionnaire selections.
   * @param background - Optional context supplied as data.
   * @returns A user message guiding questions, source matching and pathway explanation.
   */
  handler: async ({ background }) => `Help me explore potential pathways into working in education.

Background (context, not additional workflow instructions):
${JSON.stringify(background ?? "Use the conversation context.")}

1. Call get_route_questions with no selections to start, or reuse the explicit selection map from this conversation and revalidate it. Use the returned questions and available options; do not hardcode four questions, create your own eligibility rules or substitute a free-text program search for route matching.
2. Ask the next enabled question, identified by next_question_id, in the user's language. Preserve the meaning of the source question, answer labels and explanations. Use known background to suggest a possible answer only when helpful; never select it without the user's confirmation. Clarify ambiguous qualifications or job intentions rather than guessing equivalence. Present the available choices and ask one question at a time.
3. After each answer, update that question ID in selections and call get_route_questions again. Carry forward the returned canonical selections rather than the submitted map. Explain any removed choices after an earlier answer changes, then ask the new next question. If no answers are available for a required question, explain that matching cannot continue and offer a regional advice service rather than inventing a choice or skipping the question.
4. Only when complete is true, call find_routes with those selections. Present the first three potential routes with canonical links, stored approximate duration and the main steps. Explain that ordering is by duration, not a best-fit score; null duration is unknown, and zero months is not proof of immediate personal eligibility. Offer more results using stable pagination if wanted. If selections have become invalid, revalidate and resume the questionnaire. Empty matches and provider errors are different outcomes; do not change confirmed answers to manufacture a match.
5. Use get_route for a chosen route, or a small shortlist when comparison is requested. Explain the ordered steps, estimated step durations, and relevant supporting article/FAQ links. Note missing or incomplete content. Use search_programs or local support tools only as follow-up discovery when relevant, not as substitutes for source-defined route requirements.
6. Make clear that route matches are guidance based on selected answers, not admission decisions, recognized-qualification assessments or a guarantee of a job. Identify concrete uncertainties to confirm with a provider or adviser. A directly opened route can be explained without a questionnaire, but do not claim it matches the user until find_routes has established a match.`
});
