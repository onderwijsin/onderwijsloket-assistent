const icons = {
  // State
  warn: "lucide:message-square-warning",
  success: "lucide:badge-check",
  error: "lucide:triangle-alert",
  info: "lucide:info",

  search: "lucide:search",
  sparkles: "lucide:wand-sparkles",
  status: "lucide:circle-dashed",
  calendar: "lucide:calendar",
  money: "lucide:euro",
  clock: "lucide:clock",
  happy: "lucide:smile",
  close: "lucide:x",
  filter: "lucide:funnel",

  // Actions
  edit: "lucide:notebook-pen",
  delete: "lucide:trash",
  save: "lucide:save",
  external: "lucide:external-link",
  url: "lucide:link",
  refresh: "lucide:refresh-cw",
  copy: "lucide:copy",
  copied: "lucide:copy-check",
  chevronDown: "lucide:chevron-down",
  add: "lucide:plus",
  send: "lucide:send",
  email: "lucide:mail",
  download: "lucide:cloud-download",
  call: "lucide:phone",
  settings: "heroicons:cog",
  privacy: "ooui:user-anonymous",

  // Site Sections:
  home: "lucide:home",
  expertise: "lucide:book-open",
  missie: "lucide:rocket",
  domein: "lucide:folder-open",
  category: "lucide:tag",
  nieuws: "lucide:newspaper",
  projecten: "lucide:briefcase-business",
  chat: "lucide:message-circle",
  team: "lucide:users",
  partners: "lucide:handshake",
  bestuur: "lucide:hand-coins",
  contact: "lucide:messages-square",
  vacature: "lucide:briefcase",
  vacatureMention: "heroicons:briefcase-16-solid",
  experiment: "lucide:flask-conical",
  scale: "lucide:circle-fading-arrow-up",
  user: "lucide:user",
  euro: "lucide:euro",
  briefcase: "lucide:briefcase",

  // Audiences
  audience: "lucide:users",
  overstappers: "lucide:user",
  werkgevers: "heroicons:building-library",
  beleidsmakers: "lucide:building",
  opleiders: "lucide:graduation-cap",

  // Arrows
  right: "lucide:arrow-right",
  down: "lucide:arrow-down",
  left: "lucide:arrow-left",
  up: "lucide:arrow-up",

  // Editor
  paragraph: "lucide:type",
  heading1: "lucide:heading-1",
  heading2: "lucide:heading-2",
  heading3: "lucide:heading-3",
  list: "lucide:list",
  listOrdered: "lucide:list-ordered",
  quote: "lucide:text-quote",
  separator: "lucide:separator-horizontal",

  bold: "lucide:bold",
  italic: "lucide:italic",
  underline: "lucide:underline",
  strike: "lucide:strikethrough",

  undo: "lucide:undo",
  redo: "lucide:redo",
  headings: "lucide:heading",
  apply: "lucide:corner-down-left",

  // AI
  chatgpt: "simple-icons:openai",
  claude: "simple-icons:anthropic",
  markdown: "simple-icons:markdown",
  cursor: "simple-icons:cursor",
  ai: "hugeicons:artificial-intelligence-04",

  // Content types
  guide: "lucide:book",
  articleMention: "heroicons:document-text-16-solid",
  toolkit: "lucide:tool-case",
  toolkitMention: "mdi:tools",
  code: "lucide:square-code",
  insight: "lucide:lightbulb",
  report: "lucide:chart-network",
  opinion: "lucide:message-square-quote",
  case: "lucide:user-round-search",

  // Social
  linkedin: "bxl:linkedin",
  github: "bxl:github",
  substack: "simple-icons:substack",
  link: "lucide:link"
};

export type IconKey = keyof typeof icons;

/**
 * Return the icon key usable by Nuxt UI
 * @param name The name of the icon
 * @returns The icon key
 */
export function getIcon(name: IconKey) {
  return icons[name];
}
