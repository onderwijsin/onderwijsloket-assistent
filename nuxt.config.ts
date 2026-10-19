import "varlock/auto-load";
import { ENV } from "varlock/env";

import { version as packageVersion } from "./package.json";

import { app } from "./config/head";
import identity, { siteDescription, siteTitle } from "./config/identity";

import { resolveEnvironment } from "./config/helpers";
const { environment, isDebug, isProd, isPreview, isDev, isTest } = resolveEnvironment(ENV.MODE);

export default defineNuxtConfig({
  compatibilityDate: "2026-06-30",
  devtools: {
    enabled: true
  },

  nitro: { experimental: { asyncContext: true } },

  mcp: {
    name: "Onderwijsloket Assistent (experimental)",
    description: "Experimental read-only access to published Onderwijsloket articles.",
    version: packageVersion,
    // instructions: '', TODO add good system instruction
    icons: [
      { src: "/mcp_icon.png", mimeType: "image/png", sizes: ["64x64"], theme: "light" },
      { src: "/mcp_icon.png", mimeType: "image/png", sizes: ["64x64"], theme: "dark" }
    ]
  },

  css: ["~/assets/css/main.css"],

  modules: [
    "@varlock/nuxt-integration",
    "@nuxt/fonts",
    "@nuxtjs/seo",
    "@nuxt/ui",
    "@nuxt/image",
    "@comark/nuxt",
    "@nuxtjs/mcp-toolkit",
    "@nuxtjs/plausible",
    "motion-v/nuxt",
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "pinia-plugin-persistedstate",
    "@onderwijsin/nuxt-healthcheck",
    "@onderwijsin/nuxt-directus-config",
    "@onderwijsin/nuxt-directus-client",
    "@onderwijsin/nuxt-newsletter-signup"
  ],

  routeRules: {
    "/": { prerender: true },
    "/_nuxt/**": {
      cache: { maxAge: 31_536_000, swr: true },
      headers: { "cache-control": "public, max-age=31_536_000, s-maxage=31_536_000, immutable" }
    },
    "/_fonts/**": {
      cache: { maxAge: 31_536_000, swr: true },
      headers: { "cache-control": "public, max-age=31_536_000, s-maxage=31_536_000, immutable" }
    }
  },

  app: {
    keepalive: true,
    head: app.head
  },

  components: [
    {
      path: "~/components",
      pathPrefix: false
    }
  ],

  vite: {
    optimizeDeps: {
      include: [
        "@plausible-analytics/tracker",
        "@vue/devtools-core",
        "@vue/devtools-kit",
        "zod",
        "@directus/sdk",
        "@comark/vue"
      ]
    }
  },

  varlock: {
    ssrInjectMode: "auto-load",
    envTypesPath: "envs/env.d.ts"
  },

  site: {
    name: siteTitle,
    description: siteDescription,
    url: ENV.NUXT_PUBLIC_SITE_URL!,
    titleSeparator: "|",
    defaultLocale: "nl", // not needed if you have @nuxtjs/i18n installed
    language: "nl_NL",
    indexable: isProd && ENV.DISABLE_INDEXING !== true,
    trailingSlash: false
  },

  image: {
    provider: "directus",
    format: ["avif", "webp"],
    directus: {
      baseURL: ENV.DIRECTUS_ASSET_URL
    }
  },

  ogImage: {
    zeroRuntime: false
  },

  aiReady: false,

  schemaOrg: {
    identity: isTest ? undefined : identity
  },

  ui: {
    theme: {
      colors: ["primary", "secondary", "neutral", "success", "warning", "error", "info"]
    },
    experimental: {
      componentDetection: true
    }
  },

  fonts: {
    families: [{ name: "Poppins", provider: "google", weights: [200, 400, 500, 700] }]
  },

  plausible: {
    domain: ENV.PLAUSIBLE_DOMAIN || new URL(ENV.NUXT_PUBLIC_SITE_URL!).host,
    // https://github.com/nuxt-modules/plausible?tab=readme-ov-file#proxy-configuration
    proxy: true,
    proxyBaseEndpoint: "/api/_plausible",
    ignoredHostnames: ["localhost"],
    autoPageviews: true,
    autoOutboundTracking: true
  },

  icon: {
    serverBundle: {
      collections: ["lucide", "simple-icons"]
    }
  },

  healthcheck: {
    cache: {
      threshold: {
        warn: 50,
        error: 200
      }
    },
    directus: {
      enabled: true,
      baseUrl: ENV.DIRECTUS_URL || "http://localhost:8055",
      threshold: {
        warn: 200,
        error: 1000
      }
    }
  },

  newsletterSignup: {
    provider: "loops",
    apiKey: ENV.LOOPS_API_KEY,
    lists: { default: ENV.LOOPS_LIST_ID },
    fields: {
      firstName: { required: true },
      lastName: { target: "lastName" },
      organization: { target: "organisation" }
    }
  },

  runtimeConfig: {
    apiToken: ENV.API_TOKEN,
    public: {
      directus: {
        assetBaseUrl: ENV.DIRECTUS_ASSET_URL
      },
      buildDate: new Date().toISOString(),
      siteName: siteTitle,
      titleSeparator: "|",
      language: "nl_NL", // prefer more explicit language codes like `en-AU` over `en`
      mode: {
        isDev,
        isProd,
        isPreview,
        isDebug,
        value: environment
      },
      tracking: {
        disabled: ENV.DISABLE_TRACKING === true
      }
    }
  }
});
