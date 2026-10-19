/** MCP cache lifetimes in seconds. Expired entries are refreshed before returning. */
export const cacheDurations = {
  /** Article metadata and rendered Markdown, shared by tools and resource reads. */
  article: 5 * 60,
  /** Search facet values and counts for each collection and request. */
  facets: 5 * 60,
  /** Complete resource descriptors for each collection, without document bodies. */
  resourceCatalogue: 5 * 60,
  /** Available search facet names for each index. */
  facetNames: 60,
  /** Normalized taxonomy values for each taxonomy collection. */
  taxonomy: 60
} as const;
