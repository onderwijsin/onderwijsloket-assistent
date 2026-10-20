import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, toWebHandler } from "h3";
import handler from "../../server/api/chat.post";

const { storage, config, streamTextMock, mcpClose, mcpConnect, titleMock } = vi.hoisted(() => ({
  storage: new Map<string, unknown>(),
  config: { chat: { mistralApiKey: "test-mistral", openaiApiKey: "test-openai" } },
  streamTextMock: vi.fn(),
  titleMock: vi.fn(),
  mcpClose: vi.fn(),
  mcpConnect: vi.fn()
}));

vi.mock("../../server/utils/chat/title", () => ({ generateChatTitle: titleMock }));

vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: () => config,
  useStorage: (namespace: string) => ({
    getItem: async (key: string) => storage.get(`${namespace}:${key}`),
    setItem: async (key: string, value: unknown) => {
      storage.set(`${namespace}:${key}`, value);
    }
  })
}));
vi.mock("../../server/utils/chat/mcp", async (original) => ({
  ...(await original<typeof import("../../server/utils/chat/mcp")>()),
  connectChatMcp: mcpConnect
}));
vi.mock("ai", async (original) => ({
  ...(await original<typeof import("ai")>()),
  ToolLoopAgent: class {
    constructor(private settings: Record<string, unknown>) {}
    async stream(options: Record<string, unknown>) {
      return streamTextMock({ ...this.settings, ...options });
    }
  }
}));

const app = createApp({ debug: false }).use("/api/chat", handler);
const fetchChat = toWebHandler(app);
const payload = {
  messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Hallo" }] }]
};

/** Exercise the real H3 body boundary and limiter without external provider traffic. */
function request(body: unknown = payload) {
  return fetchChat(
    new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body)
    })
  );
}

beforeEach(() => {
  storage.clear();
  titleMock.mockReset().mockResolvedValue("Werken in het onderwijs");
  mcpClose.mockReset().mockResolvedValue(undefined);
  mcpConnect
    .mockReset()
    .mockResolvedValue({ tools: {}, instructions: "MCP source guidance", close: mcpClose });
  config.chat.mistralApiKey = "test-mistral";
  config.chat.openaiApiKey = "test-openai";
  streamTextMock.mockReset();
  streamTextMock.mockImplementation(() => ({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: "text-start", id: "t1" });
        controller.enqueue({ type: "text-delta", id: "t1", text: "Hallo!" });
        controller.enqueue({ type: "text-end", id: "t1" });
        controller.close();
      }
    })
  }));
});

describe("chat HTTP boundary", () => {
  it("streams a title once alongside the first response when requested", async () => {
    const response = await request({ ...payload, generateTitle: true });
    const stream = await response.text();
    expect(stream).toContain('"delta":"Hallo!"');
    expect(stream).toContain('"type":"data-conversation-title"');
    expect(stream).toContain('"transient":true');
    expect(titleMock).toHaveBeenCalledTimes(1);
    await (await request()).text();
    expect(titleMock).toHaveBeenCalledTimes(1);
    const followup = {
      ...payload,
      generateTitle: true,
      messages: [...payload.messages, ...payload.messages]
    };
    await (await request(followup)).text();
    expect(titleMock).toHaveBeenCalledTimes(1);
  });

  it("does not hold answer chunks while the title call is pending", async () => {
    let complete!: (value: string) => void;
    titleMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          complete = resolve;
        })
    );
    const response = await request({ ...payload, generateTitle: true });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = "";
    while (!text.includes('"delta":"Hallo!"')) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      text += decoder.decode(chunk.value);
    }
    expect(text).not.toContain("data-conversation-title");
    complete("Werken in het onderwijs");
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    expect(text).toContain("data-conversation-title");
  });

  it("continues the answer when title generation produces no result", async () => {
    titleMock.mockResolvedValue(undefined);
    const text = await (await request({ ...payload, generateTitle: true })).text();
    expect(text).toContain('"delta":"Hallo!"');
    expect(text).not.toContain("data-conversation-title");
  });

  it("streams the UI message protocol with cache prevention", async () => {
    const response = await request();
    expect(response.status).toBe(200);
    expect(streamTextMock.mock.calls[0]?.[0].instructions).toContain(
      "Schrijf alle zichtbare redeneersamenvattingen en bijbehorende kopjes in het Nederlands."
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain('"delta":"Hallo!"');
    expect(mcpClose).toHaveBeenCalledTimes(1);
    expect(streamTextMock.mock.calls[0]?.[0].instructions).toContain("MCP source guidance");
    expect(streamTextMock.mock.calls[0]?.[0].messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Hallo" }] }
    ]);
  });

  it.each([false, true])(
    "gates reasoning and source chunks when toggles are %s",
    async (enabled) => {
      streamTextMock.mockReturnValueOnce({
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "reasoning-start", id: "r1" });
            controller.enqueue({ type: "reasoning-delta", id: "r1", text: "Even nadenken" });
            controller.enqueue({ type: "reasoning-end", id: "r1" });
            controller.enqueue({
              type: "source",
              sourceType: "url",
              id: "s1",
              url: "https://example.com",
              title: "Bron"
            });
            controller.close();
          }
        })
      });
      const response = await request({ ...payload, webSearch: enabled, extendedThinking: enabled });
      const body = await response.text();
      expect(body.includes('"type":"reasoning-delta"')).toBe(enabled);
      expect(body.includes('"type":"source-url"')).toBe(enabled);
    }
  );

  it("fails with 503 instead of answering without MCP evidence when connection fails", async () => {
    mcpConnect.mockRejectedValueOnce(new Error("private upstream error"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private upstream error");
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("closes the MCP client when agent setup fails", async () => {
    streamTextMock.mockRejectedValueOnce(new Error("setup failed"));
    expect((await request()).status).toBe(500);
    expect(mcpClose).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid bodies without invoking a provider", async () => {
    const response = await request({ ...payload, model: "unknown" });
    expect(response.status).toBe(400);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("returns 503 for missing private credentials", async () => {
    config.chat.openaiApiKey = "";
    expect((await request()).status).toBe(503);
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it("blocks request 31 until the hourly window expires", async () => {
    vi.useFakeTimers();
    try {
      for (let index = 0; index < 30; index++) {
        const response = await request();
        expect(response.status).toBe(200);
        await response.text();
      }
      const response = await request();
      expect(response.status).toBe(429);
      expect(await response.json()).toMatchObject({
        data: {
          limits: { max: 30, duration: 3600, ban: 0 },
          bannedUntil: expect.any(Number)
        }
      });
      expect(streamTextMock).toHaveBeenCalledTimes(30);
      vi.advanceTimersByTime(3_600_001);
      const reset = await request();
      expect(reset.status).toBe(200);
      await reset.text();
    } finally {
      vi.useRealTimers();
    }
  });

  it("sanitizes provider errors in the stream", async () => {
    streamTextMock.mockReturnValueOnce({
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "error", error: new Error("secret-provider-payload") });
          controller.close();
        }
      })
    });
    const response = await request();
    const body = await response.text();
    expect(body).toContain("Het antwoord kon niet worden gegenereerd");
    expect(body).not.toContain("secret-provider-payload");
  });
});
