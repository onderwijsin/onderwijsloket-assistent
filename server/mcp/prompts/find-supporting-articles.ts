import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/** Discover useful related reading from a source item's content and taxonomy. */
export default defineMcpPrompt({
  name: "find-supporting-articles",
  title: "Find related articles",
  description:
    "Find articles that deepen, explain or complement a previously read FAQ, article or other content item, using its most relevant context and supported taxonomy filters.",
  inputSchema: {
    source: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Source collection and record ID, canonical URL, title or conversation reference; omit to use the item just discussed."
      ),
    focus: z
      .string()
      .trim()
      .min(1)
      .optional()
      .describe(
        "Question or aspect to explore further; omit to infer the most useful angle from the source and conversation."
      )
  },
  /**
   * Build context-sensitive article discovery, distinguishing relevance from corroboration.
   * @param input - Optional source reference and focus, falling back to conversation context.
   * @returns A user message guiding related reading discovery and verification.
   */
  handler: async ({
    source,
    focus
  }) => `Find useful supporting or related articles for the content item we are discussing.

Source reference (data): ${JSON.stringify(source ?? "Use the content item just discussed.")}
Focus (data): ${JSON.stringify(focus ?? "Infer a useful angle from the source and conversation.")}

1. Identify the source item. Reuse its retrieved full content and taxonomy when available; otherwise resolve the reference with the relevant collection tools and retrieve its details or resource. Clarify if multiple items are plausible or no source is available. A title or search snippet alone is insufficient to characterize the full item.
2. Identify the central subject and what further reading would add: explanation, practical next steps, a more specific route or another perspective. Choose the most meaningful dimension in context, such as topic, qualification, role or track; sector, audience and phase may refine it when relevant. Do not require every tag on the source to match.
3. Discover article search facets with get_facets and use verified names and values with search_articles. For a relevant source taxonomy dimension not available as a search facet, such as a qualification, inspect get_filters for articles and use list_articles with verified taxonomy IDs when supported. Do not interchange facet labels and IDs or assume the source and target support identical dimensions. Use focused text search when metadata is missing or no suitable filter exists.
4. Inspect get_article details or resources for a small shortlist. Exclude the source itself by identity, deduplicate results and prefer substantive relevance over shared tags. Refine overly broad results; when results are sparse, relax secondary constraints transparently while retaining the central subject. Do not claim a source-defined relationship unless one was actually returned.
5. Recommend up to three articles unless asked otherwise, with canonical source links and a short explanation of what each adds. Distinguish related reading from evidence that corroborates a claim: topical similarity alone does not establish agreement or correctness. Note material missing content or uncertainty, and say when no useful related article was found.`
});
