# MCP tools

Five read-only Directus tools are registered: `list_collections`, `describe_collection`, `list_records`, `get_record` and `get_filters`.

Adapters delegate to the article collection definition and return structured content with a text fallback. `search_records` and `get_facets` are deferred. Article resources are also registered; record tools include resource links. Prompts remain deferred. See [the POC guide](../../../docs/articles-poc.md).
