<script setup lang="ts">
import { isTextUIPart, type UIMessage } from "ai";

const props = defineProps<{ message: UIMessage; busy: boolean; canRegenerate?: boolean }>();
const emit = defineEmits<{ regenerate: [messageId: string] }>();
const text = computed(() =>
  props.message.parts
    .filter(isTextUIPart)
    .map((part) => part.text)
    .join("\n\n")
);
const { copy, copied, copyPending, isSupported } = useClipboard({ source: text });
const toast = useToast();

/** Copy the answer text without including reasoning or tool payloads. */
async function copyResponse() {
  try {
    await copy();
  } catch {
    toast.add({
      title: "Kopiëren is niet gelukt",
      description: "Selecteer de tekst om deze handmatig te kopiëren.",
      color: "error"
    });
  }
}
</script>

<template>
  <div class="flex items-center gap-0.5">
    <UTooltip :text="copied ? 'Gekopieerd' : 'Antwoord kopiëren'">
      <UButton
        :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'"
        :aria-label="copied ? 'Antwoord gekopieerd' : 'Antwoord kopiëren'"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="!isSupported || !text || copyPending"
        :ui="{ leadingIcon: 'size-4!' }"
        @click="copyResponse"
      />
    </UTooltip>
    <UTooltip
      :text="
        canRegenerate === false
          ? 'Opnieuw genereren uitgeschakeld om dubbele boekingen te voorkomen'
          : 'Antwoord opnieuw genereren'
      "
    >
      <UButton
        icon="i-lucide-rotate-cw"
        aria-label="Antwoord opnieuw genereren"
        color="neutral"
        variant="ghost"
        size="xs"
        :disabled="busy || canRegenerate === false"
        :ui="{ leadingIcon: 'size-4!' }"
        @click="emit('regenerate', message.id)"
      />
    </UTooltip>
    <span class="sr-only" role="status">{{ copied ? "Antwoord gekopieerd" : "" }}</span>
  </div>
</template>
