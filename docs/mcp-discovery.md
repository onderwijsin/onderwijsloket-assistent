# MCP discovery

Two public, read-only JSON endpoints expose the toolkit's discovered definitions
without calling tools or fetching source records:

- `GET /.well-known/mcp/server-card.json` returns the MCP server's `name` and
  `description`, plus `tools`, `resources` and `prompts`. Entries contain `name`
  and `description`; resource entries also include their `uri` template.
- `GET /api/tools` returns JSON-friendly tool summaries keyed by group. Tools
  without a group appear under `default`. Summaries include resolved names and
  available titles, descriptions, groups, tags and handler attribution.

Both routes use the toolkit's `listMcp*` helpers with the current request event,
so per-definition `enabled()` guards apply. Responses are not cached across
requests. The catalog reflects discovered definitions; it does not apply custom
MCP handler middleware, dynamic resolvers or `mcp:config:resolved` hooks.

The server card and `/mcp` share their identity through `config/mcp-server.ts`.
Existing MCP protocol routes and tool contracts are unchanged.

See the toolkit's [listing definitions guide](https://mcp-toolkit.nuxt.dev/advanced/listing-definitions).
