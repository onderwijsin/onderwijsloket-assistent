const collections: Record<string, readonly [string, string]> = {
  article: ["Artikelen", "Artikel"],
  educational_institution: ["Onderwijsinstellingen", "Onderwijsinstelling"],
  faq: ["Veelgestelde vragen", "Veelgestelde vraag"],
  podcast_episode: ["Podcastafleveringen", "Podcastaflevering"],
  podcast_show: ["Podcasts", "Podcast"],
  program: ["Opleidingen", "Opleiding"],
  regional_education_desk: ["Regionale adviespunten", "Regionaal adviespunt"],
  sector: ["Onderwijssectoren", "Onderwijssector"],
  testimonial: ["Ervaringsverhalen", "Ervaringsverhaal"],
  video: ["Video’s", "Video"]
};

const actions: Record<string, string> = {
  web_search: "Zoeken op internet",
  list_collections: "Beschikbare kennisbronnen bekijken",
  describe_collection: "Kennisbron verkennen",
  get_filters: "Filtermogelijkheden ophalen",
  get_facets: "Beschikbare zoekfilters bekijken",
  get_route_questions: "Vragen voor jouw onderwijsroute ophalen",
  find_routes: "Passende onderwijsroutes zoeken",
  get_route: "Onderwijsroute bekijken",
  get_scheduling_link: "Gegevens voor het adviesgesprek ophalen",
  get_scheduling_slots: "Beschikbare gesprekstijden zoeken",
  book_appointment: "Adviesgesprek boeken",
  submit_feedback: "Feedback versturen",
  mcp_list_resources: "Beschikbare bronteksten bekijken",
  mcp_read_resource: "Brontekst lezen",
  mcp_get_prompt: "Aanpak voor je vraag ophalen"
};

const workflows: Record<string, string> = {
  "report-feedback": "Feedbackmelding voorbereiden",
  "schedule-consultation": "Telefonisch adviesgesprek voorbereiden",
  "find-education-routes": "Aanpak voor jouw onderwijsroute ophalen",
  "compare-programs": "Opleidingsvergelijking voorbereiden",
  "find-local-support": "Zoeken naar advies in jouw regio voorbereiden",
  "find-supporting-articles": "Zoeken naar relevante artikelen voorbereiden",
  "find-supporting-media": "Zoeken naar relevante media voorbereiden"
};

/**
 * Describe an actual tool action in Dutch, including its workflow when available.
 * @param name - SDK tool name for either a static or dynamic tool part.
 * @param input - Possibly incomplete input while the tool call is streaming.
 * @returns A user-facing activity label without exposing internal identifiers.
 */
export function chatToolLabel(name: string, input?: unknown): string {
  if (name === "mcp_get_prompt" && input && typeof input === "object" && "name" in input) {
    if (typeof input.name === "string" && Object.hasOwn(workflows, input.name)) {
      return workflows[input.name]!;
    }
  }
  if (Object.hasOwn(actions, name)) return actions[name]!;
  for (const [singular, [pluralLabel, singularLabel]] of Object.entries(collections)) {
    if (name === `search_${singular}s`) return `${pluralLabel} doorzoeken`;
    if (name === `list_${singular}s`) return `${pluralLabel} ophalen`;
    if (name === `get_${singular}`) return `${singularLabel} lezen`;
  }
  return "Kennisbron raadplegen";
}
