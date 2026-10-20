# Development

Use the Node version in `.nvmrc` and the Corepack-managed package manager pinned in `package.json`. Dependencies use the workspace catalogue; see [dependencies](dependencies.md).

## Local setup

Use the existing Varlock environment profiles under `envs/`. Directus and Algolia schemas describe their configuration. Resolve credentials through the existing environment setup; do not put tokens in documentation, fixtures or public runtime configuration.

For a fresh checkout, dependency installation is a human setup step or a separately authorized dependency task. No installation is needed for this scaffold.

With dependencies and environment access available:

```sh
corepack pnpm dev
```

Nuxt modules may require access to the configured secrets provider and Directus schema generation. The MCP Toolkit discovers five Directus article tools plus `search_articles` and `get_facets`. Exercise `/mcp` through an MCP client; the starter UI does not call these tools.

## Checks

```sh
corepack pnpm fmt
corepack pnpm lint:fix
corepack pnpm typecheck
```

`typecheck` runs `typecheck:nuxt` followed by `typecheck:test`. The Nuxt check covers
its generated application, server, shared and tooling projects. The test check uses
`tsc --noEmit` for all TypeScript under `tests/` (including fixtures) and
`vitest.config.ts`; Vitest execution alone does not check types.

`tests/tsconfig.json` extends the generated server configuration because these tests
run in Node and import server code. It retains strict checking and generated aliases,
adds Node types, and loads `.nuxt/nuxt.d.ts` for module, runtime configuration and
Varlock declarations. Keeping the config inside `tests/` also gives editors the
same type context without adding tests to Nuxt's production projects. Vitest APIs
remain explicit imports rather than global types.

Run either check independently with `corepack pnpm typecheck:nuxt` or
`corepack pnpm typecheck:test`. The standalone test check requires generated `.nuxt/`
types: run `corepack pnpm prepare` after initial setup or configuration changes.
The combined check generates these through Nuxt before checking tests.

For documentation-only edits, formatting can target the changed Markdown files. Inspect the diff after checks and preserve unrelated work. Typecheck may initialize modules and generate ignored Nuxt/schema artifacts.

## Testing

Vitest runs two projects, following its [test projects configuration](https://vitest.dev/guide/projects).
Both use Node; there is no Playwright, browser runner or separate integration suite.

```sh
corepack pnpm test            # unit and e2e tests, single run
corepack pnpm test:unit       # unit tests only
corepack pnpm test:watch      # unit tests, watch mode
corepack pnpm test:coverage   # unit tests with V8 coverage
```

Put isolated unit tests in `tests/unit/**/*.test.ts`. Import Vitest APIs explicitly.
Use relative source imports; this lightweight setup does not boot Nuxt, resolve its
virtual imports or provide a DOM. Mock environment and external service boundaries.
The environment-mode tests exercise the existing configuration helper without loading secrets.

Run the HTTP e2e suite with one command:

```sh
corepack pnpm test:e2e
```

`@nuxt/test-utils/e2e` builds the actual application with the Node server preset,
starts its own server on an automatically selected free port, waits for readiness,
and stops it after the suite. Each suite gets a unique build and output directory
under ignored `.nuxt/test/`, removed during teardown. It does not reuse a running
dev server or `.output/`, and requires no `TEST_BASE_URL`. Browser support is disabled.

Put HTTP e2e tests in `tests/e2e/**/*.test.ts` and use `setup` plus the test-utils
`fetch`/`$fetch` helpers to target the managed instance. Setup has a three-minute
build/start timeout. The suite checks the root HTML response, the MCP schema catalogue, and all seven
MCP tools. It does not verify browser hydration.

Server and build isolation does not replace upstream services: the app still loads
its existing Varlock environment and configured Nuxt modules. Their credentials
and build-time service access must be available as for a normal build. Runtime article and taxonomy requests use a local HTTP Directus fixture with synthetic
content and fixture credentials. This exercises the actual SDK, query serialization, collection
logic, Markdown pipeline and MCP responses. No live content or provider credentials are needed
for these runtime assertions. Build-time module setup still uses the normal environment.

Coverage reports are written to ignored `coverage/`. No coverage thresholds are imposed.
Use synthetic or sanitized fixtures and keep checks against live providers opt-in and bounded.
See [the articles POC](articles-poc.md) for the implemented MCP contracts.

## Current implementation entry point

Follow [the articles POC](articles-poc.md). Article resources are described in [article resources](article-resources.md). Shared collection preparation and the rollout plan are documented in [phase 3 preparation](collection-inventory/phase-3.md). Chat, prompts and live additional collections remain deferred. Existing UI and optional module configuration are retained; their presence does not expand the scope.

## Server JSDoc

MCP handlers, collection methods and their supporting server utilities document behavior, each declared parameter with `@param`, and the return value with `@returns`. Functions without parameters omit `@param`; void and throwing functions explain their effects under `@returns`. Schema, configuration and type comments describe their purpose without function tags. Keep client-facing MCP descriptions independent of infrastructure details.

## Tool analytics

See [server-side tool analytics](tool-analytics.md) for Plausible configuration,
properties, optional query data, delivery behavior and attribution limitations.
