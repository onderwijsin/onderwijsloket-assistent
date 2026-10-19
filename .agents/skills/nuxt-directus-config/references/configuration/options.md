# Directus configuration reference

Use this reference for configuration changes involving `@onderwijsin/nuxt-directus-client`,
`@onderwijsin/nuxt-directus-config`, `@onderwijsin/nuxt-directus-sitemaps`, or
`@onderwijsin/nuxt-directus-prerenderer`. The source of truth is the published schema entrypoint at
`@onderwijsin/nuxt-directus-config/schema`.

## Contents

- [`directus` options](#directus-options)
- [Shared `collections` options](#shared-collections-options)
- [Shared `sitemaps` options](#shared-sitemaps-options)
- [Shared `prerenderer` options](#shared-prerenderer-options)
- [Sitemap entry schema](#sitemap-entry-schema)
  - [`SitemapUrl`](#sitemapurl)
  - [Nested entry schemas](#nested-entry-schemas)

## `directus` options

| Option                              | Default                             | Contract                                                                                         |
| ----------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `enabled`                           | `true`                              | Enables the Directus module.                                                                     |
| `instance.baseUrl`                  | —                                   | Optional Directus URL; requests require it.                                                      |
| `instance.proxyToken`               | —                                   | Server-held credential delegated through the proxy; permissions must be safe for public callers. |
| `client.proxy.path`                 | `/_directus/proxy`                  | Absolute same-origin browser proxy path; root paths and auth-route collisions are rejected.      |
| `client.assets.enabled`             | `true`                              | Registers the dedicated Directus `/assets` proxy when enabled.                                   |
| `client.assets.url`                 | —                                   | Optional absolute upstream asset base URL; defaults to `instance.baseUrl` with `/assets`.        |
| `client.assets.path`                | `/_directus/assets`                 | Absolute local asset-proxy path using the shared safe local-path validation.                     |
| `client.assets.publicOnly`          | `false`                             | Uses anonymous asset requests only and never attempts session authentication when enabled.       |
| `client.assets.cache.enabled`       | `false`                             | Enables server-side caching of explicitly public anonymous assets.                               |
| `client.assets.cache.storage`       | —                                   | Application-provided Nitro raw-byte storage mount; required when enabled.                        |
| `client.assets.cache.maxAge`        | —                                   | Positive cache lifetime in seconds; required when enabled.                                       |
| `client.assets.cache.maxBodySize`   | `10485760`                          | Maximum response size in bytes that may be buffered for caching.                                 |
| `client.assets.cache.swr`           | `false`                             | Enables stale-while-revalidate behavior.                                                         |
| `client.assets.cache.staleMaxAge`   | —                                   | Optional non-negative stale lifetime in seconds.                                                 |
| `client.commands`                   | `readItem`, `readItems`             | SDK command names to auto-import.                                                                |
| `client.preview.enabled`            | `false`                             | Enables preview query parsing and request-scoped preview credentials; set to `true` to opt in.   |
| `client.preview.versioning`         | `true`                              | Enables versioned preview lookup.                                                                |
| `client.preview.queryKeys`          | `preview`, `token`, `version`, `id` | Query parameter names for preview context.                                                       |
| `client.auth.enabled`               | `false`                             | Enables cookie authentication, routes, and `useDirectusAuth`.                                    |
| `client.auth.turnstile.enabled`     | `false`                             | Enables Turnstile protection for login and password-reset-email requests.                        |
| `client.auth.cookie.name`           | `directus_session`                  | Session cookie name.                                                                             |
| `client.auth.cookie.secure`         | `true`                              | Sends the cookie only over HTTPS.                                                                |
| `client.auth.cookie.sameSite`       | `lax`                               | Cookie `SameSite` policy.                                                                        |
| `client.auth.cookie.path`           | `/`                                 | Cookie path.                                                                                     |
| `client.auth.cookie.maxAge`         | `2592000`                           | Cookie lifetime in seconds.                                                                      |
| `client.auth.cookie.domain`         | —                                   | Optional cookie domain.                                                                          |
| `client.auth.refreshSafetyWindow`   | `30000`                             | Refresh window in milliseconds before expiry.                                                    |
| `client.auth.passwordResetUrl`      | —                                   | URL sent to Directus as `reset_url`.                                                             |
| `client.auth.user.enabled`          | `false`                             | Enables the opt-in current-user fetch; requires `client.auth.enabled`.                           |
| `client.auth.user.fields`           | —                                   | Required non-empty recursive QueryFields selection when enabled.                                 |
| `client.auth.user.mapper`           | —                                   | Synchronous server-only mapper accepted only from executable shared config.                      |
| `client.typegen.enabled`            | `true`                              | Enables generated `#directus` declarations.                                                      |
| `client.typegen.introspectionToken` | —                                   | Server-only schema-introspection token.                                                          |
| `client.typegen.cache.maxAge`       | `3600000`                           | Development type-generation cache lifetime in milliseconds.                                      |
| `client.typegen.augmentations`      | all `true`                          | Generated-output transforms.                                                                     |
| `client.typegen.rules`              | `{}`                                | Generated field type overrides keyed by collection and field.                                    |
| `client.typegen.transform`          | —                                   | Final build-time source transform.                                                               |

## Shared `collections` options

`collections` is an array. Each item requires `collection`, `sitemap`, and `prerender`. Collection
configuration is executable and server-only.

| Option               | Required/default | Contract                                                                                  |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| `collection`         | Required         | Directus collection name.                                                                 |
| `sitemap`            | Required         | `false` excludes the collection; an object enables sitemap generation.                    |
| `sitemap._sitemap`   | Optional         | Named `@nuxtjs/sitemap` destination.                                                      |
| `sitemap.fields`     | Optional         | Directus fields; the default fetcher uses `['*']` when absent.                            |
| `sitemap.filter`     | Optional         | Directus filter; the default fetcher uses `{}` when absent.                               |
| `sitemap.fieldmap`   | Optional         | Declarative map from sitemap properties to Directus record properties; `loc` is required. |
| `sitemap.fetcher`    | Optional         | Async replacement fetcher receiving `{ collection, fields, filter }`.                     |
| `sitemap.mapper`     | Optional         | Executable mapper for one fetched item, or `null`/`undefined` to omit it.                 |
| `prerender`          | Required         | `false` or prerender configuration for `@onderwijsin/nuxt-directus-prerenderer`.          |
| `prerender.fields`   | Optional         | Directus fields passed to the default build-time fetcher.                                 |
| `prerender.filter`   | Optional         | Directus filter passed to the default build-time fetcher.                                 |
| `prerender.fieldmap` | Optional         | `{ route: string }` mapping a fetched field to a complete route path.                     |
| `prerender.fetcher`  | Optional         | Async replacement fetcher receiving `{ collection, fields, filter }`.                     |
| `prerender.mapper`   | Optional         | Executable mapper returning one route, multiple routes, or `null`/`undefined`.            |

## Shared `sitemaps` options

| Option               | Default                                      | Contract                                   |
| -------------------- | -------------------------------------------- | ------------------------------------------ |
| `static`             | `[]`                                         | Static sitemap entries.                    |
| `apiEndpoint`        | `/api/_directus-sitemaps/urls`               | Dynamic sitemap source endpoint.           |
| `sitemapsPathPrefix` | `/__sitemap__/`                              | Path prefix for named sitemap XML routes.  |
| `enablePrettyUrls`   | `true`                                       | Enables pretty sitemap URL routes.         |
| `cache`              | `{ maxAge: 300, staleMaxAge: 0, swr: true }` | Nitro cache policy in seconds, or `false`. |
| `prerenderSitemaps`  | `false`                                      | Prerenders sitemap source and XML routes.  |

The `@onderwijsin/nuxt-directus-sitemaps` module accepts these options directly under
`directusSitemaps`; direct options override shared values.

## Shared `prerenderer` options

| Option                     | Default         | Contract                                                        |
| -------------------------- | --------------- | --------------------------------------------------------------- |
| `includeStaticSitemapUrls` | `false`         | Adds static sitemap URLs to the build-time prerender route set. |
| `queryLimit`               | `100`           | Maximum records requested per built-in Directus page.           |
| `failureMode`              | `"best-effort"` | Omits failed collections or aborts with `"hard-failure"`.       |

The `@onderwijsin/nuxt-directus-prerenderer` module accepts these options directly under
`directusPrerenderer`; direct options override shared values. Its `instance` option falls back to
the top-level shared `instance` credentials.

## Sitemap entry schema

The schema is implemented in
[`modules/directus-config/src/schema/sitemap-entry.ts`](../../../../../modules/directus-config/src/schema/sitemap-entry.ts).
Use the exported `SitemapUrl`, `sitemapUrlSchema`, `priorities`, and `changeFrequencies` from
`@onderwijsin/nuxt-directus-config/schema` rather than recreating the shape.

### `SitemapUrl`

| Property         | Schema                                                              | Contract                            |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `loc`            | `string`                                                            | Required location value.            |
| `lastmod`        | `Date` or ISO datetime string                                       | Optional last-modified value.       |
| `changefreq`     | `always`, `hourly`, `daily`, `weekly`, `monthly`, `yearly`, `never` | Optional change frequency.          |
| `priority`       | `0`, `0.1`, …, `1`                                                  | Optional sitemap priority.          |
| `images`         | array of image entries                                              | Optional image sitemap metadata.    |
| `videos`         | array of video entries                                              | Optional video sitemap metadata.    |
| `news`           | Google News entry                                                   | Optional Google News metadata.      |
| `_sitemap`       | `string`                                                            | Optional named sitemap metadata.    |
| `_encoded`       | `boolean`                                                           | Optional sitemap encoding metadata. |
| `_i18nTransform` | `boolean`                                                           | Optional i18n transform metadata.   |
| `alternatives`   | array of `{ hreflang, href }`                                       | Optional alternate-language links.  |

### Nested entry schemas

URL-like nested fields accept a `URL` instance or a path beginning with `/`.

| Nested schema      | Property                                           | Schema                                  | Required |
| ------------------ | -------------------------------------------------- | --------------------------------------- | -------- |
| `images[]`         | `loc`                                              | URL or path                             | Yes      |
| `images[]`         | `caption`, `geo_location`, `title`                 | `string`                                | No       |
| `images[]`         | `license`                                          | URL or path                             | No       |
| `alternatives[]`   | `hreflang`                                         | `string`                                | Yes      |
| `alternatives[]`   | `href`                                             | URL or path                             | Yes      |
| `news`             | `title`                                            | `string`                                | Yes      |
| `news`             | `publication_date`                                 | `Date` or ISO datetime string           | Yes      |
| `news.publication` | `name`, `language`                                 | `string`                                | Yes      |
| `videos[]`         | `title`, `thumbnail_loc`, `description`            | `string`, URL or path, `string`         | Yes      |
| `videos[]`         | `content_loc`, `player_loc`, `gallery_loc`         | URL or path                             | No       |
| `videos[]`         | `duration`, `rating`, `view_count`                 | non-negative number                     | No       |
| `videos[]`         | `expiration_date`, `publication_date`              | `Date` or ISO datetime string           | No       |
| `videos[]`         | `family_friendly`, `requires_subscription`, `live` | `true`, `false`, `yes`, or `no`         | No       |
| `videos[]`         | `restriction`                                      | `{ relationship, restriction }`         | No       |
| `videos[]`         | `platform`                                         | `{ relationship, platform }`            | No       |
| `videos[]`         | `price`                                            | array of `{ price?, currency?, type? }` | No       |
| `videos[]`         | `uploader`                                         | `{ uploader, info? }`                   | No       |
| `videos[]`         | `tag`                                              | `string` or `string[]`                  | No       |
| `videos[]`         | `category`                                         | `string`                                | No       |

For `videos[].restriction` and `videos[].platform`, `relationship` is `allow` or `deny` and the
other property is a string. `videos[].price[].type` is `rent`, `purchase`, `package`, or
`subscription`; `videos[].uploader.info` is a URL or path.

Collection mapper results may additionally include `noIndex: true`; the sitemap runtime removes that
marker and omits the entry when it is true.
