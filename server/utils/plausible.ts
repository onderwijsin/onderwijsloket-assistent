import { ofetch } from "ofetch";

/** Server-only configuration for best-effort tool call analytics. */
export interface ToolAnalyticsConfig {
  enabled: boolean;
  domain: string;
  endpoint: string;
  includeData: boolean;
}

/** Explicitly selected event properties; never pass complete tool arguments here. */
export interface ToolAnalyticsProps {
  tool: string;
  collection: string;
  status: "success" | "error";
  client: string;
  data?: string;
}

const plausibleFetch = ofetch.create({
  method: "POST",
  timeout: 1000,
  retry: 0,
  /**
   * Report successful HTTP deliveries that Plausible explicitly dropped.
   * @param options - Fetch response context, including attribution status headers.
   */
  onResponse({ response }) {
    if (response.ok && response.headers.get("x-plausible-dropped") === "1") {
      console.warn(
        "[tool-analytics] Plausible dropped an event; check client attribution headers."
      );
    }
  },
  /** Log a failed analytics response without exposing event data. */
  onResponseError() {
    console.warn("[tool-analytics] Event delivery failed.");
  },
  /** Log an analytics transport failure without exposing event data. */
  onRequestError() {
    console.warn("[tool-analytics] Event delivery failed.");
  }
});

/**
 * Deliver once with a bounded timeout; failures never propagate to the MCP response.
 * @param config - Server-only delivery settings.
 * @param props - Allowlisted tool event properties.
 * @param headers - Client attribution headers for Plausible.
 */
export async function sendToolAnalytics(
  config: ToolAnalyticsConfig,
  props: ToolAnalyticsProps,
  headers: Record<string, string>
): Promise<void> {
  if (!config.enabled || !config.domain) return;
  try {
    await plausibleFetch(config.endpoint, {
      headers,
      body: {
        name: "MCP Tool Call",
        domain: config.domain,
        url: `https://${config.domain}/mcp`,
        props
      }
    });
  } catch {
    // Interceptors log delivery failures without event data. Analytics must not reject the tool call.
  }
}
