<template>
  <ClientOnly>
    <ChatDashboard />
    <template #fallback><ChatDashboardLoading /></template>
  </ClientOnly>
</template>
