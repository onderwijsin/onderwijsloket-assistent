# Scheduling

The MCP server can arrange a free, roughly 20-minute, one-to-one telephone consultation with an Onderwijsloket adviser. Scheduling is offered only when explicitly requested or when a complex question remains unresolved after consulting available knowledge. There is no scheduling UI.

## Tools

| Tool                   | Purpose                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `get_scheduling_link`  | Fetch current Dutch or English link metadata, durations and booking fields. Report missing choice configuration without guessing. |
| `get_scheduling_slots` | Fetch a single bounded availability window for the selected language.                                                             |
| `book_appointment`     | Validate confirmed contact details, fresh form requirements and availability, then create one event.                              |

The language argument is `nl` or `en`. Choose the user's preferred consultation language; clarify when neither is an obvious match. The only permitted links are `link_01JJVPB262C3M3RGHWZGYJNSQV` (Dutch, `plan-een-adviesgesprek`) and `link_01JJVGB7J31E1BR072F8ADKYQ8` (English, `fce6f26c`).

`get_scheduling_slots` starts with `window: 0`, covering now through the next three days. After an empty result, follow `next_window` for days 4–7, then days 8–15, then weekly windows. Boundaries are contiguous elapsed-time intervals anchored to the call time. Stop expanding when slots exist. Explicit `from` and/or `until` override the default window: an omitted `from` means now; an omitted `until` means three days after `from`. Explicit windows must be in the future, ordered and no longer than 31 days; they are never automatically expanded. Slot timestamps retain their offsets and preference rank. Expanding windows is guided by the tool contract; the stateless server does not retain search history.

After selecting a slot, collect name, email, international phone number and every current required form answer. Infer the IANA time zone from reliable conversation or host context, defaulting to `Europe/Amsterdam`; do not ask the user for it or infer it from chat language alone. Label times clearly and accept corrections. Answers are `{ field_id, values: string[] }`; text and single-select fields take one value. Ask the user to explicitly confirm the slot and completed form before calling `book_appointment` with `confirmed: true`. This is a caller attestation to user confirmation, not independent proof of consent. The adviser calls the supplied number. Optional answers may be omitted, and known background should be reused only after confirmation.

The server refreshes the link before each operation and rechecks the exact slot immediately before creation. It rejects unknown, duplicate or hidden answer IDs and missing required fields. The hidden attribution field is populated from the SDK connection client name, falling back to `Unknown MCP Client`. Client names are self-reported labels, not authenticated identities.

## Form choices and provider validation

SavvyCal's documented [link response](https://developers.savvycal.com/api/get-scheduling-link) does not include select/checkbox options. The project owner supplies these lists in `server/utils/scheduling/config.ts`, keyed by language and field ID, with matching field label and type. The supplied Dutch and English choice lists are configured. A new required choice field or a changed label/type returns `booking_ready: false` and `blocking_field_ids`; booking fails with `FORM_NOT_CONFIGURED` before creation or quota consumption.

The documented [event request](https://developers.savvycal.com/api/create-event) accepts a string per custom field but does not specify native multi-checkbox serialization. The adapter submits selected checkbox labels as newline-separated readable text in that documented string field, preserving commas inside individual labels. This representation is an implementation assumption pending the owner's manual API test; no native checkbox round-trip is claimed. Never scrape booking pages.

Manual validation after implementation: test whether SavvyCal rejects select/radio values outside the configured choices, and whether multiple checkbox values are accepted and displayed correctly. The owner will perform these checks. Keep local validation until that behavior is established. A provider `422` is surfaced as a sanitized `BOOKING_REJECTED` error with the website fallback, without automatic retry. Because the API omits choice lists, label/type checks cannot detect changed options; maintain these lists alongside SavvyCal forms.

## Provider and credentials

`SAVVYCAL_API_KEY` resolves through the existing Varlock Proton Pass schema and is projected into server-private `runtimeConfig.scheduling.apiKey`. Missing credentials fail with `NOT_CONFIGURED`. Runtime overrides use `NUXT_SCHEDULING_API_KEY`. Never put the token in tool arguments, public config, fixtures or logs.

`createSavvyCalClient` uses `ofetch.create()` with a fixed `https://api.savvycal.com/v1` base URL, a 15-second timeout, redirects disabled and retries disabled. Its only operations are link retrieval, bounded slot retrieval and event creation for the two allowlisted links. The event payload is explicitly constructed and strictly validated; callers cannot pass arbitrary paths, HTTP options, guests, metadata, payments or conferencing configuration.

The [documented link API](https://developers.savvycal.com/api/schemas/link) does not expose enough settings to prove telephone-only location, absence of payments or group size before creation. These remain administrator-maintained invariants of the two supplied links. The integration does not call undocumented endpoints or invent enforcement properties. Responses only count as successful when they establish a confirmed matching event without payments, group scheduling or video conferencing; unexpected creation responses are reported as uncertain rather than retried. Changing link settings can still cause a real event to be created before an unexpected response is detected.

## Abuse prevention

Only actual create-event attempts consume quota: **three per hour per client IP**, shared across Dutch and English, matching the current root scheduling specification. Failed or uncertain provider writes still consume a slot. Invalid forms, stale availability and link/slot lookups do not. The fourth attempt is rejected with `RATE_LIMITED` and `retry_at` before sending the create-event request.

The installed `@onderwijsin/nuxt-simple-rate-limiter` runs immediately before the write, using the `/mcp` storage namespace. No blanket rate limit is applied to MCP traffic. IP resolution uses the runtime client address or socket; arbitrary forwarding headers are not trusted. The internal chat bridge preserves the runtime-resolved original address through local MCP dispatch. Missing addresses share the limiter's `unknown` bucket.

The configured memory store is per runtime instance and resets on restart. The installed limiter uses non-atomic read/modify/write, so concurrent requests can exceed its limit; this is a best-effort initial abuse control. Shared storage is needed across instances, and strict enforcement requires an atomic limiter. Users behind a shared network share quota.

## Results, privacy and errors

Successful creation returns only event ID, organizer name, timestamps, time zone and the requested Dutch confirmation message (or English translation). Cancellation and rescheduling are handled through the confirmation email. The response does not include attendee details or raw provider objects.

Errors return MCP `isError: true` with a safe code, the requested website fallback message, and retry timing where relevant. `BOOKING_UNCERTAIN` means the write may already have succeeded: check the confirmation email before trying again. Neither the adapter nor the tool automatically retries. An explicit provider rejection is `BOOKING_REJECTED`; read failures are `UNAVAILABLE` and malformed read responses are `INVALID_RESPONSE`.

Scheduling payloads are excluded by the existing analytics query allowlist. Contact details, answers, raw errors and credentials are never included in tool analytics. Tool names, outcome and MCP client attribution remain tracked according to the existing analytics configuration. Scheduling requests/results are not cached. Clients, including the website chat, may retain tool history under their own conversation-storage behavior.

## Validation and references

Unit tests cover fixed API operations, safe errors, required and configured fields, hidden attribution, confirmation, range boundaries, stale slots, uncertain writes and hourly quota reset. HTTP MCP tests use a local synthetic provider via a test-only transport plugin; production keeps the fixed SavvyCal origin. Tests never create real appointments. These tests establish Node behavior, not deployed Workers storage or proxy configuration.

See [authentication](https://developers.savvycal.com/authentication), [available slots](https://developers.savvycal.com/api/get-link-slots), [consultation information](https://onderwijsloket.com/adviesgesprek) and [preparation guidance](https://onderwijsloket.com/wat-kan-je-van-een-adviesgesprek-verwachten).

Booking replay protection hashes the normalized email and start instant. Within a server instance, concurrent requests are blocked, confirmed replays return the original confirmation without consuming quota, and ambiguous writes remain blocked until the slot ends (at least one hour). Rejected writes also remain blocked conservatively. This memory store does not survive restarts or coordinate replicas; shared atomic storage is required for that guarantee. The built-in chat passes `onderwijsloket-chat` through trusted server context. External stateless clients use SDK client metadata when available, otherwise `Unknown MCP Client`; HTTP headers cannot override attribution.
