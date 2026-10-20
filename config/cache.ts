/** MCP cache lifetimes in seconds. Expired entries are refreshed before returning. */
export const cacheDurations = {
  /** Mapbox geocoding TTL when caching is enabled. */
  geocoding: 90 * 24 * 60 * 60,
  /** Per-collection detail TTLs; tools/resources share records. Set detail to false to disable. */
  collections: {
    articles: { detail: 5 * 60 },
    faqs: { detail: 5 * 60 },
    sectors: { detail: 5 * 60 },
    testimonials: { detail: 5 * 60 },
    educational_institutions: { detail: 5 * 60 },
    programs: { detail: 5 * 60 },
    regional_education_desks: { detail: 5 * 60 },
    podcast_shows: { detail: 5 * 60 },
    podcast_episodes: { detail: 5 * 60 },
    videos: { detail: 5 * 60 }
  },
  /** Search facet values and counts for each collection and request. */
  facets: 5 * 60,
  /** Root-only resource descriptors for each collection; concurrent cold reads are coalesced. */
  resourceCatalogue: 5 * 60,
  /** Available search facet names for each index. */
  facetNames: 60,
  /** Normalized taxonomy values for each taxonomy collection. */
  taxonomy: 60
} as const;
