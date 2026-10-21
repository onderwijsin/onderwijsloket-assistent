import { getSdkServer, useMcpServer } from "@nuxtjs/mcp-toolkit/server";
import { getHeader } from "h3";
import { useEvent, useRuntimeConfig } from "nitropack/runtime";
import { createNotionClient } from "../notion/client";
import { createNotionFeedbackStorage } from "../notion/feedback-storage";
import { toolResult } from "../tool-result";
import { FeedbackError, type FeedbackErrorCode } from "./errors";
import { createFeedbackService } from "./service";
import type { FeedbackInput } from "./schemas";

const messages: Record<FeedbackErrorCode, string> = {
  INVALID_INPUT:
    "The report is invalid or exceeds the 80 KB limit. Review and reduce the included context, then ask for consent again if its contents change.",
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
    const service = createFeedbackService(
      createNotionFeedbackStorage(
        createNotionClient(config.feedback.notionApiToken),
        config.feedback.notionDataSourceId
      )
    );
    return toolResult(
      await service.submit(input, {
        source: client?.name === "onderwijsloket-chat" ? "Web chat" : "MCP client",
        userAgent: getHeader(event, "user-agent")?.slice(0, 2000),
        clientName: client?.name?.slice(0, 256) || undefined,
        clientVersion: client?.version?.slice(0, 256) || undefined,
        appVersion: config.feedback.appVersion,
        environment: config.public.mode.value
      })
    );
  } catch (error) {
    const code = error instanceof FeedbackError ? error.code : "SUBMISSION_UNCERTAIN";
    return {
      isError: true,
      content: [{ type: "text" as const, text: JSON.stringify({ code, message: messages[code] }) }]
    };
  }
}
