import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NitroApp, NitroRuntimeHooks } from "nitropack/types";
import type { H3Event } from "h3";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  config: {
    enabled: true,
    domain: "example.test",
    endpoint: "https://plausible.io/api/event",
    includeData: false
  },
  readBody: vi.fn(),
  fetch: vi.fn(),
  create: vi.fn(),
  defaults: {} as { timeout?: number; retry?: number | false },
  body: {} as unknown
}));
vi.mock("ofetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ofetch")>();
  mocks.create.mockImplementation((options) => {
    mocks.defaults = options;
    return actual.ofetch.create(options, { fetch: mocks.fetch });
  });
  return { ...actual, ofetch: { ...actual.ofetch, create: mocks.create } };
});
vi.mock("nitropack/runtime", () => ({
  defineNitroPlugin: (plugin: unknown) => plugin,
  useRuntimeConfig: () => ({ toolAnalytics: mocks.config })
}));
vi.mock("@nuxtjs/mcp-toolkit/server", () => ({
  getSdkServer: () => ({ getClientVersion: () => ({ name: "test-client" }) })
}));
vi.mock("h3", () => ({
  readBody: mocks.readBody,
  getHeader: (_event: unknown, name: string) => (name === "user-agent" ? "test-agent" : undefined),
  getRequestIP: () => "192.0.2.1"
}));
import plugin from "../../server/plugins/tool-analytics";
import { sendToolAnalytics } from "../../server/utils/plausible";

const hooks: Partial<NitroRuntimeHooks> = {};
const fetchMock = mocks.fetch;
let pending: Promise<unknown>[];
let event: H3Event;

beforeEach(() => {
  mocks.config.enabled = true;
  mocks.config.domain = "example.test";
  mocks.config.includeData = false;
  mocks.body = {
    method: "tools/call",
    params: {
      name: "search_articles",
      arguments: { query: "teacher", token: "secret" }
    }
  };
  mocks.readBody.mockReset().mockImplementation(async () => mocks.body);
  pending = [];
  event = {
    method: "POST",
    waitUntil: (promise: Promise<unknown>) => pending.push(promise)
  } as unknown as H3Event;
  fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 202 }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  plugin({
    hooks: {
      hook: (name: keyof NitroRuntimeHooks, callback: never) => {
        hooks[name] = callback;
      }
    }
  } as unknown as NitroApp);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Invoke the same completed-execution hook used by the toolkit. */
async function complete(isError = false, configured = false) {
  if (!configured) await hooks["mcp:config:resolved"]!({ config: { tools: [] } as never, event });
  await hooks["mcp:tool:called"]!({
    name: "search_articles",
    result: { content: [], isError },
    durationMs: 1,
    event
  });
  await Promise.all(pending);
}

it("sends one event with trusted collection and SDK client, omitting arguments by default", async () => {
  await hooks["mcp:config:resolved"]!({
    config: {
      tools: [{ name: "search_articles", _meta: { "onderwijsloket.com/collection": "articles" } }]
    } as never,
    event
  });
  await hooks["mcp:server:created"]!({ server: {} as never, event });
  await complete(false, true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe("https://plausible.io/api/event");
  expect(JSON.parse(options.body)).toEqual({
    name: "MCP Tool Call",
    domain: "example.test",
    url: "https://example.test/mcp",
    props: {
      tool: "search_articles",
      collection: "articles",
      status: "success",
      client: "test-client"
    }
  });
  expect(options.headers.get("x-forwarded-for")).toBe("192.0.2.1");
  expect(mocks.defaults).toMatchObject({ timeout: 1000, retry: 0 });
});

it("counts tool errors and includes only explicitly enabled query data", async () => {
  mocks.config.includeData = true;
  await complete(true);
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).props).toEqual({
    tool: "search_articles",
    collection: "unknown",
    status: "error",
    client: "unknown",
    data: "teacher"
  });
});

it.each(["disabled", "unconfigured"])("does not send when %s", async (mode) => {
  if (mode === "disabled") mocks.config.enabled = false;
  else mocks.config.domain = "";
  await complete();
  expect(fetchMock).not.toHaveBeenCalled();
});

it("registers only execution hooks, so initialization and tools/list are not counted", () => {
  expect(Object.keys(hooks).sort()).toEqual([
    "mcp:config:resolved",
    "mcp:server:created",
    "mcp:tool:called"
  ]);
  expect(fetchMock).not.toHaveBeenCalled();
});

it("does not await delivery in the execution hook", async () => {
  let finish!: (value: Response) => void;
  fetchMock.mockReturnValue(
    new Promise<Response>((resolve) => {
      finish = resolve;
    })
  );
  await hooks["mcp:tool:called"]!({
    name: "search_articles",
    result: { content: [] },
    durationMs: 1,
    event
  });
  expect(pending).toHaveLength(1);
  finish(new Response(null, { status: 202 }));
  await Promise.all(pending);
});

it.each(["network", "timeout", "http", "dropped"])(
  "contains %s delivery failures without retrying",
  async (mode) => {
    if (mode === "http") fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    else if (mode === "dropped")
      fetchMock.mockResolvedValue(
        new Response(null, { status: 202, headers: { "x-plausible-dropped": "1" } })
      );
    else
      fetchMock.mockRejectedValue(
        new DOMException("failed", mode === "timeout" ? "TimeoutError" : "NetworkError")
      );
    await expect(
      sendToolAnalytics(
        mocks.config,
        { tool: "get_article", collection: "articles", status: "error", client: "unknown" },
        {}
      )
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![1].signal).toBeInstanceOf(AbortSignal);
    expect(console.warn).toHaveBeenCalledOnce();
  }
);

it("captures a Node body before transport consumption and never reads it after execution", async () => {
  const h3 = await vi.importActual<typeof import("h3")>("h3");
  const { IncomingMessage, ServerResponse } = await import("node:http");
  const { Socket } = await import("node:net");
  const body = JSON.stringify(mocks.body);
  const request = new IncomingMessage(new Socket());
  request.method = "POST";
  request.url = "/mcp";
  request.headers = {
    host: "localhost",
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body))
  };
  event = h3.createEvent(request, new ServerResponse(request));
  event.waitUntil = (promise) => {
    pending.push(promise);
  };
  mocks.readBody.mockImplementation(h3.readBody);

  const capture = hooks["mcp:config:resolved"]!({ config: { tools: [] } as never, event });
  request.push(body);
  request.push(null);
  await capture;
  expect(await h3.toWebRequest(event).json()).toEqual(mocks.body);

  // A second read would reproduce the hang after the SDK has consumed the stream.
  mocks.readBody.mockImplementation(() => new Promise(() => {}));
  await complete(false, true);
  expect(mocks.readBody).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("clones web requests so the SDK can still consume the original body", async () => {
  const request = new Request("https://example.test/mcp", {
    method: "POST",
    body: JSON.stringify(mocks.body)
  });
  event = {
    method: "POST",
    web: { request },
    waitUntil: (promise: Promise<unknown>) => pending.push(promise)
  } as unknown as H3Event;
  mocks.config.includeData = true;
  await hooks["mcp:config:resolved"]!({ config: { tools: [] } as never, event });
  expect(await request.json()).toEqual(mocks.body);
  await complete(false, true);
  expect(mocks.readBody).not.toHaveBeenCalled();
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).props.data).toBe("teacher");
});

it("uses configured collection metadata even when callers supply another collection", async () => {
  mocks.body = {
    method: "tools/call",
    params: { name: "search_articles", arguments: { collection: "faqs" } }
  };
  await hooks["mcp:config:resolved"]!({
    config: {
      tools: [{ name: "search_articles", _meta: { "onderwijsloket.com/collection": "articles" } }]
    } as never,
    event
  });
  await complete(false, true);
  expect(JSON.parse(fetchMock.mock.calls[0]![1].body).props.collection).toBe("articles");
});

it("retains schema-based collection attribution for shared discovery", async () => {
  const { readToolCallDetails } = await import("../../server/utils/tool-analytics");
  mocks.body = {
    method: "tools/call",
    params: { name: "get_facets", arguments: { collection: "articles", query: "teacher" } }
  };
  const tools = [{ name: "get_facets", inputSchema: { collection: z.literal("articles") } }];
  expect(await readToolCallDetails(event, tools, true)).toEqual({
    tool: "get_facets",
    collection: "articles",
    data: "teacher"
  });
  mocks.body = {
    method: "tools/call",
    params: { name: "get_facets", arguments: { collection: "unknown" } }
  };
  expect(await readToolCallDetails(event, tools, false)).toEqual({
    tool: "get_facets",
    collection: "unknown"
  });
});

it.each(["search_faqs", "search_sectors", "search_testimonials"])(
  "captures query context for %s without a collection argument",
  async (name) => {
    const { readToolCallDetails } = await import("../../server/utils/tool-analytics");
    const collection = name.replace("search_", "");
    mocks.body = { method: "tools/call", params: { name, arguments: { query: "teaching" } } };
    const tools = [{ name, _meta: { "onderwijsloket.com/collection": collection } }];
    expect(await readToolCallDetails(event, tools, true)).toEqual({
      tool: name,
      collection,
      data: "teaching"
    });
  }
);
