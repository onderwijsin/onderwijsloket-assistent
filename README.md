# Onderwijsloket Assistent

Experimental, anonymous, read-only MCP access to Onderwijsloket data.

The articles POC exposes five Directus-backed tools: `list_collections`, `describe_collection`, `list_records`, `get_record` and `get_filters`. Algolia discovery is available through `search_collection` and `get_facets`; see [search](docs/search.md). Article Markdown resources are available through MCP; see [article resources](docs/article-resources.md). UI and prompts remain deferred; the existing Nuxt starter UI is unchanged.

## Start here

- [Project specification](SPEC.md): product direction and current scope.
- [Articles POC](docs/articles-poc.md): tool responsibilities, implementation sequence and acceptance criteria.
- [Development](docs/development.md): existing tooling and setup requirements.

## Structure

- `server/mcp/tools/`: MCP adapters.
- `server/collections/`: collection schemas, Directus queries and normalization.
- `server/utils/`: shared collection definition helper.
- `tests/`: contract and integration checks.

See the POC guide for supported inputs and current limitations, including explicit warnings for unavailable or unsupported content.
