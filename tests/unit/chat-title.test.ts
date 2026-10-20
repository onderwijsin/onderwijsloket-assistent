import { beforeEach, expect, it, vi } from "vitest";
import { generateChatTitle } from "../../server/utils/chat/title";

const generate = vi.hoisted(() => vi.fn());
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  generateText: generate
}));
const credentials = { openaiApiKey: "test-openai", mistralApiKey: "test-mistral" };
beforeEach(() => generate.mockReset().mockResolvedValue({ text: "Ervaringen in het onderwijs" }));

it.each([
  ["gpt-6-luna", "gpt-5-nano"],
  ["mistral-medium-latest", "ministral-3b-2512"]
] as const)("uses a cheap model from the selected provider %s", async (model, titleModel) => {
  expect(
    await generateChatTitle(model, "x".repeat(3000), credentials, new AbortController().signal)
  ).toBe("Ervaringen in het onderwijs");
  expect(generate.mock.calls[0]?.[0]).toMatchObject({
    model: { modelId: titleModel },
    maxRetries: 0,
    maxOutputTokens: 256,
    prompt: "x".repeat(2000)
  });
});
it("keeps failures and unsuitable titles from breaking the answer", async () => {
  generate.mockRejectedValueOnce(new Error("provider unavailable"));
  expect(
    await generateChatTitle("gpt-6-luna", "Vraag", credentials, new AbortController().signal)
  ).toBeUndefined();
  generate.mockResolvedValueOnce({ text: "Dit is een veel te lange titel voor deze chat" });
  expect(
    await generateChatTitle("gpt-6-luna", "Vraag", credentials, new AbortController().signal)
  ).toBeUndefined();
});
