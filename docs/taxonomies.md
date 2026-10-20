# Taxonomy lookups

Use `readTaxonomy` from `server/utils/taxonomy/read-taxonomy.ts` for shared taxonomy lookups:

```ts
await readTaxonomy(); // All eight collections.
await readTaxonomy(["topics", "school_subjects"]);
await readTaxonomy([]); // No collections, no requests.
```

The optional argument is an array of `TaxonomyCollection` names: `topics`, `qualifications`, `roles`, `tracks`, `school_subjects`, `sectors`, `phases` and `audiences`. Duplicates are removed; results are a flat array in collection-selection order.

Each result contains `title`, `id`, `source_url` and `description`. Upstream `name` fields become `title`. Archive URLs point to content related to that taxonomy item. Unavailable archive URLs/descriptions are null; taxonomy slugs and raw paths are not public fields. Taxonomy identifiers accept GUID formatting, including existing audience IDs that do not satisfy strict RFC UUID version bits.

Each collection is fetched once with `limit: -1` and stable ID sorting. Nitro's `cachedFunction` caches validated data per collection for 60 seconds with stale-while-revalidate disabled. Overlapping selections share the same entries. Expired data is refreshed before returning; failed lookups return a sanitized error and are not cached as empty results.

Article `filters()` uses this utility for its seven dimensions. Filter choices and record metadata both use the same `{ id, title, source_url, description }` shape. Article list pagination is independent of taxonomy caching.

## Relation schemas

Use `createTaxonomyRelationSchema(collection)` from `server/utils/taxonomy/create-taxonomy-relation-schema.ts` for Directus M2M junction responses:

```ts
const articleRelations = z.object({
  sectors: createTaxonomyRelationSchema("sectors"),
  topics: createTaxonomyRelationSchema("topics")
});
```

It validates the appropriate junction target (`sectors_id`, `topics_id`, etc.) and flattens the rows into normalized taxonomy metadata. Missing arrays become empty arrays and null targets are skipped. Malformed non-null targets fail validation.

Both lookup and relation schemas use the shared `taxonomySchema` and `createTaxonomySourceSchema` in `server/utils/taxonomy/taxonomy.ts`, so label normalization and nullable metadata behave identically. Collection queries select ID, label, description where available, and the archive source field: `path` for topics, roles, qualifications, tracks and school subjects; `slug` for sectors. Audiences and phases have neither archive field and always return `source_url: null`. The source schema handles Directus `name` versus `title` fields internally; MCP output schemas use the plain normalized schema.

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

## Archive links

Taxonomy `source_url` is a canonical archive of related content, not a replacement for the taxonomy ID used in source filters. Topics, qualifications, roles, tracks and school subjects use their actual local `path` through `useSourceUrl`. Do not guess their route from a slug. Sectors have no path: their native slug is relative to the site root, yielding `https://onderwijsloket.com/{slug}`. Audiences and phases always have null URLs. Missing/invalid local paths yield null rather than an invented destination.

The same normalized shape is used by `get_filters` values and embedded taxonomy references in all core collections, including program-form tracks. Core record slugs and exact slug filters are retained. This intentional API change replaces the taxonomy `slug` field with `source_url`; callers filtering records must continue sending IDs. Taxonomy lookup and cached article-detail namespaces change to avoid returning the previous shape after deployment.
