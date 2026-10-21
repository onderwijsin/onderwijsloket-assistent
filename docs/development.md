# Development

Use the Node version in `.nvmrc` and the Corepack-managed package manager pinned in `package.json`. Dependencies use the workspace catalogue; see [dependencies](dependencies.md).

## Local setup

Use the existing Varlock environment profiles under `envs/`. Directus and Algolia schemas describe their configuration. Resolve credentials through the existing environment setup; do not put tokens in documentation, fixtures or public runtime configuration.

For a fresh checkout, run `corepack pnpm install` after configuring environment access. Installation initializes Nuxt modules and generates types. Existing checkouts do not need dependency installation for ordinary source or documentation changes.

`NOTION_API_KEY` is an optional server-only secret in the core Varlock schema,
resolved from the environment-specific `NOTION_API_KEY` field in Proton Pass.
It is used by the server-side [feedback reporting integration](feedback.md).
Provision that field in Proton Pass or supply an environment override before loading
the configuration: the current resolver errors on a missing field despite `allowMissing=true`.

With dependencies and environment access available:

```sh
corepack pnpm dev
```

Nuxt modules may require access to the configured secrets provider and Directus schema generation. The MCP Toolkit discovers thirty collection-specific record tools, four shared discovery tools and ten resource templates. Exercise `/mcp` through an MCP client; the [chat endpoint](chat.md) discovers and executes these tools through the same protocol.

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

The reusable Code Quality workflow runs `corepack pnpm test` in a separate job
alongside lint and typecheck for pull requests targeting `main`. This includes unit
and HTTP e2e tests; the e2e suite builds and starts its own Node server, so no
separate build step is needed. The job uses the configured runner and Proton Pass
secret for build-time environment access. Like the other quality jobs, it skips
Dependabot runs. Configure the test job as a required check in branch rules to
block merges when tests fail.

The pre-push hook runs `corepack pnpm test`, covering both unit and HTTP e2e
projects. Test failures block the push. Existing typecheck and lint gates run
first, with their existing opt-out flags; the test gate has no opt-out flag.
The hook uses the project-pinned package manager through Corepack and requires
the same build-time environment access as the e2e suite.

Vitest runs unit and HTTP integration projects. Use `corepack pnpm test` for both, `corepack pnpm test:unit` for isolated behavior and `corepack pnpm test:e2e` for the built server’s HTTP contracts. Type checking remains a separate step.

The [testing guide](../tests/README.md) owns test commands, fixture conventions, server isolation and verification boundaries. Runtime provider requests use synthetic HTTP fixtures; build-time module setup still requires the configured environment.

## HTTP requests

Follow the [HTTP request policy](http-requests.md): use `ofetch` or `ofetch.create()`, or an installed specialized service client.

## Architecture entry points

Start with [collection registry](collection-registry.md), [search](search.md) and [collection data](collection-data.md). Resources, content rendering, taxonomy choices and cache controls have focused reference guides. The implementation exposes ten core collections with record tools/resources; supporting tables remain embedded. [Education pathways](routes.md) use dedicated questionnaire, matching and detail tools. The [geocoding utility](geocoding.md) resolves location text for geographic searches of programs, institutions and regional education desks. [MCP prompts](mcp-prompts.md) provide program comparison, local support, related-content and route-questionnaire workflows. The [chat integration](chat.md) exposes these workflows to the assistant.

## Server JSDoc

MCP handlers, collection methods and their supporting server utilities document behavior, each declared parameter with `@param`, and the return value with `@returns`. Functions without parameters omit `@param`; void and throwing functions explain their effects under `@returns`. Schema, configuration and type comments describe their purpose without function tags. Keep client-facing MCP descriptions independent of infrastructure details.

## Tool analytics

See [server-side tool analytics](tool-analytics.md) for Plausible configuration,
properties, optional query data, delivery behavior and attribution limitations.

See [collection resources](collection-resources.md) for catalogue discovery and resource reads across all ten core collections.

## Chat dashboard

The website uses the Nuxt UI chat dashboard with our logo, collapsible navigation,
local conversation history and search. The main panel retains the compact composer,
model selection and color-mode toggle. Sidebar links point to Onderwijs in, GitHub
and `https://onderwijsin.nl/nieuwsbrief` ("Blijf op de hoogte"). The old website header,
footer and newsletter signup components have been removed.

The light-mode page uses Onderwijs in’s `sand-main` token
(`oklch(96% 0.011 76.6)`) around a `sand-light` conversation panel (`oklch(97.4% 0.006 75.4)`). Dark mode uses
`neutral-950` for the page and a panel-scoped `bg-default` mapped to `zinc-900` at 50% opacity.
The command palette includes new-chat and system/light/dark color-mode actions.
`UDashboardSearch` owns the Cmd+K (Ctrl+K on other platforms) shortcut, including
when the composer is focused. Do not register a second handler for this shortcut:
both handlers would run and immediately close the palette again.

The dashboard mounts client-side behind a loading skeleton. Pinia owns conversations,
drafts and model settings, persisted in localStorage with the installed persisted-state
plugin. Chat content is never written to cookies or a server conversation database.
See [chat](chat.md) for hydration, retention, SDK state synchronization and MCP behavior.
