# MCP caching

`config/cache.ts` is the single place to manage server cache durations, in seconds:

| Entry               | Default | Cache boundary                                                         |
| ------------------- | ------- | ---------------------------------------------------------------------- |
| `article`           | 300     | Validated article detail and rendered Markdown, keyed by ID            |
| `facets`            | 300     | Facet response, keyed by collection/index and complete request options |
| `resourceCatalogue` | 300     | Complete summary descriptor list, keyed by collection                  |
| `facetNames`        | 60      | Algolia facet-name discovery, keyed by index                           |
| `taxonomy`          | 60      | Directus taxonomy lookup, keyed by collection                          |

Both `get_article` and article resource reads call `articles.get()`, so they share one detail cache. YAML serialization remains outside that cache. Catalogue caching does not warm article details or change ordinary `list_articles` behavior. Search result queries remain uncached.

These use Nitro function caching with `swr: false`: an expired entry is refreshed before returning, and concurrent identical requests share the refresh. Failed fetches, missing articles and incomplete catalogues are not cached. A cached article or catalogue can remain visible for up to five minutes after an upstream edit or deletion; there are no change notifications or manual invalidation endpoints.

Nitro's configured cache storage determines persistence and sharing between instances. Without a shared backing store, each server instance or Workers isolate maintains its own cache. Changing durations requires rebuilding/restarting the server. Existing taxonomy and facet-name discovery retain their one-minute defaults.

Unit tests exercise the real Nitro cache with controlled storage and time, including expiry, key isolation, shared article/resource reads and failure retries. HTTP tests verify repeat facet and catalogue calls avoid upstream requests and resources share cached tool reads.
