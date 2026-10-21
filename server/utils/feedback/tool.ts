import { getSdkServer, useMcpServer } from "@nuxtjs/mcp-toolkit/server";
import { getHeader } from "h3";
import { useEvent, useRuntimeConfig } from "nitropack/runtime";
import { createNotionClient } from "../notion/client";
import { createNotionFeedbackStorage } from "../notion/feedback-storage";
import { toolResult } from "../tool-result";
import { FeedbackError, type FeedbackErrorCode } from "./errors";
import { createFeedbackService } from "./service";
import type { FeedbackInput } from "./schemas";
import { feedbackConversationSchema, feedbackInput } from "./schemas";
import { z } from "zod";

const chatSnapshotSchema = z.object({
  conversation: feedbackConversationSchema,
  userAgent: z.string().max(2000).optional(),
  settings: feedbackInput.shape.settings
});

const messages: Record<FeedbackErrorCode, string> = {
  INVALID_INPUT:
    "Report validation failed. No report was sent. Check the reported field paths without discarding conversation messages.",
  MISSING_CONVERSATION:
    "The authoritative web chat conversation was not attached. No report was sent. Do not replace it with model-reconstructed history.",
  INVALID_CHAT_CONTEXT:
    "The attached web chat snapshot failed validation. No report was sent. This is not a missing-history error; check the reported field paths.",
  INVALID_METADATA:
    "App/client metadata failed validation. No report was sent. Check the reported field paths.",
  REPORT_TOO_LARGE:
    "The encoded storage request still exceeds the 500,000-byte limit after lossless compression. No report was sent. The size includes the readable transcript, full compressed snapshot and metadata. Do not omit messages, summarize or truncate history to bypass this limit.",
  SNAPSHOT_ENCODING_FAILED:
    "The full report could not be compressed. No report was sent. Do not submit a partial report or retry automatically.",
  NOT_CONFIGURED: "Feedback reporting is not configured. No report was sent.",
  SUBMISSION_REJECTED: "The report could not be accepted. Do not retry automatically.",
  SUBMISSION_UNCERTAIN:
    "The report may already have been saved. Do not retry automatically or claim confirmed success. Ask the team to check before submitting again."
};

/** MCP composition root; another transport can call the service with its own context.
 * @param input - User-approved report validated again by the service.
 * @returns Minimal structured receipt or a sanitized MCP error.
 */
export async function submitFeedbackTool(input: FeedbackInput) {
  try {
    const event = useEvent();
    const config = useRuntimeConfig(event);
    const client = getSdkServer(useMcpServer().server).getClientVersion();
    const snapshot =
      event.context.feedbackChatSnapshot === undefined
        ? undefined
        : chatSnapshotSchema.safeParse(event.context.feedbackChatSnapshot);
    if (snapshot && !snapshot.success)
      throw new FeedbackError("INVALID_CHAT_CONTEXT", {
        fields: snapshot.error.issues.slice(0, 10).map((issue) => issue.path.join("."))
      });
    const chat = snapshot?.success ? snapshot.data : undefined;
    const report = chat
      ? { ...input, conversation: chat.conversation, settings: chat.settings }
      : input;
    const service = createFeedbackService(
      createNotionFeedbackStorage(
        createNotionClient(config.feedback.notionApiToken),
        config.feedback.notionDataSourceId
      )
    );
    return toolResult(
      await service.submit(report, {
        source: chat ? "Web chat" : "MCP client",
        userAgent: chat ? chat.userAgent : getHeader(event, "user-agent")?.slice(0, 2000),
        clientName: chat ? "onderwijsloket-chat" : client?.name?.slice(0, 256) || undefined,
        clientVersion: chat
          ? config.feedback.appVersion
          : client?.version?.slice(0, 256) || undefined,
        appVersion: config.feedback.appVersion,
        environment: config.public.mode.value
      })
    );
  } catch (error) {
    const code = error instanceof FeedbackError ? error.code : "SUBMISSION_UNCERTAIN";
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            code,
            message: messages[code],
            ...(error instanceof FeedbackError && error.details ? { details: error.details } : {})
          })
        }
      ]
    };
  }
}
