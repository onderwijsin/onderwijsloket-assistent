<script setup lang="ts">
useHead({ titleTemplate: "%s | Stichting Onderwijs in" });
</script>

<template>
  <ClientOnly>
    <ChatDashboard />
    <template #fallback><ChatDashboardLoading /></template>
  </ClientOnly>
</template>
