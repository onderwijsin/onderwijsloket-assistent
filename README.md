![Stichting Onderwijs in](https://raw.githubusercontent.com/onderwijsin/.github/main/banner.png)

# Onderwijsloket Assistent

Read-only access to Onderwijsloket’s knowledge about working in education, through the Model Context Protocol (MCP).

Onderwijsloket Assistent lets AI assistants find guidance, compare education programs, explore institutions and regional advice services, and read stories and media from Onderwijsloket. It combines relevance-ranked search, structured collection records and complete Markdown resources in one discoverable interface.

## What the server provides

- **Ten core content collections** with dedicated tools for browsing, searching and reading individual records.
- **Geo-search** for programs, educational institutions and regional education desks: resolve a city, postcode or address, search within a configurable radius and return nearest-first results with location and distance metadata.
- **Filter discovery** for education sectors, qualifications, audiences, career phases, roles, topics and tracks, with collection-specific search facets and counts.
- **Structured detail records** with relevant relationships, including program forms, institution locations, regional service areas, authors, sources and podcast participants.
- **Readable resources** for every core collection, with YAML metadata, Markdown content and transcripts where available.
- **Source attribution** through canonical website links and explicit indicators for missing content or bounded relationships.
- **Self-describing contracts** with collection descriptions, input/output schemas, supported filters, sorting and pagination.

All operations are read-only. MCP access requires no API key or sign-in. Source visibility is managed by Directus; the server validates and presents the data it receives.

## Connect

Add the deployment’s `/mcp` URL to an MCP-compatible client. For a local instance:

```text
http://localhost:3000/mcp
```

The client can discover tools, browse resource catalogues and read resources by URI. Start with `list_collections` to inspect the available content, then use `describe_collection` for a collection’s detailed contract.

## Collections and tools

Each collection has a dedicated list, get and search tool. Record tools select their collection through the tool name; they do not take a `collection` argument.

| Collection               | Browse                          | Read                          | Search                            |
| ------------------------ | ------------------------------- | ----------------------------- | --------------------------------- |
| Articles                 | `list_articles`                 | `get_article`                 | `search_articles`                 |
| FAQs                     | `list_faqs`                     | `get_faq`                     | `search_faqs`                     |
| Education sectors        | `list_sectors`                  | `get_sector`                  | `search_sectors`                  |
| Testimonials             | `list_testimonials`             | `get_testimonial`             | `search_testimonials`             |
| Educational institutions | `list_educational_institutions` | `get_educational_institution` | `search_educational_institutions` |
| Programs                 | `list_programs`                 | `get_program`                 | `search_programs`                 |
| Regional education desks | `list_regional_education_desks` | `get_regional_education_desk` | `search_regional_education_desks` |
| Podcast shows            | `list_podcast_shows`            | `get_podcast_show`            | `search_podcast_shows`            |
| Podcast episodes         | `list_podcast_episodes`         | `get_podcast_episode`         | `search_podcast_episodes`         |
| Videos                   | `list_videos`                   | `get_video`                   | `search_videos`                   |

Four shared tools complete the interface:

| Tool                  | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `list_collections`    | Discover collection identities, descriptions and capabilities.     |
| `describe_collection` | Inspect a collection’s fields, operations, filters and pagination. |
| `get_filters`         | Discover source-list filter rules and available taxonomy IDs.      |
| `get_facets`          | Discover supported search filters, values and match counts.        |

Source lists and search have separate filter contracts. Use `get_filters` for list operations and `get_facets` for search operations that support facets. Sector search accepts a query without facets. Paginated record results start at page 1 and allow up to 25 records per page.

### Find and read content

For example, call `search_articles` to find guidance about an alternative route into teaching:

```json
{
  "query": "zij-instroom",
  "page_size": 5
}
```

Search results contain lightweight records and matched snippets. Pass a returned ID to `get_article` for the full record, or follow its resource link for a Markdown document. The same search-to-detail workflow applies to the other collections.

### Find nearby programs, institutions or advice services

Call `search_programs`, `search_educational_institutions` or `search_regional_education_desks`
with `location` to search geographically. For example, search programs near Utrecht:

```json
{
  "location": "Utrecht",
  "radius": 25000,
  "query": "leraar"
}
```

`radius` is optional and defaults to 50,000 metres. Keep `query` for the subject or
program name; use `location` for the geographic centre. Results sort nearest first
and include `geo` metadata with the matched coordinates, full address, applied radius
and each hit's distance in metres. Regional desk distances approximate service-area
coverage using indexed grid points. See [geographic search](docs/search.md#geographic-search)
for the contract and [geocoding](docs/geocoding.md) for Mapbox environment configuration.

## Resources and data quality

Every collection exposes a resource catalogue and a URI template:

```text
onderwijsloket://{collection}/{id}
```

Here, `collection` is a registered name such as `articles`, `programs` or `podcast_episodes`. Browse `resources/list` for concrete record URIs or use the collection’s advertised template. MCP URIs identify resources inside the client; use `source_url` to open or cite the original website page when available.

Resources include YAML front matter and a Markdown body. Records retain their native fields: FAQs have answers, programs describe forms, and media can include transcripts. When text is absent, the resource explains this with a notice; structured fields preserve the source’s null value. Check `content_warnings`, `relations_truncated` and `truncated` where present before treating content as complete.

Individual record reads share a configurable cache between tools and resources, with a five-minute default per collection. Catalogues and selected discovery data are also cached. Ordinary lists and search results remain uncached. See [resources](docs/collection-resources.md), [collection data](docs/collection-data.md) and [caching](docs/cache.md) for the full behavior.

## Run the server

Use Node.js 24, as specified in `.nvmrc`, and the Corepack-managed package manager pinned in `package.json`. Configure the Varlock environment profiles in `envs/` with access to the required services and secrets provider.

```sh
pnpm install
pnpm dev
```

For a Node server build:

```sh
pnpm build
pnpm start
```

Module initialization and schema generation can require service credentials and network access during installation and builds. See [development](docs/development.md) for environment setup and build requirements.

## Verification

The automated suite covers collection contracts, validation, search mappings, content rendering, cache behavior and the public MCP endpoint. HTTP integration tests build and run the application against local Directus and Algolia fixtures.

```sh
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
```

See the [testing guide](tests/README.md) for focused commands, fixture conventions and verification boundaries.

## Documentation

| Guide                                              | Covers                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| [Collection registry](docs/collection-registry.md) | Architecture, public contracts and responsibilities by layer.    |
| [Collection data](docs/collection-data.md)         | Domain relationships, native records and reusable projections.   |
| [Search](docs/search.md)                           | Source filters, geo-search, search indexes, snippets and facets. |
| [Resources](docs/collection-resources.md)          | Catalogues, URI templates and readable documents.                |
| [Content documents](docs/content-documents.md)     | Editor content hydration and Markdown rendering.                 |
| [Taxonomies](docs/taxonomies.md)                   | Filter identities, archive links and normalization.              |
| [Caching](docs/cache.md)                           | Cache configuration, freshness and failure behavior.             |
| [Data access](docs/data-access.md)                 | Visibility and source-system responsibilities.                   |
| [Development](docs/development.md)                 | Environment setup, checks and contributor conventions.           |
| [Tool analytics](docs/tool-analytics.md)           | Optional server-side analytics and query-data controls.          |

Maintained by [Stichting Onderwijs in](https://onderwijsin.nl) for [Onderwijsloket](https://onderwijsloket.com). Report bugs and request features through [GitHub issues](https://github.com/onderwijsin/onderwijsloket-assistent/issues).
