<script setup>
import { nl } from "@nuxt/ui/locale";
import {
  ORGANIZATION_SCHEMA_ID,
  WEBSITE_SCHEMA_ID,
  siteTitle as title,
  siteDescription as description
} from "~~/config/identity";

useSchemaOrg([
  defineWebSite({
    "@id": WEBSITE_SCHEMA_ID,
    publisher: {
      "@id": ORGANIZATION_SCHEMA_ID
    }
  })
]);

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogImage:
    "https://res.cloudinary.com/onderwijsin/image/upload/w_1200/brand/onderwijsin_meta_hxhulm.png",
  twitterCard: "summary_large_image"
});
</script>

<template>
  <UApp :toaster="{ expand: false }" :tooltip="{ delayDuration: 250 }" :locale="nl">
    <NuxtRouteAnnouncer />
    <NuxtLoadingIndicator
      :throttle="0"
      color="repeating-linear-gradient(to right, var(--color-primary-400) 0%, var(--color-tertiary-500) 100%)"
      class="fixed top-0 right-0 left-0 z-50"
    />
    <Header />

    <UMain>
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </UMain>

    <NewsletterBanner class="mb-4 sm:mb-6" />
    <Footer />
  </UApp>
</template>
