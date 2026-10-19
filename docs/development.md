# Development

Use the Node version in `.nvmrc` and the Corepack-managed package manager pinned in `package.json`. Dependencies use the workspace catalogue; see [dependencies](dependencies.md).

## Local setup

Use the existing Varlock environment profiles under `envs/`. Directus and Algolia schemas describe their configuration. Resolve credentials through the existing environment setup; do not put tokens in documentation, fixtures or public runtime configuration.

For a fresh checkout, dependency installation is a human setup step or a separately authorized dependency task. No installation is needed for this scaffold.

With dependencies and environment access available:

```sh
corepack pnpm dev
```

Nuxt modules may require access to the configured secrets provider and Directus schema generation. The MCP Toolkit warning about missing definitions is expected until tools are implemented. A running starter does not demonstrate a working MCP contract.

## Checks

```sh
corepack pnpm fmt
corepack pnpm lint:fix
corepack pnpm typecheck
```

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
build/start timeout. The initial smoke test checks the root HTML response and Nuxt
mount point; it does not verify the planned MCP contract or browser hydration.

Server and build isolation does not replace upstream services: the app still loads
its existing Varlock environment and configured Nuxt modules. Their credentials
and build-time service access must be available as for a normal build. Future tests
that exercise upstream APIs must use controlled fixtures or explicitly opted-in test services.

Coverage reports are written to ignored `coverage/`. No coverage thresholds are imposed.
Use synthetic or sanitized fixtures and keep checks against live providers opt-in and bounded.
See [the articles POC](articles-poc.md) for the future MCP acceptance checks.

## Current implementation entry point

Follow [the articles POC](articles-poc.md). Do not build chat, resources, prompts or additional collections during that milestone. Existing UI and optional module configuration are retained; their presence does not expand the scope.
