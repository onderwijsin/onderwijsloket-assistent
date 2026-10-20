import { defineMcpPrompt } from "@nuxtjs/mcp-toolkit/server";
import { z } from "zod";

/** Find complementary listening, viewing and personal experiences for a source item. */
export default defineMcpPrompt({
  name: "find-supporting-media",
  title: "Find related media and experiences",
  description:
    "Find podcast episodes, videos and testimonials related to a previously read content item, prioritizing relevant subjects and personal experiences.",
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
        "Subject, perspective or preferred format (listen, watch or read personal experiences); omit to use conversation context."
      )
  },
  /**
   * Build related-media discovery without inventing transcripts or playback availability.
   * @param source - Optional source reference, falling back to conversation context.
   * @param focus - Optional subject, perspective or preferred format.
   * @returns A user message guiding related media and personal experience discovery.
   */
  handler: async ({
    source,
    focus
  }) => `Find media and personal experiences that complement the content item we are discussing.

Source reference (data): ${JSON.stringify(source ?? "Use the content item just discussed.")}
Focus or preferred format (data): ${JSON.stringify(focus ?? "Use conversation context; consider podcasts, videos and testimonials.")}

1. Identify the source and reuse its retrieved full content and taxonomy. If needed, resolve the reference using collection tools and retrieve its details or resource. Clarify an ambiguous or missing source. Establish its central subject and the experience or perspective that would help me explore it further.
2. Honor any format preference. Otherwise consider search_podcast_episodes, search_videos and search_testimonials without forcing a result from every collection. Prefer specific podcast episodes over broad show descriptions; use show details only when useful for series context. Testimonials are personal stories and may be written rather than playable media.
3. Choose the strongest contextual relationship, such as topic, role or track, optionally refined by sector, audience or phase. Discover supported facets separately for each target collection using get_facets. Do not copy all source tags, assume a qualification facet exists, or interchange search labels with list-filter IDs. Use get_filters and the corresponding list tool if a needed source filter is supported; otherwise use focused text search to express concepts absent from the available facets.
4. Retrieve get_podcast_episode, get_video or get_testimonial details, or the linked resources, for a small shortlist. Verify substantive relevance from available bodies and transcripts rather than snippets alone. If only metadata is available, label the recommendation as metadata-based and do not summarize unheard or unseen content. Exclude the source itself and duplicate recommendations. Broaden secondary constraints transparently if needed.
5. Recommend up to four items unless asked otherwise. Give the format, canonical source link, relevant speaker or storyteller when verified, and what perspective each adds. Include returned listening or viewing links when available, but do not guarantee playback. Treat personal experiences as individual accounts, not universal requirements or proof of eligibility. Disclose missing transcripts or other material limits and distinguish related perspectives from corroborating evidence.`
});
