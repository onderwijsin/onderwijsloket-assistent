<script setup lang="ts">
import policy from "./privacy.md?raw";

definePageMeta({ layout: "dashboard" });
useSeoMeta({ title: "Privacy" });
</script>

<template>
  <UContainer class="min-h-0 flex-1 overflow-y-auto py-6 pb-12">
    <article v-if="policy" class="">
      <Markdown :value="policy" class="prose dark:prose-invert mx-auto" />
    </article>
  </UContainer>
</template>
