# MCP tools

There are thirty collection-specific list/get/search tools and four shared discovery tools: `list_collections`, `describe_collection`, `get_filters` and `get_facets`. Concrete record tool names select their collection; only shared discovery needs a collection argument. Sector search is query-only and advertises no facet capability.

Keep these files as thin static protocol declarations: domain guidance, collection-owned input/output schemas, and structured/text results with resource links. Source queries, field mappings, filters, caches and relationship rules belong below this layer. Do not introduce a generic collection router or expose supporting tables through tool discovery.

Get tools and resource reads call the same cached collection getter. Source lists and search results remain uncached. Details in [collection architecture](../../../docs/collection-registry.md), [search](../../../docs/search.md), [resources](../../../docs/collection-resources.md), [data boundaries](../../../docs/collection-data.md) and [cache controls](../../../docs/cache.md).
