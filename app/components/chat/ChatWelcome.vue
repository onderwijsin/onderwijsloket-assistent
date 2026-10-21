<script setup lang="ts">
const emit = defineEmits<{ select: [prompt: string] }>();
const greeting = useState("chat-greeting", () => {
  const hour = Number(
    new Intl.DateTimeFormat("nl-NL", {
      timeZone: "Europe/Amsterdam",
      hour: "numeric",
      hourCycle: "h23"
    }).format(new Date())
  );
  return hour < 6
    ? "Goedenacht"
    : hour < 12
      ? "Goedemorgen"
      : hour < 18
        ? "Goedemiddag"
        : "Goedenavond";
});

// Dutch conversation starters for common questions and existing MCP prompt themes.
const suggestions = [
  {
    label: "Welke route past bij mij?",
    icon: "i-lucide-route",
    prompt:
      "Ik wil in het onderwijs werken. Help me ontdekken welke opleidingsroute bij mijn achtergrond en wensen past. Stel me één vraag tegelijk."
  },
  {
    label: "Opleidingen vergelijken",
    icon: "i-lucide-graduation-cap",
    prompt:
      "Ik wil opleidingen voor werken in het onderwijs vergelijken. Help me eerst bepalen wat ik belangrijk vind en welke opleidingen ik wil vergelijken."
  },
  {
    label: "Advies bij mij in de buurt",
    icon: "i-lucide-map-pin",
    prompt:
      "Ik zoek persoonlijk advies over werken in het onderwijs bij mij in de buurt. Vraag me waar ik woon en waarover ik advies zoek."
  },
  {
    label: "Welke bevoegdheid heb ik nodig",
    icon: "i-lucide-badge-check",
    prompt:
      "Welke bevoegdheid heb ik nodig om les te geven? Vraag me in welke onderwijssector en welk vak ik wil werken en welke opleiding ik al heb."
  },
  {
    label: "Wat is het salaris in het onderwijs",
    icon: "i-lucide-euro",
    prompt:
      "Wat is het salaris in het onderwijs? Help me dit uitzoeken op basis van de functie, onderwijssector en mijn werkervaring."
  },
  {
    label: "Hoe werkt zij-instromen",
    icon: "i-lucide-signpost",
    prompt:
      "Hoe werkt zij-instromen in het onderwijs? Leg uit wat het inhoudt en vraag me naar mijn achtergrond en de sector waarin ik wil werken."
  },
  {
    label: "Plan een adviesgesprek",
    icon: "i-lucide-calendar-days",
    prompt:
      "Ik wil een telefonisch adviesgesprek plannen met een adviseur van het Onderwijsloket. Help me een geschikt moment te kiezen en de benodigde gegevens te verzamelen."
  },
  {
    label: "Ervaringen van anderen",
    icon: "i-lucide-messages-square",
    prompt:
      "Ik wil ervaringen horen van mensen die in het onderwijs zijn gaan werken. Help me bepalen welke verhalen, podcasts of video's aansluiten bij mijn situatie."
  }
];
</script>

<template>
  <div class="space-y-7 sm:space-y-9">
    <div class="space-y-3">
      <UBadge
        label="Experimenteel"
        icon="i-lucide-sparkles"
        :ui="{ leadingIcon: 'size-3' }"
        color="primary"
        variant="subtle"
        size="sm"
        class="shrink-0 rounded-full"
      />
      <h1
        id="chat-heading"
        class="text-highlighted text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
      >
        {{ greeting }} <span aria-hidden="true">👋</span>
      </h1>
      <p class="text-muted text-base sm:text-lg">Wat wil je weten over werken in het onderwijs?</p>
    </div>
    <slot />
    <div class="flex flex-wrap gap-2" aria-label="Suggesties om een gesprek te beginnen">
      <UButton
        v-for="suggestion in suggestions"
        :key="suggestion.label"
        :label="suggestion.label"
        :icon="suggestion.icon"
        :ui="{ leadingIcon: 'size-3.5!' }"
        size="sm"
        color="neutral"
        variant="outline"
        class="rounded-full bg-default/50"
        @click="emit('select', suggestion.prompt)"
      />
    </div>
  </div>
</template>
