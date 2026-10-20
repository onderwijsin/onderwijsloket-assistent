import { resourceContent } from "./resource-content";
import { escapeMarkdownText } from "./markdown-formatting";
/**
 * Render body and transcript as distinct sections, preserving metadata-only resources with notices.
 * @param record - Native readable media fields, without binary data.
 * @returns Resource Markdown; source transcript strings remain unchanged in JSON.
 */
export function mediaResourceContent(record: {
  title: string;
  content: string | null;
  transcript_string: string | null;
  transcript_string_with_speakers: string | null;
}) {
  const transcript = record.transcript_string_with_speakers?.trim()
    ? record.transcript_string_with_speakers
    : record.transcript_string;
  return [
    record.content ?? `# ${escapeMarkdownText(record.title)}\n\n${resourceContent(null)}`,
    "## Transcript",
    transcript?.trim()
      ? escapeMarkdownText(transcript)
      : "> **Notice:** No transcript is available."
  ].join("\n\n");
}
