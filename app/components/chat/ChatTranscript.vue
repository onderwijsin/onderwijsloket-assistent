<script setup lang="ts">
import {
  getToolName,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type ChatStatus,
  type UIMessage
} from "ai";
import { isPartStreaming, isToolStreaming } from "@nuxt/ui/utils/ai";
import { canRegenerateChat } from "../../utils/chat-regenerate";
import { chatToolLabel } from "../../utils/chat-tool-label";

defineProps<{ messages: UIMessage[]; status: ChatStatus }>();
defineEmits<{ regenerate: [messageId: string] }>();
</script>

<template>
  <!-- The chat owns submission scrolling so the fixed composer is accounted for. -->
  <UChatMessages
    :messages="messages"
    :status="status === 'submitted' ? 'ready' : status"
    :should-scroll-to-bottom="false"
    :should-auto-scroll="true"
    :auto-scroll="false"
    :assistant="{
      ui: {
        container: 'pb-6',
        content: 'min-w-0 space-y-3 text-sm leading-6 [overflow-wrap:anywhere]',
        actions: 'static mt-2 opacity-100 [@media(hover:hover)]:opacity-100'
      }
    }"
    :user="{
      ui: {
        container: 'max-w-[85%] pb-6 sm:max-w-[75%]',
        actions: 'hidden',
        content:
          'min-h-0 rounded-2xl bg-white px-4 py-2.5 text-sm leading-6 shadow-xs dark:bg-neutral-800'
      }
    }"
    :ui="{ root: 'gap-0 px-0 [&>article]:last-of-type:min-h-0' }"
    class="pt-8 pb-2 sm:pt-10"
  >
    <template #actions="{ message }">
      <ChatResponseActions
        v-if="
          message.role === 'assistant' &&
          message.parts.some(isTextUIPart) &&
          !(
            (status === 'submitted' || status === 'streaming') &&
            message.id === messages.at(-1)?.id
          )
        "
        :message="message"
        :can-regenerate="canRegenerateChat(messages, message.id)"
        :busy="status === 'submitted' || status === 'streaming'"
        @regenerate="$emit('regenerate', $event)"
      />
    </template>
    <template #content="{ message }">
      <template v-for="(part, index) in message.parts" :key="`${message.id}-${index}`">
        <UChatReasoning
          v-if="isReasoningUIPart(part)"
          :text="part.text"
          :streaming="isPartStreaming(part)"
        >
          <ChatMarkdown :text="part.text" :streaming="isPartStreaming(part)" />
        </UChatReasoning>
        <UChatTool
          v-else-if="isToolUIPart(part)"
          :text="chatToolLabel(getToolName(part), part.input)"
          :streaming="isToolStreaming(part)"
        />
        <template v-else-if="isTextUIPart(part)">
          <ChatMarkdown
            v-if="message.role === 'assistant'"
            :text="part.text"
            :streaming="isPartStreaming(part)"
          />
          <p v-else class="whitespace-pre-wrap">{{ part.text }}</p>
        </template>
        <UButton
          v-else-if="part.type === 'source-url' && /^https?:\/\//i.test(part.url)"
          :to="part.url"
          :label="part.title || part.url"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="outline"
          size="xs"
          class="my-1 flex w-fit min-w-0 max-w-full"
          :ui="{ label: 'min-w-0 truncate' }"
        />
      </template>
    </template>
  </UChatMessages>
  <p
    v-if="status === 'submitted'"
    role="status"
    class="text-muted pb-6 text-sm motion-safe:animate-pulse"
  >
    Even nadenken…
  </p>
</template>
