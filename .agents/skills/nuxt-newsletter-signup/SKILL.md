---
name: nuxt-newsletter-signup
description:
  Use when integrating @onderwijsin/nuxt-newsletter-signup, configuring Loops or Mailchimp
  newsletter signup, or handling its normalized client errors.
---

# Nuxt newsletter signup

Use `@onderwijsin/nuxt-newsletter-signup` for a provider-independent newsletter signup endpoint. It
supports Loops and Mailchimp through server-side HTTP requests and does not expose provider SDKs or
API keys to the browser.

## Installation

```sh
pnpm add @onderwijsin/nuxt-newsletter-signup @nuxt/ui
```

The application supplies `@nuxt/ui` as a peer dependency so module runtime code shares the
application's instances. Nuxt module registration remains automatic.

## Configuration

The module composes its runtime-config namespaces with existing application and layer values,
preserving unrelated keys and keeping provider secrets server-only.

For a locally registered handler, the consumer must provide `provider`, `apiKey`, and either
`lists.default` or `lists.options`. The API key is used only by the server runtime and is never
exposed to the client. Remote-endpoint mode does not need provider credentials in this application.

Loops with one mailing list:

```ts
export default defineNuxtConfig({
  modules: ["@onderwijsin/nuxt-newsletter-signup"],
  newsletterSignup: {
    provider: "loops",
    apiKey: "your-loops-api-key",
    lists: { default: "loops-mailing-list-id" },
    fields: {
      firstName: { required: true },
      lastName: { required: false },
      organization: { required: false }
    }
  }
});
```

Mailchimp with audience-specific servers:

```ts
export default defineNuxtConfig({
  modules: ["@onderwijsin/nuxt-newsletter-signup"],
  newsletterSignup: {
    provider: "mailchimp",
    apiKey: "your-mailchimp-api-key",
    lists: {
      options: [
        { label: "Product updates", id: "audience-a", server: "us4" },
        { label: "Events", id: "audience-b", server: "us5" }
      ]
    },
    fields: {
      firstName: { required: true, target: "FNAME" },
      lastName: { target: "LNAME" },
      organization: { target: "ORG" }
    }
  }
});
```

When Mailchimp is used, each audience option should contain its own `server` value. It must be a
Mailchimp server prefix matching `us` followed by one or more digits, such as `us4` or `us21`.
Hostnames, URLs, paths, whitespace, and other formats are rejected during module setup. The selected
option’s server is used for the request. A top-level `server` can be used as a fallback when one
server applies to a single audience or to all configured audiences.

For Cloudflare Workers, enable the `nodejs_compat` compatibility flag in the Wrangler configuration.
Nuxt applications running on Workers already require this flag. Cloudflare also enables
`nodejs_compat_v2` when the compatibility date is `2024-09-23` or later.

## Local or remote endpoint

The default configuration registers the local `POST /api/newsletter/signup` handler:

```ts
newsletterSignup: {
  provider: "loops",
  apiKey: "your-loops-api-key",
  endpoint: {
    enabled: true,
    url: "/api/newsletter/signup"
  },
  lists: { default: "loops-mailing-list-id" }
}
```

To use a handler registered by another Nuxt application, disable local registration and configure
the remote URL:

```ts
newsletterSignup: {
  endpoint: {
    enabled: false,
    url: "https://newsletter-api.example.com/api/newsletter/signup"
  }
}
```

This still provides `useNewsletterSignup()`; it only prevents this module from registering its local
server route. The remote URL must accept the same request payload and return the same normalized
error contract.

The local endpoint uses `@onderwijsin/nuxt-simple-rate-limiter` to limit each IP to five requests
per minute and ban it for 15 minutes after exhaustion. Rate-limit failures remain normalized as
`rateLimited` errors and include `bannedUntil`. Without persistent Nitro storage, counters and bans
reset on application restart. Configure persistent storage for a single instance:

```ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      "simple-rate-limiter:%2Fapi%2Fnewsletter%2Fsignup": {
        driver: "fs",
        base: "./newsletter-signup"
      }
    }
  }
});
```

The storage key must match the limiter namespace for `/api/newsletter/signup`. Configure
`simple-rate-limiter:global` separately if global rate limiting is enabled. Use a shared driver such
as Redis for multi-instance production deployments. Duplicate subscriptions are intentionally
idempotent and provider requests time out after five seconds. Mailchimp uses its add-or-update
member endpoint and applies immediate `subscribed` status, including when an existing member was
previously unsubscribed.

For multiple selectable lists or audiences:

```ts
lists: {
  options: [
    { label: "Product updates", id: "product-updates" },
    { label: "Events", id: "events" }
  ];
}
```

When only `lists.default` is configured, the endpoint always uses that server-owned list and rejects
any client-supplied `listId`.

For Mailchimp, include the server with each audience option:

```ts
lists: {
  options: [
    { label: "Product updates", id: "audience-a", server: "us4" },
    { label: "Events", id: "audience-b", server: "us5" }
  ];
}
```

The submitted `listId` is validated against these options. Configure `lists.default` as well when
the form should have a fallback selection.

List labels and IDs are exposed through `useRuntimeConfig().public.newsletterSignup.lists` for
client-side selectors. Provider credentials and Mailchimp server values are not exposed.

## Supported payload

These standard fields are supported, along with arbitrary properties configured with a `target`
under `newsletterSignup.fields`. Custom values may be strings, numbers, booleans, string arrays,
`null`, or `undefined`:

```ts
{
  email: string;
  firstName?: string;
  lastName?: string;
  organization?: string;
  userId?: string;
  userGroup?: string;
  source?: string;
  listId?: string;
  [property: string]: string | number | boolean | string[] | null | undefined;
}
```

`userId` and `userGroup` are forwarded to Loops using their native field names. For Mailchimp, map
them to custom merge fields with `fields.userId.target` and `fields.userGroup.target`. Any field can
be made server-side required with `fields.<name>.required: true`. Loops requires
`fields.organization.target` for `organization`; it has no Loops default. Custom properties also
require a target and are sent to Loops using that target or to Mailchimp as merge fields:

```ts
fields: {
  organization: { target: "company" },
  favoriteColor: { target: "FAVORITE_COLOR" }
}
```

An arbitrary property without a configured target is rejected. `source` defaults to `"api"`. Loops
stores it as the contact source; Mailchimp stores it as a member tag. Additional fields must be
string, number, boolean, string-array, `null`, or `undefined` values. The reserved properties
`listId` and `subscribed` cannot be used as contact properties.

## Client usage

`useNewsletterSignup()` is auto-imported. Its `signup` function wraps the generated
`POST /api/newsletter/signup` endpoint:

```vue
<script setup lang="ts">
const { signup, handleSignupError } = useNewsletterSignup();

async function submit() {
  try {
    await signup({
      email: "person@example.com",
      firstName: "Ada",
      source: "homepage"
    });

    // Custom success behavior.
  } catch (error) {
    handleSignupError(error);
  }
}
</script>
```

For a selectable list, include the validated option ID:

```ts
await signup({
  email: "person@example.com",
  listId: "events"
});
```

`handleSignupError` uses Nuxt UI toasts with Dutch messages. Use the returned helpers for custom UI:

```ts
const { signup, getErrorCode, handleSignupError, ERROR_CODES } = useNewsletterSignup();

try {
  await signup(payload);
} catch (error) {
  if (getErrorCode(error) === ERROR_CODES.invalidInput) {
    showInvalidInputMessage();
  } else {
    handleSignupError(error);
  }
}
```

The normalized statuses are `400` for invalid input, `429` only for rate limiting
(`NEWSLETTER_SIGNUP_RATE_LIMITED`, including `bannedUntil`), `500` for incomplete module
configuration, and `5xx` for provider/server failures. Duplicate subscriptions are handled
idempotently by the provider adapters and are not exposed as a separate frontend error state.
