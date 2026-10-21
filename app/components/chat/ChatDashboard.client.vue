<script setup lang="ts">
import type { DropdownMenuItem, NavigationMenuItem, CommandPaletteItem } from "@nuxt/ui";

const store = useChatStore();
if (!store.active) store.newConversation();
const renaming = ref(false);
const renameTitle = ref("");
const renameId = ref("");
const groups = computed(() => {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const buckets = new Map<string, (NavigationMenuItem & CommandPaletteItem)[]>();
  for (const chat of [...store.conversations]
    .filter((chat) => chat.messages.some((message) => message.role === "user"))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))) {
    const day = new Date(chat.updatedAt).toDateString();
    const label = day === today ? "Vandaag" : day === yesterday ? "Gisteren" : "Eerder";
    const items = buckets.get(label) ?? [];
    items.push({
      id: chat.id,
      label: chat.title,
      active: chat.id === store.activeId,
      onSelect: () => store.selectConversation(chat.id)
    });
    buckets.set(label, items);
  }
  return [...buckets].map(([label, items]) => ({ id: label, label, items }));
});
const history = computed<NavigationMenuItem[]>(() =>
  groups.value.flatMap((group) => [{ type: "label", label: group.label }, ...group.items])
);
const links = [
  { label: "Onderwijs in", to: "https://onderwijsin.nl", icon: "i-lucide-external-link" },
  {
    label: "Bekijk broncode",
    to: "https://github.com/onderwijsin/onderwijsloket-assistent",
    icon: "i-simple-icons-github"
  },
  { label: "Blijf op de hoogte", to: "https://onderwijsin.nl/nieuwsbrief", icon: "i-lucide-mail" }
];
const actions = computed<DropdownMenuItem[]>(() => [
  {
    label: "Naam wijzigen",
    icon: "i-lucide-pencil",
    onSelect: () => {
      if (!store.active) return;
      renameId.value = store.active.id;
      renameTitle.value = store.active.title;
      renaming.value = true;
    }
  },
  {
    label: "Gesprek verwijderen",
    icon: "i-lucide-trash",
    color: "error",
    onSelect: () => {
      if (store.activeId) store.deleteConversation(store.activeId);
    }
  }
]);

/** Start an empty local chat and close the mobile menu. */
function newChat() {
  store.newConversation();
  store.sidebarOpen = false;
  store.searchOpen = false;
}
/** Save the selected conversation's edited title. */
function saveTitle() {
  store.renameConversation(renameId.value, renameTitle.value);
  renaming.value = false;
}
defineShortcuts({
  meta_o: newChat,
  meta_k: () => {
    store.searchOpen = true;
  }
});
</script>

<template>
  <UDashboardGroup unit="rem" :persistent="false" class="bg-sand-main dark:bg-neutral-950">
    <UDashboardSidebar
      id="chat-navigation"
      v-model:open="store.sidebarOpen"
      v-model:collapsed="store.sidebarCollapsed"
      :default-size="17"
      :min-size="12"
      :max-size="20"
      :collapsed-size="4"
      collapsible
      :menu="{ inset: true, title: 'Gesprekken', description: 'Jouw lokaal opgeslagen gesprekken' }"
      class="border-r-0 py-3"
    >
      <template #header="{ collapsed }">
        <button
          v-if="!collapsed"
          aria-label="Nieuw gesprek"
          class="min-w-0 cursor-pointer"
          @click="newChat"
        >
          <Logo class="h-6 w-auto max-w-full" />
        </button>
        <UDashboardSidebarCollapse class="ms-auto" />
      </template>
      <template #default="{ collapsed }">
        <UNavigationMenu
          :collapsed="collapsed"
          :items="[
            { label: 'Nieuw gesprek', icon: 'i-lucide-circle-plus', onSelect: newChat },
            {
              label: 'Gesprekken zoeken',
              icon: 'i-lucide-search',
              onSelect: () => {
                store.searchOpen = true;
              }
            }
          ]"
          orientation="vertical"
        />
        <UNavigationMenu
          v-if="!collapsed"
          :items="history"
          orientation="vertical"
          :ui="{ linkLabel: 'truncate' }"
        />
      </template>
      <template #footer="{ collapsed }">
        <UNavigationMenu
          :items="links"
          :collapsed="collapsed"
          orientation="vertical"
          class="w-full"
        />
      </template>
    </UDashboardSidebar>
    <UDashboardSearch
      v-model:open="store.searchOpen"
      title="Gesprekken zoeken"
      description="Zoek in je lokaal opgeslagen gesprekken"
      placeholder="Zoek een gesprek…"
      :groups="[
        {
          id: 'actions',
          items: [
            {
              label: 'Nieuw gesprek',
              icon: 'i-lucide-circle-plus',
              kbds: ['meta', 'o'],
              onSelect: newChat
            }
          ]
        },
        ...groups
      ]"
      :color-mode="true"
    />
    <UDashboardPanel
      id="conversation"
      class="m-2 min-h-0 min-w-0 rounded-xl bg-sand-light ring ring-default shadow-sm lg:ms-0 dark:[--ui-bg:color-mix(in_oklab,var(--color-zinc-900)_50%,transparent)] dark:bg-default"
      :ui="{ body: 'min-h-0 gap-0 overflow-hidden p-0 sm:p-0' }"
    >
      <template #header>
        <UDashboardNavbar :ui="{ root: 'border-b-0 shrink-0' }">
          <template #title>
            <UDropdownMenu
              v-if="store.active?.messages.length"
              :items="actions"
              :content="{ align: 'start' }"
            >
              <UButton
                :label="store.active.title"
                trailing-icon="i-lucide-chevron-down"
                color="neutral"
                variant="ghost"
                class="min-w-0 max-w-[55vw] sm:max-w-[min(28rem,45vw)]"
                :ui="{ label: 'truncate' }"
              />
            </UDropdownMenu>
            <ChatExperimentalBadge
              v-if="store.active?.messages.length"
              class="hidden sm:inline-flex"
            />
          </template>
          <template #right><UColorModeButton /></template>
        </UDashboardNavbar>
      </template>
      <template #body>
        <ChatInterface
          v-if="store.active"
          :key="store.activeId!"
          :conversation-id="store.active.id"
        />
      </template>
    </UDashboardPanel>
    <UModal
      v-model:open="renaming"
      title="Naam wijzigen"
      description="Geef dit gesprek een herkenbare naam."
    >
      <template #body>
        <form class="space-y-4" @submit.prevent="saveTitle">
          <UInput
            v-model="renameTitle"
            aria-label="Naam van het gesprek"
            maxlength="120"
            autofocus
          />
          <UButton type="submit" label="Opslaan" :disabled="!renameTitle.trim()" />
        </form>
      </template>
    </UModal>
  </UDashboardGroup>
</template>
