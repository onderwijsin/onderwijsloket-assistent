import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { createPersistedState } from "pinia-plugin-persistedstate";
import type { UIMessage } from "ai";
import { deserializeChatState, restoreChatMessages } from "../../app/utils/chat-storage";

const storage = vi.hoisted(() => {
  const data = new Map<string, string>();
  const local = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    }
  };
  vi.stubGlobal("piniaPluginPersistedstate", { localStorage: () => local });
  return { data, local };
});
import { groupConversations } from "../../app/utils/chat-history";
import { useChatStore } from "../../app/stores/chat";

/** Create a fresh app with the real persistence plugin and a browser-storage substitute. */
function openStore() {
  const pinia = createPinia().use(createPersistedState());
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useChatStore();
}
const messages: UIMessage[] = [
  { id: "u1", role: "user", parts: [{ type: "text", text: "Hoe word ik leraar?" }] }
];

beforeEach(() => storage.data.clear());

describe("local chat store", () => {
  it("restores conversations, drafts, selection and settings from local storage", async () => {
    const first = openStore();
    const chat = first.newConversation();
    first.saveMessages(chat.id, messages);
    first.active!.draft = "Mijn vervolg";
    first.settings.webSearch = true;
    first.sidebarCollapsed = true;
    first.sidebarOpen = true;
    await nextTick();
    const saved = storage.data.get("chat")!;
    expect(saved).toContain("Hoe word ik leraar?");
    expect(saved).not.toContain("sidebarOpen");
    const restored = openStore();
    expect(restored.activeId).toBe(chat.id);
    expect(restored.active?.draft).toBe("Mijn vervolg");
    expect(restored.active?.messages).toEqual(
      messages.map((message) => ({
        ...message,
        parts: [{ type: "text", text: "Hoe word ik leraar?", state: "done" }]
      }))
    );
    expect(restored.settings.webSearch).toBe(true);
    expect(restored.sidebarCollapsed).toBe(true);
    expect(restored.sidebarOpen).toBe(false);
  });

  it("keeps transcripts isolated while switching, renaming and deleting conversations", () => {
    const store = openStore();
    const first = store.newConversation();
    store.saveMessages(first.id, messages);
    const second = store.newConversation();
    store.saveMessages(first.id, [
      ...messages,
      { id: "a1", role: "assistant", parts: [{ type: "text", text: "Antwoord" }] }
    ]);
    expect(store.active?.id).toBe(second.id);
    expect(store.active?.messages).toEqual([]);
    store.renameConversation(first.id, "Mijn route");
    store.selectConversation(first.id);
    expect(store.active?.title).toBe("Mijn route");
    expect(store.active?.messages).toHaveLength(2);
    store.deleteConversation(first.id);
    expect(store.activeId).toBe(second.id);
    store.saveMessages(first.id, messages);
    expect(store.conversations).toHaveLength(1);
    store.deleteConversation(second.id);
    expect(store.active?.messages).toEqual([]);
  });

  it("keeps generated titles on streaming updates and protects manual renames", () => {
    const store = openStore();
    const first = store.newConversation();
    store.applyGeneratedTitle(first.id, "Werken in het onderwijs");
    store.saveMessages(first.id, messages);
    expect(store.active?.title).toBe("Werken in het onderwijs");
    store.renameConversation(first.id, "Mijn eigen titel");
    store.applyGeneratedTitle(first.id, "Een late titel");
    expect(store.active?.title).toBe("Mijn eigen titel");
    store.deleteConversation(first.id);
    store.applyGeneratedTitle(first.id, "Een verwijderde chat");
    expect(store.conversations.some((chat) => chat.id === first.id)).toBe(false);
  });

  it("keeps creation order and date groups when reopening and saving an older chat", () => {
    const store = openStore();
    const older = store.newConversation();
    store.saveMessages(older.id, messages);
    store.active!.createdAt = "2026-10-20T10:00:00.000Z";
    const newer = store.newConversation();
    store.saveMessages(newer.id, messages);
    store.active!.createdAt = "2026-10-21T10:00:00.000Z";
    const now = new Date("2026-10-21T12:00:00.000Z");
    const before = groupConversations(store.conversations, now);
    store.selectConversation(older.id);
    store.saveMessages(older.id, messages);
    store.renameConversation(older.id, "Older chat");
    expect(groupConversations(store.conversations, now)).toEqual(before);
    expect(before.map((group) => [group.label, group.items.map((chat) => chat.id)])).toEqual([
      ["Vandaag", [newer.id]],
      ["Gisteren", [older.id]]
    ]);
    expect(store.active?.createdAt).toBe("2026-10-20T10:00:00.000Z");
  });

  it("persists pins, orders by pin time and restores creation order on unpin", async () => {
    const store = openStore();
    const first = store.newConversation();
    store.saveMessages(first.id, messages);
    store.active!.createdAt = "2026-10-19T10:00:00.000Z";
    const second = store.newConversation();
    store.saveMessages(second.id, messages);
    store.active!.createdAt = "2026-10-20T10:00:00.000Z";
    const draft = store.newConversation();
    const clock = vi.spyOn(Date.prototype, "toISOString");
    try {
      clock.mockReturnValue("2026-10-21T10:00:00.000Z");
      store.togglePin(second.id);
      clock.mockReturnValue("2026-10-21T11:00:00.000Z");
      store.togglePin(first.id);
      store.togglePin(draft.id);
      store.togglePin("missing");
      await nextTick();
      const restored = openStore();
      const now = new Date("2026-10-21T12:00:00.000Z");
      expect(
        groupConversations(restored.conversations, now).map((group) => [
          group.label,
          group.items.map((chat) => chat.id)
        ])
      ).toEqual([["Vastgezet", [first.id, second.id]]]);
      restored.togglePin(first.id);
      restored.togglePin(second.id);
      expect(
        groupConversations(restored.conversations, now).flatMap((group) =>
          group.items.map((chat) => chat.id)
        )
      ).toEqual([second.id, first.id]);
      clock.mockReturnValue("2026-10-21T12:00:00.000Z");
      restored.togglePin(first.id);
      expect(restored.conversations.find((chat) => chat.id === first.id)?.pinnedAt).toBe(
        "2026-10-21T12:00:00.000Z"
      );
    } finally {
      clock.mockRestore();
    }
  });

  it("archives and restores conversations without losing content or creation dates", async () => {
    const store = openStore();
    const chat = store.newConversation();
    store.saveMessages(chat.id, messages);
    store.active!.draft = "Keep this draft";
    store.togglePin(chat.id);
    const createdAt = store.active!.createdAt;
    store.toggleArchive(chat.id);
    expect(store.activeId).not.toBe(chat.id);
    const archived = store.conversations.find((item) => item.id === chat.id)!;
    expect(archived.archivedAt).toBeTruthy();
    expect(archived.pinnedAt).toBeNull();
    store.togglePin(chat.id);
    expect(archived.pinnedAt).toBeNull();
    expect(groupConversations(store.conversations).map((group) => group.label)).toEqual([
      "Gearchiveerd"
    ]);
    await nextTick();
    const restored = openStore();
    restored.selectConversation(chat.id);
    expect(restored.active?.archivedAt).toBeTruthy();
    expect(restored.active?.draft).toBe("Keep this draft");
    expect(restored.active?.messages).toHaveLength(1);
    restored.toggleArchive(chat.id);
    expect(restored.activeId).toBe(chat.id);
    expect(restored.active?.archivedAt).toBeNull();
    expect(restored.active?.createdAt).toBe(createdAt);
    expect(groupConversations(restored.conversations)[0]?.label).toBe("Vandaag");
    restored.toggleArchive("missing");
    restored.toggleArchive(chat.id);
    restored.deleteConversation(chat.id);
    expect(restored.conversations.some((item) => item.id === chat.id)).toBe(false);
  });

  it("restores legacy conversations without pin timestamps", async () => {
    const store = openStore();
    const chat = store.newConversation();
    store.saveMessages(chat.id, messages);
    await nextTick();
    expect(openStore().active?.id).toBe(chat.id);
    expect(openStore().active?.pinnedAt).toBeUndefined();
  });

  it("does not retain mutable SDK message references", () => {
    const store = openStore();
    const chat = store.newConversation();
    const mutable = structuredClone(messages);
    store.saveMessages(chat.id, mutable);
    mutable[0]!.parts = [];
    expect(store.active?.messages[0]?.parts).toHaveLength(1);
  });

  it("recovers from malformed storage and removes unfinished tool calls", () => {
    expect(deserializeChatState("not json")).toEqual({});
    expect(deserializeChatState('{"conversations":null}')).toEqual({});
    const resumed = restoreChatMessages([
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "get_route",
            toolCallId: "pending",
            state: "input-streaming",
            input: {}
          },
          {
            type: "dynamic-tool",
            toolName: "get_route",
            toolCallId: "done",
            state: "output-available",
            input: {},
            output: { selections: {} }
          },
          { type: "text", text: "Deelantwoord", state: "streaming" }
        ]
      }
    ]);
    expect(resumed[0]?.parts).toHaveLength(2);
    expect(resumed[0]?.parts[0]).toHaveProperty("toolCallId", "done");
    expect(resumed[0]?.parts[1]).toHaveProperty("state", "done");
  });
});
