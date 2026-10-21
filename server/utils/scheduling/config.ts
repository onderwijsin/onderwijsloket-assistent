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

/** Owner-supplied choices must be tied to the current field label and type. */
export interface SchedulingChoices {
  label: string;
  type: "select" | "radio" | "checkbox" | "checkboxes";
  values: readonly string[];
}
export type SchedulingChoiceConfig = Record<
  SchedulingLanguage,
  Readonly<Record<string, SchedulingChoices>>
>;

/** Owner-supplied UI choices. Update alongside the corresponding SavvyCal forms. */
export const schedulingChoices: SchedulingChoiceConfig = {
  nl: {
    field_qd8z7G9q: {
      label: "Wat is het niveau van jouw hoogst afgeronde opleiding?",
      type: "select",
      values: [
        "Geen vooropleiding",
        "Praktijkonderwijs",
        "Vmbo-bl",
        "Vmbo-kl",
        "Vmbo-gl",
        "Vmbo-tl / mavo",
        "Havo",
        "Vwo",
        "Mbo entree",
        "Mbo 2",
        "Mbo 3",
        "Mbo 4",
        "Associate degree",
        "Hbo-propedeuse",
        "Hbo-bachelor",
        "Hbo-master",
        "Wo-bachelor",
        "Wo-master",
        "Anders",
        "Weet ik niet"
      ]
    },
    field_pbR8tSLL: {
      label: "Heb je je diploma's in Nederland behaald?",
      type: "select",
      values: ["Ja", "Nee", "Anders", "Weet ik niet"]
    },
    field_RTHt4B8s: {
      label: "In welke onderwijssector(en) ben je geïnteresseerd?",
      type: "checkboxes",
      values: [
        "Primair onderwijs",
        "Voortgezet onderwijs",
        "Gespecialiseerd onderwijs",
        "Praktijkonderwijs",
        "Middelbaar beroepsonderwijs",
        "Hoger onderwijs",
        "Anders",
        "Weet ik niet"
      ]
    },
    field_ZKY7KAtW: {
      label: "In wat voor functies ben je geïnteresseerd?",
      type: "checkboxes",
      values: [
        "Leraar",
        "Instructeur",
        "(Onderwijs)ondersteunend personeel",
        "Leerlingenzorg",
        "(Midden)management",
        "Schoolleider",
        "Anders",
        "Weet ik niet"
      ]
    },
    field_sP3A3F61: {
      label: "Bij welke andere partij(en) heb je al informatie gezocht over een overstap?",
      type: "checkboxes",
      values: [
        "(Leraren)opleiding",
        "Een school",
        "Platform werkenmetdetoekomst (https://www.werkeninhetonderwijs.nl)",
        "DUO",
        "Regionaal loket (https://regioloketten.onderwijsloket.com)",
        "Anders",
        "Geen",
        "Weet ik niet"
      ]
    }
  },
  en: {
    field_35ewND8A: {
      label: "What is the highest level of education you have completed?",
      type: "select",
      values: [
        "Primary education",
        "Secondary education",
        "Secondary vocational education",
        "Bachelor's degree",
        "Master's degree",
        "Other",
        "I don't know"
      ]
    },
    field_InVvPg2C: {
      label: "Did you obtain your diplomas in the Netherlands?",
      type: "checkboxes",
      values: ["Yes", "No", "Other", "I don't know"]
    },
    field_oT8aYQzW: {
      label: "Do you possess a (foreign) teaching qualification?",
      type: "select",
      values: ["Yes", "Yes, and it has been certified by DUO", "No", "Other", "I don't know"]
    },
    field_HnBWFSoe: {
      label: "In which educational sector(s) are you interested?",
      type: "checkboxes",
      values: [
        "Primary education",
        "Secondary education",
        "Specialised education",
        "Practical education",
        "Secondary vocational education",
        "Higher education",
        "Other",
        "I don't know"
      ]
    },
    field_Pd0awMGc: {
      label: "In what positions are you interested?",
      type: "checkboxes",
      values: [
        "Teacher",
        "Instructor",
        "(Educational) support staff",
        "Studentcare",
        "(Middle)management",
        "School leadership",
        "Other",
        "I don't know"
      ]
    },
    field_fHmDr6qm: {
      label:
        "Have you already searched for information regarding working in education at any of the following parties?",
      type: "checkboxes",
      values: [
        "University (of applied sciences)",
        "A school",
        "Platform Werkenmetdetoekomst (https://www.werkeninhetonderwijs.nl)",
        "DUO",
        "Regional initiative (https://regioloketten.onderwijsloket.com)",
        "Other",
        "None",
        "I don't know"
      ]
    }
  }
};

/** Event creation only, shared across both languages, per the approved root specification. */
export const schedulingRateLimit = { max: 3, duration: 3600, ban: 0 } as const;
