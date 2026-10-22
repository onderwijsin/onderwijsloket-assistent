import { isTextUIPart } from "ai";
import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Conversation } from "../stores/chat";

/**
 * Copy a conversation's visible text as Markdown and report clipboard results.
 * @param source - Reactive conversation selected by the caller.
 * @returns The copy action and whether it is currently available.
 */
export function useConversationClipboard(
  source: MaybeRefOrGetter<Conversation | null | undefined>
) {
  const { copy, copyPending, isSupported } = useClipboard();
  const toast = useToast();
  const canCopy = computed(() => !!toValue(source) && isSupported.value && !copyPending.value);

  /** Copy the active conversation as Markdown, excluding reasoning and tool payloads. */
  async function copyConversation() {
    const conversation = toValue(source);
    if (!conversation || !isSupported.value || copyPending.value) return;

    const messages = conversation.messages.flatMap((message) => {
      if (message.role !== "user" && message.role !== "assistant") return [];
      const text = message.parts
        .filter(isTextUIPart)
        .map((part) => part.text)
        .join("\n\n");
      if (!text.trim()) return [];
      return [`## ${message.role === "user" ? "Gebruiker" : "Assistent"}\n\n${text}`];
    });
    const markdown = [`# ${conversation.title.replace(/[\r\n]+/g, " ")}`, ...messages].join("\n\n");

    try {
      await copy(markdown);
      toast.add({ title: "Het gesprek is gekopieerd naar je klembord", icon: "i-lucide-check" });
    } catch {
      toast.add({
        title: "Kopiëren is niet gelukt",
        description: "Probeer het opnieuw of selecteer de tekst om deze handmatig te kopiëren.",
        color: "error"
      });
    }
  }

  return { copyConversation, canCopy };
}
