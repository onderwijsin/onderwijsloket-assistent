<script lang="ts" setup>
import { z } from "zod";
import type { FormSubmitEvent } from "@nuxt/ui";

/** Required contact fields for the newsletter signup boundary. */
const baseSubscriberSchema = z.object({
  email: z.email({ error: "Ongeldig e-mailadres" }),
  firstName: z.string().trim().min(1, { error: "Geef je naam op" })
});
type Subscriber = z.infer<typeof baseSubscriberSchema>;

const form = useTemplateRef("form");
const input = useTemplateRef("input");

const { signup, handleSignupError } = useNewsletterSignup();
const toast = useToast();
const isSubmitting = ref(false);
const isDone = ref(false);

type RichSchema = Record<
  keyof Subscriber,
  { label: string; placeholder: string; fieldType: string }
>;

const richSchema: RichSchema = {
  email: { label: "Email", placeholder: "Jouw email", fieldType: "email" },
  firstName: { label: "Naam", placeholder: "Jouw naam", fieldType: "text" }
};

const state = reactive<Subscriber>({
  email: "",
  firstName: ""
});

const currentFieldTarget = ref<keyof Subscriber>("email");
const buttonAction = computed<"set-next" | "submit">(() => {
  return currentFieldTarget.value === "firstName" ? "submit" : "set-next";
});

const activeModel = computed({
  get: () => state[currentFieldTarget.value],
  set: (value: string) => {
    state[currentFieldTarget.value] = value;
  }
});

/**
 * Sets the next input target (if any keys are left)
 */
async function setNext() {
  // Make sure to validate the current target first. If any errors, the UI will show hint
  const valid = await form.value?.validate({ name: currentFieldTarget.value, silent: true });
  if (!valid) return;
  const keys = Object.keys(state) as (keyof Subscriber)[];
  const currentIndex = keys.indexOf(currentFieldTarget.value);
  if (currentIndex < keys.length - 1) {
    currentFieldTarget.value = keys[currentIndex + 1] as keyof Subscriber;
    // Focus the updated input after Vue renders the next field.
    await nextTick();
    input.value?.inputRef?.focus();
  }
}

/** Submits validated contact details and shows provider-independent feedback. */
async function onSubmit(event: FormSubmitEvent<Subscriber>) {
  if (isSubmitting.value || isDone.value) return;
  isSubmitting.value = true;
  try {
    await signup({ ...event.data, source: "website" });
    toast.add({
      title: "Gelukt!",
      description: "Bedankt voor je inschrijving. Je ontvangt binnenkort updates van ons.",
      color: "success",
      icon: getIcon("success")
    });
    isDone.value = true;
  } catch (error) {
    handleSignupError(error);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <UForm
    ref="form"
    :state="state"
    :schema="baseSubscriberSchema"
    class="floating-error-message relative flex sm:-mr-1"
    @submit="onSubmit"
  >
    <UFormField
      :name="currentFieldTarget"
      :label="richSchema[currentFieldTarget].label"
      size="xl"
      :ui="{ label: 'hidden', container: 'mt-0 sm:py-1.25' }"
      class="grow"
    >
      <UInput
        ref="input"
        v-model.trim="activeModel"
        :name="currentFieldTarget"
        :type="richSchema[currentFieldTarget].fieldType"
        :placeholder="richSchema[currentFieldTarget].placeholder"
        :disabled="isDone || isSubmitting"
        :required="true"
        :autocomplete="currentFieldTarget === 'email' ? 'email' : 'given-name'"
        variant="outline"
        color="neutral"
        @keydown.enter.prevent="
          !isSubmitting && !isDone && (buttonAction === 'set-next' ? setNext() : form?.submit())
        "
      />
    </UFormField>
    <div
      class="absolute top-1/2 right-2 aspect-square size-8 -translate-y-1/2 rounded-md bg-white sm:relative sm:-left-1 sm:aspect-auto sm:size-auto sm:min-w-[150px]"
    >
      <UButton
        type="button"
        :aria-label="buttonAction === 'set-next' ? 'Volgende' : 'Meld je aan'"
        size="lg"
        :loading="isSubmitting"
        :disabled="isDone || isSubmitting"
        class="h-full px-1.5 sm:px-4"
        block
        trailing
        :ui="{
          base: 'py-2 px-1.5 sm:px-4',
          label: 'hidden sm:inline',
          trailingIcon: 'ms-0 sm:ms-auto'
        }"
        :trailing-icon="getIcon(buttonAction === 'set-next' ? 'right' : 'send')"
        :label="buttonAction === 'set-next' ? 'Volgende' : 'Meld je aan'"
        @click="buttonAction === 'set-next' ? setNext() : form?.submit()"
      />
    </div>
  </UForm>
</template>

<style lang="postcss">
.floating-error-message [data-slot="error"] {
  position: absolute;
}
</style>
