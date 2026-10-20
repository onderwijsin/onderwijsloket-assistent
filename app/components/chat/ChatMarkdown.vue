<script setup lang="ts">
defineProps<{ text: string; streaming: boolean }>();
</script>

<template>
  <Suspense>
    <Markdown
      :value="text"
      :streaming="streaming"
      class="min-w-0 text-sm leading-6 [overflow-wrap:anywhere] *:first:mt-0 *:last:mb-0 [&_li]:my-1 [&_ol]:my-3 [&_p]:my-3 [&_p]:leading-6 [&_ul]:my-3"
    />
    <template #fallback>
      <p class="min-w-0 text-sm leading-6 [overflow-wrap:anywhere] whitespace-pre-wrap">
        {{ text }}
      </p>
    </template>
  </Suspense>
</template>
