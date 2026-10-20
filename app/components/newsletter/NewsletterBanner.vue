<template>
  <FluidBanner
    inner-container-class="py-8 sm:py-12 lg:py-16"
    container-class="flex flex-col gap-8 sm:gap-12 md:flex-row md:items-center"
  >
    <div class="grow">
      <h2 class="mb-2 text-lg font-bold lg:text-xl">
        Schrijf je in voor onze <GradientText>maandelijkse deep dives</GradientText>
      </h2>
      <p class="text-xs">
        Door je in te schrijven ga je akkoord met onze
        <NuxtLink to="https://onderwijsin.nl/privacy" class="underline">privacy policy</NuxtLink>.
      </p>
    </div>
    <div class="grid w-full md:max-w-md">
      <MailchimpSignup />
    </div>
  </FluidBanner>
</template>
