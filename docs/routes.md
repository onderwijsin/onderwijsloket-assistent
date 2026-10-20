# Education pathways

The route workflow helps people identify potential pathways from their current
education toward desired work in education. It exposes three dedicated MCP tools
and the `find-education-routes` prompt. The four main source tables (`route_questions`,
`route_answers`, `routes`, `route_steps`) and their junctions are not registered as
generic collections or resource catalogues. Existing collection tools are unchanged.

## Tool contracts

| Tool                  | Input                                                                                                     | Output                                                                                                                                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_route_questions` | Optional `selections`: question UUID to answer UUID map; defaults to `{}`.                                | Ordered questions and currently available options, enabled flags, canonical `selections`, `removed_selections`, `next_question_id`, `complete`, `retrieved_at`. |
| `find_routes`         | Complete `selections`; one-based `page` (default 1, maximum 10,000); `page_size` (default 3, maximum 25). | Matching route summaries with ordered step titles, stored durations, canonical links, pagination and `has_more`.                                                |
| `get_route`           | Route UUID `id`; no questionnaire required.                                                               | Route description and ordered steps rendered to Markdown, stored durations, article/FAQ references, source links and completeness metadata.                     |

The client carries selections between calls; no cookies or server session are
needed. Start or reset with `{}`. Ask the returned next enabled question, record
the user's confirmed option ID and resubmit the map. Use the returned canonical
map after every edit. Unknown questions, wrong-question answers, unavailable
options and choices after the first unanswered question are removed with reasons.
Earlier answered questions remain enabled for edits. All current questions must
have valid selections; their count is determined by source data, not hardcoded to four.
An empty questionnaire is an upstream error, not permission to list every route.

## Source and matching boundaries

Questions and options sort by `sort,id`. Questions, answers and answer-dependency
junctions are read in root pages advancing by actual row count until an empty
page, tolerating lower upstream page-size caps. Repeated IDs, overflow, missing
dependency targets and dependencies referring to the same or a later question
fail with sanitized `UPSTREAM_UNAVAILABLE` errors. Limits are 100 questions,
1,000 answers and 10,000 dependency rows; these are structural bounds, not partial
questionnaires. No questionnaire or match-result caching is added.

Answer prerequisites use OR within each prerequisite question and AND across
distinct questions. An answer with no prerequisites is available unconditionally.
The validated earlier-question-only graph allows a forward pass to clear dependent
selections transitively. Later choices after a gap are also cleared to enforce
sequential progression, including imported state.

`find_routes` reloads and validates the questionnaire on every call. Incomplete or
modified-invalid selections fail with `INVALID_ROUTE_SELECTIONS` before reading
routes. Matching is performed by Directus using:

```json
{
  "requires_answers": {
    "_none": {
      "route_answers_id": { "_nin": ["selected-answer-ids"] }
    }
  }
}
```

Every required route answer must be selected; extra selected answers are allowed.
Routes without requirements match only after questionnaire completion. This is
neither exact-set equality nor OR matching. Visibility at every relation depth
remains owned by Directus, as required by [data access responsibilities](data-access.md).
The historical source analysis's suggestion of local publication filters does not
apply to this server.

Results sort by stored `duration_in_months` ascending, then `id`. The ID tiebreaker
is an intentional improvement over the website's unspecified equal-duration order.
Page filling tolerates lower upstream caps and fetches one extra result for
`has_more`; there is no separate count query or ranking score. Keep selections and
page size fixed while paging. Source edits can change results between calls.

The route catalogue is never loaded in full for matching. Each call reads at most
`page_size + 1` route summaries (four for the default preview, at most 26), with
eligibility filtering, ordering and offset applied in Directus. Later pages jump
directly to their offset. Summary projections omit route descriptions, step bodies
and related article/FAQ content; those are fetched only by `get_route`. Scale tests
use more than 3,000 matching routes and assert bounded reads for preview, full and
final pages, including when the upstream caps responses at two rows.

## Route content and limitations

Timeline junctions explicitly sort by `sort,id`. Existing 100-record relation
bounds and sentinel queries apply to steps and related article/FAQ links. Missing
targets and relation truncation remain explicit. Stored overall duration is not
recomputed from returned steps, which may have unknown durations or be incomplete.
Null duration means unknown, while zero retains the stored zero-month estimate;
neither establishes personal eligibility. This deliberately avoids the website's
legacy presentation of null as immediate entry.

Route descriptions and step bodies use the existing content renderer, including
warnings for unresolved rich-content relations. No editor-node relation is exposed
by the current route-step schema, so missing embedded targets are not invented.
Article references include canonical links and IDs for `get_article`; FAQ
references include IDs and questions for `get_faq`. The workflow does not expand
every linked document automatically. `get_route` returns `NOT_FOUND` for an absent
route and can explain a route independently of whether it matches a user.

The prompt asks one question at a time, validates each confirmed answer and shows
a three-route preview before optionally paging or reading full routes. It does
not infer qualification equivalence, replace questionnaire rules with semantic
search or claim admission, professional recognition or job guarantees. Comparable
routes derived from a route's own requirements are not a separate operation;
matching uses the user's complete questionnaire instead.

Unit tests cover boolean prerequisites, transitive cleanup, invalid imports,
completion gates, subset matching, paging and detail rendering. HTTP tests verify
real SDK tool schemas, calls and prompt retrieval against synthetic source data.
Live content, upstream permissions and deployed Workers behavior still require
deployment validation. Runtime code uses no Node-only APIs or new dependencies.
