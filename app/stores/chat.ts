import { defineStore, acceptHMRUpdate } from "pinia";
import { computed, ref } from "vue";
import type { UIMessage } from "ai";
import { DEFAULT_CHAT_SETTINGS, type ChatSettings } from "../types/chat";
import { deserializeChatState } from "../utils/chat-storage";

export interface Conversation {
  id: string;
  title: string;
  titleSource: "fallback" | "generated" | "manual";
  titleRequested: boolean;
  createdAt: string;
  updatedAt: string;
  pinnedAt?: string | null;
  archivedAt?: string | null;
  draft: string;
  settings: ChatSettings;
  messages: UIMessage[];
}

/** Local conversation data; instantiated only inside the client dashboard. */
export const useChatStore = defineStore(
  "chat",
  () => {
    const conversations = ref<Conversation[]>([]);
    const activeId = ref<string | null>(null);
    const defaultSettings = ref<ChatSettings>({ ...DEFAULT_CHAT_SETTINGS });
    const sidebarCollapsed = ref(false);
    const sidebarOpen = ref(false);
    const searchOpen = ref(false);
    const active = computed(() => conversations.value.find((chat) => chat.id === activeId.value));

    /**
     * Create or reuse an empty conversation and select it.
     * @returns The reused empty conversation or a newly created active conversation.
     */
    function newConversation() {
      const empty = conversations.value.find((chat) => !chat.archivedAt && !chat.messages.length);
      if (empty) {
        empty.settings = { ...defaultSettings.value };
        activeId.value = empty.id;
        return empty;
      }
      const now = new Date().toISOString();
      const chat: Conversation = {
        id: crypto.randomUUID(),
        title: "Nieuw gesprek",
        titleSource: "fallback",
        titleRequested: false,
        createdAt: now,
        updatedAt: now,
        draft: "",
        settings: { ...defaultSettings.value },
        messages: []
      };
      conversations.value.unshift(chat);
      activeId.value = chat.id;
      return chat;
    }

    /**
     * Save preferences, updating defaults only while editing the welcome composer.
     * @param id - Conversation receiving the selections.
     * @param settings - Complete model and capability selections.
     * @param updateDefaults - Whether the welcome composer is still visible.
     */
    function updateSettings(id: string, settings: ChatSettings, updateDefaults: boolean) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat) return;
      chat.settings = { ...settings };
      if (updateDefaults) defaultSettings.value = { ...settings };
    }

    /**
     * Select an existing chat and close mobile navigation.
     * @param id - Local conversation identifier.
     */
    function selectConversation(id: string) {
      if (!conversations.value.some((chat) => chat.id === id)) return;
      activeId.value = id;
      sidebarOpen.value = false;
      searchOpen.value = false;
    }

    /**
     * Save SDK message snapshots without retaining mutable SDK objects.
     * @param id - Local conversation identifier.
     * @param messages - Current SDK messages to snapshot for persistence.
     */
    function saveMessages(id: string, messages: UIMessage[]) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat) return;
      const wasEmpty = chat.messages.length === 0;
      chat.messages = JSON.parse(JSON.stringify(messages)) as UIMessage[];
      chat.updatedAt = new Date().toISOString();
      if (wasEmpty && messages.length && chat.titleSource === "fallback") {
        const first = messages.find((message) => message.role === "user");
        const text = first?.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join(" ");
        if (text) chat.title = text.slice(0, 80);
      }
    }

    /**
     * Toggle a conversation's persisted pin timestamp.
     * @param id - Local conversation identifier.
     */
    function togglePin(id: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (chat && !chat.archivedAt) chat.pinnedAt = chat.pinnedAt ? null : new Date().toISOString();
    }

    /**
     * Archive or restore a local chat without discarding its content.
     * @param id - Local conversation identifier.
     */
    function toggleArchive(id: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat) return;
      chat.archivedAt = chat.archivedAt ? null : new Date().toISOString();
      if (chat.archivedAt) {
        chat.pinnedAt = null;
        if (activeId.value === id) newConversation();
      }
    }

    /**
     * Rename a conversation.
     * @param id - Local conversation identifier.
     * @param title - User-supplied title to trim and bound.
     */
    function renameConversation(id: string, title: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (chat && title.trim()) {
        chat.title = title.trim().slice(0, 120);
        chat.titleSource = "manual";
      }
    }

    /**
     * Apply a generated title without replacing a manual rename.
     * @param id - Local conversation identifier.
     * @param title - Validated generated title to apply while the title is still a fallback.
     */
    function applyGeneratedTitle(id: string, title: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat || chat.titleSource !== "fallback") return;
      chat.title = title;
      chat.titleSource = "generated";
    }

    /**
     * Delete a local conversation and select a remaining chat.
     * @param id - Local conversation identifier.
     */
    function deleteConversation(id: string) {
      conversations.value = conversations.value.filter((chat) => chat.id !== id);
      if (activeId.value === id) activeId.value = conversations.value[0]?.id ?? null;
      if (!active.value) newConversation();
    }

    return {
      conversations,
      activeId,
      defaultSettings,
      updateSettings,
      active,
      sidebarCollapsed,
      sidebarOpen,
      searchOpen,
      newConversation,
      selectConversation,
      saveMessages,
      renameConversation,
      togglePin,
      toggleArchive,
      applyGeneratedTitle,
      deleteConversation
    };
  },
  {
    persist: {
      // Never use the persistence module's default cookie storage for chat content.
      storage: piniaPluginPersistedstate.localStorage(),
      serializer: { serialize: JSON.stringify, deserialize: deserializeChatState },
      pick: ["conversations", "activeId", "defaultSettings", "sidebarCollapsed"]
    }
  }
);

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot));
