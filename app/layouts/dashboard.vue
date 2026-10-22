<template>
  <ClientOnly>
    <ChatDashboard><slot /></ChatDashboard>
    <template #fallback>
      <ChatDashboardLoading><slot /></ChatDashboardLoading>
    </template>
  </ClientOnly>
</template>
