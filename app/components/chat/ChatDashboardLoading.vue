<template>
  <div
    class="flex h-dvh gap-3 bg-sand-main p-3 dark:bg-neutral-950"
    role="status"
    aria-label="Gesprekken laden"
    aria-busy="true"
  >
    <aside class="hidden w-64 shrink-0 space-y-7 p-4 lg:block">
      <Logo class="h-6 w-auto" />
      <USkeleton class="h-9 w-full" />
      <USkeleton class="h-9 w-3/4" />
      <USkeleton class="h-5 w-1/2" />
    </aside>
    <main
      class="flex min-w-0 flex-1 flex-col rounded-xl bg-sand-light ring ring-default dark:[--ui-bg:color-mix(in_oklab,var(--color-zinc-900)_50%,transparent)] dark:bg-default p-5 sm:p-8"
    >
      <USkeleton class="h-6 w-36" />
      <div class="m-auto w-full max-w-2xl space-y-6">
        <USkeleton class="h-12 w-2/3" />
        <USkeleton class="h-5 w-4/5" />
        <USkeleton class="h-36 w-full rounded-2xl" />
        <p class="text-muted text-sm">Je gesprekken worden geladen…</p>
      </div>
    </main>
  </div>
</template>
