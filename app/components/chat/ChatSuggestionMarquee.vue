<script setup lang="ts">
const props = defineProps<{
  suggestions: { label: string; icon: string; prompt: string }[];
}>();
const emit = defineEmits<{ select: [prompt: string] }>();
</script>

<template>
  <div
    class="relative start-1/2 flex w-screen min-w-0 -translate-x-1/2 flex-col gap-3"
    aria-label="Suggesties om een gesprek te beginnen"
  >
    <UMarquee
      v-for="index in 3"
      :key="index"
      :reverse="index === 2"
      :repeat="2"
      pause-on-hover
      :overlay="false"
      class="suggestion-marquee [--duration:120s] [--gap:0.75rem]"
      :style="{ '--row-delay': `${(index - 1) * -35}s` }"
      :ui="{ content: 'w-auto justify-start' }"
    >
      <UButton
        v-for="suggestion in props.suggestions"
        :key="suggestion.label"
        :label="suggestion.label"
        :icon="suggestion.icon"
        color="neutral"
        variant="outline"
        size="lg"
        class="shrink-0 rounded-full bg-default/50"
        @click="emit('select', suggestion.prompt)"
      />
    </UMarquee>
  </div>
</template>

<style scoped>
.suggestion-marquee :deep([data-slot="content"]) {
  animation-delay: var(--row-delay);
}

.suggestion-marquee:focus-within :deep([data-slot="content"]),
.suggestion-marquee:active :deep([data-slot="content"]) {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .suggestion-marquee {
    overflow-x: auto;
  }

  .suggestion-marquee :deep([data-slot="content"]:nth-child(n + 2)) {
    display: none;
  }
}
</style>
