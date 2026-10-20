<script lang="ts" setup>
import { siteTitle as title } from "~~/config/identity";
</script>

<template>
  <UHeader
    class="main-header h-(--ui-header-main-height) shadow-xl shadow-neutral-400/10 dark:shadow-neutral-950/50"
    mode="modal"
    :menu="{
      title: 'Navigatie',
      description: `Navigeer naar de verschillende onderdelen van ${title}`,
      transition: true,
      fullscreen: true,
      portal: false,
      class: 'mobile-menu z-40'
    }"
    :ui="{
      root: 'h-(--ui-header-main-height)',
      left: 'lg:flex-0',
      body: 'grow',
      right: 'flex flex-row gap-2 sm:gap-3 md:gap-4',
      header: 'h-(--ui-header-main-height)',
      toggle: 'hidden'
    }"
  >
    <template #title>
      <Logo class="h-5 w-auto lg:h-5.5" />
    </template>

    <template #right>
      <UButton
        to="https://onderwijsin.nl"
        label="Onderwijs in"
        size="sm"
        variant="subtle"
        color="primary"
        trailing-icon="i-lucide-external-link"
        :ui="{ trailingIcon: 'size-3!' }"
      />
      <UColorModeButton />
    </template>
  </UHeader>
</template>
