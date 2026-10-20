<template>
  <div :class="!disable ? 'fluid' : ''">
    <slot />
  </div>
</template>

<script lang="ts" setup>
defineProps<{ disable?: boolean }>();
</script>

<style>
.fluid {
  position: relative;
  width: 100vw;
  max-width: none;
  margin-left: -50vw;
  left: 50%;
}
</style>
