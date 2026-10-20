# Testing

Vitest runs two projects: isolated unit tests and HTTP integration tests against a built Node server. Together they protect collection contracts and the MCP interface across all ten core collections.

## Run tests

Use the Node version in `.nvmrc` and the package manager pinned in `package.json`.

```sh
corepack pnpm test            # Complete suite
corepack pnpm test:unit       # Unit tests
corepack pnpm test:e2e        # HTTP integration tests
corepack pnpm test:watch      # Unit tests in watch mode
corepack pnpm test:coverage   # Unit tests with V8 coverage reports
corepack pnpm typecheck       # Application and test TypeScript checks
```

HTTP tests build the application, so the configured Varlock environment, secrets-provider access and build-time services must be available. Runtime Directus and Algolia requests use local fixtures with synthetic credentials. See [development](../docs/development.md) for environment setup.

The reusable Code Quality workflow runs the complete suite in its **Unit and e2e
tests** job for pull requests to `main`, alongside lint and typecheck. It uses the
same setup and build-time credentials as the other quality jobs and skips
Dependabot runs.

## Where tests belong

| Location        | Responsibility                                                                         |
| --------------- | -------------------------------------------------------------------------------------- |
| `unit/`         | Schemas, query translation, normalization, rendering, discovery and shared mechanisms. |
| `e2e/`          | Advertised MCP contracts and behavior across the production HTTP boundary.             |
| `fixtures/`     | Synthetic domain records, test-only collection definitions and local provider servers. |
| `tsconfig.json` | Type checking for tests, fixtures and Vitest configuration.                            |

Unit tests import Vitest APIs explicitly and mock environment or external-service boundaries where needed. They do not boot Nuxt or provide a browser DOM. Collection tests use collection names; shared behavior tests use the mechanism they protect.

The HTTP project uses `@nuxt/test-utils` to build and start an isolated Node server on an available port. Build artifacts live under ignored `.nuxt/test/`; test-utils manages server teardown. Tests do not reuse a development server or the normal `.output/` build.

## Behavior covered

- **Collection contracts:** native schemas, boundary validation, source filters, pagination, relationship projections and sanitized provider errors.
- **Discovery and search:** the explicit collection allowlist, capability gating, facets, literal filter values, snippets and index-to-record mapping.
- **Content and resources:** editor hydration, Markdown/YAML rendering, missing-body notices, transcripts, relation bounds, traversal limits and truncation indicators.
- **Caching:** Nitro’s actual function cache with isolated storage and controlled time, including collection/ID isolation, concurrent reads, expiry, retries and tool/resource reuse across all ten collections.
- **Route workflows:** prerequisite grouping, sequential state cleanup, complete-selection gates, subset matching, pagination and ordered readable steps.
- **MCP over HTTP:** all thirty-seven tools, advertised schemas, structured responses and text fallbacks, resource links, templates, catalogues and the route prompt. Catalogue cases include more than 1,500 records, lower upstream page caps and incomplete responses.

The HTTP fixtures in `fixtures/directus.ts` and `fixtures/algolia.ts` exercise installed SDKs against real HTTP boundaries. Domain fixture modules provide relationships and collection-specific source/search records. Missing-content and error variants use distinct synthetic IDs so an earlier cached record cannot hide the scenario under test.

`fixtures/faq-collection.ts` is a separate test-only collection, not the production FAQ definition. It tests registry behavior with non-UUID IDs, different native fields and optional capabilities. In-memory SDK tests check its protocol contract without adding it to the production registry.

## Adding regression coverage

Add tests for observable behavior or a known failure risk. Keep source fixtures synthetic or sanitized, and place reusable domain data in the relevant fixture module. Test contract differences explicitly rather than reproducing implementation details in assertions.

Choose the lowest boundary that proves the behavior: unit tests for transformations and validation, HTTP tests for advertised schemas, SDK serialization and protocol responses. Test execution does not replace TypeScript checking; run `corepack pnpm typecheck` when changing test code.

Coverage reports are written to ignored `coverage/`. Use them to investigate gaps; percentage targets are not enforced. Live-provider checks should remain opt-in and bounded.

## Verification boundaries

The suite verifies the Node server’s HTTP contracts. It does not establish browser hydration behavior, live service permissions or deployed Cloudflare Workers behavior. Build-time module initialization uses the normal configured environment even when runtime requests use fixtures.

See [collection architecture](../docs/collection-registry.md), [collection data](../docs/collection-data.md), [search](../docs/search.md), [resources](../docs/collection-resources.md) and [caching](../docs/cache.md) for the contracts these tests protect.
