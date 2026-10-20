# Dependencies

All direct dependencies use the default catalog in `pnpm-workspace.yaml` with
exact versions. Update catalog entries and regenerate `pnpm-lock.yaml` with
`corepack pnpm install`. Keep h3 on major version 1 and TypeScript on major
version 6 when updating dependencies.

## Content rendering

`@tiptap/core`, `@tiptap/starter-kit` and `@tiptap/markdown` are direct dependencies pinned to 3.24.0, matching the existing installed Tiptap family. The server uses `MarkdownManager` without constructing a browser editor. See [content documents](content-documents.md).

## MCP resources

`@modelcontextprotocol/sdk` is a direct dependency pinned to 1.32.1, matching the version already used by MCP Toolkit. It supplies the public resource-template, protocol-schema and error APIs. See [article resources](collection-resources.md).

`yaml` 2.9.1 is a direct dependency for front matter serialization, reusing the version already installed in the dependency tree.
