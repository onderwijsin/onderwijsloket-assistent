# Development

Use the Node version in `.nvmrc` and the Corepack-managed package manager pinned in `package.json`. Dependencies use the workspace catalogue; see [dependencies](dependencies.md).

## Local setup

Use the existing Varlock environment profiles under `envs/`. Directus and Algolia schemas describe their configuration. Resolve credentials through the existing environment setup; do not put tokens in documentation, fixtures or public runtime configuration.

For a fresh checkout, run `corepack pnpm install` after configuring environment access. Installation initializes Nuxt modules and generates types. Existing checkouts do not need dependency installation for ordinary source or documentation changes.

With dependencies and environment access available:

```sh
corepack pnpm dev
```

Nuxt modules may require access to the configured secrets provider and Directus schema generation. The MCP Toolkit discovers thirty collection-specific record tools, four shared discovery tools and ten resource templates. Exercise `/mcp` through an MCP client; the website does not call these tools.

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

The pre-push hook runs `corepack pnpm test`, covering both unit and HTTP e2e
projects. Test failures block the push. Existing typecheck and lint gates run
first, with their existing opt-out flags; the test gate has no opt-out flag.
The hook uses the project-pinned package manager through Corepack and requires
the same build-time environment access as the e2e suite.

Vitest runs unit and HTTP integration projects. Use `corepack pnpm test` for both, `corepack pnpm test:unit` for isolated behavior and `corepack pnpm test:e2e` for the built server’s HTTP contracts. Type checking remains a separate step.

The [testing guide](../tests/README.md) owns test commands, fixture conventions, server isolation and verification boundaries. Runtime provider requests use synthetic HTTP fixtures; build-time module setup still requires the configured environment.

## Architecture entry points

Start with [collection registry](collection-registry.md), [search](search.md) and [collection data](collection-data.md). Resources, content rendering, taxonomy choices and cache controls have focused reference guides. The implementation exposes ten core collections with record tools/resources; supporting tables remain embedded. The [geocoding utility](geocoding.md) resolves location text for geographic searches of programs, institutions and regional education desks. [MCP prompts](mcp-prompts.md) provide program comparison, local support and related-content workflows. Chat remains future work.

## Server JSDoc

MCP handlers, collection methods and their supporting server utilities document behavior, each declared parameter with `@param`, and the return value with `@returns`. Functions without parameters omit `@param`; void and throwing functions explain their effects under `@returns`. Schema, configuration and type comments describe their purpose without function tags. Keep client-facing MCP descriptions independent of infrastructure details.

## Tool analytics

See [server-side tool analytics](tool-analytics.md) for Plausible configuration,
properties, optional query data, delivery behavior and attribution limitations.

See [collection resources](collection-resources.md) for catalogue discovery and resource reads across all ten core collections.
