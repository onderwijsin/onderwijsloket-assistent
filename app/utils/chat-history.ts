import type { Conversation } from "../stores/chat";

/**
 * Group visible history by creation date, with pins ordered by their pin timestamp.
 * @param conversations - Local conversations, including drafts.
 * @param now - Local calendar date used for relative group labels.
 * @returns Nonempty navigation groups with pinned conversations first.
 */
export function groupConversations(conversations: Conversation[], now = new Date()) {
  const today = now.toDateString();
  const previousDay = new Date(now);
  previousDay.setDate(previousDay.getDate() - 1);
  const yesterday = previousDay.toDateString();
  const buckets = new Map<string, Conversation[]>([
    ["Vastgezet", []],
    ["Vandaag", []],
    ["Gisteren", []],
    ["Eerder", []],
    ["Gearchiveerd", []]
  ]);
  for (const chat of [...conversations]
    .filter((chat) => chat.messages.some((message) => message.role === "user"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const day = new Date(chat.createdAt).toDateString();
    const label = chat.archivedAt
      ? "Gearchiveerd"
      : chat.pinnedAt
        ? "Vastgezet"
        : day === today
          ? "Vandaag"
          : day === yesterday
            ? "Gisteren"
            : "Eerder";
    buckets.get(label)!.push(chat);
  }
  buckets.get("Vastgezet")!.sort((a, b) => b.pinnedAt!.localeCompare(a.pinnedAt!));
  return [...buckets]
    .filter(([, items]) => items.length)
    .map(([label, items]) => ({ id: label, label, items }));
}
