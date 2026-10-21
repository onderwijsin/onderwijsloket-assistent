import { describe, expect, it } from "vitest";
import {
  compressFeedbackSnapshot,
  decodeFeedbackSnapshot
} from "../../server/utils/feedback/snapshot";
import type { FeedbackReport } from "../../server/utils/feedback/schemas";

const report: FeedbackReport = {
  schemaVersion: 1,
  consentVersion: "feedback-v3",
  receivedAt: "2026-10-21T12:00:00.000Z",
  input: {
    title: "Unicode feedback 😀",
    category: "bug",
    message: "A test report",
    user_consent: true,
    conversation: {
      messages: [
        { id: "u1", role: "user", parts: [{ type: "text", text: "één gesprek 中文 😀" }] },
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "get_faq",
              state: "output-available",
              input: { id: "faq-1" },
              output: { nested: [true, null, 42], body: "repeated content".repeat(50_000) }
            }
          ]
        }
      ]
    }
  },
  context: { source: "Web chat", clientName: "onderwijsloket-chat" }
};

describe("feedback snapshot codec", () => {
  it("losslessly restores Unicode and complete structured tool data", async () => {
    const envelope = await compressFeedbackSnapshot(report);
    expect(envelope.originalBytes).toBe(
      new TextEncoder().encode(JSON.stringify(report)).byteLength
    );
    expect(JSON.stringify(envelope).length).toBeLessThan(JSON.stringify(report).length);
    expect(await decodeFeedbackSnapshot(envelope)).toEqual(report);
  });

  it("also reads existing uncompressed snapshots without dropping fields", async () => {
    expect(await decodeFeedbackSnapshot(report)).toEqual(report);
  });

  it("rejects corrupt gzip data, unsupported versions and byte count mismatches", async () => {
    const envelope = await compressFeedbackSnapshot(report);
    for (const invalid of [
      { ...envelope, data: btoa("not gzip") },
      { ...envelope, data: "invalid base64!" },
      { ...envelope, version: 2 },
      { ...envelope, originalBytes: envelope.originalBytes - 1 },
      { ...envelope, originalBytes: envelope.originalBytes + 1 }
    ])
      await expect(decodeFeedbackSnapshot(invalid)).rejects.toThrow();
  });
});
