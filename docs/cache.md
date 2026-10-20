# Cache controls and freshness

`config/cache.ts` controls server cache lifetimes in seconds. Every production collection explicitly supplies its detail settings to `defineMcpCollection`; test-only definitions are uncached unless they opt in.

[Mapbox geocoding](geocoding.md) uses a separate 90-day result cache controlled
by `geocoding`. `MAPBOX_ENABLE_GEOCODING_CACHE` controls reads and writes independently
of the selected geocoding mode.

| Setting                     | Default | Boundary/key                                                                                 |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `collections.<name>.detail` | 300     | Validated normalized detail record, isolated by collection and record ID                     |
| `resourceCatalogue`         | 300     | Complete root-only descriptor catalogue per collection                                       |
| `facets`                    | 300     | Contextual facet response per collection/index and complete query/filter/facet/limit request |
| `facetNames`                | 60      | Countable facet names per index                                                              |
| `taxonomy`                  | 60      | Normalized taxonomy choices per source collection                                            |

Set a collection's `detail` to a positive number of seconds or `false` to disable its cache. All ten definitions have independent settings. Ordinary list and search results remain uncached; catalogue listing is a separate descriptor-only read and does not call public list operations.

## Detail records, not response envelopes

`collections/cache-detail.ts` wraps native read/normalization/rendering in one shared cache. It validates the public detail schema before storing and checks persisted entries against the current schema. Missing records, invalid data and thrown errors are not cached. Collection/ID isolation prevents equal source IDs in different domains from colliding.

Tools and resources call the same collection getter. The stored value includes normalized relationships and rendered content, while `retrieved_at` is generated for each response outside that cache. Resource Markdown/YAML packaging is also outside it, so there is no second resource document cache with competing freshness rules. Content schema changes invalidate incompatible entries through validation; intentional same-shape semantic changes still need a namespace/version change or storage invalidation.

## Refresh and storage semantics

Nitro function caches use `swr: false`: expired reads wait for refresh, and concurrent cold/expired requests for the same key share work within a runtime. Successful cached records/catalogues can remain visible until their TTL after a source edit or deletion. The application has no webhook or manual cache-invalidation endpoint. Caching changes freshness, not the upstream visibility policy.

Cache storage controls persistence/sharing between Node instances or Workers isolates. Without shared storage, caches and request coalescing are local to an instance. Durations are build-time configuration; rebuilding/restarting applies changes. The server currently uses a fixed upstream service identity; introducing caller-specific source credentials would require scope-aware cache keys before sharing results between callers.

## Other useful boundaries

Taxonomy choices, available facet names and contextual facet counts already cache reusable provider discovery work. Filter descriptions are rebuilt around cached taxonomy values; caching the whole filter response would duplicate those boundaries. Registry metadata is static in-memory configuration and needs no TTL cache. Nested host/location/area data is cached with its parent detail: separate caches would complicate relationship freshness and completeness without a demonstrated independent lookup need.

Unit tests use Nitro's real function cache with isolated storage and controlled time for every collection, including coalescing, expiry, fresh timestamps, failures, disabled caching, key isolation and malformed persisted values. HTTP tests verify that each record tool and resource read share the same detail cache. Catalogue, taxonomy and facet tests preserve their independent refresh/failure semantics.
