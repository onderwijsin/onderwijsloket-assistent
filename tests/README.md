# Verification

Run `corepack pnpm test:unit` for query translation, taxonomy metadata, dynamic filter discovery, input validation and bounded content rendering. Directus responses use synthetic fixtures.

Taxonomy cache tests use Nitro’s actual cache implementation with isolated in-memory storage to verify reuse, 60-second expiry and failed-request retries.

Run `corepack pnpm test:e2e` for production-build MCP discovery and catalogue calls. Live upstream reads are checked separately using the configured credentials.
