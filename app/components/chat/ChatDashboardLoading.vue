<template>
  <UDashboardGroup
    unit="rem"
    :persistent="false"
    class="bg-sand-main dark:bg-neutral-950"
    aria-busy="true"
    aria-label="Dashboard laden"
  >
    <UDashboardSidebar
      id="chat-navigation-loading"
      :default-size="17"
      :min-size="16"
      :max-size="28"
      :collapsed-size="4"
      :toggle="false"
      class="border-r-0 py-3"
    >
      <template #header>
        <div class="min-w-0"><Logo class="h-6 w-auto max-w-full" /></div>
        <UDashboardSidebarCollapse class="ms-auto" disabled />
      </template>
      <div class="space-y-2">
        <USkeleton class="h-8 w-full" />
        <USkeleton class="h-8 w-3/4" />
        <USkeleton class="mt-6 h-5 w-1/2" />
      </div>
    </UDashboardSidebar>
    <UDashboardPanel
      id="conversation-loading"
      class="m-0 min-h-0 min-w-0 rounded-none bg-sand-light sm:m-2 sm:rounded-xl sm:ring sm:ring-default sm:shadow-sm lg:ms-0 dark:[--ui-bg:color-mix(in_oklab,var(--color-zinc-900)_50%,transparent)] dark:bg-default"
      :ui="{ body: 'min-h-0 gap-0 overflow-hidden p-0 sm:p-0' }"
    >
      <template #header>
        <UDashboardNavbar
          :toggle="{ disabled: true }"
          :ui="{
            root: 'border-b-0 shrink-0',
            left: 'flex-1 sm:flex-initial',
            title: 'min-w-0 flex-1 sm:flex-initial'
          }"
        >
          <template #right><UColorModeButton disabled /></template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <slot>
          <div class="flex min-h-0 flex-1 items-center justify-center px-5 py-8 sm:px-8">
            <div class="w-full max-w-2xl space-y-6" role="status">
              <USkeleton class="h-12 w-2/3" />
              <USkeleton class="h-5 w-4/5" />
              <USkeleton class="h-36 w-full rounded-2xl" />
              <p class="text-sm text-muted">Je gesprekken worden geladen…</p>
            </div>
          </div>
        </slot>
      </template>
    </UDashboardPanel>
  </UDashboardGroup>
</template>
