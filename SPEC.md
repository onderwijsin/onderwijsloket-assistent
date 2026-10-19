# Onderwijsloket Assistent — initial project specification

Status: rough draft for discussion. Research date: 19 October 2026.

## Current milestone: articles POC

The next implementation is articles-only, with exactly `list_collections`, `describe_collection`, `list_records`, `get_record`, `search_records`, `get_facets` and `get_filters`. No UI, resources, prompts or model integration are in scope at this stage. See [the articles POC guide](docs/articles-poc.md) for the implementation handoff and acceptance criteria.

The remainder describes the broader product roadmap. Its domain tools, workflows, resources and chat are deferred beyond this POC.

## 1. Purpose and positioning

Build an experimental, publicly accessible MCP server that makes Onderwijsloket data useful to AI assistants. The primary users are Onderwijsloket advisers and colleagues; external users can connect to the same public service without authentication. A small Dutch-language chat interface demonstrates the server using Nuxt UI, the AI SDK and Mistral AI.

The MCP server is the product. The chat is one client, not a prerequisite for using the data. External assistants supply their own model; ordinary MCP retrieval must not require a Mistral call or incur our inference costs.

The service must clearly identify itself as experimental in its website, server instructions and connection documentation. Advice is grounded in retrieved sources, with human review for consequential or uncertain guidance.

## 2. Scope and boundaries

### First release

- A remote, read-only MCP endpoint at `/mcp`, without login, API keys or OAuth for consumers.
- Discovery and retrieval of approved collections, relationships and shared taxonomies.
- Algolia full-text search, facets, multi-index discovery and bounded geographic search.
- A geocoding utility for Dutch place names and postcodes, once a provider is selected.
- Adviser workflows: `answer_question`, `reply_to_email` and `write_article`.
- A minimal streaming chat that calls the MCP endpoint and uses a server-side Mistral client.
- Connection instructions, source attribution, failure handling and operating limits.

“All data” means all datasets approved for anonymous redistribution. It does not mean everything a privileged upstream token can read. Cover the approved catalogue progressively; report unavailable domains explicitly rather than implying complete coverage.

Do not include sending emails, publishing articles, editing CMS data, appointment booking, internal case files, accounts, persistent conversation history, a vector database or custom model training in the first release. Email and article workflows produce drafts only. Public appointment links can be returned as information later.

## 3. Research findings

### Onderwijsloket data

The [data model overview](https://docs.onderwijsloket.com/data-model/data-model-overview) groups the API into knowledge base, navigator, media, routes, filters and system families. Content, taxonomy, metadata, block and junction collections require different treatment; exposing every underlying table as a separate model tool would make discovery unnecessarily difficult.

The [first-request guide](https://docs.onderwijsloket.com/directus/your-first-request) documents `https://content.onderwijsloket.com` as the Directus source. Records are available through `/items/{collection}` and `/items/{collection}/{id}` with field selection, relational expansion, filters and pagination. Public page paths are available on some records and should be used for attribution.

The [permissions documentation](https://docs.onderwijsloket.com/misc/permissions) distinguishes ordinary published content from additional datasets. Navigator permissions cover Onderwijsloket-owned navigator records. HOVI, KiesMBO and Scholen op de kaart datasets have separate contractual conditions. Algolia access is separately provisioned. A service credential's ability to read a dataset does not establish permission to republish it anonymously; confirm that scope before enabling each dataset.

### Search

The [index catalogue](https://docs.onderwijsloket.com/search/collections) currently lists `articles`, `faqs`, `sectors`, `videos`, `testimonials`, `podcast_episodes`, `podcast_shows`, `programs`, `educational_institutions`, `regional_education_desks` and `locations`.

Search records flatten relationships and omit some source fields. Rich content is searchable as `bodyString`; fetch Directus details when the full document or missing fields matter. Facets differ by index, so expose supported facets through the catalogue rather than accepting arbitrary filter syntax.

The [search authentication guide](https://docs.onderwijsloket.com/search/authentication) retrieves a scoped Algolia token from Directus `/users/me?fields=algolia_token`. Keep that bootstrap and token server-side. Cache it, and allow one refresh after an authorization rejection instead of retrying indefinitely. Use a dedicated search credential, never an Algolia administration key.

The [advanced search guide](https://docs.onderwijsloket.com/search/advanced-usage) explains that regional desk geo-search uses sampled points inside service areas. Such matches are approximate; they must not be presented as exact polygon containment or distance to a physical desk.

### Content documents

The [content document guide](https://docs.onderwijsloket.com/misc/content-documents) describes Tiptap JSON plus relational `editor_nodes`. Returning only text nodes can lose callouts, references and other meaningful information. The shared `server/utils/content/` pipeline now provides bounded Markdown, resolves supported relational nodes, preserves links and reports unresolved content; see [content documents](docs/content-documents.md). Avoid a full visual editor or renderer for this project.

### Research limitations

The supplied Onderwijsloket Docs connector returned `Tool search-documentation not found`. Research therefore used the public documentation, including direct HTML reads where the web reader could not fetch a page. No authenticated data requests or permission checks were performed. Exact collection schemas, live index settings, record coverage and redistribution rights remain implementation discovery work.

## 4. Proposed architecture

```text
Claude / ChatGPT / other MCP clients ───────────────┐
                                                  v
Nuxt UI → POST /api/chat → AI SDK + Mistral → /mcp
                                                  |
                                     validated domain services
                                        /        |        \
                                  Directus    Algolia    Geocoder
```

Use one Nuxt application with Nitro server handlers. Keep collection contracts, Directus queries and normalization together; MCP tools are thin validated adapters. Keep Node server and Cloudflare Workers compatibility, using fetch-compatible libraries and no dependence on local files or process memory for correctness.

Proposed layout:

```text
app/pages/index.vue             Simple chat and connection information
server/api/chat.post.ts         Validated streaming Mistral orchestration
server/mcp/tools/               Discovery, retrieval, search and geo tools
server/mcp/resources/           Catalogue, usage guidance and workflow text
server/mcp/prompts/             Adviser prompt templates
server/collections/             Collection contracts, Directus queries and normalization
server/utils/                   Shared collection definition helper
shared/                         Public schemas and response types
```

The chat should consume `/mcp` through an AI SDK MCP client so it exercises the same public contract as other assistants. Fix its MCP URL in trusted server configuration; never accept a user-supplied server URL. Verify same-deployment HTTP calls and streaming on the selected host before release. Close request-scoped clients after streams finish, fail or are cancelled.

Start stateless. Do not introduce MCP session persistence unless a demonstrated client requirement calls for it.

## 5. Stack and dependency plan

The following versions are declared in the existing workspace catalogue, not a recommendation to upgrade:

| Component                           | Declared version | Purpose                                          |
| ----------------------------------- | ---------------- | ------------------------------------------------ |
| Nuxt                                | 4.6.2            | Application and Nitro runtime                    |
| Nuxt UI                             | 4.12.0           | Chat components and accessible interface         |
| `@nuxtjs/mcp-toolkit`               | 0.24.2           | MCP tools, resources, prompts and HTTP handler   |
| `ai`                                | 7.0.143          | Streaming and bounded model/tool orchestration   |
| `@ai-sdk/mistral`                   | 4.0.66           | Direct Mistral provider                          |
| `algoliasearch`                     | ^5.60.0          | Search client; prefer the search-only entrypoint |
| `@onderwijsin/nuxt-directus-client` | 0.12.4           | Typed server access and normalized errors        |
| `@onderwijsin/nuxt-directus-config` | 0.9.0            | Existing shared Directus configuration           |
| Zod                                 | 4.6.7            | Boundary validation and tool schemas             |

The project already registers the MCP, UI and Directus modules, but has no `server/` implementation. Do not treat module registration as an implemented feature.

The repository now declares `@ai-sdk/vue` and `@ai-sdk/mcp` for future chat integration. They are not needed for the articles POC. Verify installed compatibility when implementing chat and reuse existing Comark support for streamed Markdown.

Use [MCP Toolkit](https://mcp-toolkit.nuxt.dev) conventions: `defineMcpTool`, `defineMcpResource`, `defineMcpPrompt` and a single default handler. Verify transport and async-context configuration against the installed release.

Use the [AI SDK MCP adapter](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools), its bounded agent/tool loop, and the [Mistral provider](https://ai-sdk.dev/providers/ai-sdk-providers/mistral). Select a tool-capable model through server configuration after a small Dutch-language evaluation; do not hardcode a moving model alias in the specification.

Use [Nuxt UI chat components](https://ui.nuxt.com/docs/components/chat-messages) for messages and input. Follow the installed AI SDK 7 Vue documentation rather than examples for older SDK versions.

Use the [Directus client server helper](https://github.com/onderwijsin/nuxt-modules/tree/main/modules/directus-client) for source requests and generated schema types where available. Reuse the configured Directus client and generated types.

Use the [Algolia JavaScript client](https://www.algolia.com/doc/libraries/sdk/install) for query operations only. Exact index names, available facets and permitted vendors belong in server configuration, not caller-controlled identifiers.

## 6. MCP interface

### Discovery and granularity

Start with a small set of domain-oriented tools and an explicit collection registry. The registry maps collection identifiers to field projections, filter schemas, sort options, relationships, search indexes and attribution rules. Unknown collections are rejected. Adding an upstream collection must not publish it automatically.

Proposed names and inputs below are provisional until the first contract review:

| Tool                            | Main inputs                                                    | Result                                                           |
| ------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| `list_domains`                  | None                                                           | Supported domains, collections and availability                  |
| `describe_collection`           | Approved collection                                            | Public fields, filters, relationships and search capabilities    |
| `list_records`                  | Collection, typed filters, page, page size, allowed sort       | Bounded record summaries                                         |
| `get_record`                    | Collection, ID, optional supported section                     | Normalized detail and related references                         |
| `search_content`                | Query, optional content types and typed facets                 | Ranked content hits and citations                                |
| `search_programs`               | Query, supported programme facets, optional coordinates/radius | Programmes and relevant location information                     |
| `find_regional_education_desks` | Coordinates, radius, optional sector                           | Candidate desks with approximate service-area matching explained |
| `get_facets`                    | Approved search domain, optional query/filters                 | Supported facet values and counts                                |
| `geocode_location`              | Place/postcode, optional country defaulting to NL              | Candidate coordinates and display labels                         |
| `get_workflow`                  | Workflow name                                                  | Portable adviser instructions for clients without prompt support |

Expose institution and location reads through the collection tools initially. Add dedicated tools only where they make a common task materially easier. Add explicit route discovery/matching only after reviewing actual route relationships and eligibility semantics; a list of routes must not be mistaken for a validated eligibility engine.

Initial catalogue priorities:

1. Knowledge base: articles, FAQs, sectors and relevant shared taxonomies.
2. Navigator: approved programmes, institutions, regional desks, locations and supporting areas.
3. Media: public stories, videos and podcasts, with clear separation of personal experience from factual guidance.
4. Routes and remaining approved collections after schema and policy review.

Supporting blocks and junctions should normally be resolved inside detail responses rather than appear as standalone tools. Track every upstream collection as exposed, resolved indirectly, deferred or excluded with a reason.

### Response contract

- Validate inputs and normalized outputs with Zod. Generated upstream TypeScript types do not provide runtime validation.
- Summaries include collection, stable ID, title/question, short excerpt and source URL where available.
- Details include readable content, relevant relationships, upstream update date when present, and retrieval time.
- Preserve upstream paths when building canonical links. Do not invent public URLs for records without a known route; return an explicit source reference instead.
- Lists expose pagination, whether more results exist, and any truncation or partial failures. Multi-index ranking must be explicit; preserve per-index groups initially rather than inventing a shared relevance score.
- Prefer MCP `structuredContent` with an output schema plus a concise text fallback for clients that use text results.
- Return safe error codes such as `INVALID_INPUT`, `NOT_FOUND`, `DATASET_UNAVAILABLE`, `RATE_LIMITED` and `UPSTREAM_UNAVAILABLE`, with retry information where appropriate. Never turn an upstream failure into an empty successful result.
- Annotate read tools accurately with `readOnlyHint`, `destructiveHint` and `idempotentHint`; annotations supplement enforced restrictions.

Provisional limits: 10 records by default, 25 maximum per page, 500 characters per search query, 20,000 characters per detail response, bounded relationship depth and a 10-second upstream timeout. Tune from real records; large documents need section retrieval with explicit truncation, not silent loss. Clamp geo radii and validate coordinate ranges and units.

### Resources and transport

Publish a small catalogue resource, source/usage guidance and workflow resources. Resource templates may expose approved individual records. Tools must remain sufficient for clients that do not surface resources.

Serve remote MCP over HTTPS using Streamable HTTP. Test initialization, capability negotiation, tools, resources, prompts, JSON and any required SSE responses. Add legacy transport only for a verified target-client need. Configure Origin handling and browser CORS deliberately without blocking legitimate server-to-server clients lacking an Origin header.

## 7. Adviser workflows (“skills”)

Implement reusable instruction templates as MCP prompts, backed by readable workflow resources and `get_workflow`. They do not execute inference themselves. The caller's assistant retrieves evidence and produces the draft. The built-in chat offers matching workflow shortcuts and explicitly incorporates the chosen instructions.

| Workflow          | Inputs                                    | Expected output                                                     |
| ----------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `answer_question` | Question, optional background             | Direct answer, sources, uncertainty and practical next steps        |
| `reply_to_email`  | Pasted email, optional context and tone   | Dutch reply draft, sources and adviser review notes kept separate   |
| `write_article`   | Topic, audience, purpose, optional length | Outline or article draft, source list and gaps needing verification |

All workflows should search first, read relevant source details, distinguish sourced facts from inference, avoid invented admission/qualification guarantees, and recommend personal advice where the evidence is insufficient. Treat retrieved content and pasted emails as untrusted data, not instructions that can override the workflow.

MCP prompts are not a universal installable skill format and are not automatically invoked by every client. Document invocation and the tool fallback. Consider downloadable client-specific skill packages later if needed. Do not advertise native prompt support or plugin-directory distribution until tested.

## 8. Minimal chat experience

One responsive page with an experimental label, Dutch introduction, a few example questions, message history for the current session, a text input, submit/stop controls and a new-conversation action. Show tool activity without exposing secrets, readable sources, and clear upstream/rate-limit errors. Allow copying a response or draft.

Use `POST /api/chat` with validated message roles, shapes, counts and total size. Server-owned instructions, model selection and tool allowlists cannot be overridden by the submitted conversation. Bound output tokens, total tool steps, tool calls and request duration; propagate cancellation to upstream work.

Keep chat history in memory for the first release. Do not persist email contents or conversations by default. Explain that chat content is processed by Mistral, while external clients apply their own model provider's handling. Avoid asking for personal data unless necessary for the question.

MCP access remains anonymous. Apply separate per-client and global cost controls to the inference endpoint, including a global daily budget and a clear disabled state when exhausted. A UI-only limit is insufficient. The MCP retrieval service must remain available if chat inference is disabled.

## 9. Public access and operations

- Keep Directus, Algolia and Mistral credentials server-only. Use a least-privilege runtime credential and a separate build-time schema credential if required.
- Reject arbitrary Directus queries, raw Algolia filters, unlimited exports and caller-supplied upstream URLs. Bound multi-search fan-out as well as individual result counts.
- Rate-limit MCP and chat separately, with shared limits across instances and global upstream budgets. Account for shared IPs used by hosted assistants; per-IP limits are a starting point, not user identity.
- Cache only approved public data with bounded TTLs and documented invalidation. Never publicly cache chat responses, pasted emails or credential-bearing responses. Cache keys include normalized filters and policy/version context.
- On provider failure, return an explicit error or clearly identified stale public data within a defined stale window. Record retrieval time separately from content update time; search indexing can lag Directus.
- Log tool names, durations, outcomes, cache hits and aggregate usage. Redact secrets and avoid raw questions, precise addresses, email contents and full tool payloads by default.
- Monitor upstream availability, schema drift, error rates, latency, search usage and inference spending. Provide independent chat and tool/domain kill switches.

Experimental positioning permits iteration; it does not reduce these public exposure requirements. Keep tool names stable where practical and document schema changes and removals.

## 10. External assistant integration

Publish the HTTPS endpoint, anonymous connection instructions, supported capabilities, example tasks, data coverage and known limits. Test a real Claude connection and a real ChatGPT connection using their available remote MCP integration paths. Record product/account prerequisites and the tested date.

A working MCP endpoint does not itself guarantee listing in a plugin/app directory, acceptance by a platform, or support across all plans and clients. Keep platform packaging and directory submission separate from the core server. Standard MCP tools are the first compatibility target; prompts, resources and richer app UI are supplementary.

## 11. Delivery outline and acceptance criteria

### A. Confirm sources and publish the first retrieval tools

Inventory collections, fields, relationships, index settings and vendor rights. Create the public registry and a coverage table. Implement catalogue, list and detail tools for knowledge-base content, with source links and bounded rich-content resolution.

Acceptance: an independent MCP client can discover tools and retrieve a published article with its FAQ relationships. Unknown collections are rejected and record outputs match their declared contracts.

### B. Add search and navigator coverage

Implement indexed discovery, facets, canonical detail lookup, approved navigator data and geographic utilities. Select a geocoder after checking Dutch postcode coverage, usage terms, attribution, quotas, cost and deployment compatibility. Return ambiguous geocoding candidates rather than guessing.

Acceptance: find sources about zij-instroom; filter programmes by supported attributes; resolve Utrecht and find candidate regional desks. Results explain approximation, preserve pagination and distinguish no results from provider failure. Search coverage matches the approved data policy.

### C. Add adviser workflows and simple Mistral chat

Expose the three prompts and their fallback tools/resources. Add the streaming UI and fixed-endpoint MCP client, configure the model, and enforce inference limits.

Acceptance: draft an email reply and a short article using retrieved sources without sending or publishing anything. Stop/reset work; cancellation cleans up clients; a failed tool call yields an honest user-facing outcome. Chat is usable on mobile and with a keyboard.

### D. Prepare the experimental public release

Test target clients, deployed HTTPS transport and runtime compatibility. Document connection steps, coverage, limitations and operating procedures. Establish shared rate limits, budgets, monitoring and kill switches.

Acceptance: external clients work without our credentials; secrets and excluded data never appear in outputs or public proxies; inference exhaustion leaves retrieval operational. Complete a representative Dutch adviser evaluation covering correct retrieval, citations, ambiguity, unsupported claims and unavailable sources.

Verification should protect real risks: exposure through nested relations/proxies, malformed inputs, pagination, content resolution, approximate geo semantics, token-refresh failure, streaming cancellation and source attribution. Use repository formatting, lint and type checks; choose test tooling during implementation rather than adding dependencies for this draft.

## 12. Open decisions before implementation

1. Which datasets and vendors are approved for anonymous redistribution, and which fields must be excluded?
2. What deployment host, public hostname, shared rate-limit/cache backend and operating budget should be used?
3. Which Mistral model offers acceptable Dutch guidance, tool reliability, latency and cost on representative adviser tasks?
4. Which geocoder meets Dutch coverage and reuse requirements?
5. How should exact regional eligibility be established if approximate service-area search is insufficient?
6. What are the desired scope and eligibility semantics for route tools beyond retrieval?

These decisions do not block drafting the architecture. Data rights, deployment controls and a tested model choice must be resolved before public release.
