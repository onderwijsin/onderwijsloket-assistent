# Collection definitions

`index.ts` explicitly enables the ten public core collections. Each definition owns native schemas, source queries, source-list filters, normalization, search mapping and resource metadata. Concrete tools/resources adapt these contracts; supporting tables remain embedded.

Shared mechanisms live in `server/utils/collections/`: definition/envelope validation, registry metadata, source-read error handling, detail caching and relation bounds. Reusable domain projections live in `server/utils/projections/`; pure document/resource formatting lives in `server/utils/content/`. Source list and search contracts remain separate.

Every production definition opts into `cacheDurations.collections.<name>` from `config/cache.ts`. Get tools and resources share validated cached detail records, with fresh response timestamps. Ordinary lists/search results remain uncached; catalogues have their own root-only cache.

See [collection architecture](../../docs/collection-registry.md), [public data/projections](../../docs/collection-data.md), [search](../../docs/search.md), [resources](../../docs/collection-resources.md) and [cache controls](../../docs/cache.md). Keep runtime publication policy in Directus and native domain differences explicit.
