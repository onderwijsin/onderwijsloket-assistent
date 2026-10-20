<script lang="ts" setup>
import type { FooterSubMenuItem } from "~/types/navigation";

const { socials } = useAppConfig();

const footerSubMenu = [
  {
    label: "Privacy",
    to: "https:/onderwijsin.nl/privacy"
  },
  {
    label: "Algemene voorwaarden",
    to: "https://onderwijsin.nl/algemene-voorwaarden"
  }
] satisfies FooterSubMenuItem[];
</script>

<template>
  <FluidBanner :use-container="false" class="pb-3 sm:px-4 sm:pb-6 md:pb-8">
    <UFooter>
      <template #left>
        <Logo class="hidden h-5 w-auto sm:block" />
      </template>

      <LazyUNavigationMenu
        :items="footerSubMenu"
        hydrate-on-visible
        :ui="{
          link: 'text-xs',
          list: 'flex flex-col sm:flex-row -mb-4 sm:mb-0'
        }"
      />

      <template #right>
        <UButton
          v-for="social in socials"
          :key="social.label"
          :icon="social.icon"
          color="primary"
          variant="ghost"
          :to="social.url"
          target="_blank"
          :aria-label="social.label"
        />
      </template>
    </UFooter>
  </FluidBanner>
</template>
