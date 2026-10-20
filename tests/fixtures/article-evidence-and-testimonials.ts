/** Synthetic attribution and evidence, distinct from live content and personal data. */
export const testimonialId = "550e8400-e29b-41d4-a716-446655440020";
export const author = {
  id: "author-1",
  name: "Editorial Author",
  first_name: "Editorial",
  job_title: "Editor",
  image: "author-image",
  team_member: [{ email: "private@example.test" }],
  status: "draft"
};
export const profile = {
  id: "profile-1",
  first_name: "Featured",
  last_name: "Teacher",
  path: "/media/profielen/featured",
  image: null,
  body: { type: "doc", content: [] },
  status: "archived"
};
export const evidence = {
  id: "source-1",
  title: "Original publication",
  url: "https://example.test/evidence",
  status: "draft"
};
export const document = {
  id: "document-1",
  title: "Report",
  asset: { id: "file-1", type: "application/pdf", storage: "private-metadata" },
  status: "archived"
};
export const supportingRelations = {
  sources: [{ sources_id: evidence }],
  documents: [{ documents_id: document }],
  authors: [{ authors_id: author }]
};
export const testimonialRecord = {
  id: testimonialId,
  title: "My teaching experience",
  slug: "my-teaching-experience",
  path: "/media/ervaringsverhalen/my-teaching-experience",
  description: "An individual experience",
  summary: "A teacher tells their story",
  publication_date: "2999-01-01T00:00:00",
  date_updated: null,
  status: "draft",
  sectors: [],
  audiences: [],
  phases: [],
  roles: [],
  topics: [],
  tracks: [],
  authors: [{ authors_id: author }],
  profiles: [{ profiles_id: profile }],
  body: {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "My personal story." }] },
      { type: "relation-block", attrs: { id: "advice", collection: "buttons" } }
    ]
  },
  editor_nodes: [{ id: "advice", collection: "buttons", item: { label: "Advice", to: "/advies" } }]
};
