# Collection search

The MCP exposes `search_articles` and `get_facets` for articles. `search_articles` selects articles by its name and takes no collection selector. `get_facets` remains shared and requires `collection: "articles"`. Search is collection-scoped; global search remains deferred. Directus continues to serve `list_articles`, `get_article` and Markdown resources.

## Runtime configuration

`envs/.env.schema` imports the Algolia schema. `ENV.ALGOLIA_APPLICATION_ID` and `ENV.ALGOLIA_TOKEN` populate private `runtimeConfig.algolia`; neither is exposed through public runtime configuration. The existing `algoliasearch` dependency supplies the SDK client, reused per runtime configuration. Host overrides are parsed with `ufo` and require an HTTP(S) host. `NUXT_ALGOLIA_HOST` is an optional private host override for controlled HTTP fixtures; production uses Algolia's default hosts.

## Collection configuration

The articles definition includes:

```ts
...defineCollectionSearch({ name: "articles", indexName: "articles" })
```

The shared utility supplies `search()` and `facets()` implementations plus their input/result schemas. Optional field mappings retain the article-shaped compatibility projection. New collections can provide their own `recordSchema`, `attributes`, `mapHit` and strict `filterSchema`; they need not have article ID/title/description/slug fields. The defaults still match the articles index. The client can never select an arbitrary index. `defineMcpCollection` validates input/output schemas and advertises search/facets capabilities only when implementations are configured.

## Agent workflow

1. Call `get_facets` with `collection: "articles"` to discover current countable facet names, values and counts.
2. Call `search_articles` with a query and/or selected facet values.
3. Use a returned ID with `get_article`, or follow its resource link, for full current content.

```json
{
  "query": "zij-instroom",
  "filters": {
    "sectors.title": ["Primair onderwijs", "Voortgezet onderwijs"],
    "english": [false]
  },
  "page": 1,
  "page_size": 10
}
```

Facet names/values above illustrate the live index; always discover them before selecting filters. Values within one field use OR; different fields use AND. Arrays accept strings, booleans or numbers. The service converts these into `facetFilters`, escaping leading minus signs; raw Algolia expressions and request parameters are not accepted.

Directus filtering is a different contract: `get_filters` returns taxonomy IDs for `list_articles`. Search uses index facet names and values, often taxonomy labels. Do not interchange the two.

## Search output and snippets

Results contain only ID, collection, title, slug, short description, source URL and an optional snippet. No raw body, editor nodes or full taxonomy expansion is returned. Search data may lag behind Directus.

With a nonblank query, Algolia generates 30-word snippets across attributes. The utility selects one matched excerpt, preferring a full query match and then richer context. The excerpt exposes its field and match level; matched terms use `**` markers. Nested related-record snippets are supported. Browsing without a query returns null snippets; queries can also return null when Algolia supplies no matched excerpt. Highlighting explains a match, not the full ranking rationale. These behaviors follow Algolia's [attributesToSnippet](https://www.algolia.com/doc/api-reference/api-parameters/attributesToSnippet) contract.

Pagination is one-based, default size 10, maximum 25. Algolia receives zero-based pages. `total_is_exact` distinguishes exact and estimated match counts; `total_pages` reflects the index's accessible pagination window, which can be smaller than the total match count. Empty results are valid. Ranking, searchable attributes, synonyms and other index settings remain configured in Algolia.

## Facets and dynamic index discovery

`get_facets` requests `facets: ["*"]` by default. Optional `facets`, `query` and `filters` select fields and scope counts. Counts include the facet's own selected filter; this is not disjunctive faceting. `max_values` limits values per facet (default 100, maximum 1000). Exact counts do not imply a complete value enumeration; inspect `counts_are_exact` separately.

The configured key allows searching but denies settings reads. The service therefore discovers countable facet names through a minimal zero-hit search and caches those names for 60 seconds with Nitro. Facet responses are cached for five minutes per collection/index and complete query/filter/facet/limit request. The cached `retrieved_at` stays unchanged until refresh. Counts reflect that cached query/filter context. See [cache configuration](./cache.md). No facet-name list is hard-coded, and no settings permission or admin key is required. Attributes configured only for filtering without counts are not discoverable by this route and are not exposed as search filters. See Algolia's [facets](https://www.algolia.com/doc/api-reference/api-parameters/facets) documentation.

Unsupported facet names produce `INVALID_FILTER`. Transport failures or malformed provider data produce sanitized `UPSTREAM_UNAVAILABLE` responses. Queries set `analytics: false`; no click/conversion instrumentation or UI is part of this server-only feature. Index settings and records are never modified.

## Verification

Unit tests cover client reuse, field mappings, dynamic filter validation, literal values, nested snippets, pagination, browsing and safe failures. Production HTTP tests use a local Algolia query fixture with the real SDK to exercise both tools, facets, AND/OR filtering, snippets, resource links and schema portability alongside the existing Directus suite.

Live inspection confirmed the `articles` index and snippet/facet behavior in application `WSV9PQ4NXW`. The Productivity plugin's index tools were unavailable in this session, so inspection used the configured SDK credentials. No live settings were changed. The existing dev server may need restarting to register newly added MCP tool files and runtime configuration.

## MCP wording

Published tool descriptions, instructions and schemas describe collection search and record retrieval without naming infrastructure providers. Keep the distinction between search facet values (`get_facets`) and list filter taxonomy IDs (`get_filters`) explicit. Provider details belong in internal code and developer documentation. HTTP regression tests inspect the published MCP discovery responses.

See [phase 3 preparation](collection-inventory/phase-3.md) for independent collection schemas, static facet-key boundaries and the test-only FAQ adapter. Articles, FAQs and sectors are enabled; see [group 1](collection-inventory/group-1.md) for native question hits, query-only sector search and verified FAQ facet keys.
