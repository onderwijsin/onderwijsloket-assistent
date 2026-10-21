# Feedback reports

`submit_feedback` creates one report for incorrect information, a bug or other
feedback. `report-feedback` guides collection and review before submission. The
tool is a mutation (`readOnlyHint: false`, `idempotentHint: false`), has no cache,
and makes exactly one Notion request. No dashboard UI or HTTP feedback route is
implemented.

## Architecture and configuration

- `server/utils/feedback/schemas.ts` owns the input, context, receipt and
  `FeedbackStorage` port.
- `server/utils/feedback/service.ts` validates consent and bounds the report,
  creates a detached snapshot, and calls `FeedbackStorage.create` once. It has no
  Nitro, MCP or Notion dependency. Another storage implementation supplies this
  one method; another transport calls the same service with its own context.
- `server/utils/notion/` encapsulates the fixed-origin `ofetch` client and Notion
  property mapping. No Notion client library is used.
- `server/utils/feedback/tool.ts` composes the service and adapter and collects
  the available MCP request metadata.

Private `runtimeConfig.feedback` contains `notionApiToken` (from Varlock
`NOTION_API_KEY`), `notionDataSourceId` and `appVersion`. Deployments can override
these with `NUXT_FEEDBACK_NOTION_API_TOKEN`,
`NUXT_FEEDBACK_NOTION_DATA_SOURCE_ID` and `NUXT_FEEDBACK_APP_VERSION`.
The default data source is `400b66e1-be69-80b6-a7cb-000bf91f086e` in the
[team feedback database](https://app.notion.com/p/400b66e1be6980b6b1fccf8cf36d4e88).
The credential needs access to that data source and permission to insert content.
Missing credentials or an invalid destination fail closed without a request.

## Submission contract

Required fields are `title` (1–120 characters), `category`
(`incorrect_information`, `bug`, `other`), `message` (1–8,000 characters) and
`user_consent: true`. Consent must follow review of the exact report and included
context, with disclosure of storage in Notion and available client metadata.
The boolean records the caller's assertion; the server cannot independently
verify that the user approved it. The prompt is guidance, not an access-control
boundary.

Optional fields:

| Field          | Meaning                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `email`        | Explicitly supplied optional contact address, at most 200 characters.                                       |
| `occurred_at`  | Known issue timestamp with a UTC offset; not inferred from receipt time.                                    |
| `message_id`   | Identifier of the affected message when available.                                                          |
| `conversation` | Available, approved snapshot with optional `id`, `title`, `createdAt`, `updatedAt` and required `messages`. |
| `settings`     | Current `model`, `webSearch`, `extendedThinking`; not per-message model provenance.                         |
| `diagnostics`  | Reviewed `request_id`, `tool_name`, `error_code`, `error_message`.                                          |

Conversation messages follow the relevant Pinia shape: optional message `id`,
`role` (`user` or `assistant`) and structured `parts` with a `type`. Available tool
inputs, outputs and states are preserved. Unknown conversation-level fields,
including unsent `draft`, `titleSource`, `titleRequested` and UI state, are
discarded. Only the selected approved conversation belongs in the payload.
External MCP clients may not expose any history; omit unavailable context rather
than synthesizing it. Hidden reasoning must not be collected.

The normalized input and attribution together must fit within **80,000 UTF-8
bytes**. Conversations have at most 100 messages with 100 parts each. Reports
over the limit fail before persistence; nothing is silently truncated. There is
no automatic secret or personal-data redaction. The agent/user must review and
minimize all submitted text and tool outputs before consenting.

The MCP adapter collects the observed HTTP User-Agent, SDK initialization client
name/version when available, package version and deployment environment. Client
names are self-reported and a User-Agent may describe a server rather than the
user's browser. Missing metadata remains absent. Tool arguments cannot override
this attribution. The current source label is `Web chat` when the SDK client name
is `onderwijsloket-chat`, otherwise `MCP client`; it is not authenticated origin
proof. No IP address, cookies or authorization headers are persisted.

## Notion representation

The adapter uses `POST /v1/pages`, API version `2026-03-11`, with a
`data_source_id` parent. It writes category, `Status: New`, message, consent and
available metadata into existing database properties. Notion manages `Created`,
`Last edited` and its `FB` report number. `Reported at` and `Consent recorded at`
are the server receipt time; the latter records receipt of the consent assertion,
not the precise moment the user clicked or spoke consent. `Consent version` is
the workflow contract identifier `feedback-v1`.

A JSON code block in the report body holds the complete versioned snapshot,
including history and diagnostics. Rich-text fragments stay below Notion's
2,000-character limit and preserve Unicode. This keeps report creation to one
request. The existing `Conversation history` and `Diagnostics` file properties
remain empty: producing native JSON attachments would require additional upload
requests. The inline snapshot is the source of truth for this implementation.

Success returns only `{ report_id, received_at }`. `report_id` is the storage's
opaque identifier (currently the Notion page UUID), not the Notion-generated
`FB` display number. No internal database URL or report content is returned.

## Failures and verification

Errors return `isError: true` and a text JSON object with a safe `code` and
`message`. Input validation fails before persistence. Missing configuration is
`NOT_CONFIGURED`. Known rejection responses (400/401/403/404/413/429) become
`SUBMISSION_REJECTED`. Network failures, 5xx responses, unexpected errors and
malformed success receipts become `SUBMISSION_UNCERTAIN`: the report may already
exist. Neither the service nor HTTP client retries writes. The agent must explain
uncertainty and must not automatically resubmit. There is no cross-request
deduplication or delivery guarantee; repeated explicitly requested calls can
create duplicates. Reports do not promise a reply or a resolution time.

The client uses a fixed API origin and the ofetch defaults, including no automatic
retries for POST requests. It never retains or exposes upstream bodies, secrets or
personal details in errors.
No feedback-specific abuse quota or authentication is introduced; apply ingress
controls if this public write capability needs stricter protection. Server-side
tool analytics can still record the tool name and outcome, but feedback content
is outside its query-data allowlist.

Unit tests mock the ofetch boundary to verify mapping, receipt validation,
consent, payload limits, absent metadata, sanitized failures and no automatic
retries. MCP protocol tests verify the production handler's schema and safe
results over an in-memory SDK connection. Live Notion permissions and deployed
Cloudflare behavior require separate verification; no real report is created by
the test suite.

API behavior follows the official [create page reference](https://developers.notion.com/reference/post-page),
[request limits](https://developers.notion.com/reference/request-limits) and
[versioning reference](https://developers.notion.com/reference/versioning).
