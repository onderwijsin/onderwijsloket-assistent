import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { createApp, defineEventHandler, toWebHandler } from "h3";
import { enforceSchedulingRateLimit } from "../../server/utils/scheduling/rate-limit";
import { schedulingRateLimit } from "../../server/utils/scheduling/config";

const { storage } = vi.hoisted(() => ({ storage: new Map<string, unknown>() }));
vi.mock("nitropack/runtime", () => ({
  useRuntimeConfig: () => ({}),
  useStorage: (namespace: string) => ({
    getItem: async (key: string) => storage.get(`${namespace}:${key}`),
    setItem: async (key: string, value: unknown) => {
      storage.set(`${namespace}:${key}`, value);
    }
  })
}));
const app = createApp().use(
  "/mcp",
  defineEventHandler(async (event) => {
    event.context.clientAddress = "192.0.2.20";
    try {
      await enforceSchedulingRateLimit(event);
      return { allowed: true };
    } catch (error) {
      return {
        code: (error as { code: string }).code,
        retryAt: (error as { retryAt: string }).retryAt
      };
    }
  })
);
const handler = toWebHandler(app);
const request = () =>
  handler(
    new Request("http://localhost/mcp", {
      headers: { "x-forwarded-for": Math.random().toString() }
    })
  ).then((response) => response.json());
beforeEach(() => {
  storage.clear();
  vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("event creation quota", () => {
  it("shares the per-IP quota despite forged headers, blocks attempt four, and resets after an hour", async () => {
    for (let index = 0; index < schedulingRateLimit.max; index++)
      expect(await request()).toEqual({ allowed: true });
    expect(await request()).toEqual({ code: "RATE_LIMITED", retryAt: "2027-01-01T01:00:00.000Z" });
    expect(storage.size).toBe(1);
    vi.advanceTimersByTime(3600001);
    expect(await request()).toEqual({ allowed: true });
  });
});
