# Collections

Each collection has a single default `defineMcpCollection(...)` export that owns its schemas, Directus queries, normalization and `list()`, `get()` and `filters()` methods. `articles.ts` defines articles and the seven taxonomy filter dimensions. The shared `defineMcpCollection` helper derives discovery metadata, tool inputs and response envelopes from the collection schemas.

Filter values are loaded from Directus. Summaries and details include flattened sectors, qualifications, roles, topics and tracks. The shared `server/utils/content/` pipeline hydrates editor nodes and renders document Markdown.

See [the POC guide](../../docs/articles-poc.md).
