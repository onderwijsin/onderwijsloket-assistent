import { describe, expect, it, vi } from "vitest";
import { useAlgoliaClient } from "../../server/utils/search/algolia-client";

const { create, config } = vi.hoisted(() => ({
  create: vi.fn(() => ({ searchSingleIndex: vi.fn() })),
  config: { applicationId: "app", token: "secret", host: "" }
}));
vi.mock("algoliasearch", () => ({ algoliasearch: create }));
vi.mock("nitropack/runtime", () => ({ useRuntimeConfig: () => ({ algolia: config }) }));

describe("server Algolia client", () => {
  it("reuses SDK clients for the same private runtime configuration", () => {
    const first = useAlgoliaClient();
    expect(useAlgoliaClient()).toBe(first);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith("app", "secret", undefined);
  });
  it("uses the optional HTTP fixture host and rebuilds clients when config changes", () => {
    config.host = "http://127.0.0.1:8056";
    useAlgoliaClient();
    expect(create).toHaveBeenLastCalledWith("app", "secret", {
      hosts: [{ url: "127.0.0.1:8056", protocol: "http", accept: "readWrite" }]
    });
    config.token = "changed";
    useAlgoliaClient();
    expect(create).toHaveBeenLastCalledWith("app", "changed", expect.any(Object));
    config.host = "file:///invalid";
    expect(() => useAlgoliaClient()).toThrow("Unsupported Algolia host protocol");
  });
  it("parses HTTPS overrides and rejects hosts without an HTTP(S) origin", () => {
    config.host = "https://search.example.com:8443";
    useAlgoliaClient();
    expect(create).toHaveBeenLastCalledWith("app", "changed", {
      hosts: [{ url: "search.example.com:8443", protocol: "https", accept: "readWrite" }]
    });
    for (const host of ["search.example.com", "//search.example.com", "https://"]) {
      config.host = host;
      expect(() => useAlgoliaClient()).toThrow();
    }
  });
});
