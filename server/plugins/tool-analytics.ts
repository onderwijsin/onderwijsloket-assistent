import type { H3Event } from "h3";
import { defineNitroPlugin, useRuntimeConfig } from "nitropack/runtime";
import { getSdkServer } from "@nuxtjs/mcp-toolkit/server";
import { sendToolAnalytics, type ToolAnalyticsProps } from "../utils/plausible";
import {
  getToolAnalyticsHeaders,
  readToolCallDetails,
  type ToolCallDetails
} from "../utils/tool-analytics";

interface RequestAnalytics {
  call?: ToolCallDetails;
  server?: ReturnType<typeof getSdkServer>;
}

/** Capture input before transport execution and track completed calls, including cache hits. */
export default defineNitroPlugin((nitroApp) => {
  const requests = new WeakMap<H3Event, RequestAnalytics>();

  nitroApp.hooks.hook("mcp:config:resolved", async ({ config, event }) => {
    const analytics = useRuntimeConfig(event).toolAnalytics;
    if (!analytics.enabled || !analytics.domain || event.method !== "POST") return;

    const call = await readToolCallDetails(event, config.tools, analytics.includeData);
    requests.set(event, { call });
  });

  nitroApp.hooks.hook("mcp:server:created", ({ server, event }) => {
    const request = requests.get(event);
    if (request) request.server = getSdkServer(server);
  });

  nitroApp.hooks.hook("mcp:tool:called", ({ name, result, event }) => {
    const config = useRuntimeConfig(event).toolAnalytics;
    if (!config.enabled || !config.domain) return;

    const request = requests.get(event);
    const call = request?.call?.tool === name ? request.call : undefined;
    const props: ToolAnalyticsProps = {
      tool: name,
      collection: call?.collection || "unknown",
      status: result.isError ? "error" : "success",
      client: request?.server?.getClientVersion()?.name || "unknown"
    };
    if (call?.data) props.data = call.data;

    event.waitUntil(sendToolAnalytics(config, props, getToolAnalyticsHeaders(event)));
  });
});
