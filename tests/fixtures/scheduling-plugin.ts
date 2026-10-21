import { defineNitroPlugin } from "nitropack/runtime";

/** Test-only transport interception. Production retains the fixed SavvyCal origin. */
export default defineNitroPlugin(() => {
  const nativeFetch = globalThis.fetch;
  const fixture = process.env.SCHEDULING_FIXTURE_URL;
  globalThis.fetch = (input, init) => {
    const url = new URL(
      typeof input === "string" ? input : input instanceof URL ? input.href : input.url
    );
    if (url.origin !== "https://api.savvycal.com") return nativeFetch(input, init);
    if (!fixture) throw new Error("Scheduling fixture URL is required for provider requests");
    // The adapter uses a synthetic runtime key; never forward production credentials to fixtures.
    if (new Headers(init?.headers).get("authorization") !== "Bearer fixture-savvycal-token")
      throw new Error("Refusing non-fixture SavvyCal credentials");
    return nativeFetch(`${fixture}${url.pathname}${url.search}`, init);
  };
});
