<script lang="ts" setup>
withDefaults(
  defineProps<{
    title?: string;
  }>(),
  {
    title: "Op de hoogte blijven?"
  }
);
</script>

<template>
  <div
    class="bg-elevated border-sand-extra-dark @container relative space-y-2 rounded-lg border p-4 py-6 sm:p-6 md:p-8 dark:border-neutral-700"
  >
    <h3 class="text-xl font-black @xl:text-2xl">
      <slot name="title" />
      <span v-if="!$slots.title">{{ title }}</span>
    </h3>
    <p class="text-md text-muted mb-6 @xl:text-lg">
      <slot name="description" />
      <span v-if="!$slots.description"
        >Schrijf je in voor onze <strong>maandelijkse deep dives</strong> - direct in je
        inbox.</span
      >
    </p>
    <div class="grid w-full max-w-lg">
      <MailchimpSignup />
    </div>
  </div>
</template>
