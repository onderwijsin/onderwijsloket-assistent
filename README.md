# Onderwijsloket Assistent

Experimental, anonymous, read-only MCP access to Onderwijsloket data.

The next milestone is an articles-only POC with seven tools. No MCP tools are implemented yet. UI, resources and prompts are outside the current milestone; the existing Nuxt starter UI is unchanged.

## Start here

- [Project specification](SPEC.md): product direction and current scope.
- [Articles POC](docs/articles-poc.md): tool responsibilities, implementation sequence and acceptance criteria.
- [Development](docs/development.md): existing tooling and setup requirements.

## Structure

- `server/mcp/tools/`: MCP adapters.
- `server/collections/`: approved collection definitions and public contracts.
- `server/services/`: upstream access and record normalization.
- `tests/`: future contract and integration checks.

These directories contain documentation only. Scaffolding does not register tools or change runtime behavior.
