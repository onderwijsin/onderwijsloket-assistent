import { fileURLToPath } from "node:url";
import { fetch, setup } from "@nuxt/test-utils/e2e";
import { describe, expect, it } from "vitest";

describe("application", async () => {
  await setup({
    rootDir: fileURLToPath(new URL("../../", import.meta.url)),
    dev: false,
    build: true,
    server: true,
    browser: false,
    setupTimeout: 180_000,
    nuxtConfig: {
      devtools: { enabled: false },
      nitro: { preset: "node-server" }
    }
  });

  it("serves the application HTML", async () => {
    const response = await fetch("/");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('id="__nuxt"');
  });
});
