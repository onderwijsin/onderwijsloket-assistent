# MCP prompts

Seven user-selected workflows are auto-discovered from `server/mcp/prompts/`.
They complement shared `mcp.instructions` without changing tool or resource
contracts. Clients must support prompt listing and retrieval; retrieving a prompt
returns a user message, not executed tool calls.

| Prompt                     | Arguments                            | Purpose                                                                                                               |
| -------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `report-feedback`          | Optional `issue`                     | Collect an actionable report, review shared context and obtain explicit consent before `submit_feedback`.             |
| `schedule-consultation`    | Optional `request`                   | Guide a requested telephone consultation through current fields, availability and explicit confirmation.              |
| `compare-programs`         | Required `request`                   | Compare programs or discover alternatives, preserving program-form distinctions and evidenced attributes.             |
| `find-local-support`       | Required `location`, optional `need` | Find regional desks and verify services and coverage, explaining geographic approximation.                            |
| `find-supporting-articles` | Optional `source`, `focus`           | Find useful related reading using contextually relevant taxonomy filters or text search.                              |
| `find-supporting-media`    | Optional `source`, `focus`           | Find podcast episodes, videos and personal stories, respecting format preferences and available content.              |
| `find-education-routes`    | Optional `background`                | Ask the source-defined route questions, validate confirmed choices, find matching pathways and explain ordered steps. |

Arguments are strings validated with Zod. Whitespace-only values are rejected;
optional values should be omitted when not needed. A source can be a collection
and ID, URL, title or conversation reference. Omitting it uses the item just
discussed; missing or ambiguous context requires clarification. Argument values
are serialized as data within the message. Handlers make no provider requests
and use no Node-specific APIs.

Alternate-program discovery is included in `compare-programs`. Related-content
workflows reuse retrieved details, select meaningful dimensions rather than every
source tag, and discover target-specific filters. Article source filters can use
qualifications even when a corresponding search facet is unavailable. Search
labels and list taxonomy IDs remain separate contracts.

Relatedness is inferred unless an explicit relationship is returned; matching
tags do not establish corroboration. Missing bodies/transcripts remain explicit,
and metadata-only recommendations must not summarize unheard or unseen content.
Shortlist sizes are guidance, not enforced limits. Client/model behavior requires
evaluation with representative conversations.

The route prompt complements three dedicated [route tools](routes.md). It asks
one enabled question at a time, requires confirmed choices and revalidates state
after edits. Route matching remains server-side; the prompt cannot override
questionnaire completion or matching rules.

The scheduling prompt coordinates `get_scheduling_link`, `get_scheduling_slots` and
`book_appointment`. It keeps scheduling limited to explicit consultation requests or
unresolved complex questions, respects preferred consultation language and time zone,
and requires fresh form requirements and explicit confirmation before creation.
Retrieving the prompt never queries SavvyCal or consumes creation quota.

The welcome composer's **Plan een adviesgesprek** suggestion sends an explicit request
through the existing chat submission flow. The agent retrieves `schedule-consultation`
via `mcp_get_prompt`; choosing the suggestion does not itself authorize event creation.
Existing model/feature selections and composer drafts follow the other suggestions.
The prompt has a Dutch activity label when loaded. The three scheduling tools also
have Dutch activity labels for retrieving consultation details, finding available
times and booking the appointment.

The experimental scheduling flow proceeds through the MCP tools without a warning or
website handoff for the pending provider choice-field issue. The website remains a
fallback for unavailable form configuration or booking failures. The server adapter
and its current serialization are unchanged. See [scheduling](scheduling.md).

Scheduling infers the IANA time zone from reliable conversation or host context, defaulting to `Europe/Amsterdam`. It does not ask for the time zone or infer it from language alone. Times are labelled clearly and user corrections are accepted. Intake turns emphasize one question in bold on its own line, with brief context. Preparation links follow booking unless requested earlier; links are not bold. Final confirmation still summarizes all booking details.

Phone intake asks for a reachable number without imposing a format. The assistant normalizes clear numbers internally using established country context, clarifies the country only when ambiguous, and includes the result in the final booking summary without a separate formatting confirmation.

## Instruction ownership

`config/mcp.ts` contains only cross-cutting guidance: purpose, minimal context,
source choice, evidence, uncertainty and consent for writes. Collection/tool
descriptions own field requirements, filters, pagination and action-specific
behavior. Prompts explain multi-step workflows. Scheduling and feedback are
conditional workflows, not the focus of every knowledge request.
