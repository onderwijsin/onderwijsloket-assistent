<script setup lang="ts">
withDefaults(
  defineProps<{
    baseColor?: "default" | "primary";
  }>(),
  {
    baseColor: "primary"
  }
);
</script>

<template>
  <span
    class="animate-shimmer shimmer-text bg-size-[200%_auto] bg-clip-text text-transparent"
    :class="baseColor === 'default' ? 'default-base' : 'primary-base'"
  >
    <slot />
  </span>
</template>

<style lang="postcss" scoped>
.shimmer-text {
  background-image: linear-gradient(
    135deg,
    var(--color-primary-600),
    var(--color-primary-400),
    var(--color-primary-300),
    var(--color-primary-400),
    var(--color-primary-600)
  );
}
.dark {
  .shimmer-text {
    background-image: linear-gradient(
      135deg,
      var(--color-primary-400),
      var(--color-primary-300),
      var(--color-primary-200),
      var(--color-primary-100),
      var(--color-primary-200),
      var(--color-primary-300),
      var(--color-primary-400)
    );
  }
}

.default-base.shimmer-text {
  background-image: linear-gradient(
    135deg,
    var(--ui-text-highlighted),
    var(--ui-text),
    var(--color-primary-500),
    var(--ui-text),
    var(--ui-text-highlighted)
  );
}

.dark {
  .default-base.shimmer-text {
    background-image: linear-gradient(
      135deg,
      var(--color-primary-300),
      var(--color-primary-200),
      var(--color-primary-100),
      var(--color-primary-50),
      var(--color-primary-100),
      var(--color-primary-200),
      var(--color-primary-300)
    );
  }
}
</style>
