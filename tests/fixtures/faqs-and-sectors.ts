/** Synthetic source records for FAQ and sector unit and HTTP contract tests. */
export const faqId = "550e8400-e29b-41d4-a716-446655440010";
export const sectorId = "00000000-0000-0000-0000-000000000001";
export const relatedArticle = {
  id: "00f81660-a2e4-48af-b8d7-98ce338de447",
  title: "Article",
  path: "/kennisbank/artikelen/article"
};
export const faqRecord = {
  id: faqId,
  question: "Can I teach?",

  english: false,
  date_updated: null,
  answer: {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "Yes, with the required qualification.", marks: [{ type: "bold" }] }
        ]
      }
    ]
  },
  sectors: [
    {
      sectors_id: {
        id: sectorId,
        title: "Primary education",
        slug: "primary",
        description: "Primary education"
      }
    }
  ],
  audiences: [],
  phases: [],
  topics: [],
  articles: [{ articles_id: relatedArticle }]
};
export const sectorRecord = {
  id: sectorId,
  title: "Primary education",
  code: "po",
  slug: "primary",
  description: "Primary education guidance",

  sort: 0,
  alt_names: null,
  icon: null,
  date_updated: null,
  introduction: "Teach children.",
  roles_content: "Teachers and assistants.",
  routes_content: null,
  salary_content: "Salary guidance.",
  costs_content: null,
  costs_actions: [{ label: "Funding", link: "/funding", internal: true }],
  salary_cards: [
    {
      title: "Salary",
      description: "Pay scales",
      link: "https://example.test/pay",
      link_label: "Pay scales"
    },
    { title: "Additional guidance", description: "A card without an action." }
  ],
  featured_articles: [{ id: 1, articles_id: relatedArticle }],
  featured_faqs: [{ id: 1, faqs_id: { id: faqId, question: faqRecord.question } }],
  featured_media: [
    {
      id: 1,
      sort: 1,
      collection: "videos",
      item: {
        id: "550e8400-e29b-41d4-a716-446655440011",
        title: "Experience",
        path: "/video/example",

        publication_date: "2020-01-01T00:00:00Z"
      }
    }
  ]
};
