import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"]
    },
    projects: [
      {
        test: {
          name: "unit",
          // Allow cache and limiter tests to replace Nitro virtual runtime dependencies.
          server: { deps: { inline: ["nitropack", "@onderwijsin/nuxt-simple-rate-limiter"] } },
          environment: "node",
          include: ["tests/unit/**/*.test.ts"]
        }
      },
      {
        test: {
          name: "e2e",
          environment: "node",
          include: ["tests/e2e/**/*.test.ts"],
          testTimeout: 30_000,
          hookTimeout: 30_000
        }
      }
    ]
  }
});
