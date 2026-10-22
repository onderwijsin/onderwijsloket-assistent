/** The complete allowlist of organisation-owned consultation links. */
export const schedulingLinks = {
  nl: {
    id: "link_01JJVPB262C3M3RGHWZGYJNSQV",
    slug: "plan-een-adviesgesprek",
    attributionField: "field_fPXF0ONM"
  },
  en: {
    id: "link_01JJVGB7J31E1BR072F8ADKYQ8",
    slug: "fce6f26c",
    attributionField: "field_CWOL9M7b"
  }
} as const;
export type SchedulingLanguage = keyof typeof schedulingLinks;

/** Event creation only, shared across both languages, per the approved root specification. */
export const schedulingRateLimit = { max: 3, duration: 3600, ban: 0 } as const;
