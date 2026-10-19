# Verification

Run `corepack pnpm test` for the complete unit and HTTP e2e suite.

## Unit tests

`corepack pnpm test:unit` exercises collection schemas and response validation, query translation, all article filter dimensions, taxonomy normalization, dynamic filter discovery, Markdown rendering and environment resolution.

Document fixtures cover every supported relation type, nested callout scopes, repeated references, cycles, malformed inputs, missing/unsupported payloads, tables, text formatting, URL handling, H1 insertion and full content beyond 20,000 characters. Node-count and depth limits are tested separately.

Taxonomy cache tests use Nitro's actual cache implementation with isolated in-memory storage to verify reuse, 60-second expiry and retries after transport or validation failures.

## HTTP e2e tests

`corepack pnpm test:e2e` builds and starts the actual Node application. A local Directus HTTP fixture in `tests/fixtures/directus.ts` supplies synthetic records; server runtime configuration points exclusively to that fixture using a synthetic token. The Directus SDK and application handlers are not mocked.

The suite covers MCP discovery and schema portability, catalogue/collection metadata, filtered pagination, full Markdown details and embedded assets, dynamic filter choices, cache reuse, input rejection before upstream requests, missing records and sanitized upstream failures. Successful responses verify structured content and the JSON text fallback.

The normal Nuxt build still requires its configured environment and build-time schema access. These tests do not validate production Directus permissions, live content, browser behavior or Cloudflare deployment.

## Coverage

`corepack pnpm test:coverage` writes V8 reports to ignored `coverage/`. Coverage guides investigation; there are no percentage targets or changed include paths. Tests protect meaningful behavior rather than mirroring implementation details.

Article resource tests additionally exercise URI templates, complete catalogue discovery across multiple summary pages, Markdown/front matter, record-tool resource links and sanitized resource errors. YAML serialization, collection metadata selection and generic resource descriptors and reusable list/read callbacks also have unit coverage. See [article resources](../docs/article-resources.md).

Search tests cover reusable Algolia clients and query adapters, dynamic facets, literal filter values, nested matched snippets and index-to-Directus discovery. HTTP e2e uses `tests/fixtures/algolia.ts` with private fixture credentials and a local host override, exercising the installed SDK rather than a mocked SDK transport. See [search](../docs/search.md).
