# Server services

Reserved for Directus reads, Algolia search/token handling and article normalization. Reuse the existing Directus module and configuration; do not create a second client abstraction without a concrete need.

Keep credentials and provider-specific response shapes server-side. Apply approved field, publication and relationship policies to every read. Normalize records, citations, pagination and safe errors consistently across tools.

No geocoding, model orchestration or chat services are needed for the articles POC. See [the POC guide](../../docs/articles-poc.md).
