# Tests

The test suite verifies collection contracts, document rendering and the public MCP endpoint. Vitest runs separate unit and HTTP end-to-end projects.

## Commands

```sh
corepack pnpm test            # Complete suite
corepack pnpm test:unit       # Unit tests
corepack pnpm test:e2e        # Production HTTP integration tests
corepack pnpm test:watch      # Unit tests in watch mode
corepack pnpm test:coverage   # Unit tests with V8 coverage reports
```

Use the Node version in `.nvmrc` and the package manager pinned in `package.json`. Application builds load the configured environment and require access to the services used during module initialization and schema generation. See [development](../docs/development.md) for setup.

## Unit coverage

`unit/` covers collection schemas, boundary validation, query translation, pagination, taxonomy normalization, filter discovery, search mapping and safe errors.

Document tests exercise supported editor relations, nested callouts, repeated references, cycles, malformed or unresolved content, tables, text formatting, links, assets, H1 insertion and documents beyond 20,000 characters. Traversal depth and node-count limits have separate assertions.

Resource tests verify URI construction, descriptors, collection metadata selection, reusable list/read callbacks and YAML front matter. Search tests verify client reuse, dynamic facets, literal filter values and nested matched snippets.

Cache tests use Nitro’s actual function cache with isolated storage and controlled time. They verify key isolation, expiry, shared article/tool/resource reads and retries after failures, including incomplete catalogues.

## HTTP integration coverage

`e2e/` builds and starts the application with the Node server preset using `@nuxt/test-utils`. Each run uses an isolated build directory and a server on an available port, with teardown managed by the test runner.

Local HTTP fixtures supply synthetic content and search responses:

- `fixtures/directus.ts` serves article and taxonomy records.
- `fixtures/algolia.ts` serves search results, snippets and facets.

Runtime requests use these fixtures and synthetic credentials. The installed SDKs and application handlers run against real HTTP boundaries. Build-time module initialization still uses the normal configured environment.

Assertions cover all seven tools, collection discovery, schema portability, provider-independent MCP guidance, filtering, pagination, full Markdown content, resource templates and catalogues, front matter, resource links and cache reuse. Error cases verify invalid-input rejection and sanitized missing-record or upstream failures. Successful responses are checked for structured content and the JSON text fallback.

These tests cover the Node server’s HTTP contracts. They do not verify browser hydration, live service permissions or a deployed Cloudflare Workers instance.

## Adding tests

Place isolated behavior tests in `unit/**/*.test.ts` and HTTP contract tests in `e2e/**/*.test.ts`. Import Vitest APIs explicitly. Use synthetic or sanitized fixtures and add cases that protect observable behavior or known regressions.

Coverage reports are written to ignored `coverage/`. Use them to investigate gaps; percentage targets are not enforced.
