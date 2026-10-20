/** Synthetic Navigator fixtures; no production records or private contact snapshots. */
export const institutionId = "550e8400-e29b-41d4-a716-446655440030";
export const secondInstitutionId = "550e8400-e29b-41d4-a716-446655440031";
export const programId = "550e8400-e29b-41d4-a716-446655440032";
export const locationId = "550e8400-e29b-41d4-a716-446655440033";
export const formId = "550e8400-e29b-41d4-a716-446655440034";
export const trackId = "00000000-0000-0000-0000-000000000001";
export const availabilityRecord = {
  id: "550e8400-e29b-41d4-a716-446655440035",
  monday: true,
  monday_start: "22:00:00",
  monday_end: "06:00:00",
  tuesday: false,
  wednesday: false,
  thursday: false,
  friday: false,
  saturday: false,
  sunday: false,
  sunday_start: "09:00:00",
  sunday_end: "12:00:00",
  user_created: { email: "internal@example.test" }
};
export const locationRecord = {
  id: locationId,
  title: "Teaching campus",
  url: "https://example.test/campus",
  address: "Learning Street 1",
  zip: "0123 AB",
  city: "Example City",
  country: "Nederland",
  location_address: "Learning Street 1, Example City",
  location_geopoint: { type: "Point", coordinates: [4.9, 52.3] },
  vendor: "kiesmbo",
  opening_hours: availabilityRecord,
  status: "draft",
  hovi_id: "private-source-id",
  location_components: { internal: true }
};
export const institutionRecord = {
  id: institutionId,
  title: "Example university",
  slug: "example-university",
  path: "/navigator/onderwijsinstellingen/example-university",
  code: "0010",
  brin_code: "00AB",
  type: "hogeschool",
  vendor: "hovi",
  date_updated: null,
  logo: "logo-file",
  main_location: locationRecord,
  locations: [{ id: 1, sort: 1, locations_id: locationRecord }],
  description: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Institution guidance." }] }]
  },
  email: "study@example.test",
  phone: "0100000000",
  website: [
    { url: "https://example.test/nl", lang: "Nederlands" },
    { url: "https://example.test/en", lang: "Engels" }
  ],
  status: "archived",
  hovi_id: "private-source-id",
  programs: ["private-reverse-program"],
  reviewed_by: { email: "internal@example.test" }
};
export const programFormRecord = {
  id: formId,
  program_id: programId,
  sort: 1,
  url: "https://example.test/program/part-time",
  description: {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Part-time pathway." }] }]
  },
  track: { id: trackId, name: "Part-time", slug: "part-time", description: "Study alongside work" },
  vendor: "onderwijsloket"
};
export const programRecord = {
  id: programId,
  title: "Teacher training",
  slug: "teacher-training",
  path: "/navigator/opleidingen/teacher-training",
  type: "croho_program",
  level: "bachelor",
  degrees: ["Bachelor of Education"],
  financing: "government",
  credits: 240,
  croho: "00123",
  crebo: "00045",
  croho_name: "Teacher Education",
  croho_sector: "Education",
  crebo_profile: null,
  vendor: "onderwijsloket",
  date_updated: null,
  educational_institutions: [
    { id: 1, educational_institutions_id: institutionRecord },
    {
      id: 2,
      educational_institutions_id: {
        ...institutionRecord,
        id: secondInstitutionId,
        vendor: "kiesmbo",
        title: "Second provider"
      }
    }
  ],
  location: locationRecord,
  sectors: [],
  qualifications: [],
  roles: [],
  school_subjects: [],
  program_forms: [
    programFormRecord,
    {
      ...programFormRecord,
      id: "550e8400-e29b-41d4-a716-446655440036",
      sort: 2,
      track: null,
      description: {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Full-time pathway." }] }]
      }
    }
  ],
  status: "draft",
  hovi_id: "private-source-id",
  study_number: "private-study-number",
  reviewers: [{ email: "internal@example.test" }]
};
