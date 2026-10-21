import { ofetch } from "ofetch";
import { z } from "zod";
import { NotionWriteError } from "./errors";

type RichText = { type: "text"; text: { content: string } };
export type NotionProperty =
  | { title: RichText[] }
  | { rich_text: RichText[] }
  | { select: { name: string } }
  | { status: { name: string } }
  | { checkbox: boolean }
  | { email: string }
  | { date: { start: string } };

export interface NotionPageInput {
  parent: { type: "data_source_id"; data_source_id: string };
  properties: Record<string, NotionProperty>;
  children: { object: "block"; type: "code"; code: { language: "json"; rich_text: RichText[] } }[];
}

/** Fixed-origin, single-operation Notion client; no SDK, arbitrary URLs or caller headers.
 * @param token - Server-only credential.
 * @returns A single page creation operation with sanitized errors and no retries.
 */
export function createNotionClient(token: string | undefined) {
  const request = ofetch.create({
    baseURL: "https://api.notion.com/v1",
    headers: {
      Authorization: `Bearer ${token || ""}`,
      "Notion-Version": "2026-03-11",
      Accept: "application/json"
    }
  });
  return {
    /** Create one page and validate its receipt without exposing provider errors.
     * @param body - Internally mapped properties and bounded JSON code blocks.
     * @returns Created page UUID; an invalid success response is an uncertain write.
     */
    async createPage(body: NotionPageInput): Promise<string> {
      if (!token?.trim()) throw new NotionWriteError("NOT_CONFIGURED");
      let response: unknown;
      try {
        response = await request<unknown>("/pages", { method: "POST", body });
      } catch (error) {
        const status =
          error && typeof error === "object" && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        throw new NotionWriteError(
          [400, 401, 403, 404, 413, 429].includes(status) ? "REJECTED" : "UNCERTAIN"
        );
      }
      const parsed = z.object({ object: z.literal("page"), id: z.uuid() }).safeParse(response);
      if (!parsed.success) throw new NotionWriteError("UNCERTAIN");
      return parsed.data.id;
    }
  };
}

export type NotionClient = ReturnType<typeof createNotionClient>;
