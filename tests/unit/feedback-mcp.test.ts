import { beforeEach, describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { feedbackInput, feedbackOutput } from "../../server/utils/feedback/schemas";
import { submitFeedbackTool } from "../../server/utils/feedback/tool";

const { createPage, config, state } = vi.hoisted(() => ({
  createPage: vi.fn(),
  config: {
    feedback: {
      notionApiToken: "private-token",
      notionDataSourceId: "400b66e1-be69-80b6-a7cb-000bf91f086e",
      appVersion: "1.0"
    },
    public: { mode: { value: "development" } }
  },
  state: { server: undefined as unknown, context: {} as Record<string, unknown> }
}));
vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: () => config,
  useEvent: () => ({
    context: state.context,
    node: { req: { headers: { "user-agent": "Fixture UA" } } }
  })
}));
vi.mock("@nuxtjs/mcp-toolkit/server", () => ({
  useMcpServer: () => ({ server: state.server }),
  getSdkServer: (server: McpServer) => server.server
}));
vi.mock("../../server/utils/notion/client", () => ({ createNotionClient: () => ({ createPage }) }));

const args = {
  title: "Bug report",
  category: "bug",
  message: "The answer failed.",
  user_consent: true,
  conversation: {
    messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: "Current conversation" }] }]
  }
};
beforeEach(() => {
  state.context = {};
  createPage.mockReset().mockResolvedValue("400b66e1-be69-805d-9625-000cfde4b019");
});

/** Execute the production MCP adapter over real SDK validation and serialization.
 * @param action - Assertions against the connected client.
 * @returns Resolves after both in-memory transports close.
 */
async function withClient(action: (client: Client) => Promise<void>) {
  const server = new McpServer({ name: "feedback-fixture", version: "1" });
  state.server = server;
  server.registerTool(
    "submit_feedback",
    { inputSchema: feedbackInput.shape, outputSchema: feedbackOutput.shape },
    submitFeedbackTool
  );
  const client = new Client({ name: "fixture-client", version: "2" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    await action(client);
  } finally {
    await client.close();
    await server.close();
  }
}

describe("feedback MCP contract", () => {
  it("identifies invalid attached history separately from missing history without leaking values", async () => {
    state.context.feedbackChatSnapshot = {
      conversation: {
        messages: [
          { role: "private-invalid-role", parts: [{ type: "text", text: "private transcript" }] }
        ]
      }
    };
    await withClient(async (client) => {
      const result = await client.callTool({ name: "submit_feedback", arguments: args });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("INVALID_CHAT_CONTEXT");
      expect(JSON.stringify(result)).toContain("conversation.messages.0.role");
      expect(JSON.stringify(result)).not.toContain("private-invalid-role");
      expect(JSON.stringify(result)).not.toContain("private transcript");
      expect(createPage).not.toHaveBeenCalled();
    });
  });
  it("attaches the complete request-local web chat instead of agent-supplied excerpts", async () => {
    const conversation = {
      messages: [
        {
          id: "u1",
          role: "user",
          parts: [{ type: "text", text: "Personal information shared earlier" }]
        },
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "dynamic-tool",
              toolName: "get_faq",
              input: { id: "faq-1" },
              output: { answer: "Full tool result" }
            },
            { type: "text", text: "Answer" }
          ]
        },
        {
          id: "u2",
          role: "user",
          parts: [{ type: "text", text: "Yes, send this conversation and metadata" }]
        }
      ]
    };
    const settings = { model: "actual-model", webSearch: false, extendedThinking: true };
    state.context.feedbackChatSnapshot = { conversation, settings };
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "submit_feedback",
        arguments: { ...args, settings: { ...settings, model: "invented" } }
      });
      expect(result.isError).not.toBe(true);
      const body = createPage.mock.calls[0]![0];
      const report = JSON.parse(
        body.children[0].code.rich_text
          .map((part: { text: { content: string } }) => part.text.content)
          .join("")
      );
      expect(report.input.conversation).toEqual(conversation);
      expect(report.input.settings).toEqual(settings);
      expect(report.context.source).toBe("Web chat");
      expect(report.consentVersion).toBe("feedback-v3");
    });
  });

  it("does not attach or persist a conversation without consent", async () => {
    state.context.feedbackChatSnapshot = { conversation: args.conversation };
    const result = await submitFeedbackTool({
      ...args,
      category: "bug",
      user_consent: false
    } as unknown as Parameters<typeof submitFeedbackTool>[0]);
    expect(result).toMatchObject({ isError: true });
    expect(createPage).not.toHaveBeenCalled();
  });

  it("rejects external submissions without history instead of saving an incomplete report", async () => {
    await withClient(async (client) => {
      const { conversation: _conversation, ...withoutHistory } = args;
      const result = await client.callTool({ name: "submit_feedback", arguments: withoutHistory });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("MISSING_CONVERSATION");
      expect(createPage).not.toHaveBeenCalled();
    });
  });
  it("advertises explicit consent and returns a minimal receipt with request attribution", async () => {
    await withClient(async (client) => {
      const tools = await client.listTools();
      expect(tools.tools[0]?.inputSchema.required).toContain("user_consent");
      const result = await client.callTool({ name: "submit_feedback", arguments: args });
      expect(result.isError).not.toBe(true);
      expect(feedbackOutput.safeParse(result.structuredContent).success).toBe(true);
      expect(createPage).toHaveBeenCalledOnce();
      const body = createPage.mock.calls[0]![0];
      expect(body.properties["MCP client"].rich_text[0].text.content).toBe("fixture-client");
      expect(body.properties["MCP client version"].rich_text[0].text.content).toBe("2");
      expect(body.properties["User agent"].rich_text[0].text.content).toBe("Fixture UA");
      expect(JSON.stringify(result)).not.toContain("private-token");
      expect(JSON.stringify(result)).not.toContain(args.message);
    });
  });

  it("rejects false consent at the protocol boundary without writing", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "submit_feedback",
        arguments: { ...args, user_consent: false }
      });
      expect(result.isError).toBe(true);
      expect(createPage).not.toHaveBeenCalled();
    });
  });

  it("returns safe uncertainty instructions instead of leaking adapter failures", async () => {
    createPage.mockRejectedValue(new Error("private-token user@example.test"));
    await withClient(async (client) => {
      const result = await client.callTool({ name: "submit_feedback", arguments: args });
      expect(result.isError).toBe(true);
      expect(JSON.stringify(result)).toContain("SUBMISSION_UNCERTAIN");
      expect(JSON.stringify(result)).toContain("Do not retry automatically");
      expect(JSON.stringify(result)).not.toContain("private-token");
      expect(JSON.stringify(result)).not.toContain("user@example.test");
      expect(createPage).toHaveBeenCalledOnce();
    });
  });
});
