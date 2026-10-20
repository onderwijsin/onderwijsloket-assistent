import { resourceContent } from "./resource-content";
import { escapeMarkdownText } from "./markdown-formatting";

/**
 * Preserve named desk/service descriptions and show the shared notice for each absent document.
 * @param record - Validated desk detail.
 * @returns Markdown with public metadata supplied separately as YAML front matter.
 */
export function deskResourceContent(record: {
  title: string;
  description: string | null;
  consultation_service_description: string | null;
}) {
  return [
    record.description ?? `# ${escapeMarkdownText(record.title)}\n\n${resourceContent(null)}`,
    "## Consultation service",
    resourceContent(record.consultation_service_description)
  ].join("\n\n");
}
