---
name: nuxt-directus-client
description:
  Use @onderwijsin/nuxt-directus-client for typed server-safe Directus REST access, preview lookup,
  schema generation, normalized errors, and optional cookie authentication in Nuxt 4.
---

# Nuxt Directus Client

`@onderwijsin/nuxt-directus-client` provides typed Directus REST access across browser, SSR, and
Nitro code. It also provides a same-origin proxy, preview-aware item lookup, generated `#directus`
types, normalized Directus errors, and optional cookie-backed authentication.

## Installation and configuration

```sh
pnpm add @onderwijsin/nuxt-directus-client vue @onderwijsin/nuxt-directus-config
```

The application supplies `vue` as a peer dependency so this module uses the application's Vue
instance.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@onderwijsin/nuxt-directus-config", "@onderwijsin/nuxt-directus-client"]
});
```

```ts
// directus.config.ts
import { defineDirectusConfig } from "@onderwijsin/nuxt-directus-config/config";

export default defineDirectusConfig({
  instance: {
    baseUrl: process.env.DIRECTUS_URL,
    proxyToken: process.env.DIRECTUS_PROXY_TOKEN
  },
  client: {
    commands: ["readItem", "readItems"]
  }
});
```

`@onderwijsin/nuxt-directus-config` is optional. Direct module options use the same shape:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@onderwijsin/nuxt-directus-client"],
  directusClient: {
    instance: {
      baseUrl: process.env.DIRECTUS_URL,
      proxyToken: process.env.DIRECTUS_PROXY_TOKEN
    },
    client: {
      commands: ["readItem", "readItems"]
    }
  }
});
```

When both sources are configured, direct module options take precedence. `instance.baseUrl`,
`instance.proxyToken`, and `client.typegen.introspectionToken` are server-only. The proxy token's
permissions must be safe for public application callers to exercise; secrecy does not make them
private. Do not place these values in `runtimeConfig.public` or browser code.

Authentication owns only stable session facts. Mutable current-user data is opt-in under
`client.auth.user` and is exposed through `useDirectusUser()`:

```ts
client: {
  auth: {
    enabled: true,
    user: { enabled: true, fields: ["id", "email", { role: ["id", "name"] }] }
  }
}
```

The composable returns shared `user`, `status`, `error`, and `refresh` async-data state. Both
browser and SSR use `GET /_directus/auth/user`; SSR also forwards rotated session cookies. Profile
edits require explicit `refresh()`, and auth token refresh does not refetch profile data. The user
ref type is generated from `fields`. It uses the generated `DirectusUser`, including custom system
collection fields, when automated type generation is enabled and falls back to the SDK user type
when disabled. An effective executable mapper replaces that selection with its inferred return type.
A mapper is synchronous, server-only, and accepted only in executable `directus.config.ts`. Its
parameter exposes selected SDK user fields as optional values; custom fields remain `unknown` until
narrowed. Register the Directus config module when using one.

### Complete option reference

All options are configured under `directusClient`.

| Option                                | Default                             | Contract                                                                                                                               |
| ------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`                             | `true`                              | Enables the module.                                                                                                                    |
| `instance.baseUrl`                    | —                                   | Optional Directus URL. Required before requests can run.                                                                               |
| `instance.proxyToken`                 | —                                   | Server-held credential delegated through the proxy; its permissions must be safe for public callers.                                   |
| `client.proxy.path`                   | `/_directus/proxy`                  | Absolute local same-origin browser proxy path. Root paths, auth-route collisions, and overlaps with `client.assets.path` are rejected. |
| `client.assets.enabled`               | `true`                              | Registers the dedicated Directus `/assets` proxy when enabled.                                                                         |
| `client.assets.url`                   | —                                   | Optional absolute upstream asset base URL; defaults to `instance.baseUrl` with `/assets`.                                              |
| `client.assets.path`                  | `/_directus/assets`                 | Absolute local asset-proxy path using the same safe validation; it cannot overlap the REST proxy or reserved auth routes.              |
| `client.assets.publicOnly`            | `false`                             | Keeps asset requests anonymous and never escalates to the current session when enabled.                                                |
| `client.assets.cache.enabled`         | `false`                             | Enables server-side caching of explicitly public anonymous assets.                                                                     |
| `client.assets.cache.storage`         | —                                   | Name of an application-provided Nitro raw-byte storage mount; required when enabled.                                                   |
| `client.assets.cache.maxAge`          | —                                   | Positive cache lifetime in seconds; required when enabled.                                                                             |
| `client.assets.cache.maxBodySize`     | `10485760`                          | Maximum response size in bytes that may be buffered for caching.                                                                       |
| `client.assets.cache.swr`             | `false`                             | Enables stale-while-revalidate behavior.                                                                                               |
| `client.assets.cache.staleMaxAge`     | —                                   | Optional non-negative stale lifetime in seconds.                                                                                       |
| `client.assets.cache.prune.enabled`   | `false`                             | Opts into pruning expired entries when storage does not enforce physical TTLs.                                                         |
| `client.assets.cache.prune.onRequest` | `true`                              | Enables throttled background pruning after cached asset requests.                                                                      |
| `client.assets.cache.prune.interval`  | `3600`                              | Minimum interval between request-triggered prune attempts, in seconds.                                                                 |
| `client.commands`                     | `[readItem, readItems]`             | SDK command names to auto-import. Unsupported names are rejected.                                                                      |
| `client.preview.enabled`              | `false`                             | Enables preview query parsing and request-scoped preview credentials; set to `true` to opt in.                                         |
| `client.preview.versioning`           | `true`                              | Enables versioned preview lookup.                                                                                                      |
| `client.preview.queryKeys`            | `preview`, `token`, `version`, `id` | Query parameter names used for preview context.                                                                                        |
| `client.auth.enabled`                 | `false`                             | Enables cookie authentication and registers authentication routes plus `useDirectusAuth`.                                              |
| `client.auth.turnstile.enabled`       | `false`                             | Registers Turnstile and protects login plus password-reset-email requests.                                                             |
| `client.auth.magicLinks.enabled`      | `false`                             | Registers optional magic-link request and redemption routes; requires auth to be enabled.                                              |
| `client.auth.magicLinks.redirectUrl`  | —                                   | Fixed absolute server-only callback URL; required when magic links are enabled.                                                        |
| `client.auth.cookie.name`             | `directus_session`                  | Session cookie name.                                                                                                                   |
| `client.auth.cookie.secure`           | `true`                              | Sends the cookie only over HTTPS. Use `false` only for local HTTP development.                                                         |
| `client.auth.cookie.sameSite`         | `lax`                               | Cookie `SameSite` policy.                                                                                                              |
| `client.auth.cookie.path`             | `/`                                 | Cookie path.                                                                                                                           |
| `client.auth.cookie.maxAge`           | `2592000`                           | Cookie lifetime in seconds.                                                                                                            |
| `client.auth.cookie.domain`           | —                                   | Optional cookie domain.                                                                                                                |
| `client.auth.refreshSafetyWindow`     | `30000`                             | Refreshes a session this many milliseconds before expiry.                                                                              |
| `client.auth.sessionSecret`           | —                                   | Server-only H3 sealing secret; required when auth is enabled and must contain at least 32 characters.                                  |
| `client.auth.previousSessionSecrets`  | `[]`                                | Server-only previous sealing secrets tried during key rotation, in order.                                                              |
| `client.auth.maskSecretsInPlayground` | `true`                              | Masks tokens in the local sealed-session playground inspection page.                                                                   |
| `client.auth.passwordResetUrl`        | —                                   | Required for password-request support; sent as Directus `reset_url`.                                                                   |
| `client.typegen.enabled`              | `true`                              | Enables generated `#directus` declarations.                                                                                            |
| `client.typegen.introspectionToken`   | —                                   | Server-only Directus schema introspection token.                                                                                       |
| `client.typegen.cache.maxAge`         | `3600000`                           | Development type-generation cache lifetime in milliseconds.                                                                            |
| `client.typegen.augmentations`        | all `true`                          | Optional generated-output transforms.                                                                                                  |
| `client.typegen.rules`                | `{}`                                | Generated field type overrides keyed by collection and field.                                                                          |
| `client.typegen.transform`            | —                                   | Final build-time source transform.                                                                                                     |

The module validates option values during Nuxt configuration. `instance.baseUrl` is optional, but
requests cannot run without it; the module skips setup during `nuxt prepare` and CI when it is
absent. Set `enabled: false` when Directus is not configured. Production type generation
additionally requires `client.typegen.introspectionToken`.

The asset proxy normalizes upstream `Vary` headers to `Accept`, matching the request representation
that the proxy exposes and the optional asset cache keys. It does not vary on `Origin`, request
`Cache-Control`, or `Accept-Encoding`.

Cache-disabled asset requests use a streaming proxy. Cached delivery is application-scoped and
anonymous-only; session-backed asset responses always receive `Cache-Control: private, no-store`.

Asset-cache pruning is disabled by default. Enable `client.assets.cache.prune.enabled` for backends
without reliable physical TTLs; request-triggered cleanup is backgrounded and throttled. For the
resolved configuration is `{ enabled: false, onRequest: true, interval: 3600 }`. For scheduled
cleanup, create `server/tasks/directus-assets/prune.ts` that re-exports
`@onderwijsin/nuxt-directus-client/runtime/prune-task`, then explicitly enable Nitro experimental
tasks and optionally configure `nitro.scheduledTasks`. Task registration and scheduling remain
consumer-owned; `prune.enabled` only enables the pruning logic.

When authentication is enabled without an explicit session secret, local development uses a fixed
convenience value, while `nuxt prepare` and CI generate a fresh ephemeral cryptographic value.
Production has no fallback; configure `client.auth.sessionSecret` from a server-only deployment
secret to keep sessions stable across builds and deployments.

## Public auto-imports

### `useDirectus`

```ts
useDirectus<Output>(command: RestCommand<Output, Schema>): Promise<Output>
```

Executes a typed Directus REST command. Browser calls use the same-origin proxy; SSR calls use the
direct server client. The module chooses session (only with `client.auth.enabled`), preview, proxy,
or no credential on the server. Without an event it still uses the configured proxy credential.
Callers cannot override that credential with request headers.

### `useDirectusServer`

```ts
useDirectusServer<Output>(
  command: RestCommand<Output, Schema>,
  event?: H3Event
): Promise<Output>
```

Executes a typed command directly from Nitro. Passing the current `H3Event` enables request-scoped
preview and, when enabled, session credential resolution. Without an event, the configured proxy
credential is used, which supports server tasks and utilities.

For reusable server-side module code, import it from the published runtime entrypoint:

```ts
import {
  useDirectusServer,
  useDirectusServerItemByPath
} from "@onderwijsin/nuxt-directus-client/runtime/server";
```

### `useDirectusServerAuth`

```ts
useDirectusServerAuth(event: H3Event): Promise<DirectusSessionSnapshot | null>
```

Resolves the current token-free Directus session snapshot through the request-scoped, refresh-aware
authentication boundary. It returns `null` for an unauthenticated, invalid, or disabled session.
Transient refresh failures propagate; this helper does not silently fall back to stale local state.
Access and refresh tokens are never returned.

```ts
export default defineEventHandler(async (event) => {
  const session = await useDirectusServerAuth(event);

  if (!session) {
    throw createError({ statusCode: 401 });
  }

  return { userId: session.userId };
});
```

### `useDirectusItemByPath`

```ts
useDirectusItemByPath(collection, query): Promise<Item | null>
```

Queries a collection and returns its first matching item or `null`. Normal path lookup uses
`readItems` with `limit: 1`. When the request contains a valid version-preview context, it uses the
preview URL's item ID with `readItem(id, { version })` instead.

Selected fields and expanded nested relations retain the same item inference as
`useDirectus(readItems(collection, query))`, with `null` added for a missing item. This also applies
to version previews and the server equivalent.

### `useDirectusServerItemByPath`

```ts
useDirectusServerItemByPath(event, collection, query): Promise<Item | null>
```

Server equivalent of `useDirectusItemByPath`. It reads preview context from the supplied request
event and uses the server Directus client.

### `useDirectusError`

```ts
useDirectusError(error: unknown): DirectusErrorResult
```

Normalizes Directus, SDK, `ofetch`, H3, and malformed errors. A normalized result has:

- `isDirectusError`;
- `isNitroError` for Nitro/H3 validation errors generated by the module;
- `errors`, containing safe `message`, `code`, and `extensions` values;
- optional `statusCode`;
- `isOtpError`;
- `isInvalidCredentialError`;
- `isForbiddenError`;
- `isTokenExpiredError`;
- `isInvalidTokenError`;
- `isValidationError`;
- `isRateLimitError`;
- `isServiceUnavailableError`; and
- `isRouteNotFoundError`.

Local authentication validation failures also expose `isInvalidAuthInput`, `isInvalidEmailInput`,
`isInvalidPasswordInput`, `isInvalidOtpInput`, `isInvalidPasswordResetTokenInput`, and
`isInvalidMagicLinkTokenInput`. Their `errors` entries use Nitro codes such as
`INVALID_PASSWORD_INPUT` and include safe field, message, and constraint details. Directus errors
retain their upstream codes; Nitro codes are not added to Directus error envelopes.

Unknown errors return both discriminator flags as `false` and an empty `errors` array.

### `useDirectusAuth`

The auto-import is registered only when `client.auth.enabled` is `true`.

```ts
const auth = useDirectusAuth();
```

#### State

| Member                   | Type                                                 | Contract                                            |
| ------------------------ | ---------------------------------------------------- | --------------------------------------------------- |
| `auth._session`          | `DeepReadonly<Ref<DirectusSessionSnapshot \| null>>` | Read-only token-free snapshot.                      |
| `auth.isAuthenticated`   | `DeepReadonly<ComputedRef<boolean>>`                 | `true` when a snapshot exists.                      |
| `auth.userId`            | `DeepReadonly<ComputedRef<string \| undefined>>`     | Current user ID.                                    |
| `auth.magicLinksEnabled` | `boolean`                                            | Whether the magic-link facade is enabled.           |
| `auth.requiresTfaSetup`  | `DeepReadonly<ComputedRef<boolean>>`                 | Server-derived informational TFA setup requirement. |

The snapshot contains `userId`, nullable `email`, `firstName`, and `lastName`, and the informational
`requiresTfaSetup` flag derived server-side from Directus' `enforce_tfa` claim. It does not contain
access tokens or refresh tokens. The current implementation intentionally keeps the public snapshot
identity-only; role, policy, and permission helpers are not part of this release. TFA setup UX and
navigation remain the consuming application's responsibility.

#### Methods

| Method             | Signature                                                       | Behavior                                                                                                                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `login`            | `login(input, meta?): Promise<void>`                            | Authenticates with Directus, fetches the selected current-user fields, writes the session cookie, updates Nuxt state, and emits `directus:auth:login`.                                                                                                       |
| `refresh`          | `refresh(): Promise<void>`                                      | Requests a refresh, rotates the cookie token pair, updates state, and emits `directus:auth:refresh`. Terminal session/auth rejection clears state and emits `directus:auth:invalidated`; transient refresh availability failures preserve state and rethrow. |
| `logout`           | `logout(): Promise<void>`                                       | Attempts upstream logout, always clears local state/cookie, and emits `directus:auth:logout`. An upstream failure is still rethrown after cleanup and emission.                                                                                              |
| `passwordRequest`  | `passwordRequest(email: string, meta?): Promise<void>`          | Requests a password-reset email using the configured `client.auth.passwordResetUrl`.                                                                                                                                                                         |
| `passwordReset`    | `passwordReset(token: string, password: string): Promise<void>` | Completes a Directus password reset.                                                                                                                                                                                                                         |
| `requestMagicLink` | `requestMagicLink(email: string, meta?): Promise<void>`         | Requests a passwordless login link when magic links are enabled.                                                                                                                                                                                             |
| `redeemMagicLink`  | `redeemMagicLink(token: string, otp?: string): Promise<void>`   | Redeems a token, establishes the normal session, and emits `directus:auth:login`.                                                                                                                                                                            |

Nitro refreshes an expiring access token when possible before the SSR server plugin reads the
token-free snapshot from the `httpOnly` cookie into Nuxt state. If refresh is temporarily
unavailable, SSR falls back to the trusted local snapshot; terminal refresh failures clear the
session and hydrate as unauthenticated. The session endpoint uses the same refresh-aware path, and
hydration does not require a separate session request. Authentication mutations use Nuxt's
request-aware fetch against the same-origin routes; they are not executed directly through a Nitro
utility. Reading authentication state remains SSR-safe, while login, refresh, logout, and magic-link
redemption may require explicit outer-response cookie propagation when invoked during SSR. The
authentication boundaries remain distinct: `getDirectusSessionSnapshot(event)` reads trusted local
session state without refreshing and is an internal server primitive; `useDirectusServerAuth(event)`
represents current server authentication state and is refresh-aware; and `directusAuth.resolve()`
resolves request-scoped usable credentials and authentication state. SSR normally uses refresh-aware
resolution, falling back to `getDirectusSessionSnapshot(event)` only for an explicitly classified
transient refresh failure. SSR POST mutations may also be subject to the same-origin and CSRF
requirements. Server-side refresh coordination resolves the root `directus-auth-refresh` mount:
`memory` is process-local, while `redis` uses the configured Redis client for atomic cross-process
leases and short-lived H3-sealed results. Configure Redis for multiple processes, containers,
replicas, or Cloudflare isolates; unsupported drivers fail explicitly. Refresh starts in the safety
window and may continue after access-token expiry; Directus remains the authority on refresh-token
validity. Refresh requests are attempted exactly once because Directus may rotate the refresh token
even when a response is lost. The existing safe user snapshot is reused after rotation; only
access-token-derived state such as `requiresTfaSetup` is recalculated. If a later local persistence
step fails, the old session is cleared because its refresh token may already be invalid. Terminal
Directus authentication rejections clear the local session; transport failures, HTTP 429, and HTTP
5xx responses preserve it and surface a temporary service error. The configured Redis backend
remains sensitive infrastructure. Completed coordination results are reusable for thirty seconds,
terminal results for five seconds, and transient failures for one second only. This bounded window
protects overlapping and near-concurrent refreshes; it is not permanent consumed-token tracking.

### Magic links

Install the `directus-magic-links-bundle` extension in Directus and configure a fixed callback URL:

```ts
client: {
  auth: {
    enabled: true,
    magicLinks: {
      enabled: true,
      redirectUrl: "https://app.example.test/auth/magic-link"
    }
  }
}
```

Use `auth.requestMagicLink(email, meta?)` and `auth.redeemMagicLink(token, otp?)`. The browser
cannot override the callback URL, and Directus access/refresh tokens remain server-side in the
sealed HTTP-only session. The consuming application implements the callback route, URL token
extraction and cleanup, OTP UI, TFA setup navigation, return-to state, and post-login navigation.
When disabled, these methods perform no network request. Local invalid token input is exposed as
`INVALID_MAGIC_LINK_TOKEN_INPUT` and `isInvalidMagicLinkTokenInput`.

When `client.auth.enabled` is `false`, the module does not read, refresh, forward, or serialize
Directus session cookies. Proxy, preview, and unauthenticated access continue to work.

### Turnstile protection

Set `client.auth.turnstile.enabled: true` to register `@onderwijsin/nuxt-turnstile` and protect
login, password-reset-email, and magic-link request operations. Configure site and secret keys
through the top-level `turnstile` option. Follow the
[Turnstile module documentation](https://github.com/onderwijsin/nuxt-modules/tree/main/modules/turnstile)
to configure keys, render widgets, and manage tokens. Render each widget with the public action key
at `useRuntimeConfig().public.directusClient.auth.turnstile.actions.login`, `.passwordRequest`, or
`.magicLinkRequest`, then pass the resulting token as `{ turnstileToken }` metadata to `auth.login`
or `auth.passwordRequest`. Cloudflare's test credentials return a verified test-key response without
an action, which the module recognizes only for those credentials. Tokens are single-use, so reset
the widget after each processed submission.

## Authentication hooks

Register typed Nuxt app hooks with `useNuxtApp().hook`:

```ts
const nuxtApp = useNuxtApp();

nuxtApp.hook("directus:auth:login", (session) => {
  console.log("Signed in as", session.userId);
});
```

| Hook                        | Payload                         | Emission contract                                                     |
| --------------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `directus:auth:login`       | Read-only `DirectusAuthSession` | After the login cookie and reactive state are written.                |
| `directus:auth:refresh`     | Read-only `DirectusAuthSession` | After the refreshed cookie and reactive state are written.            |
| `directus:auth:logout`      | Previous `userId` or `null`     | After local state and cookie clearing, even if upstream logout fails. |
| `directus:auth:invalidated` | Previous `userId` or `null`     | After a failed/expired refresh clears local state.                    |

Hook payloads never contain token material. Hook failures are logged and do not reject, roll back,
or otherwise undo the completed authentication transition.

## Version previews

Directus Content Versions are unpublished changes to a main item. When a preview URL contains
`preview=true`, an item `id`, and a version key, `useDirectusItemByPath` and
`useDirectusServerItemByPath` read that item with `readItem(id, { version })`. Without a valid
version context they retain their normal query-and-first-item behavior.

Set up Directus for version previews:

1. In **Settings → Data Model**, enable **Content Versioning** for each collection and create
   versions in the item editor.
2. Set the collection's Preview URL to the corresponding application route. Use Directus' dynamic
   value picker to include item **ID** and **Version**, for example:
   `https://app.example.test/pages/{{slug}}?preview=true&id={{id}}&version={{version}}`.
3. For unpublished content, give the preview request a short-lived credential. The recommended
   [Tokenized Preview Endpoint](https://github.com/formfcw/directus-extension-tokenized-preview)
   adds one: install it in Directus, configure its preview base URL, and prefix the collection URL
   with `/preview/`. It appends `token`; if configured with another token key, set
   `client.preview.queryKeys.token` to match.

Preview handling is disabled by default; set `client.preview.enabled: true` to opt in. Preview
tokens are request-scoped and never enter public runtime config. The default query keys are
`preview`, `token`, `version`, and `id`; rename them with `client.preview.queryKeys`. Set
`client.preview.enabled: false` to ignore all preview parameters, or
`client.preview.versioning: false` to ignore only the version. Version previews do not configure
Directus' embedded editor; see the Directus
[Live Preview guide](https://docs.directus.io/guides/headless-cms/live-preview/nuxt-3) for framing
and refresh behavior.

Opening the app in preview registers a `page:finish` hook to refresh Nuxt async data, including
prerendered pages. Preview mode and its initial credential persist across client navigation for that
application instance; ordinary page loads register no refresh hook. Wrap refreshable content in
`useAsyncData` or `useFetch`. The item helper owns item/version selection; plain `useDirectus` calls
share the preview credential. Reload without preview parameters to exit preview.

The browser keeps the initial preview token in memory and sends it in a dedicated header only to the
same-origin proxy. The proxy strips the header and selects credentials using
`session > preview > proxy > none`. The module never copies preview tokens into Nuxt state, public
runtime config, cookies, or web storage. Session access and refresh tokens remain server-only.
Directus enforces token expiry. Prerendered pages require the Nitro proxy at runtime, so purely
static hosting without that endpoint is insufficient.

After capturing the token, the browser replaces the current URL after mounting, removing only the
configured token parameter while preserving other query parameters and the hash. Client navigation
continues using the in-memory credential. Reloading the cleaned URL loses that credential; reopen
the original Directus preview link to restore it. The initial HTTP request and scripts running
before cleanup can still see the token. Avoid full-URL analytics and redact tokens in hosting/proxy
logs.

## Auto-imported SDK commands

The default auto-imports are `readItem` and `readItems`. The supported command names for
`directusClient.client.commands` are:

`aggregate`, `createComment`, `updateComment`, `deleteComment`, `createField`, `createItem`,
`createItems`, `deleteField`, `deleteFile`, `deleteFiles`, `readActivities`, `readActivity`,
`deleteItem`, `deleteItems`, `deleteUser`, `deleteUsers`, `importFile`, `readCollection`,
`readCollections`, `createCollection`, `updateCollection`, `deleteCollection`,
`readContentVersions`, `readContentVersion`, `readField`, `readFieldsByCollection`, `readFields`,
`readFile`, `readFiles`, `readItem`, `readItems`, `readSingleton`, `readMe`, `readPolicies`,
`readPolicy`, `createUser`, `createUsers`, `readUser`, `readUsers`, `updateField`, `updateFile`,
`updateFiles`, `updateFolder`, `updateFolders`, `updateItem`, `updateItems`, `updateSingleton`,
`updateMe`, `updateUser`, `updateUsers`, `uploadFiles`, `withSearch`, and `withOptions`.

Commands not configured for auto-import can be imported directly from `@directus/sdk`.

Authentication mutations use the same-origin authentication routes below. SSR only consumes the
session state prepared by Nitro; the Nuxt application runtime does not execute auth mutations.

## Authentication routes

When `client.auth.enabled` is `true`, the module registers:

| Method | Route                              | Contract                                                                                             |
| ------ | ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `POST` | `/_directus/auth/login`            | Validates email (max 1024), password (max 512), optional OTP (max 6), and returns the safe snapshot. |
| `POST` | `/_directus/auth/refresh`          | Refreshes the cookie session and returns the safe snapshot.                                          |
| `POST` | `/_directus/auth/logout`           | Attempts upstream logout, clears local state, and returns `204`.                                     |
| `GET`  | `/_directus/auth/session`          | Refreshes when needed, then returns the persisted safe snapshot or `null`.                           |
| `POST` | `/_directus/auth/password-request` | Validates email (max 1024), then proxies it with the configured reset URL.                           |
| `POST` | `/_directus/auth/password-reset`   | Validates the reset token (max 1024) and new password (max 512), then proxies them.                  |

When `client.auth.magicLinks.enabled` is true, the module also registers
`POST /_directus/auth/magic-links/request` and `POST /_directus/auth/magic-links/redeem`. The
request route uses the configured server-side callback URL and ignores browser-supplied redirects;
redemption always uses Directus `mode: "json"` and creates the normal sealed session. The client
facade methods for these routes are introduced in PR 3.

All authentication mutations require an `Origin` or `Referer` matching the application origin.
Missing or cross-origin metadata is rejected with `403`, including when the session cookie uses
`sameSite: "none"`.

The sealed-session inspection endpoint is available only in the local development playground and
returns `404` in production builds. Do not deploy the playground as an application environment.

Directus MFA failures are recognized by `useDirectusError(error).isOtpError`.

## Generated schema types

Generated declarations are available through the virtual `#directus` module:

```ts
import type { Article } from "#directus";
```

The module uses [directus-sdk-typegen](https://github.com/bryantgillespie/directus-sdk-typegen) to
generate collection interfaces and `Schema`. Configure it under `directusClient.client.typegen`:

| Option               | Contract                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `enabled`            | Set `false` to skip generation; an existing declaration is reused when available, otherwise `Schema` is empty.                       |
| `introspectionToken` | Server-only schema-introspection token. Required for enabled generation outside local development.                                   |
| `cache.maxAge`       | Development-only cache lifetime in milliseconds. CI and production always regenerate.                                                |
| `augmentations`      | Individually disable output transforms; every flag defaults to `true`.                                                               |
| `rules`              | Replace a generated field type by collection and field, for example `{ articles: { body: "RichText" } }`.                            |
| `transform`          | Final build-time source transform; receives source plus URL, generator version, collections, and rules, and must return source text. |

| Augmentation                       | Effect                                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------ |
| `removeEnums`                      | Removes generated `export enum` declarations.                                  |
| `replaceAnyWithUnknown`            | Rewrites generated `Record<…, any>` values to `Record<…, unknown>`.            |
| `replaceJsonWithJSON`              | Rewrites quoted `"json"` field types to `JSON`.                                |
| `makeNonNullableOptionalsRequired` | Makes simple optional fields required when their type does not include `null`. |
| `mergeJsDocs`                      | Merges adjacent generated JSDoc tag blocks and removes duplicate tags.         |

They run in the shown order before `rules`, then `transform`. Incomplete credentials reuse the prior
declaration or an empty `Schema` only during local development. CI and production fail when enabled
generation lacks credentials.

## Proxy and security contract

The browser endpoint at `proxy.path` (default `/_directus/proxy`) forwards Directus REST calls. It
preserves method, body, query, response status, and safe response headers, while browser code never
receives the Directus URL or a server credential.

- The proxy forwards only REST headers needed for representation, caching, conditional requests,
  range, and preference semantics. Incoming `Authorization`, `Cookie`, `Host`, `Origin`, `Referer`,
  connection, hop-by-hop, forwarding, client-IP, and platform identity headers are not forwarded.
- Credential precedence is current session (when `client.auth.enabled`), preview token, static
  token, then unauthenticated.
- Upstream `Set-Cookie` headers are not forwarded to the browser.
- Upstream `Access-Control-*` headers are removed so the Nuxt application owns the browser-facing
  CORS and security boundary. Directus non-2xx statuses and response bodies are preserved; network
  failures remain proxy errors.
- Credentialed `POST`, `PUT`, `PATCH`, and `DELETE` proxy requests require an `Origin` or `Referer`
  matching the application origin. Missing and cross-origin metadata is rejected with `403`,
  including for `sameSite: "none"` cookies.
- Authentication `POST` routes apply the same origin validation before reading input or changing a
  session.
- Session cookies are `httpOnly`, `SameSite=Lax`, secure by default, bounded below the usual cookie
  size limit, and intentionally contain the server token pair plus a compact safe snapshot.
- Directus remains the final authorization boundary.
- Sessions use a bounded H3-sealed cookie. Configure a cryptographically random server-only
  `client.auth.sessionSecret` of at least 32 characters. Existing unsigned cookies are rejected; use
  `previousSessionSecrets` for staged key rotation. The module disables H3's derived session header
  and accepts authentication only from the configured cookie.

Rotate the session secret in two stages: deploy the new value as `sessionSecret` while retaining the
old value in `previousSessionSecrets` on every instance, then remove the old value after at least
the configured cookie `maxAge` plus a short rolling-deployment window. Reads using the old value are
resealed with the active secret. Removing a previous value invalidates sessions still using it; the
shared Nitro storage mount may briefly contain sealed refresh results from the old deployment and
must remain protected during that overlap.

Generate a session secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

The proxy is not a general-purpose proxy, CORS bypass, session-token API, or authorization layer. It
can only target the configured Directus URL; authorization still happens in Directus.

## Compatibility

Supported environments are Nuxt 4 and Node.js 24 or newer. Node.js 22 may work but is untested and
unsupported.

The current-user route supports executable shared configuration in development and production.
