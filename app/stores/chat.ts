import { defineStore, acceptHMRUpdate } from "pinia";
import { computed, ref } from "vue";
import type { UIMessage } from "ai";
import type { ChatSettings } from "../types/chat";
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
  messages: UIMessage[];
}

/** Local conversation data; instantiated only inside the client dashboard. */
export const useChatStore = defineStore(
  "chat",
  () => {
    const conversations = ref<Conversation[]>([]);
    const activeId = ref<string | null>(null);
    const settings = ref<ChatSettings>({
      model: "gpt-6-luna",
      webSearch: false,
      extendedThinking: true
    });
    const sidebarCollapsed = ref(false);
    const sidebarOpen = ref(false);
    const searchOpen = ref(false);
    const active = computed(() => conversations.value.find((chat) => chat.id === activeId.value));

    /** Create or reuse an empty conversation and select it. @returns The selected local conversation. */
    function newConversation() {
      const empty = conversations.value.find(
        (chat) => !chat.archivedAt && !chat.messages.length && !chat.draft
      );
      if (empty) {
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
        messages: []
      };
      conversations.value.unshift(chat);
      activeId.value = chat.id;
      return chat;
    }

    /** Select an existing chat and close mobile navigation. @param id - Local conversation ID. */
    function selectConversation(id: string) {
      if (!conversations.value.some((chat) => chat.id === id)) return;
      activeId.value = id;
      sidebarOpen.value = false;
      searchOpen.value = false;
    }

    /** Save SDK message snapshots without retaining mutable SDK objects. @param id - Owning chat ID. @param messages - Current streamed transcript. */
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

    /** Toggle a conversation's persisted pin timestamp. @param id - Local chat ID. */
    function togglePin(id: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (chat && !chat.archivedAt) chat.pinnedAt = chat.pinnedAt ? null : new Date().toISOString();
    }

    /** Archive or restore a local chat without discarding its content. @param id - Local chat ID. */
    function toggleArchive(id: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat) return;
      chat.archivedAt = chat.archivedAt ? null : new Date().toISOString();
      if (chat.archivedAt) {
        chat.pinnedAt = null;
        if (activeId.value === id) newConversation();
      }
    }

    /** Rename a conversation. @param id - Local chat ID. @param title - User supplied title. */
    function renameConversation(id: string, title: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (chat && title.trim()) {
        chat.title = title.trim().slice(0, 120);
        chat.titleSource = "manual";
      }
    }

    /** Apply a generated title without replacing a manual rename. @param id - Owning local chat ID. @param title - Validated server title. */
    function applyGeneratedTitle(id: string, title: string) {
      const chat = conversations.value.find((item) => item.id === id);
      if (!chat || chat.titleSource !== "fallback") return;
      chat.title = title;
      chat.titleSource = "generated";
    }

    /** Delete a local conversation and select a remaining chat. @param id - Local chat ID. */
    function deleteConversation(id: string) {
      conversations.value = conversations.value.filter((chat) => chat.id !== id);
      if (activeId.value === id) activeId.value = conversations.value[0]?.id ?? null;
      if (!active.value) newConversation();
    }

    return {
      conversations,
      activeId,
      active,
      settings,
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
      pick: ["conversations", "activeId", "settings", "sidebarCollapsed"]
    }
  }
);

if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useChatStore, import.meta.hot));
