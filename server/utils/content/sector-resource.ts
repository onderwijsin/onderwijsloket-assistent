import { resourceContent } from "./resource-content";
import { escapeMarkdownText } from "./markdown-formatting";

const sectionNames = [
  "introduction",
  "roles_content",
  "routes_content",
  "salary_content",
  "costs_content"
] as const;

/**
 * Render sector plain-text guidance as named Markdown sections; references remain in front matter.
 * @param record - Validated sector detail with separately named content sections.
 * @returns Markdown guidance without synthesizing missing sections.
 */
export function sectorResourceContent(record: {
  title: string;
  description: string;
  introduction: string | null;
  roles_content: string | null;
  routes_content: string | null;
  salary_content: string | null;
  costs_content: string | null;
}) {
  const headings = {
    introduction: "Introduction",
    roles_content: "Roles",
    routes_content: "Routes",
    salary_content: "Salary",
    costs_content: "Costs"
  };
  const body = [
    escapeMarkdownText(record.description),
    ...sectionNames.flatMap((name) =>
      record[name]?.trim() ? [`## ${headings[name]}`, escapeMarkdownText(record[name])] : []
    )
  ]
    .filter((part) => part.trim())
    .join("\n\n");
  return [`# ${escapeMarkdownText(record.title)}`, resourceContent(body)].join("\n\n");
}
