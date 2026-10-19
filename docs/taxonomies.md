# Taxonomy lookups

Use `readTaxonomy` from `server/utils/taxonomy/read-taxonomy.ts` for shared taxonomy lookups:

```ts
await readTaxonomy(); // All eight collections.
await readTaxonomy(["topics", "school_subjects"]);
await readTaxonomy([]); // No collections, no requests.
```

The optional argument is an array of `TaxonomyCollection` names: `topics`, `qualifications`, `roles`, `tracks`, `school_subjects`, `sectors`, `phases` and `audiences`. Duplicates are removed; results are a flat array in collection-selection order.

Each result contains `title`, `id`, `slug` and `description`. Upstream `name` fields become `title`. Unavailable slug/description values are null. Taxonomy identifiers accept GUID formatting, including existing audience IDs that do not satisfy strict RFC UUID version bits.

Each collection is fetched once with `limit: -1` and stable ID sorting. Nitro's `cachedFunction` caches validated data per collection for 60 seconds with stale-while-revalidate disabled. Overlapping selections share the same entries. Expired data is refreshed before returning; failed lookups return a sanitized error and are not cached as empty results.

Article `filters()` uses this utility for its seven dimensions. Filter choices and record metadata both use the same `{ id, title, slug, description }` shape. Article list pagination is independent of taxonomy caching.

## Relation schemas

Use `createTaxonomyRelationSchema(collection)` from `server/utils/taxonomy/create-taxonomy-relation-schema.ts` for Directus M2M junction responses:

```ts
const articleRelations = z.object({
  sectors: createTaxonomyRelationSchema("sectors"),
  topics: createTaxonomyRelationSchema("topics")
});
```

It validates the appropriate junction target (`sectors_id`, `topics_id`, etc.) and flattens the rows into normalized taxonomy metadata. Missing arrays become empty arrays and null targets are skipped. Malformed non-null targets fail validation.

Both lookup and relation schemas use the shared `taxonomySchema` and `createTaxonomySourceSchema` in `server/utils/taxonomy/taxonomy.ts`, so label normalization and nullable metadata behave identically. Collection queries must select the taxonomy's ID, label and available slug/description fields. The source schema handles Directus `name` versus `title` fields internally; MCP output schemas use the plain normalized schema.

## Reusable collection filters

```ts
const filters = defineCollectionFilters("articles", {
  title: exactTextFilter("Exact title; not full-text search."),
  slug: exactTextFilter("Exact slug without a URL or path."),
  english: booleanFilter("Match the language flag exactly."),
  ...taxonomyFilters(["sectors", "topics"])
});

// Spread into defineMcpCollection to supply filterSchema, filtersOutput and filters().
// Or call filters.filters() from a collection-specific error wrapper.
```

These helpers live in `server/utils/taxonomy/collection-filters.ts`. `taxonomyFilter("topics")` can also be assigned to an individual field when its input name differs from its taxonomy collection. Taxonomy input arrays accept 1–50 IDs; dynamic choices use `readTaxonomy` and its existing one-minute cache. All conditions across fields use AND, with OR within each taxonomy array. Query translation remains collection-specific because junction structures can differ.
