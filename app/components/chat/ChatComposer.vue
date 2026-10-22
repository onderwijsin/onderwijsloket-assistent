<script setup lang="ts">
import type { ChatStatus } from "ai";
import type { DropdownMenuItem, SelectItem } from "@nuxt/ui";
import type { ChatSettings } from "~/types/chat";

const props = defineProps<{ status: ChatStatus; compact?: boolean }>();
const input = defineModel<string>({ required: true });
const settings = defineModel<ChatSettings>("settings", { required: true });
const emit = defineEmits<{ submit: []; stop: [] }>();
const prompt = useTemplateRef("prompt");
const busy = computed(() => props.status === "submitted" || props.status === "streaming");
const models = [
  { label: "Mistral Medium", value: "mistral-medium-latest", icon: "i-simple-icons-mistralai" },
  { label: "GPT-6 Luna", value: "gpt-6-luna", icon: "i-simple-icons-openai" }
] satisfies SelectItem[];
const selectedIcon = computed(
  () => models.find((model) => model.value === settings.value.model)?.icon
);
const features = computed<DropdownMenuItem[]>(() => [
  {
    label: "Zoeken op internet",
    icon: "i-lucide-globe",
    type: "checkbox",
    checked: settings.value.webSearch,
    /**
     * Update the web search setting from its menu checkbox.
     * @param checked - Whether web search is enabled.
     */
    onUpdateChecked: (checked) => {
      settings.value.webSearch = checked;
    },
    /**
     * Keep the feature menu open while toggling a checkbox.
     * @param event - Menu selection event whose default closing behavior is prevented.
     * @returns No value after preventing the default selection behavior.
     */
    onSelect: (event) => event.preventDefault()
  },
  {
    label: "Uitgebreid nadenken",
    icon: "i-lucide-brain",
    type: "checkbox",
    checked: settings.value.extendedThinking,
    /**
     * Update the extended thinking setting from its menu checkbox.
     * @param checked - Whether extended thinking is enabled.
     */
    onUpdateChecked: (checked) => {
      settings.value.extendedThinking = checked;
    },
    /**
     * Keep the feature menu open while toggling a checkbox.
     * @param event - Menu selection event whose default closing behavior is prevented.
     * @returns No value after preventing the default selection behavior.
     */
    onSelect: (event) => event.preventDefault()
  }
]);

/** Keep keyboard input available after submitting or choosing a suggested prompt. */
function focus() {
  prompt.value?.textareaRef?.focus();
}
defineExpose({ focus });
</script>

<template>
  <UChatPrompt
    ref="prompt"
    v-model="input"
    placeholder="Stel je vraag aan de Onderwijsloket Assistent…"
    aria-label="Je vraag aan de Onderwijsloket-assistent"
    :readonly="busy"
    :rows="compact ? 1 : 2"
    :autofocus="!compact"
    :maxrows="compact ? 5 : 8"
    :maxlength="32000"
    class="rounded-2xl bg-default shadow-sm [view-transition-name:chat-composer] dark:bg-neutral-950"
    :class="compact ? 'p-2.5' : 'p-3'"
    :ui="{ base: 'text-sm', footer: compact ? 'mt-0 flex-wrap gap-y-2' : 'mt-2 flex-wrap gap-y-2' }"
    @submit="emit('submit')"
  >
    <template #footer>
      <div class="flex items-center gap-1">
        <UDropdownMenu
          :items="features"
          :disabled="busy"
          size="sm"
          :content="{ side: 'top', align: 'start' }"
        >
          <UButton
            icon="i-lucide-plus"
            aria-label="Chatopties"
            color="neutral"
            variant="ghost"
            :disabled="busy"
          />
        </UDropdownMenu>
        <UTooltip v-if="settings.webSearch" text="Zoeken op internet staat aan">
          <UButton
            icon="i-lucide-globe"
            aria-label="Zoeken op internet uitschakelen"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="busy"
            @click="settings.webSearch = false"
          />
        </UTooltip>
        <UTooltip v-if="settings.extendedThinking" text="Uitgebreid nadenken staat aan">
          <UButton
            icon="i-lucide-brain"
            aria-label="Uitgebreid nadenken uitschakelen"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="busy"
            @click="settings.extendedThinking = false"
          />
        </UTooltip>
      </div>
      <div class="ms-auto flex items-center gap-2">
        <USelect
          v-model="settings.model"
          :items="models"
          :icon="selectedIcon"
          aria-label="AI-model kiezen"
          color="neutral"
          variant="ghost"
          size="sm"
          :disabled="busy"
          class="w-auto"
          :content="{ align: 'end' }"
          :ui="{ content: 'min-w-42 w-max', itemLabel: 'whitespace-nowrap' }"
        />
        <UChatPromptSubmit
          :status="busy ? status : 'ready'"
          :disabled="!input.trim()"
          color="primary"
          size="sm"
          @stop="emit('stop')"
        />
      </div>
    </template>
  </UChatPrompt>
</template>
