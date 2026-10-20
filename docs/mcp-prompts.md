# MCP prompts

Four user-selected workflows are auto-discovered from `server/mcp/prompts/`.
They complement shared `mcp.instructions` without changing tool or resource
contracts. Clients must support prompt listing and retrieval; retrieving a prompt
returns a user message, not executed tool calls.

| Prompt                     | Arguments                            | Purpose                                                                                                   |
| -------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `compare-programs`         | Required `request`                   | Compare programs or discover alternatives, preserving program-form distinctions and evidenced attributes. |
| `find-local-support`       | Required `location`, optional `need` | Find regional desks and verify services and coverage, explaining geographic approximation.                |
| `find-supporting-articles` | Optional `source`, `focus`           | Find useful related reading using contextually relevant taxonomy filters or text search.                  |
| `find-supporting-media`    | Optional `source`, `focus`           | Find podcast episodes, videos and personal stories, respecting format preferences and available content.  |

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
