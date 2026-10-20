# Data access responsibilities

Directus owns record visibility and publication policy. This applies to every collection, including supporting collections, taxonomy targets, nested junction targets and polymorphic relations, at any depth.

The MCP layer must not add `status: { _eq: "published" }` filters, equivalent nested filters, publication-status validation guards, or local publication-date gates. Do not request status or release-date fields solely to enforce visibility. Search adapters likewise validate the shape of returned hits without imposing a publication policy; index visibility is an upstream responsibility.

Keep structural Zod validation, explicit field projections, user-requested domain filters, stable pagination, relation bounds and missing-target reporting. Publication dates may still be exposed as useful metadata or used for requested sorting. A record returned by the source is not rejected or omitted because of its status or publication date.

Directus permissions must be configured upstream. Collection implementation and future implementation plans follow this boundary rather than duplicating those rules in application code.

Synchronization bookkeeping (`last_sync`) is internal source metadata. Do not select or expose synchronization timestamps in collection schemas, list/get/search outputs, nested references, resource descriptors or YAML front matter. Use source update dates for public modification metadata.
