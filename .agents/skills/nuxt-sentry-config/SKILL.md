---
name: nuxt-sentry-config
description:
  Use when integrating @onderwijsin/nuxt-sentry-config, configuring Sentry for Node or Cloudflare
  Nitro, or sharing one Sentry server config across those runtimes.
---

Use `@onderwijsin/nuxt-sentry-config` to initialize Sentry server-side from one config file while
switching between Nitro's Node and Cloudflare module runtimes.

## Installation and Nuxt configuration

```sh
pnpm add @onderwijsin/nuxt-sentry-config @nuxt/ui vue
```

The application supplies `@nuxt/ui`, `vue` as peer dependencies so module runtime code shares the
application's instances. Nuxt module registration remains automatic. `@nuxt/ui` is optional when the
diagnostics page is disabled.

Register both this module and `@sentry/nuxt/module`. They have separate responsibilities:

```ts
export default defineNuxtConfig({
  modules: ["@sentry/nuxt/module", "@onderwijsin/nuxt-sentry-config"],
  // @sentry/nuxt build-time settings: source-map uploads and credentials.
  sentry: process.env.SENTRY_DSN
    ? {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        sourcemaps: {
          disable: process.env.SENTRY_UPLOAD_SOURCE_MAPS !== "true"
        }
      }
    : false,
  // Runtime-portable server initialization settings from this module.
  sentryConfig: {
    dsn: process.env.SENTRY_DSN,
    configFile: "sentry.config.ts"
  }
});
```

`sentry` configures the build-time `@sentry/nuxt` integration: organisation, project, auth token,
and source-map uploads. `sentryConfig` configures server initialization. Never put
`SENTRY_AUTH_TOKEN` in runtime config or client code.

## Server config and runtime API

The optional `sentry.config.ts` file default-exports either the complete Sentry initialization
object or a resolver function. The resolver receives the selected runtime and Nitro's resolved
runtime config when Sentry starts:

```ts
import {
  defineSentryServerConfig,
  isCloudflare,
  isNode
} from "@onderwijsin/nuxt-sentry-config/runtime";

export default defineSentryServerConfig(({ runtime, runtimeConfig }) => ({
  dsn: runtimeConfig.public.sentry.dsn,
  environment: isCloudflare(runtime) ? "production-edge" : "production-server",
  sendDefaultPii: isNode(runtime),
  tracesSampleRate: isCloudflare(runtime) ? 0.05 : 0.1
}));
```

Use the runtime guards rather than string comparisons. `isNode(runtime)` narrows to `"node-server"`;
`isCloudflare(runtime)` narrows to `"cloudflare_module"`.

For a runtime-independent setup, pass an object directly instead:

```ts
import { defineSentryServerConfig } from "@onderwijsin/nuxt-sentry-config/runtime";

export default defineSentryServerConfig({
  environment: "production",
  tracesSampleRate: 0.1
});
```

The public runtime exports are:

- `defineSentryServerConfig(config)`: identity helper for a static config object or resolver.
- `isNode(runtime)`: Node runtime type guard.
- `isCloudflare(runtime)`: Cloudflare runtime type guard.
- `defaultSentryServerConfig`: `enableLogs: true`, `enabled: true`, `sampleRate: 1`,
  `tracesSampleRate: 0.1`, and `sendDefaultPii: false`.
- `defaultSentryClientConfig`: the same sensible defaults for the application's client config.
- `SentryInitConfig`: the Sentry initialization object type.
- `SentryServerConfigContext`: resolver context with `runtime` and `runtimeConfig`.
- `SentryServerConfigResolver`: a function from that context to `SentryInitConfig`.
- `SentryServerConfigInput`: either a static `SentryInitConfig` or a resolver.

The package root default-exports the Nuxt module and exports `ModuleOptions` and `SentryRuntime`
types. `SentryRuntime` is the `"node-server" | "cloudflare_module"` union used by the module option
and resolver context.

Do not put the complete Sentry config in Nuxt runtime config. Runtime config is serialized and
cannot preserve integrations, callbacks, transports, or event hooks. Keep those in
`sentry.config.ts`; use the resolver and its runtime guards for runtime-specific options.

The module writes these public values, with generated `RuntimeConfig` augmentation:

- `runtimeConfig.public.sentry.dsn`
- `runtimeConfig.public.sentry.runtime`

The DSN is public by design. At startup, matching `NUXT_*` environment variables are applied to
Nitro runtime config; for example, `NUXT_PUBLIC_SENTRY_DSN` overrides
`runtimeConfig.public.sentry.dsn` without rebuilding. This is distinct from build-time Sentry
credentials and must never be used for an auth token.

## Module options

`sentryConfig` accepts:

- `enabled` (`true`): enables server Sentry setup. Set `false` to disable this module.
- `dsn`: default public DSN, written to `runtimeConfig.public.sentry.dsn`.
- `runtime` (`"node-server"`): select `"node-server"` or `"cloudflare_module"`. When omitted,
  Cloudflare is detected from Nitro's `cloudflare_module` preset or `NITRO_PRESET`; otherwise Node
  is the default.
- `configFile`: optional path to the application config file, relative to the Nuxt root.
- `autoInjectServerConfig` (`true`): injects the generated Node preload into Nitro's entrypoint.
- `disableNitroSourceMapUpload` (`true`): disables the duplicate Nitro Rollup source-map upload.
- `testTools` (enabled): optional diagnostic page and controlled-error endpoint. Set `false` to omit
  both tools.
- `testTools.page` (`/_sentry`): browser diagnostic route, or `false` to omit only the Nuxt UI page.
- `testTools.endpoint` (`/api/_sentry/trigger-error`): deliberate-error server route, or `false` to
  omit only the endpoint.

If `configFile` is omitted, the module initializes with `defaultSentryServerConfig`.

## Diagnostic test tools

Unless disabled, the module exposes a Nuxt UI diagnostic page at `/_sentry` and a deliberate-error
endpoint at `/api/_sentry/trigger-error`. The page captures a client exception, starts a frontend
trace, calls the server endpoint, and shows whether the active server integration is Node or
Cloudflare. The endpoint is intentionally rate limited to five requests per minute per IP through
`@onderwijsin/nuxt-simple-rate-limiter`.

These tools are for environments where generating a controlled Sentry event is acceptable. The rate
limiter is best-effort abuse control rather than an access-control boundary, so protect or disable
these routes at the deployment boundary if they are not intended to be public.

Customize or omit the routes with `testTools`:

```ts
export default defineNuxtConfig({
  sentryConfig: {
    testTools: {
      page: { path: "/internal/sentry" },
      endpoint: { path: "/api/internal/sentry/trigger-error" }
    }
  }
});
```

- `testTools: false` omits both tools.
- `testTools: { page: false }` omits only the Nuxt UI page and avoids the `@nuxt/ui` dependency.
- `testTools: { endpoint: false }` omits only the server route and avoids the rate-limiter
  dependency.

The page can still test client capture when its endpoint is disabled. The configured endpoint path
is exposed as `runtimeConfig.public.sentry.testTools.endpoint` for the module-owned page.

## Node runtime

The module always emits `.output/server/sentry.server.config.mjs`. Choose exactly one startup
strategy; using two starts Sentry twice.

The default, plug-and-play strategy is `autoInjectServerConfig: true`. The module places an import
of the generated preload at the top of `.output/server/index.mjs`, so start Nitro normally:

```sh
node .output/server/index.mjs
```

When a deployment owns the Node command, opt out of automatic injection and preload it yourself:

```ts
export default defineNuxtConfig({
  sentryConfig: { autoInjectServerConfig: false }
});
```

```sh
node --import ./.output/server/sentry.server.config.mjs .output/server/index.mjs
```

For process managers, `NODE_OPTIONS="--import ./.output/server/sentry.server.config.mjs"` is
equivalent. Do not additionally enable `sentry.autoInjectServerSentry` from `@sentry/nuxt`, or add
the manual preload while automatic injection is enabled.

## Cloudflare runtime

Select Cloudflare with Nitro, or override the module runtime explicitly:

```ts
export default defineNuxtConfig({
  nitro: { preset: "cloudflare_module" },
  sentryConfig: { runtime: "cloudflare_module" }
});
```

The explicit `runtime` is only needed when the preset cannot be detected or an intentional override
is required. The module registers `sentryCloudflareNitroPlugin`, enables Cloudflare Node
compatibility for request isolation, and requires no Node preload command. Deploy the normal
Cloudflare Nitro output.

Keep portable Sentry options in the shared config and use `isNode(runtime)` or
`isCloudflare(runtime)` to add guarded runtime-specific integrations, transports, or settings.
Source-map credentials (`SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`) remain build-time
only. Use `NUXT_PUBLIC_SENTRY_DSN` for a deployment-specific public DSN.

## Client config

This module intentionally does not generate `sentry.client.config.ts`. Create and own that file in
the application, spreading `defaultSentryClientConfig` and reading the public DSN and runtime:

```ts
import * as Sentry from "@sentry/nuxt";
import { useRuntimeConfig } from "#app";
import { defaultSentryClientConfig } from "@onderwijsin/nuxt-sentry-config/runtime";

const { public: publicRuntimeConfig } = useRuntimeConfig();

Sentry.init({
  ...defaultSentryClientConfig,
  dsn: publicRuntimeConfig.sentry.dsn,
  environment: publicRuntimeConfig.sentry.runtime
});
```

## Source-map uploads

This module removes Nitro's duplicate Sentry Rollup source-map upload plugin by default. This
follows the reference module's intent: avoid duplicate artifact work from the final Nitro upload
pass. Set `disableNitroSourceMapUpload: false` only when that Nitro upload pass is intentionally
required. The `sentry` option remains the place to control whether source maps upload at all.
