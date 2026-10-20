# Phase 3 — Implementation preparation

The [phase 2 decision](architecture.md) is implemented for shared infrastructure, with **articles still the only production collection**. New collections are test fixtures only. Follow the [grouped implementation plan](implementation-plan.md) for live rollout.

Article record tools are `list_articles`, `get_article` and `search_articles`, with matching kebab-case filenames. They accept no collection selector and have no old-name aliases. Shared discovery tools continue to select collections explicitly.

## Implemented boundaries

| Area                   | Implementation                                                                           | Contract impact                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Allowlist              | `server/collections/index.ts`, `server/utils/collection-registry.ts`                     | Explicit enabled definitions; unknown names reject before provider access; capability checks use metadata, not the existence of wrapped methods |
| Shared discovery       | Four discovery tools consume registry schemas and methods                                | Same successful envelope shapes; metadata adds operations/resources; deployed name choices reflect the allowlist                                |
| Record operations      | Existing three article tool files keep importing articles                                | Article-specific names/inputs; record shapes and resource links remain; no generic record union                                                 |
| Collection definitions | Required `id` schema and concrete operation names; optional search schemas and resources | Each collection can validate its own identity, input filters and search output independently                                                    |
| Search adapter         | Optional recordSchema, attributes, mapHit and strict filterSchema                        | Existing article defaults remain; new collections can return question/provider/area fields without pretending to be articles                    |
| Facets                 | Declared strict search keys constrain new adapters and their count results               | Search/filter discovery cannot recommend hidden provider attributes; article dynamic facet behavior remains                                     |
| List-filter discovery  | `defineCollectionFilters` accepts listTool and collectionArgument routing options        | Default article instructions/operations remain; dedicated tools can omit collection input                                                       |
| Responses              | `toolResult` packages validated output                                                   | JSON text and structuredContent remain equivalent; resource links require explicitly supplied descriptors                                       |

Discovery schemas describe metadata, not the union of every collection's records. The registry captures explicit entries; it neither scans Directus nor manufactures tool files. Collection definitions remain independently typed; shared discovery sees only the narrow metadata/filter/facet view.

Metadata `operations` identifies list/get/filters/search/facets tool names, with null for unsupported optional search/facets. `resources` lists registered URI templates and MIME types. For articles it identifies the three existing record tools and `onderwijsloket://articles/{id}`. These fields are additive; they do not turn the planned tools into implemented capabilities.

## Adding a collection

1. Resolve the group's evidence gates and define precise Zod summary/detail/ID schemas. Use the same ID schema in the detail input and record/hit outputs. Keep source normalization separate from published output schemas. Rich content, attribution, vendor restrictions and relationship completeness belong to the collection, not the registry.
2. Configure `defineMcpCollection` with `id`, `operations: {list,get,search?}`, summary/detail/filter schemas, sorts and list/get/filter implementations. Configure resources only when an actual resource entrypoint exists. Optional methods still have wrappers that throw UNSUPPORTED_OPERATION; use capabilities to decide whether an operation is supported.
3. For list discovery, call `defineCollectionFilters(name, fields, {listTool: "list_<collection>", collectionArgument: false})`. The current vocabulary covers exact text, boolean and taxonomy-array filters; extend it with an explicit descriptor variant when implementing a verified enum/relation/integer filter. Do not encode unrelated IDs as taxonomy choices or use an untyped descriptor bag.
4. If using the shared provider adapter, supply `recordSchema`, `attributes`, `mapHit` and a strict `filterSchema`. The adapter returns `searchOptions`, `searchResult`, `search` and `facets` for the collection definition. mapHit receives an untrusted hit and a `{collection,snippet}` context; its result is parsed against recordSchema before leaving the adapter. No raw provider fields are returned implicitly. Search and count filters use declared keys plus runtime countable-name checks for selections.
5. Create specific record tool files with `defineMcpTool`; export input/output raw shapes supported by the installed toolkit. Omit the collection property from a dedicated record tool's input using `collection.listInput.omit({collection:true})`, and equivalently getInput/searchInput. Its handler delegates to the validated collection method. Preserve the collection literal in output records. The three article record tools use the same pattern.
6. Use `toolResult` with already validated results. Supply no resource descriptors for a tool-only collection. A registered Markdown representation needs its own descriptor mapping when source records do not have article title/description fields; do not cast FAQ/program records to the article resource shape.
7. Add the definition to the explicit production array only when enabled operation files exist and contracts have been verified. Shared discovery updates from that array; no additional shared discovery tool is needed. Run the group-specific tests and repository checks before release.

For a collection without facets, omit its raw `facets` implementation before constructing the definition. Do not spread an adapter's facets method and then assume that a missing runtime facet list means the capability is disabled. Similarly, omit search when it is not ready. For a non-faceted collection such as sectors, use a query/page-only searchOptions schema and an appropriate search implementation; the current common adapter includes an optional filter map and must not be used unchanged if the public schema promises no filters argument.

The current default search projection describes articles. New collections must opt into their own projection/input schemas; those defaults are not a universal contract. Per-group adapters or small additional builders can be added when source evidence justifies them. No generic document/geo/media abstraction was added without a real payload to validate.

### Dedicated get-tool pattern

The following uses a previously defined collection; it is an entrypoint pattern, not a new live collection:

```ts
const input = collection.getInput.omit({ collection: true });

export default defineMcpTool({
  name: collection.operations.get,
  _meta: { "onderwijsloket.com/collection": collection.name },
  description: "Read one record using the collection's own identifier.",
  inputSchema: input.shape,
  outputSchema: collection.getOutput.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  },
  async handler({ id }) {
    return toolResult(await collection.get(id));
  }
});
```

Dedicated tool metadata declares `onderwijsloket.com/collection` for server-side analytics attribution without a redundant input selector. Tool methods return structuredContent and the JSON fallback. Public descriptions should name the domain and explain how to use the returned content; provider details remain internal. Document the actual handler's parameters and return value with JSDoc as in the article entrypoints.

## Verification and limits

`tests/fixtures/faq-collection.ts` is an intentionally synthetic question/answer domain with `faq-1` identifiers. Registry tests cover production allowlisting, mismatched response identities, unknown/prototype names, unsupported capabilities, independent schemas, strict search keys, provider projection and resource absence. `collection-mcp.test.ts` exercises actual SDK discovery and calls over InMemoryTransport, including generated input/output schemas. The existing production HTTP suite exercises the seven article tools with local Directus/Algolia fixtures and the real Nuxt endpoint.

These checks do not verify live collection policy, index settings or a deployed Workers environment. Runtime code uses the existing Zod, h3, Nitro and SDK dependencies without adding Node APIs. Live permissions, source formats, relationship bounds, media availability and geo matching remain the per-group gates documented in the plan. No new resources, live collection implementations or optional descriptor variants are implied by preparation alone.
