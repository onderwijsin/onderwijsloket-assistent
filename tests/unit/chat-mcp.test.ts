import { beforeEach, describe, expect, it, vi } from "vitest";
import type { H3Event } from "h3";
import { ToolLoopAgent, isStepCount } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { connectChatMcp, withMcpCleanup } from "../../server/utils/chat/mcp";
import { prepareChatMessages } from "../../server/utils/chat/messages";
import { chatRequestSchema } from "../../server/utils/chat/request";

const { localFetch, calls } = vi.hoisted(() => ({ localFetch: vi.fn(), calls: [] as string[] }));
vi.mock("nitropack/runtime", () => ({ useNitroApp: () => ({ localFetch }) }));
const event = {
  context: { fixture: true, clientAddress: "192.0.2.10" },
  node: { req: { headers: { "user-agent": "Web fixture" } } }
} as unknown as H3Event;
const selections = { question: "answer" };

beforeEach(() => {
  calls.length = 0;
  localFetch.mockReset().mockImplementation(async (path, init) => {
    expect(path).toBe("/mcp");
    expect(init.context).toBe(event.context);
    expect(init.context.schedulingClientName).toBe("onderwijsloket-chat");
    const rpc = JSON.parse(init.body);
    calls.push(rpc.method);
    if (rpc.id == null) return new Response(null, { status: 202 });
    let result;
    switch (rpc.method) {
      case "initialize":
        result = {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {}, prompts: {}, resources: {} },
          serverInfo: { name: "fixture", version: "1" },
          instructions: "Use fixture evidence"
        };
        break;
      case "tools/list":
        result = {
          tools: [
            {
              name: "get_route_questions",
              description: "Read source questions",
              inputSchema: {
                type: "object",
                properties: {
                  selections: { type: "object", additionalProperties: { type: "string" } }
                },
                required: []
              }
            }
          ]
        };
        break;
      case "tools/call":
        result = { content: [{ type: "text", text: JSON.stringify({ selections }) }] };
        break;
      case "prompts/list":
        result = {
          prompts: [
            {
              name: "find-education-routes",
              description: "Explore routes",
              arguments: [{ name: "background", required: false }]
            }
          ]
        };
        break;
      case "prompts/get":
        result = {
          messages: [
            { role: "user", content: { type: "text", text: "Ask source questions one at a time" } }
          ]
        };
        break;
      case "resources/list":
        result = { resources: [] };
        break;
      case "resources/templates/list":
        result = {
          resourceTemplates: [{ name: "faqs", uriTemplate: "onderwijsloket://faqs/{id}" }]
        };
        break;
      case "resources/read":
        result = {
          contents: [{ uri: rpc.params.uri, text: "Fixture source", mimeType: "text/markdown" }]
        };
        break;
      default:
        return Response.json({
          jsonrpc: "2.0",
          id: rpc.id,
          error: { code: -32601, message: "Unsupported" }
        });
    }
    return Response.json({ jsonrpc: "2.0", id: rpc.id, result });
  });
});

it("discovers MCP tools and instructions and exposes prompts/resources through the local dispatcher", async () => {
  const session = await connectChatMcp(event);
  try {
    expect(session.instructions).toBe("Use fixture evidence");
    expect(Object.keys(session.tools)).toEqual(
      expect.arrayContaining([
        "get_route_questions",
        "mcp_get_prompt",
        "mcp_list_resources",
        "mcp_read_resource"
      ])
    );
    const options = { toolCallId: "call", messages: [], context: {} };
    expect(await session.tools.get_route_questions!.execute!({}, options)).toMatchObject({
      content: expect.any(Array)
    });
    expect(
      await session.tools.mcp_get_prompt!.execute!(
        { name: "find-education-routes", arguments: {} },
        options
      )
    ).toMatchObject({ messages: expect.any(Array) });
    expect(
      await session.tools.mcp_read_resource!.execute!(
        { uri: "onderwijsloket://faqs/record" },
        options
      )
    ).toMatchObject({ contents: [{ text: "Fixture source" }] });
    expect(await session.tools.mcp_list_resources!.execute!({}, options)).toMatchObject({
      resourceTemplates: expect.any(Array)
    });
  } finally {
    await session.close();
    await session.close();
  }
});

it("forwards only the current request history and settings, without retaining them for the next request", async () => {
  const request = chatRequestSchema.parse({
    messages: [
      { id: "u1", role: "user", parts: [{ type: "text", text: "Earlier personal detail" }] },
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Earlier response" }] },
      { id: "u2", role: "user", parts: [{ type: "text", text: "Send this report" }] }
    ]
  });
  const session = await connectChatMcp(event, request);
  try {
    expect(event.context.feedbackChatSnapshot).toEqual({
      conversation: { messages: request.messages },
      userAgent: "Web fixture",
      settings: {
        model: request.model,
        webSearch: request.webSearch,
        extendedThinking: request.extendedThinking
      }
    });
    for (const call of localFetch.mock.calls)
      expect(call[1].context.feedbackChatSnapshot).toBe(event.context.feedbackChatSnapshot);
  } finally {
    await session.close();
  }
  const next = await connectChatMcp(event);
  try {
    expect(event.context.feedbackChatSnapshot).toBeUndefined();
  } finally {
    await next.close();
  }
});

it("executes an MCP tool and lets the agent use its result in the next generation step", async () => {
  const session = await connectChatMcp(event);
  const usage = {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 }
  };
  const model = new MockLanguageModelV4({
    doStream: [
      {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({
              type: "tool-call",
              toolCallId: "c1",
              toolName: "get_route_questions",
              input: "{}"
            });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "tool-calls", raw: "tool_calls" },
              usage
            });
            controller.close();
          }
        })
      },
      {
        stream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: "text-start", id: "t1" });
            controller.enqueue({
              type: "text-delta",
              id: "t1",
              delta: "Welke opleiding heb je afgerond?"
            });
            controller.enqueue({ type: "text-end", id: "t1" });
            controller.enqueue({
              type: "finish",
              finishReason: { unified: "stop", raw: "stop" },
              usage
            });
            controller.close();
          }
        })
      }
    ]
  });
  try {
    const agent = new ToolLoopAgent({ model, tools: session.tools, stopWhen: isStepCount(3) });
    const response = await agent.stream({
      messages: [{ role: "user", content: "Welke route past bij mij?" }]
    });
    const reader = response.stream.getReader();
    const chunks = [];
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      chunks.push(item.value);
    }
    expect(chunks).toContainEqual(
      expect.objectContaining({ type: "text-delta", text: "Welke opleiding heb je afgerond?" })
    );
    expect(calls).toContain("tools/call");
    expect(model.doStreamCalls).toHaveLength(2);
    expect(JSON.stringify(model.doStreamCalls[1]?.prompt)).toContain("selections");
  } finally {
    await session.close();
  }
});

it("keeps validated dynamic MCP tool results for follow-ups and rejects unknown tools", async () => {
  const session = await connectChatMcp(event);
  try {
    const input = {
      messages: [
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "get_route_questions",
              toolCallId: "c1",
              state: "output-available",
              input: {},
              output: { content: [{ type: "text", text: JSON.stringify({ selections }) }] }
            }
          ]
        },
        { id: "u1", role: "user", parts: [{ type: "text", text: "Ja" }] }
      ]
    };
    const messages = await prepareChatMessages(
      chatRequestSchema.parse(input).messages,
      session.tools
    );
    expect(JSON.stringify(messages)).toContain("selections");
    expect(messages[0]?.parts[0]?.type).toBe("tool-get_route_questions");
    Object.assign(input.messages[0]!.parts[0]!, { toolName: "unknown" });
    await expect(
      prepareChatMessages(chatRequestSchema.parse(input).messages, session.tools)
    ).rejects.toThrow("Unknown chat tool");
  } finally {
    await session.close();
  }
});

describe("MCP stream lifecycle", () => {
  it("cleans up when a consumer cancels", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const stream = withMcpCleanup(new ReadableStream({ pull: () => {} }), cleanup);
    await stream.cancel();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it("cleans up when the underlying stream fails", async () => {
    const cleanup = vi.fn().mockResolvedValue(undefined);
    const reader = withMcpCleanup(
      new ReadableStream({ start: (controller) => controller.error(new Error("failed")) }),
      cleanup
    ).getReader();
    await expect(reader.read()).rejects.toThrow("failed");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
