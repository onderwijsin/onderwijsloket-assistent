# External-agent context observations

## Observed in the active coding-agent conversation

The agent can read earlier user and assistant messages and many tool calls/results
in the current conversation. Some older material is summarized and some tool outputs
are explicitly truncated. Authoritative conversation/message IDs, message timestamps,
complete provider-native parts and omitted tool-result fragments are not exposed.
Knowing a repository path, commit hash or tool execution ID does not establish a
message identifier. No feedback was submitted during this investigation.

The following is a genuine selected reconstruction from visible context, not an
export or complete transcript. Quotations are reproduced from visible messages;
tool observations are explicitly summaries. Missing metadata is omitted.

```json
{
  "source": "model-visible-context",
  "completeness": "partial",
  "representation": "selected reconstruction",
  "messages": [
    { "role": "user", "content": "assistent.onderwijsin.nl/mcp" },
    {
      "role": "assistant",
      "content": "De endpoint antwoordt als Onderwijsloket Assistent en biedt 41 tools aan, waaronder boeken en feedback.",
      "excerpt": true
    },
    { "role": "user", "content": "Commit and pish" },
    {
      "role": "assistant",
      "content": "Gecommit en gepusht als `16cfebf`. PR #24 is bijgewerkt met de Claude-configuraties, integratieaudit en B-10-anonimisering. Alle checks slagen."
    },
    {
      "role": "user",
      "content": "Problem: Make feedback conversation context best-effort for external MCP clients",
      "excerpt": true
    }
  ],
  "tool_observations": [
    {
      "representation": "summary",
      "action": "MCP initialize and tools/list against the user-confirmed deployment",
      "observed": "HTTP 200; Onderwijsloket Assistent (experimental), version 1.1.0; 41 tools, including submit_feedback."
    },
    {
      "representation": "summary",
      "action": "Read server/utils/feedback/schemas.ts and service.ts",
      "observed": "The external conversation field uses the structured webchat schema; the service rejects missing history."
    },
    {
      "representation": "summary",
      "action": "Read server/utils/notion/feedback-storage.ts",
      "observed": "Compression assumes conversation.messages and message.parts exist."
    }
  ],
  "unavailable": [
    "authoritative conversation and message IDs",
    "message timestamps",
    "truncated tool-result fragments",
    "complete provider-native message structures"
  ]
}
```

The old Pinia schema requires `messages` with user/assistant `role` and nonempty
`parts`. It would reject the content-based messages above and the supplied ChatGPT
example for the same reason. It would also strip useful top-level annotations.
A string or alternative message array could be equally useful but would fail too.
None of these observations establishes what every ChatGPT, Claude or Codex session
can expose. The observed capability is this coding-agent session; the ChatGPT
example in the task is supplied evidence, not an independently executed host test.

The implementation therefore asks for chronological messages, roles, content and
available tools/metadata as guidance, accepts any JSON representation, and permits
omission. Partial/reconstructed annotations are recommended, not schema fields.
Consent describes the actual submitted context. The custom webchat's server-owned
snapshot remains structured and authoritative, rather than model-reconstructed.
