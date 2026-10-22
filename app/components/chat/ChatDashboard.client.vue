<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

import { groupConversations } from "../../utils/chat-history";

const store = useChatStore();
if (!store.active) store.newConversation();
const renaming = ref(false);
const renameTitle = ref("");
const renameId = ref("");
const groups = computed(() =>
  groupConversations(store.conversations).map((group) => ({
    ...group,
    items: group.items.map((chat) => ({
      id: chat.id,
      label: chat.title,
      pinnedAt: chat.pinnedAt,
      archivedAt: chat.archivedAt,
      active: chat.id === store.activeId,
      /**
       * Select this conversation from the history list.
       * @returns No value after selecting the conversation.
       */
      onSelect: () => store.selectConversation(chat.id)
    }))
  }))
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
    disabled: !!store.active?.archivedAt,
    label: store.active?.pinnedAt ? "Losmaken" : "Vastzetten",
    icon: store.active?.pinnedAt ? "i-lucide-pin-off" : "i-lucide-pin",
    /** Toggle the active conversation’s pinned state. */
    onSelect: () => {
      if (store.activeId) store.togglePin(store.activeId);
    }
  },
  {
    label: store.active?.archivedAt ? "Terugzetten" : "Archiveren",
    icon: store.active?.archivedAt ? "i-lucide-archive-restore" : "i-lucide-archive",
    /** Archive or restore the active conversation. */
    onSelect: () => {
      if (store.activeId) store.toggleArchive(store.activeId);
    }
  },
  {
    label: "Naam wijzigen",
    icon: "i-lucide-pencil",
    /** Open the rename dialog with the active conversation’s current title. */
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
    /** Delete the active conversation from local history. */
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
  meta_o: newChat
});
</script>

<template>
  <UDashboardGroup unit="rem" :persistent="false" class="bg-sand-main dark:bg-neutral-950">
    <UDashboardSidebar
      id="chat-navigation"
      v-model:open="store.sidebarOpen"
      v-model:collapsed="store.sidebarCollapsed"
      :default-size="17"
      :min-size="16"
      :max-size="28"
      :collapsed-size="4"
      resizable
      collapsible
      mode="modal"
      :menu="{
        fullscreen: true,
        title: 'Gesprekken',
        description: 'Jouw lokaal opgeslagen gesprekken'
      }"
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
            {
              label: 'Nieuw gesprek',
              icon: 'i-lucide-circle-plus',
              onSelect: newChat
            },
            {
              label: 'Gesprekken zoeken',
              icon: 'i-lucide-search',
              onSelect: () => {
                store.searchOpen = true;
              }
            }
          ]"
          orientation="vertical"
          class="mt-2 mb-4 lg:mt-0 lg:mb-0"
          :ui="{ list: 'gap-2 lg:gap-0', link: 'py-3 text-base lg:py-1.5 lg:text-sm' }"
        />
        <nav v-if="!collapsed" aria-label="Gespreksgeschiedenis" class="space-y-6 lg:space-y-3">
          <component
            :is="group.id === 'Gearchiveerd' ? 'details' : 'section'"
            v-for="group in groups"
            :key="group.id"
          >
            <component
              :is="group.id === 'Gearchiveerd' ? 'summary' : 'h2'"
              class="px-2.5 py-2 text-sm font-semibold text-muted lg:py-1.5 lg:text-xs"
              :class="{ 'cursor-pointer': group.id === 'Gearchiveerd' }"
              >{{ group.label }}</component
            >
            <ul class="space-y-1 lg:space-y-0">
              <li
                v-for="item in group.items"
                :key="item.id"
                class="history-row relative flex items-center overflow-hidden rounded-md hover:bg-elevated focus-within:bg-elevated"
                :class="{ 'bg-elevated': item.active }"
                :style="{ '--history-actions-width': item.archivedAt ? '2rem' : '3.75rem' }"
              >
                <UButton
                  :label="item.label"
                  color="neutral"
                  variant="ghost"
                  class="history-link min-w-0 flex-1 justify-start py-2.5 text-base hover:bg-transparent lg:py-1.5 lg:text-sm"
                  size="sm"
                  :ui="{ label: 'history-label truncate' }"
                  :aria-current="item.active ? 'page' : undefined"
                  @click="store.selectConversation(item.id!)"
                />
                <div
                  class="history-actions absolute inset-y-0 end-0 flex items-center bg-elevated pe-1"
                >
                  <UButton
                    v-if="!item.archivedAt"
                    :icon="item.pinnedAt ? 'i-lucide-pin-off' : 'i-lucide-pin'"
                    :aria-label="item.pinnedAt ? 'Gesprek losmaken' : 'Gesprek vastzetten'"
                    :title="item.pinnedAt ? 'Losmaken' : 'Vastzetten'"
                    color="neutral"
                    variant="soft"
                    size="xs"
                    :ui="{ leadingIcon: 'size-3.5!' }"
                    @click="store.togglePin(item.id!)"
                  />
                  <UButton
                    :icon="item.archivedAt ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
                    :aria-label="item.archivedAt ? 'Gesprek terugzetten' : 'Gesprek archiveren'"
                    :title="item.archivedAt ? 'Terugzetten' : 'Archiveren'"
                    color="neutral"
                    variant="soft"
                    size="xs"
                    :ui="{ leadingIcon: 'size-3.5!' }"
                    @click="store.toggleArchive(item.id!)"
                  />
                </div>
              </li>
            </ul>
          </component>
        </nav>
      </template>
      <template #footer="{ collapsed }">
        <UNavigationMenu
          :items="links"
          :collapsed="collapsed"
          orientation="vertical"
          class="w-full py-[calc(0.75rem+env(safe-area-inset-bottom))] lg:py-0"
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
      class="m-0 min-h-0 min-w-0 rounded-none bg-sand-light sm:m-2 sm:rounded-xl sm:ring sm:ring-default sm:shadow-sm lg:ms-0 dark:[--ui-bg:color-mix(in_oklab,var(--color-zinc-900)_50%,transparent)] dark:bg-default"
      :ui="{ body: 'min-h-0 gap-0 overflow-hidden p-0 sm:p-0' }"
    >
      <template #header>
        <UDashboardNavbar
          :ui="{
            root: 'border-b-0 shrink-0',
            left: 'flex-1 sm:flex-initial',
            title: 'min-w-0 flex-1 sm:flex-initial'
          }"
        >
          <template #title>
            <UDropdownMenu
              v-if="store.active?.messages.length"
              :items="actions"
              size="sm"
              :ui="{ item: 'py-2', itemLeadingIcon: 'size-4!' }"
              :content="{ align: 'start' }"
            >
              <UButton
                :label="store.active.title"
                trailing-icon="i-lucide-chevron-down"
                color="neutral"
                variant="ghost"
                class="min-w-0 w-full justify-between sm:w-auto sm:max-w-[min(28rem,45vw)]"
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

<style scoped>
.history-actions {
  display: none;
  transition: opacity 150ms ease;
}

.history-actions::before {
  content: "";
  position: absolute;
  inset-block: 0;
  inset-inline-end: 100%;
  width: 1.5rem;
  pointer-events: none;
  background: linear-gradient(to right, transparent, var(--ui-bg-elevated));
}

.history-link {
  padding-inline-end: 0.625rem;
}

.history-link :deep(.history-label) {
  transition: transform 150ms ease;
}

@media (min-width: 1024px) {
  .history-actions {
    display: flex;
  }

  .history-link {
    padding-inline-end: var(--history-actions-width);
  }
}

@media (min-width: 1024px) and (hover: hover) {
  .history-link {
    padding-inline-end: 0.625rem;
  }

  .history-actions {
    opacity: 0;
    pointer-events: none;
  }

  .history-row:hover .history-actions,
  .history-row:focus-within .history-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .history-row:hover :deep(.history-label),
  .history-row:focus-within :deep(.history-label) {
    transform: translateX(0.125rem);
  }
}

@media (prefers-reduced-motion: reduce) {
  .history-actions,
  .history-link :deep(.history-label) {
    transition: none;
  }

  .history-row:hover :deep(.history-label),
  .history-row:focus-within :deep(.history-label) {
    transform: none;
  }
}
</style>
