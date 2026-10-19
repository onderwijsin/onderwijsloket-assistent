# Articles POC

Status: implementation handoff; scaffolding only. This is the next milestone, before the broader roadmap in [SPEC.md](../SPEC.md).

## Scope

Deliver articles end to end through an anonymous, read-only `/mcp` endpoint. Exactly seven tools are in scope. No UI work, chat endpoint, model calls, resources, prompts or geocoding. Keep existing starter UI unchanged.

Only `articles` is an exposed collection. Related taxonomies and content blocks may be read internally to resolve article content, subject to the same public-data restrictions. Their presence does not make them separately queryable collections.

## Tool responsibilities

The names are agreed; inputs and output schemas below are proposed and must be verified against actual article fields before implementation.

| Tool                  | Proposed inputs                                                             | Responsibility                                                                                                                                    |
| --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list_collections`    | None                                                                        | Return the approved catalogue: initially `articles`, its description and capabilities.                                                            |
| `describe_collection` | `collection`                                                                | Describe public record fields, identifiers, pagination, sorts and supported retrieval/search operations. Refer to filter/facet tools for details. |
| `list_records`        | `collection`, optional typed `filters`, `page`, `page_size`, allowed `sort` | Retrieve bounded article summaries from Directus with deterministic sorting.                                                                      |
| `get_record`          | `collection`, `id`                                                          | Retrieve one approved published article with readable content, relevant relationships and attribution.                                            |
| `search_records`      | `collection`, `query`, optional typed `filters`, `page`, `page_size`        | Query the configured Algolia article index and normalize ranked summaries.                                                                        |
| `get_facets`          | `collection`, optional `query` and typed `filters`                          | Return supported Algolia facet values and counts in the current search context, including any approximation/exhaustiveness metadata.              |
| `get_filters`         | `collection`                                                                | Return supported filter names, value types, allowed operators, combination rules and which operations support each filter. No result counts.      |

`get_filters` describes how to construct a valid filter. `get_facets` reports which indexed values match a search context and how many hits they have. Do not overload either tool with arbitrary upstream schema or query access.

Use one-based public page numbers consistently; translate to upstream conventions. Begin with 10 records per page and a maximum of 25. Define stable tie-breaking for Directus listing and report when more pages exist. Do not promise exact totals when a provider cannot supply them.

Use the same logical filter names where possible. Document any backend-specific capabilities rather than silently ignoring unsupported filters. Specify AND/OR semantics before writing the filter translator. Never pass raw Directus or Algolia expressions from the caller.

Search summaries should identify records that can be fetched with `get_record`. Use source paths for canonical URLs, preserve update times where available, and include retrieval time. Keep search rank separate from source record data. Do not assume indexed content is current or complete enough to replace a detail read.

## Implementation sequence

1. Inspect the actual article schema, published-content policy, content-node relationships and configured Algolia index/facets. Confirm public exposure scope. Record the verified public field and filter catalogue.
2. Define the article catalogue and Zod input/output contracts. Specify summary/detail shapes, pagination, error codes, truncation and filter semantics before implementing adapters.
3. Implement bounded Directus list/detail services and content normalization, reusing the existing server helper. Preserve links and meaningful embedded content; report unresolved/truncated content.
4. Implement Algolia search/facets and scoped token retrieval. Validate results, translate supported filters and bound token-refresh retries.
5. Add the seven thin MCP adapters with explicit public names, schemas and read-only annotations. Use the toolkit's default endpoint; add custom handler configuration only where needed.
6. Verify through an independent MCP client against local and deployed transport. Document actual output examples and connection steps once they exist.

## Preconditions and runtime review

- Confirm the configured Directus credential and Algolia token can read the intended public articles. Do not use admin keys.
- Confirm index naming and facet settings from the actual source configuration; do not infer them from collection names alone.
- Review `directus.config.ts`: current command auto-imports include writes. Those imports are not MCP tools or authorization controls; runtime credentials and exposed routes must enforce read-only access.
- Explicitly disable preview behavior for public POC reads and audit module-generated proxy routes. Existing disabled auth and asset features alone do not establish a safe public boundary.
- Review installed MCP Toolkit transport and async-context requirements before changing Nuxt configuration.
- Keep Node and Workers compatibility. No process-local correctness assumptions, filesystem runtime dependencies or unnecessary dependency changes.

These reviews belong to implementation. This scaffold changes no runtime configuration and is not ready for public deployment.

## Acceptance criteria

- MCP discovery advertises exactly the seven agreed tools, without resources or prompts.
- `list_collections` returns only `articles`; unknown collections fail validation across all collection tools.
- A client can describe articles, discover filters, list records, search, inspect facets and fetch a matching full article by ID.
- List/detail/search/facet paths consistently enforce public fields and publication restrictions, including nested relations and direct ID lookup.
- Filter definitions match accepted inputs. Invalid fields/operators and unsupported backend combinations fail explicitly.
- Empty results are distinguishable from denied access, timeout, token failure or provider outage.
- Pagination is consistent; record limits, query length, relationship depth, output size and upstream timeouts are bounded.
- Normalized detail preserves source links and meaningful relational content or explicitly reports missing/truncated sections.
- Secrets and excluded fields do not appear in results, logs, errors or module proxies.
- Formatting, lint and type checks pass; focused regression checks and an MCP transport smoke check pass.

## Deliberately unresolved

Exact article projections, filters and output schemas require upstream inspection. The test runner is not selected. Public hosting, distributed limits and operating budgets remain release decisions. None are implemented by the directory scaffold.
