import { describe, expect, it, vi } from "vitest";

vi.mock("varlock/env", () => ({ ENV: { DEBUG: false, NODE_ENV: "test" } }));

import { resolveEnvironment } from "../../config/helpers";

describe("resolveEnvironment", () => {
  it.each(["production", "preview"] as const)("preserves %s mode", (mode) => {
    expect(resolveEnvironment(mode)).toMatchObject({
      environment: mode,
      isProd: mode === "production",
      isPreview: mode === "preview",
      isDev: false,
      isTest: true
    });
  });

  it.each([undefined, "development", "unknown"])("defaults %s to development", (mode) => {
    expect(resolveEnvironment(mode)).toMatchObject({
      environment: "development",
      isProd: false,
      isPreview: false,
      isDev: true
    });
  });
});
