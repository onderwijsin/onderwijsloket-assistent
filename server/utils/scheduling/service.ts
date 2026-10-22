import { z } from "zod";
import type { SavvyCalClient } from "./client";
import { schedulingLinks, type SchedulingLanguage } from "./config";
import { SchedulingError } from "./errors";
import {
  schedulingBookingInput,
  schedulingBookingOutput,
  schedulingLinkInput,
  schedulingLinkOutput,
  schedulingSlotsInput,
  schedulingSlotsOutput,
  schedulingSlotSchema,
  savvyCalEventSchema,
  savvyCalEventInput,
  savvyCalLinkSchema
} from "./schemas";

type Booking = z.infer<typeof schedulingBookingInput>;
type Link = z.infer<typeof savvyCalLinkSchema>;
type FormField = Link["fields"][number] & { configured: boolean };
type EventFields = z.infer<typeof savvyCalEventInput>["fields"];
type ConfirmedEvent = z.infer<typeof savvyCalEventSchema>;
type TimeRange = { from: string; until: string };
type BookingContext = { clientName?: string; beforeCreate: () => Promise<void> };

const day = 24 * 60 * 60 * 1000;
const choiceTypes = new Set(["select", "radio", "checkbox", "checkboxes"]);
const multipleTypes = new Set(["checkbox", "checkboxes"]);

/**
 * Validate without exposing source data or Zod error payloads.
 * @param schema - Expected boundary contract.
 * @param value - Untrusted input or provider result.
 * @param code - Safe failure category.
 * @returns Parsed projection.
 * @throws SchedulingError when the input or provider response does not match the schema.
 */
function parse<T>(
  schema: z.ZodType<T>,
  value: unknown,
  code: "INVALID_INPUT" | "INVALID_RESPONSE" = "INVALID_RESPONSE"
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new SchedulingError(code);
  return parsed.data;
}

/**
 * Return contiguous day offsets, expanding weekly after the first fifteen days.
 * @param window - Zero-based availability window index.
 * @returns Start and end day offsets relative to the current time.
 */
function defaultWindowDays(window: number): [number, number] {
  switch (window) {
    case 0:
      return [0, 3];
    case 1:
      return [3, 7];
    case 2:
      return [7, 15];
    default: {
      const start = 15 + (window - 3) * 7;
      return [start, start + 7];
    }
  }
}

/**
 * Only expose usable, unambiguous choices from the current provider response.
 * @param field - Fresh provider field with its available choices.
 * @returns The field with a flag indicating whether its choices can be used safely.
 */
function configureField(field: Link["fields"][number]): FormField {
  const options = field.options ?? [];
  const configured =
    !choiceTypes.has(field.type) ||
    (options.length > 0 &&
      new Set(options.map(({ id }) => id)).size === options.length &&
      new Set(options.map(({ value }) => value)).size === options.length);
  return { ...field, configured };
}

/**
 * Validate against fresh options and submit provider IDs without rewriting prefixes.
 * @param field - Current field definition and configuration status.
 * @param values - Submitted answer values, preserving provider choice values.
 * @returns The provider field payload with resolved option IDs.
 * @throws SchedulingError when choices are unconfigured or answers are invalid.
 */
function serializeAnswer(field: FormField, values: string[]): EventFields[number] {
  if (!field.configured) throw new SchedulingError("FORM_NOT_CONFIGURED");

  const hasDuplicates = new Set(values).size !== values.length;
  const hasMultipleAnswers = !multipleTypes.has(field.type) && values.length !== 1;
  const hasUnknownChoice =
    choiceTypes.has(field.type) &&
    values.some((value) => !field.options?.some((option) => option.value === value));
  if (hasDuplicates || hasMultipleAnswers || hasUnknownChoice) {
    throw new SchedulingError("INVALID_ANSWERS");
  }
  if (field.type === "email" && !z.email().safeParse(values[0]).success) {
    throw new SchedulingError("INVALID_ANSWERS");
  }

  const metadata = { id: field.id, label: field.label };
  switch (field.type) {
    case "select":
    case "radio":
    case "checkbox":
    case "checkboxes":
      return {
        ...metadata,
        type: field.type,
        options: values.map((value) => field.options!.find((option) => option.value === value)!)
      };
    default:
      return { ...metadata, type: field.type, value: values[0]! };
  }
}

/**
 * Reject missing, duplicate or unknown answers before preparing provider fields.
 * @param fields - Current visible form fields.
 * @param submitted - Answers supplied for the confirmed booking.
 * @returns Validated provider payloads for answered fields.
 * @throws SchedulingError when required fields are unconfigured or answers are missing, duplicated or unknown.
 */
function prepareAnswers(fields: FormField[], submitted: Booking["answers"]) {
  if (fields.some((field) => field.is_required && !field.configured)) {
    throw new SchedulingError("FORM_NOT_CONFIGURED");
  }

  const answers = new Map(submitted.map((answer) => [answer.field_id, answer.values]));
  const hasUnknownField = submitted.some(
    ({ field_id }) => !fields.some(({ id }) => id === field_id)
  );
  if (answers.size !== submitted.length || hasUnknownField) {
    throw new SchedulingError("INVALID_ANSWERS");
  }

  return fields.flatMap((field) => {
    const values = answers.get(field.id);
    if (values) return [serializeAnswer(field, values)];
    if (field.is_required) throw new SchedulingError("INVALID_ANSWERS");
    return [];
  });
}

/**
 * Confirm the requested link, exact instants and preservation of every submitted answer.
 * @param raw - Untrusted event creation response.
 * @param linkId - Expected provider link ID.
 * @param booking - Confirmed booking details.
 * @param submitted - Field payloads sent to the provider.
 * @returns The validated event with the requested slot and preserved answers.
 * @throws SchedulingError when the response does not establish that the requested booking was created.
 */
function readConfirmation(
  raw: unknown,
  linkId: string,
  booking: Booking,
  submitted: EventFields
): ConfirmedEvent {
  const result = savvyCalEventSchema.safeParse(raw);
  if (!result.success) throw new SchedulingError("BOOKING_UNCERTAIN");

  const event = result.data;
  if (
    event.link.id !== linkId ||
    Date.parse(event.start_at) !== Date.parse(booking.start_at) ||
    Date.parse(event.end_at) !== Date.parse(booking.end_at)
  ) {
    throw new SchedulingError("BOOKING_UNCERTAIN");
  }
  for (const expected of submitted) {
    const matches = event.scheduler.fields.filter(({ id }) => id === expected.id);
    const actual = matches[0];
    if (matches.length !== 1 || !actual || actual.type !== expected.type) {
      throw new SchedulingError("BOOKING_UNCERTAIN");
    }
    const preserved =
      "options" in expected
        ? actual.options?.length === expected.options.length &&
          expected.options.every((option) =>
            actual.options?.some(({ id, value }) => id === option.id && value === option.value)
          )
        : actual.value === expected.value;
    if (!preserved) throw new SchedulingError("BOOKING_UNCERTAIN");
  }
  return event;
}

/**
 * Format the confirmation in the consultation language and the user's time zone.
 * @param event - Validated provider event.
 * @param booking - Booking language and time zone.
 * @returns Minimal booking details and a localized confirmation message.
 */
function bookingConfirmation(event: ConfirmedEvent, booking: Booking) {
  const { language, time_zone } = booking;
  const when = new Intl.DateTimeFormat(language === "nl" ? "nl-NL" : "en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: time_zone
  }).format(new Date(event.start_at));
  const organizer = event.organizer.display_name;
  const message =
    language === "nl"
      ? [
          `Je boeking bij het Onderwijsloket is gelukt! Je hebt een afspraak met ${organizer} op ${when} (${time_zone}). Je vindt een bevestiging van deze boeking in je email.`,
          "Wil je je afspraak annuleren of omzetten? Dat kan door te klikken op de betreffende link in de bevestigingsmail.",
          "We spreken je graag dan! Groeten van het Onderwijsloket."
        ]
      : [
          `Your booking with het Onderwijsloket was successful! You have an appointment with ${organizer} on ${when} (${time_zone}). You will find a confirmation in your email.`,
          "To cancel or reschedule, use the relevant link in your confirmation email.",
          "We look forward to speaking with you! Best wishes from het Onderwijsloket."
        ];
  return schedulingBookingOutput.parse({
    id: event.id,
    organizer,
    start_at: event.start_at,
    end_at: event.end_at,
    time_zone,
    message: message.join("\n")
  });
}

/**
 * Resolve a single conservative window with no gaps between subsequent windows.
 * @param input - Language, optional preferred dates, or a default window index.
 * @param now - Anchor for default windows.
 * @returns ISO timestamps for one provider query.
 * @throws SchedulingError when dates are invalid, in the past, reversed or more than 31 days apart.
 */
export function schedulingRange(input: z.input<typeof schedulingSlotsInput>, now = Date.now()) {
  const args = parse(schedulingSlotsInput, input, "INVALID_INPUT");
  const [startDay, endDay] = defaultWindowDays(args.window);
  const from = args.from ? Date.parse(args.from) : now + (args.until ? 0 : startDay * day);
  const until = args.until
    ? Date.parse(args.until)
    : from + (args.from ? 3 : endDay - startDay) * day;
  if (from < now || until <= from || until - from > 31 * day)
    throw new SchedulingError("INVALID_INPUT");
  return { from: new Date(from).toISOString(), until: new Date(until).toISOString() };
}

/** Encapsulate scheduling without accepting request URLs, API options or arbitrary link IDs.
 * @param client - Restricted API adapter.
 * @returns Metadata, availability and confirmed booking workflows.
 */
export function createSchedulingService(client: SavvyCalClient) {
  /** Fetch and validate fresh link identity, duration and attribution metadata.
   * @param language - Selected consultation language.
   * @returns Fresh API link with usable form configuration.
   */
  async function readLink(language: SchedulingLanguage) {
    const expected = schedulingLinks[language];
    const link = parse(savvyCalLinkSchema, await client.getLink(language));
    if (
      link.id !== expected.id ||
      link.slug !== expected.slug ||
      !link.durations.includes(link.default_duration) ||
      new Set(link.fields.map(({ id }) => id)).size !== link.fields.length
    ) {
      throw new SchedulingError("INVALID_RESPONSE");
    }
    const attribution = link.fields.find(({ id }) => id === expected.attributionField);
    if (
      !attribution ||
      attribution.type !== "hidden" ||
      link.fields.some((field) => field.type === "hidden" && field.id !== expected.attributionField)
    ) {
      throw new SchedulingError("INVALID_RESPONSE");
    }
    const fields = link.fields.filter(({ type }) => type !== "hidden").map(configureField);
    return { link, fields, attribution };
  }

  /** Fetch one range and reject malformed or out-of-bounds slot data.
   * @param language - Selected consultation language.
   * @param range - Resolved bounded timestamps.
   * @param durations - Current link durations.
   * @returns Unique valid slots preserving preference rank.
   */
  async function readSlots(language: SchedulingLanguage, range: TimeRange, durations: number[]) {
    const slots = parse(z.array(schedulingSlotSchema), await client.getSlots(language, range));
    const from = Date.parse(range.from);
    const until = Date.parse(range.until);
    for (const slot of slots) {
      const start = Date.parse(slot.start_at);
      const end = Date.parse(slot.end_at);
      const validDuration =
        durations.includes(slot.duration) && end - start === slot.duration * 60000;
      if (!validDuration || start < from || end > until) {
        throw new SchedulingError("INVALID_RESPONSE");
      }
    }

    const seen = new Set<string>();
    return slots.filter((slot) => {
      const key = JSON.stringify([slot.start_at, slot.end_at, slot.rank]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return {
    /** Retrieve the current form, including an explicit list of missing choice configurations.
     * @param input - Consultation language.
     * @returns Current metadata and preparation guidance; hidden fields remain server-owned.
     */
    async getLink(input: z.input<typeof schedulingLinkInput>) {
      const { language } = parse(schedulingLinkInput, input, "INVALID_INPUT");
      const { link, fields } = await readLink(language);
      const blocking = fields
        .filter((field) => field.is_required && !field.configured)
        .map(({ id }) => id);
      return schedulingLinkOutput.parse({
        language,
        id: link.id,
        name: link.name,
        description: link.description,
        url: `https://advies.onderwijsloket.com/${schedulingLinks[language].slug}`,
        default_duration: link.default_duration,
        durations: link.durations,
        fields: fields.map((field) => ({
          ...field,
          options: field.configured ? (field.options ?? []).map(({ value }) => value) : []
        })),
        booking_ready: blocking.length === 0,
        blocking_field_ids: blocking,
        guidance:
          "Only offer on an explicit request for personal consultation or when a complex question remains unresolved after consulting available knowledge. A free, independent, roughly 20-minute one-to-one telephone consultation about working in education. The adviser calls the user's phone number. Prepare desired sector and role, practical obstacles and specific questions. Read the preparation information sent by email. Reuse known background only with confirmation. Ask for every required answer; never invent answers or choices. Missing choice configuration blocks booking. Infer the time zone from reliable conversation or host context, otherwise use Europe/Amsterdam; do not ask for it. Label displayed times clearly and accept corrections. Ask simply for a reachable phone number. Normalize spaces, punctuation and a clear national number to international format internally (for example, Dutch 0612345678 becomes +31612345678). Respect an explicit country code or established country context. Otherwise, when our conversation is in Dutch, assume the Netherlands (+31) for a national phone number without asking which country it belongs to. Ask which country the number belongs to only when it remains ambiguous. Never request an international format or a country code as a formatting task, explain the conversion, or ask a separate confirmation of formatting. Show the normalized international phone number, including its country code, in the final booking summary and use that same number for booking (for example, +31612345678). Ask one focused question per turn, bold on its own line. Defer preparation links until after booking unless requested. Confirm the selected slot and completed details before booking.",
        sources: [
          "https://onderwijsloket.com/adviesgesprek",
          "https://onderwijsloket.com/wat-kan-je-van-een-adviesgesprek-verwachten"
        ]
      });
    },
    /** Fetch one availability window; expand only after an empty default-window result.
     * @param input - Language, preferred range or continuation index.
     * @param now - Current time for deterministic range validation.
     * @returns Available slots and default-window continuation.
     */
    async getSlots(input: z.input<typeof schedulingSlotsInput>, now = Date.now()) {
      const args = parse(schedulingSlotsInput, input, "INVALID_INPUT");
      const range = schedulingRange(args, now);
      const { link } = await readLink(args.language);
      const slots = await readSlots(args.language, range, link.durations);
      return schedulingSlotsOutput.parse({
        language: args.language,
        ...range,
        slots,
        next_window:
          !slots.length && !args.from && !args.until && args.window < 54 ? args.window + 1 : null
      });
    },
    /** Validate fresh form and slot before consuming quota and sending one event creation request.
     * @param input - Explicitly confirmed contact information, form answers and slot.
     * @param context - Trusted connection attribution and mandatory creation quota guard.
     * @returns Minimal confirmation; uncertain mutations must not be automatically retried.
     */
    async book(input: z.input<typeof schedulingBookingInput>, context: BookingContext) {
      const args = parse(schedulingBookingInput, input, "INVALID_INPUT");
      const range = schedulingRange({
        language: args.language,
        from: args.start_at,
        until: args.end_at
      });
      const { link, fields, attribution } = await readLink(args.language);
      const submitted = prepareAnswers(fields, args.answers);
      submitted.push({
        id: attribution.id,
        label: attribution.label,
        type: "hidden",
        value: context.clientName?.trim().slice(0, 200) || "Unknown MCP Client"
      });
      const slots = await readSlots(args.language, range, link.durations);
      if (
        !slots.some(
          (slot) =>
            Date.parse(slot.start_at) === Date.parse(args.start_at) &&
            Date.parse(slot.end_at) === Date.parse(args.end_at)
        )
      ) {
        throw new SchedulingError("SLOT_UNAVAILABLE");
      }
      await context.beforeCreate();
      const raw = await client.createEvent(args.language, {
        display_name: args.display_name,
        email: args.email,
        phone_number: args.phone_number,
        time_zone: args.time_zone,
        start_at: args.start_at,
        end_at: args.end_at,
        fields: submitted
      });
      const event = readConfirmation(raw, link.id, args, submitted);
      return bookingConfirmation(event, args);
    }
  };
}
