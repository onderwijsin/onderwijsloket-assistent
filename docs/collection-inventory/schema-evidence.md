# Generated schema evidence

Inspected 2026-10-20. Selected interfaces from `.nuxt/types/directus-schema.d.ts`, stripped of field comments only. These are upstream TypeScript shapes, **not public MCP output schemas**. They retain optionality, exact enums and object-or-ID relations. The source file SHA-256 at inspection was `7c37f8cd3e2c53949ac4a760479f1f737ff41b783353cba7d145834659260ea4`. Referenced types not expanded here remain in the original generated file.

## Article

```ts
interface Article {
  body?: JSON | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  path: string;
  reviewed_at?: string | null;
  reviewed_by?: DirectusUser | string | null;
  seo?: ExtensionSeoMetadata | null;
  slug: string;
  status: "published" | "draft" | "archived";
  summary: string;
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  next_review_at?: string | null;
  english?: boolean | null;
  editor_nodes?: ArticlesEditorNode[] | string[];
  sectors?: ArticlesSector[] | string[];
  audiences?: ArticlesAudience[] | string[];
  authors?: ArticlesAuthor[] | string[];
  documents?: ArticlesDocument[] | string[];
  faqs?: ArticlesFaq[] | string[];
  phases?: ArticlesPhase[] | string[];
  qualifications?: ArticlesQualification[] | string[];
  roles?: ArticlesRole[] | string[];
  sources?: ArticlesSource[] | string[];
  topics?: ArticlesTopic[] | string[];
  tracks?: ArticlesTrack[] | string[];
  reviewers?: ArticlesDirectusUser[] | string[];
}
```

## Sector

```ts
interface Sector {
  code: string;
  title: string;
  alt_names?: string[] | null;
  description: string;
  icon?: string | null;
  id: string;
  slug: string;
  sort?: number | null;
  status: "published" | "draft" | "archived";
  costs_actions?: Array<{ label: string; link: string; internal: boolean }> | null;
  costs_content?: string | null;
  introduction?: string | null;
  roles_content?: string | null;
  routes_content?: string | null;
  salary_cards?: Array<{
    title: string;
    description: string;
    link: string;
    link_label: string;
    link_internal: boolean;
    icon: string;
  }> | null;
  salary_content?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  seo?: ExtensionSeoMetadata | null;
  faqs?: FaqsSector[] | string[];
  featured_articles?: SectorsArticle[] | string[];
  featured_faqs?: SectorsFaq[] | string[];
  articles?: ArticlesSector[] | string[];
  podcast_episodes?: PodcastEpisodesSector[] | string[];
  podcast_shows?: PodcastShowsSector[] | string[];
  programs?: ProgramsSector[] | string[];
  testimonials?: TestimonialsSector[] | string[];
  videos?: VideosSector[] | string[];
  featured_media?: SectorsFeaturedMedia[] | string[];
}
```

## Faq

```ts
interface Faq {
  answer: JSON;
  date_created?: string | null;
  date_updated?: string | null;
  id: string;
  question: string;
  reviewed_at?: string | null;
  reviewed_by?: DirectusUser | string | null;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  next_review_at?: string | null;
  english?: boolean | null;
  phases?: FaqsPhase[] | string[];
  reviewers?: FaqsDirectusUser[] | string[];
  audiences?: FaqsAudience[] | string[];
  sectors?: FaqsSector[] | string[];
  topics: FaqsTopic[] | string[];
  articles?: ArticlesFaq[] | string[];
}
```

## Program

```ts
interface Program {
  crebo?: string | null;
  crebo_profile?: string | null;
  credits?: number | null;
  croho?: string | null;
  croho_name?: string | null;
  croho_sector?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  degrees?: Array<
    | "mbo_1"
    | "mbo_2"
    | "mbo_3"
    | "mbo_4"
    | "ba"
    | "bsc"
    | "llb"
    | "ba_bsc"
    | "llm"
    | "mphil"
    | "mpm"
    | "mre"
    | "msc"
    | "agaag"
    | "e_ma"
    | "emfc"
    | "ma"
    | "march"
    | "mba"
    | "mbi"
    | "mcc"
    | "m_des"
    | "m_eng"
    | "mfc"
    | "mfp"
    | "mii"
    | "mla"
    | "mfa"
    | "m_health"
    | "m_anp"
    | "mmus"
    | "mped"
    | "mpa"
    | "mph"
    | "m_urb"
    | "miph"
    | "aa"
    | "ad_ba"
    | "ad_eng"
    | "an"
    | "b"
    | "b_anp"
    | "bas"
    | "bba"
    | "b_be"
    | "b_com"
    | "bcomn"
    | "bda"
    | "bdes"
    | "b_ec"
    | "b_ed"
    | "b_eng"
    | "b_es"
    | "bfa"
    | "bft"
    | "bhs"
    | "bhrm"
    | "b_ict"
    | "bj"
    | "bma"
    | "bn"
    | "bpm"
    | "b_sw"
    | "bta"
    | "bth"
    | "b_mus"
    | "b_mus_ed"
    | "b_health"
    | "b_nursing"
    | "b_cmd"
    | "b_midwifery"
    | "b_mo"
    | "m"
    | "ad"
    | "m_ed"
    | "m_sw"
    | "ma_msc"
  > | null;
  financing?: "government" | "private" | null;
  hovi_id?: string | null;
  id: string;
  kiesmbo_id?: string | null;
  level: "mbo" | "bachelor" | "master" | "phd" | `post-graduate` | "preparatory";
  location?: Location | string | null;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  study_number?: string | null;
  title: string;
  type:
    | "crebo_program"
    | "croho_program"
    | "zib"
    | "minor"
    | "specialization"
    | "course"
    | "short_variant"
    | "premaster"
    | "elective_course"
    | "exchange_program"
    | "double_degree"
    | "graduation"
    | "honours_track"
    | "joint_degree"
    | "content_variant"
    | "language_variant";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  vendor: "onderwijsloket" | "hovi" | "kiesmbo";
  has_pending_changes?: boolean | null;
  next_review_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: DirectusUser | string | null;
  educational_institutions?: EducationalInstitutionsProgram[] | string[];
  qualifications?: ProgramsQualification[] | string[];
  roles?: ProgramsRole[] | string[];
  sectors?: ProgramsSector[] | string[];
  program_forms?: ProgramForm[] | string[];
  reviewers?: ProgramsDirectusUser[] | string[];
  school_subjects?: ProgramsSchoolSubject[] | string[];
}
```

## RegionalEducationDesk

```ts
interface RegionalEducationDesk {
  appointment_for_visit: boolean;
  area: Area | string;
  cities_municipalities?: string | null;
  consultation_service_description?: JSON | null;
  consultation_service_url?: string | null;
  content_types?: Array<
    `video's` | "podcasts" | "ervaringen" | "blogs" | "nieuws" | "kennisartikelen"
  > | null;
  content_via_onderwijsloket: boolean;
  date_created?: string | null;
  date_updated?: string | null;
  description?: JSON | null;
  email?: string | null;
  email_response_time?: `1 werkdag` | `2 werkdagen` | `1 werkweek` | `Zo snel mogelijk` | null;
  has_consultation_service: boolean;
  has_physical_location: boolean;
  id: string;
  location?: Location | string | null;
  logo?: DirectusFile | string | null;
  next_review_at?: string | null;
  notes?: JSON | null;
  orientation_activity_types?: Array<
    | "webinars"
    | "informatiebijeenkomsten"
    | `meeloopdagen op school`
    | `open dagen (universiteit)`
    | `open dagen (school)`
  > | null;
  path: string;
  phone?: string | null;
  phone_availability?: Availability | string | null;
  privacy_policy?: string | null;
  regions?: string[] | null;
  reviewed_at?: string | null;
  reviewed_by?: DirectusUser | string | null;
  service_links?: Array<{
    url: string;
    type: `oriëntatie` | "matching" | "vacatures" | `zij-instroom`;
    domain: string;
  }> | null;
  slug: string;
  status: "published" | "draft" | "archived";
  title: string;
  use_onderwijsloket: boolean;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  website?: string | null;
  reviewers?: RegionalEducationDesksDirectusUser[] | string[];
  sectors: RegionalEducationDesksSector[] | string[];
}
```

## EducationalInstitution

```ts
interface EducationalInstitution {
  brin_code?: string | null;
  code: string;
  date_created?: string | null;
  date_updated?: string | null;
  description?: JSON | null;
  email?: string | null;
  hovi_id?: string | null;
  id: string;
  kiesmbo_id?: string | null;
  logo?: DirectusFile | string | null;
  main_location?: Location | string | null;
  path: string;
  phone?: string | null;
  slug: string;
  status: "published" | "draft" | "archived";
  title: string;
  type:
    | "mbo"
    | "hogeschool"
    | "universiteit"
    | "onderzoeksuniversiteit"
    | `internationaal onderwijs`;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  vendor: "onderwijsloket" | "hovi" | "kiesmbo";
  website?: Array<{ url: string; lang: "Nederlands" | "Engels" | "Overig" }> | null;
  has_pending_changes?: boolean | null;
  next_review_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: DirectusUser | string | null;
  locations?: EducationalInstitutionsLocation[] | string[];
  programs?: EducationalInstitutionsProgram[] | string[];
  reviewers?: EducationalInstitutionsDirectusUser[] | string[];
}
```

## Testimonial

```ts
interface Testimonial {
  body?: JSON | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  path: string;
  seo?: ExtensionSeoMetadata | null;
  slug: string;
  status: "published" | "draft" | "archived";
  summary: string;
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  publication_date?: string | null;
  audiences?: TestimonialsAudience[] | string[];
  phases?: TestimonialsPhase[] | string[];
  roles?: TestimonialsRole[] | string[];
  sectors?: TestimonialsSector[] | string[];
  topics?: TestimonialsTopic[] | string[];
  tracks?: TestimonialsTrack[] | string[];
  editor_nodes?: TestimonialsEditorNode[] | string[];
  authors?: TestimonialsAuthor[] | string[];
  profiles?: TestimonialsProfile[] | string[];
}
```

## PodcastEpisode

```ts
interface PodcastEpisode {
  audio?: JSON | null;
  body?: JSON | null;
  date_created?: string | null;
  date_updated?: string | null;
  duration: number;
  episode_number: number;
  external_urls?: Array<{
    name: "spotify" | "apple_podcasts" | "castbox" | "pocket_casts" | "podimo";
    url: string;
  }> | null;
  id: string;
  path: string;
  publication_date?: string | null;
  season: Season | string;
  show: PodcastShow | string;
  slug: string;
  speaker_map?: Array<{ speaker: number; name: string }> | null;
  status: "published" | "draft" | "archived";
  title: string;
  transcript_raw?: Record<string, unknown> | null;
  transcript_string?: string | null;
  transcript_string_with_speakers?: string | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  topics?: PodcastEpisodesTopic[] | string[];
  tracks?: PodcastEpisodesTrack[] | string[];
  audiences?: PodcastEpisodesAudience[] | string[];
  phases?: PodcastEpisodesPhase[] | string[];
  roles?: PodcastEpisodesRole[] | string[];
  sectors?: PodcastEpisodesSector[] | string[];
  guests?: PodcastEpisodesProfile[] | string[];
  hosts?: PodcastEpisodesPodcastHost[] | string[];
}
```

## PodcastShow

```ts
interface PodcastShow {
  artwork?: DirectusFile | string | null;
  creator_name: string;
  date_created?: string | null;
  date_updated?: string | null;
  description: JSON;
  external_urls?: Array<{
    name: "spotify" | "apple_podcasts" | "castbox" | "pocket_casts" | "podimo";
    url: string;
  }> | null;
  header_image?: DirectusFile | string | null;
  id: string;
  path: string;
  podcast_status: "ongoing" | "ended" | "planned";
  slug: string;
  status: "published" | "draft" | "archived";
  title: string;
  trailer?: JSON | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  tagline: string;
  audiences?: PodcastShowsAudience[] | string[];
  episodes?: PodcastEpisode[] | string[];
  hosts: PodcastShowsPodcastHost[] | string[];
  phases?: PodcastShowsPhase[] | string[];
  seasons?: Season[] | string[];
  sectors?: PodcastShowsSector[] | string[];
}
```

## Source

```ts
interface Source {
  date_created?: string | null;
  date_updated?: string | null;
  description?: string | null;
  id: string;
  status: "published" | "draft" | "archived";
  title: string;
  url: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  articles?: ArticlesSource[] | string[];
}
```

## Document

```ts
interface Document {
  asset: DirectusFile | string;
  date_created?: string | null;
  date_updated?: string | null;
  description?: string | null;
  id: string;
  status: "published" | "draft" | "archived";
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  articles?: ArticlesDocument[] | string[];
  news_items?: NewsDocument[] | string[];
}
```

## Author

```ts
interface Author {
  date_created?: string | null;
  date_updated?: string | null;
  first_name: string;
  id: string;
  image?: DirectusFile | string | null;
  job_title?: string | null;
  name: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  team_member?: TeamMember[] | string[];
  articles?: ArticlesAuthor[] | string[];
  news_items?: NewsAuthor[] | string[];
  testimonials?: TestimonialsAuthor[] | string[];
}
```

## PodcastHost

```ts
interface PodcastHost {
  date_created?: string | null;
  date_updated?: string | null;
  description?: string | null;
  email?: string | null;
  first_name: string;
  id: string;
  image?: DirectusFile | string | null;
  last_name?: string | null;
  linkedin?: string | null;
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  episodes?: PodcastEpisodesPodcastHost[] | string[];
  podcast_shows?: PodcastShowsPodcastHost[] | string[];
}
```

## Profile

```ts
interface Profile {
  body?: JSON | null;
  date_created?: string | null;
  date_updated?: string | null;
  first_name: string;
  id: string;
  image?: DirectusFile | string | null;
  last_name?: string | null;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  video_avatar?: JSON | null;
  podcast_episodes?: PodcastEpisodesProfile[] | string[];
  roles?: ProfilesRole[] | string[];
  sectors?: ProfilesSector[] | string[];
  testimonials?: TestimonialsProfile[] | string[];
  videos?: VideosProfile[] | string[];
}
```

## Area

```ts
interface Area {
  area_bounds?: string | null;
  area_center?: string | null;
  area_inner?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  id: string;
  status: "published" | "draft" | "archived";
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
}
```

## Location

```ts
interface Location {
  address?: string | null;
  brinvest?: string | null;
  city?: string | null;
  country?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  hovi_id?: string | null;
  id: string;
  location_address?: string | null;
  location_components?: JSON | null;
  location_geopoint?: string | null;
  opening_hours?: Availability | string | null;
  organization_hovi_id?: string | null;
  organization_kiesmbo_id?: string | null;
  status: "published" | "draft" | "archived";
  title?: string | null;
  url?: string | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  vendor: "hovi" | "kiesmbo" | "onderwijsloket";
  vestiging_SK123_id?: string | null;
  zip?: string | null;
  has_pending_changes?: boolean | null;
  educational_institutions?: EducationalInstitutionsLocation[] | string[];
  programs?: Program[] | string[];
  regional_education_desks?: RegionalEducationDesk[] | string[];
}
```

## Availability

```ts
interface Availability {
  date_created?: string | null;
  date_updated?: string | null;
  friday: boolean;
  friday_end?: string | null;
  friday_start?: string | null;
  id: string;
  monday: boolean;
  monday_end?: string | null;
  monday_start?: string | null;
  saturday: boolean;
  saturday_end?: string | null;
  saturday_start?: string | null;
  sunday: boolean;
  sunday_end?: string | null;
  sunday_start?: string | null;
  thursday: boolean;
  thursday_end?: string | null;
  thursday_start?: string | null;
  tuesday: boolean;
  tuesday_end?: string | null;
  tuesday_start?: string | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  wednesday: boolean;
  wednesday_end?: string | null;
  wednesday_start?: string | null;
}
```

## ProgramForm

```ts
interface ProgramForm {
  date_created?: string | null;
  date_updated?: string | null;
  description?: JSON | null;
  id: string;
  program_id?: Program | string | null;
  sort?: number | null;
  url?: string | null;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  vendor: "onderwijsloket" | "hovi" | "kiesmbo";
  track?: Track | string | null;
}
```

## Season

```ts
interface Season {
  date_created?: string | null;
  date_updated?: string | null;
  id: string;
  season_number: number;
  show: PodcastShow | string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  year: number;
  episodes?: PodcastEpisode[] | string[];
}
```

## Topic

```ts
interface Topic {
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  icon?: string | null;
  image?: DirectusFile | string | null;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  alt_names?: string[] | null;
  name: string;
  path: string;
  slug: string;
  id: string;
  articles?: ArticlesTopic[] | string[];
  faqs?: FaqsTopic[] | string[];
  themas?: ThemasTopic[] | string[];
  podcast_episodes?: PodcastEpisodesTopic[] | string[];
  testimonials?: TestimonialsTopic[] | string[];
  videos?: VideosTopic[] | string[];
}
```

## Qualification

```ts
interface Qualification {
  alt_names?: string[] | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  name: string;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  sectors?: QualificationsSector[] | string[];
  articles?: ArticlesQualification[] | string[];
}
```

## Role

```ts
interface Role {
  alt_names?: string[] | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  name: string;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  sectors: RolesSector[] | string[];
  articles?: ArticlesRole[] | string[];
  podcast_episodes?: PodcastEpisodesRole[] | string[];
  programs?: ProgramsRole[] | string[];
  testimonials?: TestimonialsRole[] | string[];
  videos?: VideosRole[] | string[];
}
```

## Track

```ts
interface Track {
  alt_names?: string[] | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  name: string;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  articles?: ArticlesTrack[] | string[];
  podcast_episodes?: PodcastEpisodesTrack[] | string[];
  testimonials?: TestimonialsTrack[] | string[];
  videos?: VideosTrack[] | string[];
}
```

## SchoolSubject

```ts
interface SchoolSubject {
  alt_names?: string[] | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  name: string;
  path: string;
  slug: string;
  status: "published" | "draft" | "archived";
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  programs?: ProgramsSchoolSubject[] | string[];
}
```

## Phase

```ts
interface Phase {
  code: string;
  color?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  description: string;
  id: string;
  quote: string;
  sort?: number | null;
  status: "published" | "draft" | "archived";
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  articles?: ArticlesPhase[] | string[];
  podcast_episodes?: PodcastEpisodesPhase[] | string[];
  podcast_shows?: PodcastShowsPhase[] | string[];
  testimonials?: TestimonialsPhase[] | string[];
  videos?: VideosPhase[] | string[];
}
```

## Audience

```ts
interface Audience {
  alt_names?: string[] | null;
  color?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
  id: string;
  sort: number;
  status: "published" | "draft" | "archived";
  title: string;
  user_created?: DirectusUser | string | null;
  user_updated?: DirectusUser | string | null;
  articles?: ArticlesAudience[] | string[];
  podcast_episodes?: PodcastEpisodesAudience[] | string[];
  podcast_shows?: PodcastShowsAudience[] | string[];
  testimonials?: TestimonialsAudience[] | string[];
  videos?: VideosAudience[] | string[];
}
```

## ArticlesFaq

```ts
interface ArticlesFaq {
  articles_id?: Article | string | null;
  faqs_id?: Faq | string | null;
  id: number;
}
```

## ArticlesAuthor

```ts
interface ArticlesAuthor {
  articles_id?: Article | string | null;
  authors_id?: Author | string | null;
  id: number;
}
```

## ArticlesDocument

```ts
interface ArticlesDocument {
  articles_id?: Article | string | null;
  documents_id?: Document | string | null;
  id: number;
}
```

## ArticlesSource

```ts
interface ArticlesSource {
  articles_id?: Article | string | null;
  id: number;
  sources_id?: Source | string | null;
}
```

## EducationalInstitutionsLocation

```ts
interface EducationalInstitutionsLocation {
  educational_institutions_id?: EducationalInstitution | string | null;
  id: number;
  locations_id?: Location | string | null;
  sort?: number | null;
}
```

## EducationalInstitutionsProgram

```ts
interface EducationalInstitutionsProgram {
  educational_institutions_id?: EducationalInstitution | string | null;
  id: number;
  programs_id?: Program | string | null;
  sort?: number | null;
}
```

## SectorsArticle

```ts
interface SectorsArticle {
  articles_id?: Article | string | null;
  id: number;
  sectors_id?: Sector | string | null;
}
```

## SectorsFaq

```ts
interface SectorsFaq {
  faqs_id?: Faq | string | null;
  id: number;
  sectors_id?: Sector | string | null;
}
```

## SectorsFeaturedMedia

```ts
interface SectorsFeaturedMedia {
  collection?: string | null;
  id: number;
  item?: Video | PodcastEpisode | Testimonial | string | null;
  sectors_id?: Sector | string | null;
  sort?: number | null;
}
```

## PodcastEpisodesPodcastHost

```ts
interface PodcastEpisodesPodcastHost {
  id: number;
  podcast_episodes_id?: PodcastEpisode | string | null;
  podcast_hosts_id?: PodcastHost | string | null;
}
```

## PodcastEpisodesProfile

```ts
interface PodcastEpisodesProfile {
  id: number;
  podcast_episodes_id?: PodcastEpisode | string | null;
  profiles_id?: Profile | string | null;
}
```
