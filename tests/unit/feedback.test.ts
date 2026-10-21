import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFeedbackService } from "../../server/utils/feedback/service";
import { createNotionClient } from "../../server/utils/notion/client";
import {
  createNotionFeedbackStorage,
  notionText
} from "../../server/utils/notion/feedback-storage";
import type { NotionPageInput } from "../../server/utils/notion/client";
import type { FeedbackReport } from "../../server/utils/feedback/schemas";
import { decodeFeedbackSnapshot } from "../../server/utils/feedback/snapshot";
import { randomBytes } from "node:crypto";

const { request, create } = vi.hoisted(() => ({
  request:
    vi.fn<(path: string, options: { method: string; body: NotionPageInput }) => Promise<unknown>>(),
  create: vi.fn()
}));
vi.mock("ofetch", () => ({ ofetch: { create } }));
beforeEach(() => {
  request.mockReset().mockResolvedValue({ object: "page", id: pageId });
  create.mockReset().mockReturnValue(request);
});

const dataSourceId = "400b66e1-be69-80b6-a7cb-000bf91f086e";
const pageId = "400b66e1-be69-805d-9625-000cfde4b019";
const input = {
  title: "Wrong answer",
  category: "incorrect_information",
  message: "The qualification is incorrect.",
  user_consent: true,
  conversation: {
    messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Current conversation" }] }]
  }
};
const context = { source: "MCP client", clientName: "fixture", clientVersion: "1" };

/** Bind the service and adapter to the mocked ofetch boundary.
 * @param token - Synthetic credential or absent configuration.
 * @returns Production submission path with the real schema mapping.
 */
function fixture(token = "fixture-token") {
  return createFeedbackService(
    createNotionFeedbackStorage(createNotionClient(token), dataSourceId)
  );
}

describe("feedback submission", () => {
  it("identifies metadata validation fields without including their values", async () => {
    const create = vi.fn();
    const error = await createFeedbackService({ create })
      .submit(input, { ...context, environment: "private-value" })
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({ code: "INVALID_METADATA", details: { fields: ["environment"] } });
    expect(JSON.stringify(error)).not.toContain("private-value");
    expect(create).not.toHaveBeenCalled();
  });
  it("rejects reports without a conversation before writing", async () => {
    const create = vi.fn();
    await expect(
      createFeedbackService({ create }).submit({ ...input, conversation: undefined }, context)
    ).rejects.toMatchObject({ code: "MISSING_CONVERSATION" });
    expect(create).not.toHaveBeenCalled();
  });
  it.each([false, undefined, "true"])(
    "requires explicit boolean consent before any write (%s)",
    async (consent) => {
      const create = vi.fn();
      await expect(
        createFeedbackService({ create }).submit({ ...input, user_consent: consent }, context)
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(create).not.toHaveBeenCalled();
    }
  );

  it("is storage independent and excludes drafts, UI state and spoofed attribution", async () => {
    const create = vi.fn(async (_report: FeedbackReport) => "another-store-id");
    const receipt = await createFeedbackService({ create }).submit(
      {
        ...input,
        clientName: "spoofed",
        userAgent: "spoofed",
        source: "Web chat",
        conversation: {
          id: "chat-1",
          title: "Question",
          draft: "unsent secret",
          sidebarOpen: true,
          messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Question" }] }]
        }
      },
      context
    );
    expect(receipt.report_id).toBe("another-store-id");
    const report = create.mock.calls[0]![0];
    expect(report.context.clientName).toBe("fixture");
    expect(report.input.conversation).not.toHaveProperty("draft");
    expect(report.input).not.toHaveProperty("clientName");
    expect(JSON.stringify(report)).not.toContain("unsent secret");
    expect(report).toMatchObject({
      schemaVersion: 1,
      consentVersion: "feedback-v3",
      receivedAt: receipt.received_at
    });
  });

  it.each([98_360, 250_000])(
    "preserves tool-heavy reports of %s bytes across bounded code blocks",
    async (length) => {
      const output = { result: "x".repeat(length) };
      const conversation = {
        messages: [
          { role: "user", parts: [{ type: "text", text: "Please help me book a conversation." }] },
          {
            role: "assistant",
            parts: [
              { type: "dynamic-tool", toolName: "get_scheduling_link", output },
              { type: "text", text: "Which day works?" }
            ]
          }
        ]
      };
      await expect(fixture().submit({ ...input, conversation }, context)).resolves.toMatchObject({
        report_id: pageId
      });
      expect(request).toHaveBeenCalledOnce();
      const page = request.mock.calls[0]![1].body;
      expect(new TextEncoder().encode(JSON.stringify(page)).byteLength).toBeLessThan(500_000);
      for (const block of page.children) {
        expect(block.code.rich_text.length).toBeLessThanOrEqual(100);
        for (const part of block.code.rich_text)
          expect(part.text.content.length).toBeLessThanOrEqual(2000);
      }
      if (length === 250_000) expect(page.children.length).toBeGreaterThan(1);
      const snapshot = JSON.parse(
        page.children
          .flatMap((block) => block.code.rich_text)
          .map((part) => part.text.content)
          .join("")
      );
      expect(snapshot.input.conversation).toEqual(conversation);
    }
  );

  it("compresses only when JSON escaping pushes a request over the limit, keeping readable text", async () => {
    const report = {
      ...input,
      conversation: {
        messages: [{ role: "assistant", parts: [{ type: "text", text: '"'.repeat(150_000) }] }]
      }
    };
    expect(new TextEncoder().encode(JSON.stringify(report)).byteLength).toBeLessThan(500_000);
    await expect(fixture().submit(report, context)).resolves.toMatchObject({ report_id: pageId });
    expect(request).toHaveBeenCalledOnce();
    const page = request.mock.calls[0]![1].body;
    expect(new TextEncoder().encode(JSON.stringify(page)).byteLength).toBeLessThan(500_000);
    const readable = page.children
      .filter((block) => block.code.language === "plain text")
      .flatMap((block) => block.code.rich_text)
      .map((part) => part.text.content)
      .join("");
    expect(readable).toContain('"'.repeat(150_000));
    const envelope = JSON.parse(
      page.children
        .filter((block) => block.code.language === "json")
        .flatMap((block) => block.code.rich_text)
        .map((part) => part.text.content)
        .join("")
    );
    expect(envelope).toMatchObject({ version: 1, encoding: "gzip+base64" });
    expect((await decodeFeedbackSnapshot(envelope)).input.conversation).toEqual(
      report.conversation
    );
  });

  it("compresses oversized tool results while retaining the visible conversation separately", async () => {
    const conversation = {
      messages: [
        {
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "get_scheduling_link",
              output: { data: "Full tool payload".repeat(50_000) }
            },
            { type: "text", text: "Which day works for you?" }
          ]
        }
      ]
    };
    await fixture().submit({ ...input, conversation }, context);
    expect(request).toHaveBeenCalledOnce();
    const page = request.mock.calls[0]![1].body;
    expect(page.properties["User message"]).toEqual({
      rich_text: [{ type: "text", text: { content: input.message } }]
    });
    const readable = page.children
      .filter((block) => block.code.language === "plain text")
      .flatMap((block) => block.code.rich_text)
      .map((part) => part.text.content)
      .join("");
    expect(readable).toContain("Which day works for you?");
    expect(readable).not.toContain("Full tool payload");
    const envelope = JSON.parse(
      page.children
        .filter((block) => block.code.language === "json")
        .flatMap((block) => block.code.rich_text)
        .map((part) => part.text.content)
        .join("")
    );
    expect((await decodeFeedbackSnapshot(envelope)).input.conversation).toEqual(conversation);
  });

  it("rejects requests that remain oversized after compression without sending or truncating", async () => {
    const report = {
      ...input,
      conversation: {
        messages: [
          {
            role: "assistant",
            parts: [
              { type: "dynamic-tool", output: randomBytes(500_000).toString("base64") },
              { type: "text", text: "A short visible answer" }
            ]
          }
        ]
      }
    };
    const error = await fixture()
      .submit(report, context)
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      code: "REPORT_TOO_LARGE",
      details: { limit_bytes: 500_000, size_bytes: expect.any(Number) }
    });
    expect((error as { details: { size_bytes: number } }).details.size_bytes).toBeGreaterThan(
      500_000
    );
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    { email: "invalid" },
    { occurred_at: "not-a-date" },
    { category: "unknown" },
    { conversation: { messages: [{ role: "system", parts: [{ type: "text", text: "secret" }] }] } }
  ])("rejects malformed boundary input", async (invalid) => {
    const create = vi.fn();
    await expect(
      createFeedbackService({ create }).submit({ ...input, ...invalid }, context)
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(create).not.toHaveBeenCalled();
  });

  it("writes all supported metadata and exact structured history in one authenticated POST", async () => {
    const conversation = {
      id: "chat-1",
      title: "Which qualification?",
      createdAt: "2026-10-21T10:00:00Z",
      updatedAt: "2026-10-21T10:01:00Z",
      messages: [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "get_faq",
              state: "output-available",
              input: { id: "faq-1" },
              output: { answer: "😀".repeat(1500) }
            }
          ]
        }
      ]
    };
    const receipt = await fixture().submit(
      {
        ...input,
        email: "user@example.test",
        conversation,
        message_id: "a1",
        occurred_at: "2026-10-21T10:01:00Z",
        settings: { model: "some-model", webSearch: false, extendedThinking: true },
        diagnostics: { request_id: "req-1", tool_name: "get_faq", error_code: "UPSTREAM" }
      },
      {
        ...context,
        source: "Web chat",
        userAgent: "Fixture UA",
        appVersion: "1.0",
        environment: "production"
      }
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      baseURL: "https://api.notion.com/v1",
      headers: {
        Authorization: "Bearer fixture-token",
        "Notion-Version": "2026-03-11",
        Accept: "application/json"
      }
    });
    const [path, options] = request.mock.calls[0]!;
    expect(path).toBe("/pages");
    expect(options.method).toBe("POST");
    const body = options.body;
    expect(body.parent).toEqual({ type: "data_source_id", data_source_id: dataSourceId });
    expect(body.properties).toMatchObject({
      Status: { status: { name: "New" } },
      Category: { select: { name: "Incorrect information" } },
      "User email": { email: "user@example.test" },
      "User consent": { checkbox: true },
      "Consent recorded at": { date: { start: receipt.received_at } },
      "Reported at": { date: { start: receipt.received_at } },
      "Conversation started at": { date: { start: conversation.createdAt } },
      "Web search": { checkbox: false },
      "Extended thinking": { checkbox: true },
      Environment: { select: { name: "Production" } }
    });
    expect(body.properties).not.toHaveProperty("Conversation history");
    const chunks = body.children[0]!.code.rich_text as { text: { content: string } }[];
    expect(chunks.every(({ text }) => text.content.length <= 2000)).toBe(true);
    const snapshot = JSON.parse(chunks.map(({ text }) => text.content).join(""));
    expect(snapshot.input.conversation).toEqual(conversation);
    expect(snapshot.context.userAgent).toBe("Fixture UA");
    expect(receipt).toEqual({ report_id: pageId, received_at: expect.any(String) });
    expect(JSON.stringify(receipt)).not.toContain("user@example.test");
  });

  it("omits unavailable email, settings and conversation metadata", async () => {
    await fixture().submit(input, context);
    const properties = request.mock.calls[0]![1].body.properties;
    for (const key of [
      "User email",
      "Web search",
      "Extended thinking",
      "Model",
      "Conversation ID",
      "User agent"
    ])
      expect(properties).not.toHaveProperty(key);
  });

  it.each([
    [400, "SUBMISSION_REJECTED"],
    [401, "SUBMISSION_REJECTED"],
    [403, "SUBMISSION_REJECTED"],
    [429, "SUBMISSION_REJECTED"],
    [500, "SUBMISSION_UNCERTAIN"],
    [503, "SUBMISSION_UNCERTAIN"],
    [529, "SUBMISSION_UNCERTAIN"]
  ])("sanitizes HTTP %s and never retries", async (status, code) => {
    request.mockRejectedValue(
      Object.assign(new Error("private-token user@example.test"), { statusCode: Number(status) })
    );
    const error = await fixture()
      .submit(input, context)
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({ code });
    expect(String(error)).not.toContain("private-token");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("treats network failure and malformed success as uncertain, without retries", async () => {
    request.mockRejectedValueOnce(new Error("private transport failure"));
    await expect(fixture().submit(input, context)).rejects.toMatchObject({
      code: "SUBMISSION_UNCERTAIN"
    });
    expect(request).toHaveBeenCalledTimes(1);
    request.mockReset().mockResolvedValue({ object: "page", id: "invalid" });
    await expect(fixture().submit(input, context)).rejects.toMatchObject({
      code: "SUBMISSION_UNCERTAIN"
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("fails closed before HTTP when the token or destination is missing", async () => {
    await expect(fixture("").submit(input, context)).rejects.toMatchObject({
      code: "NOT_CONFIGURED"
    });
    await expect(
      createFeedbackService(createNotionFeedbackStorage(createNotionClient("fixture"), "")).submit(
        input,
        context
      )
    ).rejects.toMatchObject({ code: "NOT_CONFIGURED" });
    expect(request).not.toHaveBeenCalled();
  });

  it("preserves surrogate pairs at rich-text chunk boundaries", () => {
    const text = "a".repeat(1899) + "😀" + "b".repeat(2000);
    const chunks = notionText(text);
    expect(chunks.map((chunk) => chunk.text.content).join("")).toBe(text);
    for (const chunk of chunks) expect(chunk.text.content.isWellFormed()).toBe(true);
  });
});
