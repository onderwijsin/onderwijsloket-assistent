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
  "generateTitle": true,
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

The server retains no chat history for ordinary generation. Explicitly consented
[feedback submissions](feedback.md) send the full current request conversation to the team;
other conversations and unsent drafts are excluded. The browser persists conversations, drafts, model
settings and sidebar collapse state in Pinia via localStorage, never chat cookies. OpenAI requests set `store: false` and
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

The home page follows the [Nuxt UI chat dashboard template](https://github.com/nuxt-ui-templates/chat),
using `UDashboardGroup`, `UDashboardSidebar`, `UDashboardPanel`, `UDashboardNavbar`
and `UDashboardSearch`. It uses our logo and has no login, upload, voice or share controls.
The old header, footer, newsletter banner and their exclusive components are removed.
Draft-only conversations stay out of sidebar history and search until the first user
message is submitted. Typing alone does not add a navigation item.
The sidebar provides new conversations, grouped local history, title search and links to
Onderwijs in, the GitHub repository and the newsletter page. The conversation title menu
supports pin/unpin, rename, copying and delete. “Gesprek kopiëren” copies the title and
user/assistant text as Markdown with speaker headings, excluding reasoning and tool payloads.
Successful copying shows “Het gesprek is gekopieerd naar je klembord”; failures show an error toast.
The copy action is disabled while copying or when the Clipboard API is unavailable.
`useConversationClipboard` owns Markdown formatting, clipboard state and result toasts;
the dashboard passes the active conversation through a reactive getter.
History and search groups use creation dates,
newest first; opening, continuing or renaming a conversation never changes its position
or creation-date group. Pinned conversations appear only in a separate “Vastgezet” group
above date groups, most recently pinned first. Unpinning restores the creation-date
position; pinning again assigns a new pin timestamp. Pins persist locally alongside
conversation data, and existing saved conversations without a pin timestamp remain unpinned;
the toolbar retains the color-mode toggle. Below `sm`, the conversation title fills
the available header width. Its action menu uses small sizing, extra vertical item
padding and 1 rem leading icons. Sidebar rows expose pin/unpin and archive
buttons on hover or keyboard focus. On devices with hover, actions overlay the title
with a gradient fade rather than reserving title space; the title shifts subtly on reveal.
Reduced-motion preferences disable this movement and transitions. Mobile navigation hides row actions; pinning and archiving remain available in the
conversation title menu. Desktop touch devices keep the buttons visible with space
reserved for them. Archiving
clears the pin and moves the conversation into the collapsed “Gearchiveerd” group at
the bottom, ordered by creation date and included in search. Archiving the active chat
opens an empty chat. Archived chats can be opened, restored or deleted; restoring
returns them to their original creation-date position without a pin. Archive timestamps
persist locally and older saved conversations remain compatible. In a conversation,
an Experimenteel badge follows the title at the `sm` breakpoint and above; the header
badge is hidden on mobile. The welcome view
omits the redundant new-chat title and keeps its badge above the greeting. The command
palette includes a new-chat action and the built-in system/light/dark theme choices.
The page uses `sand-main` in light mode and `neutral-950` in dark mode; the conversation
panel uses `sand-light` in light mode and a scoped `bg-default` → `zinc-900` at 50% opacity in dark mode.
The composer dock and loading skeleton match the panel. Below `sm`, the panel and
loading shell fill the viewport without outer margins, rounded corners, rings or shadows.
The framed panel appearance is retained from `sm` upward.
Expanded navigation icons use a compact size and optical alignment with the labels. Collapsed
navigation uses centered 20px icons in 32px square buttons, matching the sidebar collapse toggle,
with an 8px vertical gap between buttons in both the primary and footer menus. Mobile navigation
uses a full-screen dashboard menu with larger text and more space between history rows
and groups. New-chat and search actions have extra padding and separation from history. Mobile
navigation adds breathing room above the primary actions and equally above and below the footer links,
including an equal allowance for the device bottom safe area. Keyboard shortcuts are Cmd/Ctrl+O for a new chat and
Cmd/Ctrl+K for search. The desktop sidebar can be resized by dragging its edge between 12 and 24 rem (default 17 rem).
Its width resets on reload. Dashboard component persistence is disabled: Pinia owns its state.

The dashboard mounts only on the client, after the persisted-state plugin is installed.
Skeleton backgrounds use `sand-dark` in light mode via `app.config.ts`, retaining
`bg-elevated` in dark mode.
SSR and initial hydration show an accessible branded skeleton until localStorage has
been read synchronously and the dashboard is ready. No private chat data is serialized
into the server-rendered page. The `chat` setup store owns conversations (IDs, titles,
timestamps, drafts, SDK message snapshots), active conversation and model settings.
Only durable fields are persisted; open menus and search state remain transient.
The storage boundary validates saved data with Zod. Invalid data falls back to defaults;
unfinished tool calls are removed when reopening a stopped or interrupted conversation.
Local history survives reloads until deleted or browser storage is cleared. It does not
sync across devices. Browser storage restrictions or quota exhaustion can prevent saving.

Each keyed chat instance uses the SDK for streaming and writes detached snapshots to its
own Pinia conversation ID. Switching or deleting a conversation stops the old stream;
late snapshots cannot populate another conversation or resurrect a deleted conversation.
New conversations request one short Dutch title (3–6 words, at most 60 characters)
through an additional model call inside the same `/api/chat` HTTP request. The optional
`generateTitle` flag defaults to false and is honored only with a single-message history.
It uses OpenAI `gpt-5-nano` (minimal reasoning, `store: false`) or Mistral
`ministral-3b-2512`, matching the selected provider. These are budget models suitable
for short topic summaries; model choices were checked against the official
[OpenAI model guide](https://developers.openai.com/api/docs/models/gpt-5-nano) and
[Mistral pricing](https://docs.mistral.ai/inference/pricing) on 20 October 2026.
OpenAI has [scheduled GPT-5 nano removal](https://developers.openai.com/api/docs/deprecations)
for 11 December 2026. Replace the title model before that date; no automatic switch
to a more expensive model is made.
Only the first 2,000 characters of the first message are sent, without tools, with
256 output tokens, no retries and a five-second timeout. The call runs alongside
the answer and emits a transient `data-conversation-title` event on the existing SSE
stream. The stream can remain open until the bounded title call completes; answer
chunks are not held back. Cancellation aborts the title call. Missing or invalid titles
silently keep the first-message fallback. Title requests share the chat endpoint quota.
Pinia records the attempt to avoid extra calls on retries or regeneration, validates
the event and applies it only to the owning conversation if it has not been renamed.
Generated titles survive subsequent message updates. Existing saved titles are treated
as manual during storage migration and are left unchanged. Reloading does
not resume interrupted generation. Chat content is still sent to `/api/chat` for generation
and MCP retrieval, but no conversation database or server session is introduced.

Nuxt UI’s `UChatPrompt`, `UChatMessages`, `UChatReasoning`, `UChatTool` and
`UChatPromptSubmit` retain the existing conversation UI. Comark renders streamed
Markdown through the installed renderer’s `value` prop, with a Suspense fallback.
The composer submits the current model, search and thinking flags using
`DefaultChatTransport`. Web search defaults off; extended thinking defaults on.
Sending is disabled during a response and the submit control becomes a stop button.
Failed requests show persistent error toasts (`duration: Infinity`) with retry and
dismissal controls instead of an inline alert. Toasts are removed when the error is
cleared or the conversation is left; quota errors
explain the hourly limit.

The conversation omits the extra title/action row and decorative message
icons. The model selector retains its Mistral and OpenAI provider logos. User bubbles are white in light mode and neutral-800 in dark mode. The composer
uses neutral-950 in dark mode; message
text is 14px. The narrower reading column and compact Markdown spacing keep long
answers readable. The dashboard fills the viewport. Only the conversation pane scrolls;
the composer remains below it in the panel, outside the transcript scroll area, without
an additional document scrollbar. Its compact form starts at one row and expands to
five while typing. The first submission retains the shared-element View Transition,
short transcript fade and reduced-motion support. Streaming starts after the view update,
without waiting for the animation. The welcome view retains the Dutch greeting and
experimental badge; its greeting is calculated when the client dashboard mounts.
The built-in floating scroll button is disabled to avoid overlap with the composer;
automatic scrolling during generation remains enabled. Completed assistant
responses show copy, regenerate and feedback actions, without voting controls. Copy includes
only answer text. Regenerating uses the selected message ID and current model
settings; as in the SDK, retrying an earlier answer discards the later conversation.

The bug-icon feedback action sends a Dutch request into the current chat, identifying
the selected answer by a text excerpt of at most 600 characters. It uses the existing
submission flow and preserves the composer draft. The agent follows the
[`report-feedback` workflow](feedback.md), collects the issue and obtains explicit
consent before submitting. Clicking the action is not consent to send a report.
The action is disabled while a response is being generated.

Below `md`, `ChatSuggestionMarquee` shows all starters in three spacious viewport-width rows
with staggered starting offsets, alternating directions and a slow 120-second loop, following the Nuxt UI testimonials
example. Horizontal button gaps and vertical row gaps are both 0.75 rem. Rows pause on hover, touch and keyboard focus. With reduced motion, animation
stops and each row scrolls horizontally so all prompts remain reachable. From `md`,
the original wrapped suggestion pills remain visible.
Eight Dutch starters cover routes, programme comparison, local advice,
required teaching qualifications, salaries, lateral entry, telephone consultations and personal experiences.
The routes, comparison, advice and experiences starters reflect the existing MCP
prompt themes. Choosing a starter sends its text directly without assigning or clearing the composer
draft, preventing a flash of the prompt in the input. It submits with the current model and feature
selections. The agent can retrieve the corresponding MCP prompt workflow during
the conversation. The telephone consultation starter selects the `schedule-consultation`
workflow; it requests help with scheduling but does not confirm an appointment.

Messages, drafts and options are stored locally through Pinia. No server-side
conversation persistence or authentication is used.

Regenerate and retry are disabled whenever truncating that response would discard a `book_appointment` tool attempt, including failed or incomplete attempts. On a stream error after a booking attempt, the chat asks the user to check their confirmation email. Subsequent unrelated answers can still be regenerated.

The AI accuracy disclaimer appears only in the welcome view, before the first message. It is hidden in transcript view.

After submitting by Enter, button or suggested prompt, focus moves to the active composer, including the welcome-to-transcript transition. While a response is in progress the textarea is read-only instead of disabled, preserving focus; submission guards still prevent overlapping requests.

OpenAI chat tool inputs omit the unsupported JSON Schema `propertyNames` keyword at the
provider boundary. Original MCP schemas and local input validators remain unchanged,
including UUID key constraints and defaults. Mistral schemas are unchanged. Other AI SDK
compatibility warnings remain enabled.
