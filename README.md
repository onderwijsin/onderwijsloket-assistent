![Stichting Onderwijs in](https://raw.githubusercontent.com/onderwijsin/.github/main/banner.png)

# Onderwijsloket Assistent

Connect AI assistants to Onderwijsloket’s knowledge about working in education.

Onderwijsloket Assistent is an experimental, read-only MCP server for finding and reading articles about qualifications, career paths, legislation and entering the education sector. It gives advisers and other users access to searchable content, structured metadata and complete Markdown documents through their MCP-compatible assistant.

## Capabilities

- **Search articles** with relevance-ranked results and snippets showing matched terms.
- **Explore by topic** using education sectors, qualifications, audiences, career phases, roles, topics and tracks.
- **Read complete articles** with taxonomy metadata, canonical source links and Markdown content.
- **Browse document resources** through an article catalogue and URI template, with YAML front matter for each document.
- **Discover the API** through collection descriptions, filter definitions and tool input/output schemas.

Access requires no authentication. All operations are read-only. The experimental label indicates that contracts and behavior can evolve.

## Connect an assistant

Add the server’s `/mcp` endpoint to an MCP-compatible client. For a local instance, use:

```text
http://localhost:3000/mcp
```

For a hosted instance, use its origin followed by `/mcp`. No API key or sign-in is required for MCP access.

### Tools

| Tool                  | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `list_collections`    | Discover collections and supported operations.                           |
| `describe_collection` | Inspect record fields, filters, sorting and pagination.                  |
| `list_records`        | Browse article summaries with exact-value and taxonomy filters.          |
| `get_record`          | Read an article’s metadata and complete Markdown content by ID.          |
| `get_filters`         | Discover list filter rules and available taxonomy IDs.                   |
| `search_collection`   | Search or browse articles with lightweight results and matched snippets. |
| `get_facets`          | Discover search filter names, values and match counts.                   |

The available collection is `articles`. Start with `list_collections`, then use the operation that fits the question.

To find articles about entering education through an alternative route, call `search_collection` with:

```json
{
  "collection": "articles",
  "query": "zij-instroom",
  "page_size": 5
}
```

Pass a returned ID to `get_record` for the complete article. For filtered search, discover values with `get_facets`. For `list_records`, use `get_filters`; its taxonomy IDs are a separate filter contract. Pagination starts at page 1, with a maximum of 25 records per page.

### Article resources

Articles are also available as Markdown resources:

```text
onderwijsloket://articles/{id}
```

Browse `resources/list` for article URIs, or follow resource links returned by record tools. Each document includes YAML metadata and its Markdown body. These URIs are MCP identifiers; use the record’s `source_url` to open or cite the original website article.

Check `content_warnings` and `truncated` before treating a document as complete. Article reads, search facets and resource catalogues are cached for five minutes. See [caching](docs/cache.md) for cache boundaries and freshness behavior.

## Run locally

Use Node.js 24 and the Corepack-managed package manager pinned in `package.json`. Configure the Varlock environment profiles in `envs/` with access to the required services and secrets provider, then run:

```sh
corepack pnpm install
corepack pnpm dev
```

Installation and builds initialize Nuxt modules and can require service credentials and schema access. See [development](docs/development.md) for environment and tooling details.

For a Node server build:

```sh
corepack pnpm build
corepack pnpm start
```

## Documentation

- [Article API](docs/articles-poc.md) — fields, filtering, pagination and response contracts.
- [Search](docs/search.md) — queries, snippets and facet semantics.
- [Article resources](docs/article-resources.md) — discovery, resource reads and document metadata.
- [Content documents](docs/content-documents.md) — hydration and Markdown rendering.
- [Caching](docs/cache.md) — centralized cache configuration.
- [Development](docs/development.md) — local setup and verification commands.
- [Tests](tests/README.md) — unit and HTTP integration coverage.

## Repository layout

| Path                    | Responsibility                                           |
| ----------------------- | -------------------------------------------------------- |
| `server/collections/`   | Collection schemas, operations and metadata.             |
| `server/mcp/tools/`     | MCP tool definitions and response adapters.              |
| `server/mcp/resources/` | Resource templates and collection bindings.              |
| `server/utils/`         | Shared content, search, taxonomy and resource utilities. |
| `config/cache.ts`       | Server cache durations in seconds.                       |
| `tests/`                | Unit tests, HTTP integration tests and service fixtures. |
