# Feedback reports

`submit_feedback` creates one report for incorrect information, a bug or other
feedback. `report-feedback` guides collection and review before submission. The
tool is a mutation (`readOnlyHint: false`, `idempotentHint: false`), has no cache,
and makes exactly one Notion request. The dashboard feedback action starts the
collection workflow in the current chat; no separate HTTP feedback route exists.

Feedback collection stays the active workflow until submission, explicit cancellation
or an explicit request to stop the report and switch tasks. Replies to feedback questions are report
content, even when phrased as commands or frustration about the original task.
The prompt prohibits original-task tool calls during collection and asks the agent
to clarify ambiguous intent before switching and wait for an explicit choice to stop
feedback. Repeating the original goal or declining submission does not itself cancel
feedback or authorize resuming the task. Both the prompt and shared server instructions
suspend original-task tools and intake questions during feedback collection. After submission it waits for the
next request instead of automatically resuming the original task. This is prompt
guidance; no server-side workflow state or tool restrictions are introduced.

Regression scenario for model evaluation: start booking, receive a website referral,
start feedback, then answer the feedback question with "Ik wil niet dat je me naar
de site verwijst. DOE GEWOON JE WERK". The agent should summarize the unwanted
referral as the complaint and continue review and consent, without fetching slots
or booking. "Laat de melding maar zitten; ik wil verder met boeken" should instead
cancel feedback and resume booking subject to its existing confirmation rules.
An additional case is "Ik wil gewoon een gesprek plannen": acknowledge this as
the unmet goal being reported and continue report review. Do not announce that
feedback is cancelled or ask for booking dates/time zones. If intent is ambiguous,
ask whether to continue feedback or stop it and resume planning, then wait.
The HTTP prompt test checks that these instructions and contrasting examples are
delivered; it does not establish live model compliance.

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
context. Explain the actual sharing scope: complete history for the built-in
webchat snapshot, best-effort/partial or reconstructed context for external clients
when that is available, or the report without history when context is omitted.
Include available app/client metadata in that explanation. Do not claim complete
history for partial context. Other chats are excluded. Do not name storage providers
unless asked.
The boolean records the caller's assertion; the server cannot independently
verify that the user approved it. The prompt is guidance, not an access-control
boundary.

Optional fields:

| Field          | Meaning                                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------------------- |
| `email`        | Explicitly supplied optional contact address, at most 200 characters.                                           |
| `occurred_at`  | Known issue timestamp with a UTC offset; not inferred from receipt time.                                        |
| `message_id`   | Identifier of the affected message when available.                                                              |
| `conversation` | Optional arbitrary JSON context for external clients; complete structured server-attached snapshot for webchat. |
| `settings`     | Current `model`, `webSearch`, `extendedThinking`; not per-message model provenance.                             |
| `diagnostics`  | Reviewed `request_id`, `tool_name`, `error_code`, `error_message`.                                              |

External `conversation` accepts any JSON value: object, array, string, number,
boolean or explicit null. It can be omitted. There are no mandatory message fields;
unknown structures, JSON property names and annotations are preserved, including partial/reconstructed
messages. Non-JSON in-process values fail validation safely. Prefer chronological
messages with roles/content and available tools, IDs and timestamps as guidance,
not validation. Never invent inaccessible information or add unrelated chats,
system instructions, hidden reasoning or unsent drafts. See
[agent context observations](feedback-context-observations.md) for a genuine
reconstruction and its limitations.

The custom webchat retains its Pinia-compatible schema: user/assistant messages,
structured parts and available tool inputs/results. Its optional selected metadata
is retained; unsent drafts and unrelated UI fields are excluded as before.
The web chat forwards its validated request history and settings through request-local
Nitro context; these override any agent-supplied conversation or settings. Nitro 2
local dispatch promotes entries under `context._platform` into the inner H3 event;
the bridge uses that envelope for allowlisted request metadata while preserving
existing platform context. Passing plain `context` entries loses the snapshot.
A real HTTP regression test covers this handoff. This
captures every message and structured part received through the latest user turn,
including consent, without asking the model to recreate them. The response being
generated and its new tool calls are not yet part of that snapshot. Other chats
and drafts are never forwarded. No history is persisted before consented submission.
External MCP clients can supply best-effort JSON or omit it. The server cannot
independently establish completeness of external-client history. Webchat snapshots
remain mandatory and validated when the transport identifies a webchat report.
System prompts and hidden provider reasoning are not part of the web chat snapshot.

The actual encoded Notion request must fit within **500,000 UTF-8 bytes**,
including properties, code blocks and JSON escaping. A short visible conversation
can contain much larger structured tool inputs/results; these remain intact. Webchat conversations retain their existing limit of 100 messages with 100 parts
each; external JSON has no message-count or part-count requirements. Reports
over the limit fail before persistence; nothing is silently truncated. There is
no automatic secret or personal-data redaction: information already shared in the
submitted context is included. Never select excerpts or silently shorten history
to fit the limit; oversized reports fail without storage.

If the normal JSON request exceeds the limit, the storage adapter losslessly gzips
the entire snapshot and Base64-encodes it. It then rechecks the final request,
including a separate readable conversation-text transcript when the structured
webchat shape is recognizable, and the existing report
summary/metadata properties. Tool inputs/results remain complete in the compressed
snapshot. If this fallback still exceeds 500 KB, submission fails without sending
anything or truncating content. Compression is local preparation, not a second
write or an automatic retry.

The MCP adapter collects the observed HTTP User-Agent, SDK initialization client
name/version when available, package version and deployment environment. Client
names are self-reported and a User-Agent may describe a server rather than the
user's browser. Missing metadata remains absent. Tool arguments cannot override
this attribution. A request-local web chat snapshot sets source to `Web chat`,
client name to `onderwijsloket-chat`, version to the configured app version and
User-Agent to the original browser request header. Otherwise source is `MCP client`
and available SDK metadata is used. HTTP IP addresses, cookies and authorization
headers are not captured as metadata; user-shared information in the transcript
is still included.

## Notion representation

The adapter uses `POST /v1/pages`, API version `2026-03-11`, with a
`data_source_id` parent. It writes category, `Status: New`, message, consent and
available metadata into existing database properties. Notion manages `Created`,
`Last edited` and its `FB` report number. `Reported at` and `Consent recorded at`
are the server receipt time; the latter records receipt of the consent assertion,
not the precise moment the user clicked or spoke consent. `Consent version` is
the workflow contract identifier `feedback-v4`.

JSON code blocks in the report body hold the complete versioned snapshot,
including history and diagnostics. Rich-text fragments stay below Notion's
2,000-character limit and preserve Unicode, with at most 100 fragments per block.
Concatenate fragments across code blocks in order to reconstruct the snapshot. This keeps report creation to one
request. The existing `Conversation history` and `Diagnostics` file properties
remain empty: producing native JSON attachments would require additional upload
requests. The inline snapshot is the source of truth for this implementation.

The compression fallback stores an envelope with `format: onderwijsloket-feedback`,
`version: 1`, `encoding: gzip+base64`, `originalBytes` (the uncompressed UTF-8 JSON
length) and `data`. When the webchat shape is recognizable, a separate plain-text code block contains
the visible transcript; unfamiliar JSON needs no transcript to be accepted, and
the complete structured history is retained inside the envelope. Both compression
and decompression use native Web Compression Streams, supported by
[Node](https://nodejs.org/api/webstreams.html#class-compressionstream) and
[Workers](https://developers.cloudflare.com/workers/runtime-apis/web-standards/#compression-streams),
without a new dependency. The decoder validates the envelope, gzip integrity,
UTF-8, byte count and snapshot format.

To inspect a report, concatenate the fragments of its **JSON** code blocks in order
into `snapshot.json`, excluding any readable plain-text blocks, then run with Node 24:

```sh
node scripts/decode-feedback.mjs snapshot.json > report.json
```

The command accepts both existing uncompressed snapshots and compressed envelopes.
It performs no network requests or environment-secret loading. The runtime utility
is `server/utils/feedback/snapshot.ts`; it is not exposed as a public endpoint.

Success returns only `{ report_id, received_at }`. `report_id` is the storage's
opaque identifier (currently the Notion page UUID), not the Notion-generated
`FB` display number. No internal database URL or report content is returned.

## Failures and verification

Errors return `isError: true` and a text JSON object with a safe `code` and
`message`. Agents must display the exact error code alongside the localized
explanation. Validation details contain field paths or byte counts, never submitted
values or raw provider errors:

- `MISSING_CONVERSATION`: the authoritative webchat history was not attached;
  external clients may omit history.
- `INVALID_CHAT_CONTEXT`: the attached web chat snapshot failed schema validation.
- `INVALID_METADATA`: app/client attribution failed validation.
- `INVALID_INPUT`: report fields or serialization are invalid.
- `REPORT_TOO_LARGE`: the encoded storage request exceeds 500,000 UTF-8 bytes; details include
  `size_bytes` and `limit_bytes`. Do not truncate history to bypass the limit.
- `SNAPSHOT_ENCODING_FAILED`: local compression failed; no request was sent.

These failures happen before persistence. Missing configuration is
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
retries. A test-only HTTP route exercises web chat history attachment through the
real local MCP dispatcher, including history above the former 80 KB cap. Storage tests cover multi-block JSON
and verify that encoding overhead is counted before sending a request. MCP protocol tests verify the production handler's schema and safe
results over an in-memory SDK connection. Live Notion permissions and deployed
Cloudflare behavior require separate verification; no real report is created by
the test suite.

API behavior follows the official [create page reference](https://developers.notion.com/reference/post-page),
[request limits](https://developers.notion.com/reference/request-limits) and
[versioning reference](https://developers.notion.com/reference/versioning).
