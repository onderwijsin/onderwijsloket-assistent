import { z } from "zod";
import { FeedbackError } from "../feedback/errors";
import type { FeedbackReport, FeedbackStorage } from "../feedback/schemas";
import type { NotionClient, NotionPageInput, NotionProperty } from "./client";
import { NotionWriteError } from "./errors";

/** Split text below Notion limits without splitting UTF-16 surrogate pairs.
 * @param value - Text to preserve, including non-BMP characters.
 * @returns Rich-text objects each containing at most 1900 UTF-16 code units.
 */
export function notionText(value: string) {
  const chunks: string[] = [];
  let chunk = "";
  for (const character of value) {
    if (chunk.length + character.length > 1900) {
      chunks.push(chunk);
      chunk = "";
    }
    chunk += character;
  }
  if (chunk) chunks.push(chunk);
  return chunks.map((content) => ({ type: "text" as const, text: { content } }));
}

/** Translate a domain report to the existing Notion database schema in one request.
 * @param report - Bounded service snapshot with explicit consent.
 * @param dataSourceId - Server-configured destination, never a tool argument.
 * @returns Page properties and JSON code blocks; no additional upload calls.
 */
export function feedbackPage(report: FeedbackReport, dataSourceId: string): NotionPageInput {
  const { input, context } = report;
  const categories = { incorrect_information: "Incorrect information", bug: "Bug", other: "Other" };
  const properties: Record<string, NotionProperty> = {
    Name: { title: notionText(input.title) },
    Category: { select: { name: categories[input.category] } },
    Status: { status: { name: "New" } },
    "User message": { rich_text: notionText(input.message) },
    "User consent": { checkbox: true },
    "Consent recorded at": { date: { start: report.receivedAt } },
    "Consent version": { rich_text: notionText(report.consentVersion) },
    "Reported at": { date: { start: report.receivedAt } },
    Source: { select: { name: context.source } }
  };
  for (const [name, value] of Object.entries({
    "Conversation ID": input.conversation?.id,
    "Conversation title": input.conversation?.title,
    "Message ID": input.message_id,
    Model: input.settings?.model,
    "User agent": context.userAgent,
    "MCP client": context.clientName,
    "MCP client version": context.clientVersion,
    "App version": context.appVersion
  }))
    if (value !== undefined) properties[name] = { rich_text: notionText(value) };
  for (const [name, value] of Object.entries({
    "Occurred at": input.occurred_at,
    "Conversation started at": input.conversation?.createdAt,
    "Conversation updated at": input.conversation?.updatedAt
  }))
    if (value !== undefined) properties[name] = { date: { start: value } };
  if (input.email) properties["User email"] = { email: input.email };
  if (input.settings) {
    properties["Web search"] = { checkbox: input.settings.webSearch };
    properties["Extended thinking"] = { checkbox: input.settings.extendedThinking };
  }
  if (context.environment)
    properties.Environment = {
      select: {
        name: { production: "Production", preview: "Preview", development: "Development" }[
          context.environment
        ]
      }
    };
  // Attachments require multiple calls. Keep the complete snapshot inline instead.
  const json = JSON.stringify(report);
  return {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties,
    children: [
      { object: "block", type: "code", code: { language: "json", rich_text: notionText(json) } }
    ]
  };
}

/** Bind the feedback storage port to an encapsulated Notion client.
 * @param client - Narrow page-creation API, replaceable in tests.
 * @param dataSourceId - Configured Notion data source UUID.
 * @returns Storage implementation with no MCP or HTTP request dependencies.
 */
export function createNotionFeedbackStorage(
  client: NotionClient,
  dataSourceId: string
): FeedbackStorage {
  return {
    /** Map and persist one validated report.
     * @param report - Consented service snapshot.
     * @returns Notion page UUID as an opaque report reference.
     */
    async create(report) {
      if (!z.uuid().safeParse(dataSourceId).success) throw new FeedbackError("NOT_CONFIGURED");
      try {
        return await client.createPage(feedbackPage(report, dataSourceId));
      } catch (error) {
        const code = error instanceof NotionWriteError ? error.code : "UNCERTAIN";
        throw new FeedbackError(
          code === "NOT_CONFIGURED"
            ? code
            : code === "REJECTED"
              ? "SUBMISSION_REJECTED"
              : "SUBMISSION_UNCERTAIN"
        );
      }
    }
  };
}
