import { resourceContent } from "./resource-content";
import { escapeMarkdownText, renderMarkdownLink } from "./markdown-formatting";

/**
 * Render a program overview and separate variant documents without inventing a shared program body.
 * @param record - Validated program detail returned by the getter.
 * @returns Markdown with named forms and provider/location context; full metadata remains in front matter.
 */
export function programResourceContent(record: {
  title: string;
  type: string;
  level: string;
  degrees: string[] | null;
  croho: string | null;
  crebo: string | null;
  educational_institutions: { title: string; source_url: string | null }[];
  location: {
    title: string | null;
    location_address: string | null;
    address: string | null;
    city: string | null;
  } | null;
  program_forms: {
    track: { title: string } | null;
    description: string | null;
    url: string | null;
  }[];
}) {
  const parts = [
    `# ${escapeMarkdownText(record.title)}`,
    `Type: ${escapeMarkdownText(record.type)}\n\nLevel: ${escapeMarkdownText(record.level)}`
  ];
  if (record.degrees?.length)
    parts.push(`Degrees: ${record.degrees.map(escapeMarkdownText).join(", ")}`);
  if (record.croho) parts.push(`CROHO: ${escapeMarkdownText(record.croho)}`);
  if (record.crebo) parts.push(`CREBO: ${escapeMarkdownText(record.crebo)}`);
  if (record.educational_institutions.length)
    parts.push(
      "## Providers",
      ...record.educational_institutions.map(
        (provider) => `- ${renderMarkdownLink(provider.title, provider.source_url)}`
      )
    );
  if (record.location)
    parts.push(
      "## Location",
      [
        record.location.title,
        record.location.location_address ?? record.location.address,
        record.location.city
      ]
        .filter((value): value is string => Boolean(value))
        .map(escapeMarkdownText)
        .join("\n\n")
    );
  for (const [index, form] of record.program_forms.entries())
    parts.push(
      `## ${escapeMarkdownText(form.track?.title ?? `Program form ${index + 1}`)}`,
      resourceContent(form.description),
      ...(form.url ? [renderMarkdownLink("More information", form.url)] : [])
    );
  if (!record.program_forms.length) parts.push(resourceContent(null));
  return parts.join("\n\n");
}
