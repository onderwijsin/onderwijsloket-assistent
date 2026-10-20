<script setup lang="ts">
import { useChat } from "@ai-sdk/vue";
import { DefaultChatTransport } from "ai";
import type { ChatSettings } from "~/types/chat";

const input = shallowRef("");
const showTranscript = useState("chat-transcript-active", () => false);
const submitting = shallowRef(false);
const composerDock = useTemplateRef("composerDock");
const { height: dockHeight } = useElementSize(composerDock, { width: 0, height: 160 });
const settings = ref<ChatSettings>({
  model: "gpt-6-luna",
  webSearch: false,
  extendedThinking: true
});
const { messages, status, error, sendMessage, stop, regenerate, clearError } = useChat({
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

// With the footer hidden, document scrolling only follows the conversation.
watch(status, async (value) => {
  if (value !== "submitted") return;
  await nextTick();
  window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
});

/** Send a non-empty draft with the current model and feature settings. */
async function submit() {
  if (busy.value || submitting.value || !input.value.trim()) return;
  const text = input.value.trim();
  submitting.value = true;
  clearError();
  try {
    if (!showTranscript.value) await enterTranscript();
    input.value = "";
    await sendMessage({ text });
  } finally {
    submitting.value = false;
  }
}

/** Transition to the fixed composer after removing the welcome-page footer. */
async function enterTranscript() {
  const update = async () => {
    showTranscript.value = true;
    await nextTick();
    window.scrollTo({ top: 0, behavior: "instant" });
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
  if (busy.value || submitting.value) return;
  input.value = prompt;
  await submit();
}

onBeforeUnmount(() => {
  void stop();
  showTranscript.value = false;
});
</script>

<template>
  <section
    class="mx-auto flex min-h-[calc(100dvh-var(--ui-header-main-height))] w-full max-w-3xl flex-col px-4 sm:px-6"
    :style="showTranscript ? { paddingBottom: `${dockHeight}px` } : undefined"
    aria-label="Chat met de Onderwijsloket-assistent"
  >
    <div v-if="!showTranscript" class="flex flex-1 flex-col">
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
      <div class="chat-transcript min-w-0">
        <ChatTranscript
          :messages="messages"
          :status="status"
          @regenerate="regenerate({ messageId: $event })"
        />
      </div>
      <div
        ref="composerDock"
        class="fixed inset-x-0 bottom-0 z-20 bg-sand-main/95 backdrop-blur-sm dark:bg-default/95"
      >
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
