# Chat server

`POST /api/chat` follows the [Nuxt UI chat example](https://ui.nuxt.com/docs/components/chat)
using AI SDK 7 `ToolLoopAgent`, `convertToModelMessages`, `toUIMessageStream` and
`createUIMessageStreamResponse`. No authentication, uploads, database or server
conversation session is involved.

## Request

```json
{
  "model": "gpt-6-luna",
  "webSearch": false,
  "extendedThinking": true,
  "messages": [
    { "id": "user-1", "role": "user", "parts": [{ "type": "text", "text": "Hoe word ik leraar?" }] }
  ]
}
```

`model` accepts `gpt-6-luna` (default) or `mistral-medium-latest`.
Web search defaults to `false`; extended thinking defaults to `true`. Extended thinking selects `high` reasoning
for both providers; disabled selects `none`. Mistral supports only `none` and
`high`, as documented in its [reasoning guide](https://docs.mistral.ai/studio/conversations/reasoning).
OpenAI uses the [GPT-6 Luna Responses API](https://developers.openai.com/api/docs/models/gpt-6-luna).

Web search registers the selected provider's native `web_search` tool. Mistral
uses its Conversations API for search and Chat Completions otherwise. OpenAI uses
Responses for both. Sources and reasoning are included in the UI message stream
only when their corresponding feature is enabled. Server instructions request
Dutch visible reasoning summaries and headings for both providers. This is a
best-effort language preference, not a provider-enforced guarantee.

The boundary accepts up to 100 user/assistant UI messages with up to 100 parts
per message, 32,000 characters per text part and 100,000 text characters total.
The final message must contain non-blank user text. File parts and system roles
are rejected. Assistant reasoning, sources and native search results are dropped from replay.
Text, step markers and validated MCP tool calls/results are retained, including canonical
questionnaire selections. Provider metadata is removed so users can switch models.
Unknown tool names are rejected; dynamic MCP parts are normalized and checked against
the discovered tool schemas. History remains client-supplied, not authenticated evidence. Transport fields such as `id` and `trigger` are ignored.
Client-provided instructions, tools and provider options are never forwarded.

## Response and errors

Successful requests return the AI SDK UI message SSE protocol with `Cache-Control:
no-store`. Each model step is capped at 10,000 tokens including reasoning, with at most 12 steps. Invalid requests
return `400`, missing provider configuration returns `503`, and quota exhaustion
returns the module's `429` contract with `data.bannedUntil` and `data.limits`.
MCP setup failures return a sanitized `503`. Provider failures after streaming starts
emit a generic Dutch stream error. SDK server-side error logging retains its default behavior.

## Credentials, limits and retention

The existing SDK packages are aligned to `ai` 7.0.144, `@ai-sdk/vue` 4.0.144,
`@ai-sdk/mistral` 4.0.67, `@ai-sdk/openai` 4.0.97 and `@ai-sdk/mcp` 2.0.79. These patch versions
share the provider schema types required for native web-search tools.

Varlock's existing `MISTRAL_API_KEY` and `OPENAI_API_KEY` values are projected into
private `runtimeConfig.chat`. They are never exposed in public runtime config.

The simple rate limiter is registered explicitly. The endpoint enforces 30
requests per IP per 3,600 seconds, before body validation or provider execution.
`ban: 0` blocks excess requests until the existing window ends. Chat quotas use
an explicit memory storage mount, reset on process restart and are independent
per server instance. They are best effort under concurrency. Forwarded IP headers
are not trusted; deployment behind a proxy needs a separately reviewed IP policy.

The application retains no chat history. The client will own browser-session state;
no client persistence is introduced here. OpenAI requests set `store: false` and
the installed Mistral Conversations adapter also sets `store: false`. This does
not override either provider's separate abuse-monitoring retention policy.

Tests cover request restrictions, default flags, provider routing, high reasoning,
native search selection, streamed text/source/reasoning chunks, sanitized errors
and hourly quota enforcement/reset without calling paid APIs. Live provider access and
deployed Workers streaming remain deployment checks.

## MCP integration

Every chat request opens an AI SDK HTTP MCP client against the existing `/mcp`
endpoint through Nitro’s local dispatcher. The fixed internal route avoids trusting
the incoming Host header or requiring a public self-request, preserving Node and
Workers compatibility. Existing tools, data access and Directus visibility rules remain unchanged.

The agent discovers all server tools and prompt metadata, receives the server’s own
instructions, and exposes three additional adapters: `mcp_list_resources`,
`mcp_read_resource` and `mcp_get_prompt`. Resources are restricted to the
`onderwijsloket://` namespace; prompt names must match the discovered catalog.
The agent is instructed to retrieve MCP evidence before factual education answers,
use relevant prompt workflows and preserve route-questionnaire selections. MCP is
available regardless of the web-search toggle; native web search is supplementary.
The transcript labels tool calls by their actual action in Dutch (such as searching
articles, reading a source or retrieving route questions), with workflow-specific
labels when loading a known MCP prompt. Unknown tools use a neutral fallback.
Tool selection remains a model decision rather than a guarantee that every answer calls a tool.

The multi-step agent executes tools and feeds results back to the model. Each
request owns its MCP client and closes it on completion, stream error, cancellation
or setup failure. Tests exercise real MCP protocol calls, a mock-model multi-step
loop, history validation and cleanup. The built-app integration test exercises
local dispatch, a discovered tool, a prompt and a resource without paid provider calls.

## Chat interface

The home page mounts the central chat interface inside the existing site shell.
Nuxt UI’s `UChatPrompt`, `UChatMessages`, `UChatReasoning`, `UChatTool` and
`UChatPromptSubmit` follow the template’s central conversation UI without its
dashboard layout, authentication, uploads or dictation. Comark renders streamed
Markdown through the installed renderer’s `value` prop. A local Suspense boundary
provides plain text while its async parser initializes, for both answers and
reasoning. HTTP(S) source links open separately.

The server selects the Dutch greeting in Europe/Amsterdam time and serializes it
with `useState`, so hydration keeps the same text without layout shift. The home
page uses request-time SSR rather than prerendering to avoid build-time greetings.
The composer owns the input controls; the interface coordinates `useChat` with
`DefaultChatTransport`, submitting the current model, search and thinking flags
to `/api/chat`. Web search defaults off; extended thinking defaults on. Sending is disabled during a response;
the submit control becomes a stop button. Failed requests show a Dutch error
with retry and dismissal controls; rate-limit failures explain the hourly quota.
The conversation omits the extra title/action row and decorative message
icons. The model selector retains its Mistral and OpenAI provider logos. User bubbles are white in light mode and neutral-800 in dark mode. The composer
uses neutral-950 in dark mode; message
text is 14px. The narrower reading column and compact Markdown spacing keep long
answers readable. The welcome view fills the viewport below the header. Both views use normal
page scrolling without a nested chat scroll container. Transcript mode hides the
newsletter and site footer through request-scoped Nuxt state shared with the app
shell. The composer is fixed to the bottom, with space below the transcript
measured from its actual height, including expanded text or error feedback.
Source links are constrained to the reading column and long text can wrap.
The compact composer starts at one row and expands to five while typing; it does
not autofocus when transcript mode mounts. The first submission uses a shared-
element View Transition where supported, with a short transcript fade and
reduced-motion support. Streaming begins after the view update, without waiting
for the animation. Leaving the chat restores the newsletter and footer.
The built-in floating scroll button is disabled to avoid overlap with the composer;
automatic scrolling during generation remains enabled. Completed assistant
responses show copy and regenerate actions, without voting controls. Copy includes
only answer text. Regenerating uses the selected message ID and current model
settings; as in the SDK, retrying an earlier answer discards the later conversation.

Seven Dutch starters cover routes, programme comparison, local advice,
required teaching qualifications, salaries, lateral entry and personal experiences.
The routes, comparison, advice and experiences starters reflect the existing MCP
prompt themes. Choosing a starter immediately submits it with the current model and feature
selections. The agent can retrieve the corresponding MCP prompt workflow during
the conversation.

Messages, drafts and options live only in the mounted chat instance. No local
storage, session storage or server persistence is used; reloading clears the chat.
