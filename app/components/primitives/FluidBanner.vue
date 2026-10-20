<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    useContainer?: boolean;
    innerContainerClass?: string;
    containerClass?: string;
    overrides?: {
      innerContainer?: boolean;
    };
  }>(),
  {
    useContainer: true,
    innerContainerClass: "",
    containerClass: "",
    overrides: undefined
  }
);

const component = props.useContainer ? resolveComponent("UContainer") : "div";
</script>

<template>
  <Fluid class="px-4 sm:px-4">
    <FluidInnerContainer
      class=""
      :class="[
        innerContainerClass,
        !props.overrides?.innerContainer
          ? 'rounded-3xl bg-white py-4 sm:py-6 dark:bg-neutral-800'
          : ''
      ]"
    >
      <component :is="component" :class="containerClass">
        <slot />
      </component>
    </FluidInnerContainer>
  </Fluid>
</template>
