# Verification

Vitest provides unit tests in `unit/` and HTTP e2e tests in `e2e/`. See [testing commands and setup](../docs/development.md#testing). There is no separate integration suite or browser automation.

Prioritize the seven-tool discovery contract, publication/field restrictions, nested relations, filter validation, pagination, content resolution, Algolia/Directus shape differences and safe provider failures. Include a real MCP transport smoke check, not only direct service calls.

Use synthetic or sanitized fixtures. Live upstream checks must be opt-in, require server-side credentials and stay bounded. Never require production writes. See [acceptance criteria](../docs/articles-poc.md).
