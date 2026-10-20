<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import { storeToRefs } from "pinia";
import { chatTitleSchema } from "../../../shared/utils/chat-title";
import { restoreChatMessages } from "../../utils/chat-storage";

const props = defineProps<{ conversationId: string }>();
const store = useChatStore();
const conversation = store.conversations.find((chat) => chat.id === props.conversationId)!;
const input = computed({
  get: () => conversation.draft,
  set: (value: string) => {
    conversation.draft = value;
  }
});
const { settings } = storeToRefs(store);
const showTranscript = shallowRef(conversation.messages.length > 0);
const submitting = shallowRef(false);
let disposed = false;
const transcript = useTemplateRef("transcript");
const { messages, status, error, sendMessage, stop, regenerate, clearError } = useChat({
  messages: restoreChatMessages(JSON.parse(JSON.stringify(conversation.messages))),
  throttle: 100,
  onData: (part) => {
    if (
      part.type !== "data-conversation-title" ||
      !part.data ||
      typeof part.data !== "object" ||
      !("title" in part.data)
    )
      return;
    const title = chatTitleSchema.safeParse(part.data.title);
    if (title.success) store.applyGeneratedTitle(props.conversationId, title.data);
  },
  transport: new DefaultChatTransport({
    api: "/api/chat",
    body: () => ({ ...settings.value }),
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(
          response.status === 429
            ? "Je hebt het maximum van 30 berichten per uur bereikt. Probeer het later opnieuw."
            : "Het antwoord kon niet worden opgehaald. Probeer het opnieuw."
        );
      }
      return response;
    }
  })
});
const busy = computed(() => status.value === "submitted" || status.value === "streaming");

// Persist snapshots against this instance's ID, even when another chat is selected.
watch(messages, (value) => store.saveMessages(props.conversationId, value), { flush: "sync" });
watch(status, async (value) => {
  if (value !== "submitted") return;
  await nextTick();
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: "instant" });
});

/** Send a non-empty draft with the current model and feature settings. */
async function submit() {
  await submitMessage(input.value, true);
}

/**
 * Send text directly without routing suggestions through the composer draft.
 * @param value - Message text from the composer or a suggested prompt.
 * @param clearDraft - Whether this submission consumes the typed draft.
 */
async function submitMessage(value: string, clearDraft = false) {
  if (busy.value || submitting.value || !value.trim()) return;
  const text = value.trim();
  submitting.value = true;
  clearError();
  try {
    if (!showTranscript.value) await enterTranscript();
    if (disposed) return;
    if (clearDraft) input.value = "";
    const generateTitle =
      !conversation.titleRequested &&
      messages.value.length === 0 &&
      conversation.titleSource === "fallback";
    conversation.titleRequested = true;
    await sendMessage({ text }, { body: { generateTitle } });
  } finally {
    submitting.value = false;
  }
}

/** Animate the composer from the welcome view to the bottom of the chat panel. */
async function enterTranscript() {
  const update = async () => {
    showTranscript.value = true;
    await nextTick();
    transcript.value?.scrollTo({ top: 0, behavior: "instant" });
  };
  if (
    !document.startViewTransition ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    await update();
    return;
  }
  const transition = document.startViewTransition(update);
  await transition.updateCallbackDone;
}

/** Submit a suggested prompt with the current model and feature selections. */
async function selectSuggestion(prompt: string) {
  await submitMessage(prompt);
}

onMounted(() => {
  transcript.value?.scrollTo({ top: transcript.value.scrollHeight, behavior: "instant" });
});

onBeforeUnmount(() => {
  disposed = true;
  store.saveMessages(props.conversationId, messages.value);
  void stop();
});
</script>

<template>
  <section
    class="flex h-full min-h-0 w-full flex-col"
    aria-label="Chat met de Onderwijsloket-assistent"
  >
    <div
      v-if="!showTranscript"
      class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 sm:px-6"
    >
      <ChatWelcome class="my-auto shrink-0 py-8 sm:py-12" @select="selectSuggestion">
        <ChatComposer
          v-model="input"
          v-model:settings="settings"
          :status="status"
          @submit="submit"
          @stop="stop()"
        />
      </ChatWelcome>
    </div>
    <template v-else>
      <h1 class="sr-only">Gesprek met de Onderwijsloket-assistent</h1>
      <div
        ref="transcript"
        class="chat-transcript min-h-0 flex-1 overflow-y-auto [overflow-wrap:anywhere]"
      >
        <div class="mx-auto w-full min-w-0 max-w-3xl px-4 sm:px-6">
          <ChatTranscript
            :messages="messages"
            :status="status"
            @regenerate="regenerate({ messageId: $event })"
          />
        </div>
      </div>
      <div class="z-20 shrink-0 bg-sand-light dark:bg-transparent">
        <div
          class="mx-auto w-full max-w-3xl space-y-2 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"
        >
          <UAlert
            v-if="error"
            title="Het is niet gelukt"
            :description="error.message"
            color="error"
            variant="soft"
            icon="i-lucide-circle-alert"
            close
            @update:open="clearError()"
          >
            <template #actions>
              <UButton
                label="Opnieuw proberen"
                color="error"
                variant="subtle"
                size="sm"
                @click="regenerate()"
              />
            </template>
          </UAlert>
          <ChatComposer
            v-model="input"
            v-model:settings="settings"
            :status="status"
            compact
            @submit="submit"
            @stop="stop()"
          />
          <p class="text-muted text-center text-xs">
            AI kan fouten maken. Controleer belangrijke informatie bij een opleider of adviseur.
          </p>
        </div>
      </div>
    </template>
  </section>
</template>

<style>
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-group(chat-composer) {
    animation-duration: 320ms;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  .chat-transcript {
    animation: chat-transcript-enter 240ms ease-out both;
  }

  @keyframes chat-transcript-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
</style>
