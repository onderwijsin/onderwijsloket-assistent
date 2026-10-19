import { defineDirectusConfig } from "@onderwijsin/nuxt-directus-config/config";
import { ENV } from "varlock/env";

export default defineDirectusConfig({
  instance: {
    baseUrl: ENV.DIRECTUS_URL,
    proxyToken: ENV.DIRECTUS_PROXY_TOKEN
  },
  client: {
    commands: [
      "readItem",
      "readItems",
      "aggregate",
      "createItem",
      "createItems",
      "updateItem",
      "updateItems",
      "deleteItem",
      "updateUser",
      "readMe",
      "readSingleton"
    ],
    typegen: {
      introspectionToken: ENV.DIRECTUS_INTROSPECTION_TOKEN
      // cache: { maxAge: 0 } // Uncomment for a fresh typegen introspection
    },
    auth: {
      enabled: false
    },
    assets: {
      enabled: false
    }
  }
});
