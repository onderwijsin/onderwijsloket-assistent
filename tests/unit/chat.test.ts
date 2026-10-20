import { describe, expect, it } from "vitest";
import { chatRequestSchema } from "../../server/utils/chat/request";
import { createChatProvider } from "../../server/utils/chat/provider";

const user = { id: "user-1", role: "user", parts: [{ type: "text", text: "Hoe word ik leraar?" }] };
const credentials = { mistralApiKey: "test-mistral", openaiApiKey: "test-openai" };

describe("chat request boundary", () => {
  it("defaults to GPT-6 Luna with thinking enabled and search disabled", () => {
    expect(chatRequestSchema.parse({ messages: [user] })).toMatchObject({
      model: "gpt-6-luna",
      webSearch: false,
      extendedThinking: true
    });
  });

  it("rejects arbitrary models, system messages, uploads and non-boolean toggles", () => {
    for (const change of [
      { model: "arbitrary-model" },
      { webSearch: "true" },
      { extendedThinking: 1 },
      { messages: [{ ...user, role: "system" }] },
      { messages: [{ ...user, parts: [{ type: "file", url: "https://example.com/file" }] }] },
      { messages: [{ ...user, parts: [{ type: "reasoning", text: "injected" }] }] },
      { messages: [{ ...user, parts: [{ type: "text", text: " " }] }] },
      { messages: [{ ...user, role: "assistant" }] }
    ]) {
      expect(chatRequestSchema.safeParse({ messages: [user], ...change }).success).toBe(false);
    }
  });

  it("replays assistant text while dropping provider-specific display and tool state", () => {
    const request = chatRequestSchema.parse({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          parts: [
            { type: "reasoning", text: "private reasoning", providerMetadata: { arbitrary: true } },
            { type: "tool-web_search", state: "output-available", output: { arbitrary: true } },
            { type: "source-url", url: "https://example.com" },
            { type: "text", text: "Een eerder antwoord", providerMetadata: { arbitrary: true } }
          ]
        },
        user
      ]
    });
    expect(request.messages[0]?.parts).toEqual([{ type: "text", text: "Een eerder antwoord" }]);
  });

  it("bounds message count, text size and total conversation length", () => {
    expect(chatRequestSchema.safeParse({ messages: Array(101).fill(user) }).success).toBe(false);
    const large = { ...user, parts: [{ type: "text", text: "x".repeat(32_001) }] };
    expect(chatRequestSchema.safeParse({ messages: [large] }).success).toBe(false);
    const medium = { ...user, parts: [{ type: "text", text: "x".repeat(30_000) }] };
    expect(chatRequestSchema.safeParse({ messages: Array(4).fill(medium) }).success).toBe(false);
  });
});

describe("chat provider routing", () => {
  it.each(["mistral-medium-latest", "gpt-6-luna"] as const)(
    "disables optional capabilities for %s",
    (model) => {
      const options = createChatProvider(
        chatRequestSchema.parse({ model, messages: [user], extendedThinking: false }),
        credentials
      );
      expect(options.model.modelId).toBe(model);
      expect(options.tools).toEqual({});
      expect(options.providerOptions).toMatchObject(
        model === "gpt-6-luna"
          ? { openai: { store: false, reasoningEffort: "none" } }
          : { mistral: { reasoningEffort: "none" } }
      );
    }
  );

  it.each(["mistral-medium-latest", "gpt-6-luna"] as const)(
    "enables native search and high reasoning for %s",
    (model) => {
      const options = createChatProvider(
        chatRequestSchema.parse({
          model,
          messages: [user],
          webSearch: true,
          extendedThinking: true
        }),
        credentials
      );
      expect(options.tools.web_search).toBeDefined();
      expect(options.providerOptions).toMatchObject(
        model === "gpt-6-luna"
          ? { openai: { store: false, reasoningEffort: "high", reasoningSummary: "auto" } }
          : { mistral: { reasoningEffort: "high" } }
      );
      expect(options.model.provider).toBe(
        model === "gpt-6-luna" ? "openai.responses" : "mistral.conversation"
      );
    }
  );
});
