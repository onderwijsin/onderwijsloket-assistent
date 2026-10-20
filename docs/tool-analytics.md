# Server-side tool analytics

The Nitro plugin registers MCP lifecycle hooks and keeps one analytics context per
request. `server/utils/tool-analytics.ts` handles request parsing, collection validation,
optional query data and attribution headers; `server/utils/plausible.ts` handles delivery.
The plugin observes MCP Toolkit's `mcp:tool:called` hook. Each completed execution
(including cache hits and thrown errors normalized by the toolkit) schedules one
`MCP Tool Call` event. Initialization, tool discovery, resource reads and requests
rejected before execution do not count. Tool schemas, responses and routes are unchanged.

No dependency or API key is required. The integration uses ofetch to post JSON to the
[Plausible Events API](https://plausible.io/docs/events-api), independently of browser tracking.

## Configuration

`PLAUSIBLE_DOMAIN` supplies the site identifier. Missing domains disable delivery.
The default enables events only in production when `DISABLE_TRACKING` is not true.
Server-only runtime config overrides are available at deployment:

| Environment variable               | Purpose                                                                           |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `NUXT_TOOL_ANALYTICS_ENABLED`      | Set `false` to disable, or `true` to explicitly enable outside production.        |
| `NUXT_TOOL_ANALYTICS_DOMAIN`       | Override the configured Plausible site.                                           |
| `NUXT_TOOL_ANALYTICS_ENDPOINT`     | Override `https://plausible.io/api/event`, for example for self-hosted Plausible. |
| `NUXT_TOOL_ANALYTICS_INCLUDE_DATA` | Defaults to `false`; set `true` to include search query context.                  |

In the site's Plausible settings, add a custom event goal named exactly `MCP Tool Call`.
Enable the custom properties below in Plausible to inspect their breakdowns.

## Properties

| Property     | Meaning                                                                                                                                                                                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tool`       | Executed tool name.                                                                                                                                                                                                                                                         |
| `collection` | Static collection from the registered tool metadata, or a request collection validated against its collection schema; otherwise `unknown`.                                                                                                                                  |
| `status`     | `error` when the MCP result has `isError`, otherwise `success`, independently of HTTP status.                                                                                                                                                                               |
| `client`     | SDK initialization client name when available; otherwise `unknown`. Client names are self-reported, not authenticated identities.                                                                                                                                           |
| `data`       | Optional tool-specific context. Currently only the query of `search_articles`, `search_faqs`, `search_sectors`, `search_testimonials`, `search_programs`, `search_educational_institutions`, `search_regional_education_desks` and `get_facets`, limited to 500 characters. |

`data` is an explicit allowlist, not an arbitrary argument dump. Query capture is
opt-in because queries can contain personal information and create high-cardinality
reports. Enabling it sends query text to Plausible. Other arguments, record contents,
outputs and prompts are never included. Extend the allowlist deliberately for future tools.
Dedicated collection tools declare `_meta["onderwijsloket.com/collection"]`; shared tools resolve collection arguments from registered schemas. Client-supplied metadata is never used for attribution. New collections need no analytics delivery calls.
Input is captured before the SDK consumes the request stream. Web request bodies are
cloned; Node bodies are cached by h3 and replayed to the SDK. The completion hook
never reads the stream. If there is no matching single `tools/call` body, collection is
`unknown` and data is omitted rather than guessing attribution.

## Delivery and attribution

Delivery uses `event.waitUntil` for Node and Cloudflare request lifecycle support,
a shared ofetch client with a one-second timeout and no retries. Response interceptors
report dropped events and HTTP failures; a request error interceptor reports network failures. Failures produce a generic warning
without logging event data and cannot fail the tool response. Delivery is best effort;
process termination and network failures can lose events.

The outgoing URL is a stable `https://<domain>/mcp`, without request query parameters.
The incoming User-Agent and Cloudflare client IP (or direct peer IP) are forwarded as
HTTP headers, never custom properties. Only trust `CF-Connecting-IP` behind an ingress
that sets or overwrites it. Arbitrary `X-Forwarded-For` chains are not trusted. Other
reverse proxies may require deployment-specific IP handling. No visitor IDs are invented.
Plausible may discard bot clients, missing attribution or hosting IPs even with HTTP 202;
`x-plausible-dropped: 1` produces a warning. SDK clients often identify as bots, so
Plausible totals can undercount actual executions. Use event totals, not unique visitors,
for usage reporting; this integration does not guarantee exhaustive operational counts.
