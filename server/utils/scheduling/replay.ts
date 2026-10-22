import { useStorage } from "nitropack/runtime";
import { z } from "zod";
import { schedulingBookingInput, schedulingBookingOutput } from "./schemas";
import { SchedulingError } from "./errors";

type BookingInput = z.input<typeof schedulingBookingInput>;
type BookingResult = z.infer<typeof schedulingBookingOutput>;
type BookingAction = (markAttempted: () => Promise<void>) => Promise<BookingResult>;
type ReplayStorage = ReturnType<typeof useStorage>;
type ReplayRecord = { expires: number; result?: unknown };

const hourInSeconds = 3600;
const hourInMilliseconds = hourInSeconds * 1000;
const activeBookings = new Set<string>();
let nextCleanupAt = 0;

/**
 * Hash the booking identity so storage keys contain no contact details.
 * @param booking - Validated booking whose email and start instant identify duplicate attempts.
 * @returns The hexadecimal SHA-256 digest of the normalized booking identity.
 */
async function bookingKey(booking: z.infer<typeof schedulingBookingInput>) {
  const email = booking.email.trim().toLowerCase();
  const start = Date.parse(booking.start_at);
  const identity = new TextEncoder().encode(JSON.stringify([email, start]));
  const digest = await crypto.subtle.digest("SHA-256", identity);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Prune lazily because the memory driver ignores storage TTL options.
 * @param storage - Replay storage namespace to prune.
 */
async function removeExpiredRecords(storage: ReplayStorage) {
  const now = Date.now();
  if (now < nextCleanupAt) return;

  nextCleanupAt = now + hourInMilliseconds;
  for (const key of await storage.getKeys()) {
    const record = await storage.getItem<ReplayRecord>(key);
    if (record && record.expires <= now) await storage.removeItem(key);
  }
}

/**
 * Reuse a confirmed result; an unfinished or unreadable attempt must never be replayed.
 * @param record - Stored attempt that may contain a confirmed booking.
 * @returns The validated original booking confirmation.
 * @throws SchedulingError when the stored attempt has no valid confirmation.
 */
function confirmedResult(record: ReplayRecord): BookingResult {
  const result = schedulingBookingOutput.safeParse(record.result);
  if (!result.success) throw new SchedulingError("BOOKING_UNCERTAIN");
  return result.data;
}

/**
 * Suppress duplicate writes for the same email and start instant within this server instance.
 * @param input - Booking details; contact information is hashed before use as a storage key.
 * @param action - Workflow that marks the attempt immediately before the provider write.
 * @returns The original confirmation on replay, without consuming another booking quota.
 */
export async function protectBooking(input: BookingInput, action: BookingAction) {
  const booking = schedulingBookingInput.parse(input);
  const key = await bookingKey(booking);
  if (activeBookings.has(key)) throw new SchedulingError("BOOKING_UNCERTAIN");

  activeBookings.add(key);
  try {
    const storage = useStorage("scheduling-replays");
    await removeExpiredRecords(storage);

    const previous = await storage.getItem<ReplayRecord>(key);
    if (previous && previous.expires > Date.now()) return confirmedResult(previous);

    // Retain attempts until the slot ends, with a minimum retention of one hour.
    const secondsUntilEnd = Math.ceil((Date.parse(booking.end_at) - Date.now()) / 1000);
    const ttl = Math.max(hourInSeconds, secondsUntilEnd);
    const expires = Date.now() + ttl * 1000;

    /** Persist an unfinished attempt before the provider write to prevent duplicate bookings. */
    const markAttempted = async () => {
      // Persist before sending: a timeout or lost stream must not cause another POST.
      await storage.setItem(key, { expires }, { ttl });
    };
    const result = await action(markAttempted);
    await storage.setItem(key, { expires, result }, { ttl });
    return result;
  } finally {
    activeBookings.delete(key);
  }
}
