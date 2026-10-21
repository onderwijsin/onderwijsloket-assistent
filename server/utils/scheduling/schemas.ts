import { z } from "zod";
import { nullableOutput } from "../mcp-schema";

export const schedulingLanguageSchema = z.enum(["nl", "en"]);
const timestamp = z.iso.datetime({ offset: true });
const nonemptyText = z.string().trim().min(1).max(10000);
/** Shared input exposes language, never an arbitrary link ID. */
export const schedulingLinkInput = z.strictObject({ language: schedulingLanguageSchema });
export const schedulingSlotsInput = schedulingLinkInput.extend({
  from: timestamp
    .optional()
    .describe("User-preferred start as an ISO timestamp with offset. Omit for default windows."),
  until: timestamp
    .optional()
    .describe("User-preferred end as an ISO timestamp with offset. Maximum 31 days per call."),
  window: z
    .number()
    .int()
    .min(0)
    .max(54)
    .default(0)
    .describe(
      "Start at 0 (next 3 days). After no results use next_window: days 4–7, days 8–15, then weekly. Ignored with explicit dates."
    )
});
/** Exactly the documented event request, with server-generated field metadata. */
export const savvyCalEventInput = z.strictObject({
  display_name: z.string().trim().min(1).max(200),
  email: z.email(),
  phone_number: z
    .string()
    .regex(/^\+[1-9]\d{6,14}$/, "Use an international phone number, such as +31612345678."),
  time_zone: z
    .string()
    .min(1)
    .max(100)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, "Use an IANA time zone."),
  start_at: timestamp,
  end_at: timestamp,
  fields: z
    .array(
      z.strictObject({ id: z.string(), label: z.string(), type: z.string(), value: nonemptyText })
    )
    .max(100)
});
export const schedulingBookingInput = z.strictObject({
  ...schedulingLinkInput.shape,
  ...savvyCalEventInput.omit({ fields: true }).shape,
  answers: z
    .array(
      z.strictObject({
        field_id: z.string().max(100),
        values: z
          .array(nonemptyText)
          .min(1)
          .max(50)
          .describe(
            "One value for text/select fields; exact returned choices for checkbox fields. Never invent missing answers."
          )
      })
    )
    .max(100),
  confirmed: z
    .literal(true)
    .describe("The user explicitly confirmed the slot, contact details and completed form.")
});
/** Provider field types include the actual link types supplied by the organisation. */
export const savvyCalFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum([
    "hidden",
    "short_text",
    "long_text",
    "select",
    "checkboxes",
    "text",
    "textarea",
    "email",
    "phone",
    "radio",
    "checkbox"
  ]),
  is_required: z.boolean()
});
export const savvyCalLinkSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.literal("active"),
  slug: z.string(),
  description: z.string().nullable(),
  default_duration: z.number().int().positive(),
  durations: z.array(z.number().int().positive()).min(1),
  fields: z.array(savvyCalFieldSchema).max(100)
});
export const schedulingSlotSchema = z.object({
  start_at: timestamp,
  end_at: timestamp,
  duration: z.number().int().positive(),
  rank: z.number().int().positive()
});
/** Only the projection needed to establish a real, matching confirmation is retained. */
export const savvyCalEventSchema = z.object({
  id: z.string().min(1),
  state: z.literal("confirmed"),
  start_at: timestamp,
  end_at: timestamp,
  organizer: z.object({ display_name: z.string().min(1) }),
  link: z.object({ id: z.string() }),
  is_group_session: z.literal(false),
  payment: z.null(),
  location_settings: z.array(z.object({ type: z.literal("phone") })).nullable(),
  conferencing: z
    .object({ type: z.enum(["phone", "none"]), join_url: z.null().optional() })
    .nullable()
});
export const schedulingLinkOutput = z.object({
  language: schedulingLanguageSchema,
  id: z.string(),
  name: z.string(),
  url: z.url(),
  description: nullableOutput(z.string()),
  default_duration: z.number(),
  durations: z.array(z.number()),
  fields: z.array(
    savvyCalFieldSchema.extend({ options: z.array(z.string()), configured: z.boolean() })
  ),
  booking_ready: z.boolean(),
  blocking_field_ids: z.array(z.string()),
  guidance: z.string(),
  sources: z.array(z.url())
});
export const schedulingSlotsOutput = z.object({
  language: schedulingLanguageSchema,
  from: timestamp,
  until: timestamp,
  slots: z.array(schedulingSlotSchema),
  next_window: nullableOutput(z.number().int())
});
export const schedulingBookingOutput = z.object({
  id: z.string(),
  organizer: z.string(),
  start_at: timestamp,
  end_at: timestamp,
  time_zone: z.string(),
  message: z.string()
});
