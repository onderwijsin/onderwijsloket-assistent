# Onderwijsloket Assistent

Experimental, anonymous, read-only MCP access to Onderwijsloket data.

The articles POC currently exposes five Directus-backed tools: `list_collections`, `describe_collection`, `list_records`, `get_record` and `get_filters`. Algolia search and facets are deferred. UI, resources and prompts are outside the current milestone; the existing Nuxt starter UI is unchanged.

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
