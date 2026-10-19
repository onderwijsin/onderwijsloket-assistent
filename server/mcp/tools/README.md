# MCP tools

Reserved for the seven articles POC adapters documented in [the POC guide](../../../docs/articles-poc.md).

Future filenames: `list-collections.ts`, `describe-collection.ts`, `list-records.ts`, `get-record.ts`, `search-records.ts`, `get-facets.ts`, `get-filters.ts`. Set explicit underscore tool names to preserve the agreed public interface.

Keep adapters thin: validate input, call collection/service logic and return structured output plus a readable fallback. Do not register resources or prompts. This README is not a tool definition.
