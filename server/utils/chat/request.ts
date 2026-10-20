import { z } from "zod";

const textPart = z.object({ type: z.literal("text"), text: z.string().max(32_000) });
const displayPart = z.looseObject({
  type: z.union([
    z.enum([
      "reasoning",
      "step-start",
      "source-url",
      "source-document",
      "tool-web_search",
      "dynamic-tool"
    ]),
    z.string().regex(/^tool-[a-zA-Z0-9_-]+$/)
  ])
});

/** Bound UI messages before SDK validation against the discovered tool schemas. */
const messageSchema = z
  .object({
    id: z.string().min(1).max(256),
    role: z.enum(["user", "assistant"]),
    parts: z
      .array(z.union([textPart, displayPart]))
      .min(1)
      .max(100)
  })
  .superRefine((message, context) => {
    if (message.role === "user" && !message.parts.every((part) => part.type === "text")) {
      context.addIssue({ code: "custom", message: "User messages must contain text only." });
    }
  });

/** Public request contract, compatible with the AI SDK's default chat transport. */
export const chatRequestSchema = z
  .object({
    model: z.enum(["mistral-medium-latest", "gpt-6-luna"]).default("gpt-6-luna"),
    generateTitle: z.boolean().default(false),
    webSearch: z.boolean().default(false),
    extendedThinking: z.boolean().default(true),
    messages: z.array(messageSchema).min(1).max(100)
  })
  .superRefine(({ messages }, context) => {
    const last = messages.at(-1);
    if (
      last?.role !== "user" ||
      !last.parts.some(
        (part) => part.type === "text" && typeof part.text === "string" && part.text.trim()
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "End with a non-empty user message."
      });
    }
    if (
      messages.reduce(
        (total, message) =>
          total +
          message.parts.reduce(
            (size, part) =>
              size + (part.type === "text" && typeof part.text === "string" ? part.text.length : 0),
            0
          ),
        0
      ) > 100_000
    ) {
      context.addIssue({
        code: "custom",
        path: ["messages"],
        message: "Conversation is too long."
      });
    }
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
