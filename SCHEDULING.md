# Scheduling — proposed scope

Status: proposal for review. No implementation until approved.

## Purpose

Allow users to book a roughly 20-minute, one-to-one telephone consultation with an Onderwijsloket expert. Offer scheduling only on an explicit request for personal consultation or when a complex question cannot be answered adequately using the available knowledge. No scheduling UI in this phase.

## SavvyCal integration

Use the SavvyCal REST API through an encapsulated client created with `ofetch.create()`. Follow the project [HTTP request policy](docs/http-requests.md). No booking-page scraping or undocumented endpoints. Keep the existing `SAVVYCAL_API_KEY` Varlock schema and Proton Pass lookup; the credential stays server-only.

Restrict the adapter to these links:

| Language | Link ID                           | Booking URL                                              |
| -------- | --------------------------------- | -------------------------------------------------------- |
| Dutch    | `link_01JJVPB262C3M3RGHWZGYJNSQV` | https://advies.onderwijsloket.com/plan-een-adviesgesprek |
| English  | `link_01JJVGB7J31E1BR072F8ADKYQ8` | https://advies.onderwijsloket.com/fce6f26c               |

Choose according to the user's preferred consultation language. Clarify when neither Dutch nor English is an obvious match.

Only expose three operations: retrieve a link, retrieve its available slots, and create an event for it. No arbitrary URLs, link IDs, HTTP methods or admin operations accepted from MCP callers. Use Zod at input and provider-response boundaries, sanitized errors, bounded requests and no automatic booking retries. Preserve Node and Cloudflare Workers compatibility.

## Proposed MCP tools and flow

1. **`get_scheduling_link`** — fetch current link metadata, durations and booking fields. Explain what the consultation covers and how to prepare, using the two Onderwijsloket advice pages supplied in the request.
2. **`get_scheduling_slots`** — fetch availability for the selected link. Start with the next three days; only after no results, query days 4–7, then days 8–15, then subsequent weekly windows. Honor explicit user date preferences instead. Return the searched bounds and continuation information; retain exact provider timestamps and the user's time zone.
3. **`book_appointment`** — after slot selection, collect the booking form, reusing confirmed information from the conversation. Require all current mandatory answers, name, email and a reachable phone number. Ask the user to confirm the slot and completed details. Refresh link metadata and availability before submitting the API's documented event payload. Populate “Boeking via” from the trusted MCP client name, falling back to `Unknown MCP Client`; callers cannot override it.

Bookings are always telephone consultations, without payments, conferencing or additional guests. Follow the current link duration settings rather than hardcoding a duration into API requests.

## Resolve before implementing booking

The supplied link responses do not contain select/checkbox options. Check for an easy, documented way to retrieve them through the API. If none exists, the project owner will provide a hardcoded list, maintained per language and field ID. Do not scrape booking pages or invent options. Validate that the configured choices still match the current API field definitions, and stop booking if required choice configuration is missing or incompatible. Verify the documented submission format for multi-select answers before implementing it.

Also verify which documented link settings establish telephone-only, one-to-one booking without payments, and how those settings affect event creation. Do not assume undocumented request properties can enforce them.

## Abuse prevention

Limit event creation to **three attempts per hour per client IP**, shared across both scheduling links. Enforce this server-side in the booking workflow immediately before the SavvyCal create-event request; rejected input and read-only link/slot lookups do not consume this quota. Count failed or uncertain create-event requests as attempts too. MCP sessions, caller-supplied client names and language changes must not reset the quota.

Reuse the installed rate-limiting package where its API supports this operation-level limit. Do not apply the limit to the entire `/mcp` endpoint. Resolve IPs using deployment-trusted proxy handling, and return a structured rate-limit error with retry timing without calling SavvyCal when exhausted. Verify storage and concurrency behavior for the target deployment; process-local counters alone cannot guarantee a shared limit across instances. IP limiting is an initial abuse control and can affect users behind a shared network.

## Results and privacy

Return a minimal confirmation only when the response establishes a confirmed booking, including the organizer and appointment date/time. Use the requested Dutch success message and cancellation/rescheduling instructions, translated for an English conversation. Use the requested website fallback on failure. If a timeout or unexpected response leaves creation uncertain, explicitly warn that a booking may exist and ask the user to check their email before trying again.

Do not log contact details, form answers, credentials or raw provider errors. Exclude scheduling payloads from optional tool-input analytics.

## Delivery and verification

Keep the API adapter, schemas and scheduling workflow encapsulated behind thin MCP tools. Update server instructions with the last-resort policy, add `docs/scheduling.md`, and add the feature to the root README.

Add unit tests for language/link restrictions, search windows, current required fields and choices, attribution, stale slots, confirmation gates, sanitized errors, uncertain booking outcomes and the event-creation rate limit (sixth attempt blocked, hourly reset, shared quota across languages, and read-only calls unaffected). Add HTTP MCP e2e tests using synthetic SavvyCal fixtures, covering discovery, the complete booking flow and failure paths. Tests must never create real appointments.

Run repository formatting, lint, typecheck and relevant unit/e2e tests. No new dependencies or UI work are planned.

## References

- [Authentication](https://developers.savvycal.com/authentication)
- [Get scheduling link](https://developers.savvycal.com/api/get-scheduling-link)
- [Get available slots](https://developers.savvycal.com/api/get-link-slots)
- [Create event](https://developers.savvycal.com/api/create-event)
- [Plan an advice call](https://onderwijsloket.com/adviesgesprek)
- [Expectations and preparation](https://onderwijsloket.com/wat-kan-je-van-een-adviesgesprek-verwachten)
