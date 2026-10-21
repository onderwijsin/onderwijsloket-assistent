import { beforeEach, expect, it, vi } from "vitest";
import { protectBooking } from "../../server/utils/scheduling/replay";

const { records } = vi.hoisted(() => ({ records: new Map<string, unknown>() }));
vi.mock("nitropack/runtime", () => ({
  useStorage: () => ({
    getKeys: async () => [...records.keys()],
    removeItem: async (key: string) => {
      records.delete(key);
    },
    getItem: async (key: string) => records.get(key),
    setItem: async (key: string, value: unknown) => {
      records.set(key, value);
    }
  })
}));
const input = {
  language: "nl" as const,
  display_name: "Test",
  email: "person@example.test",
  phone_number: "+31612345678",
  time_zone: "Europe/Amsterdam",
  start_at: "2027-01-05T10:00:00Z",
  end_at: "2027-01-05T10:20:00Z",
  answers: [],
  confirmed: true as const
};
const output = {
  id: "event_test",
  organizer: "Adviser",
  start_at: input.start_at,
  end_at: input.end_at,
  time_zone: input.time_zone,
  message: "Confirmed"
};
beforeEach(() => records.clear());
it("returns the original confirmation on replay across languages and normalized emails", async () => {
  const create = vi.fn(async (mark: () => Promise<void>) => {
    await mark();
    return output;
  });
  expect(await protectBooking(input, create)).toEqual(output);
  expect(
    await protectBooking({ ...input, language: "en", email: "PERSON@example.test" }, create)
  ).toEqual(output);
  expect(create).toHaveBeenCalledTimes(1);
  expect([...records.keys()].join()).not.toContain(input.email);
});
it("blocks concurrent and uncertain writes", async () => {
  let finish!: () => void;
  const pending = protectBooking(input, async (mark) => {
    await mark();
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    throw new Error("timeout");
  });
  await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
  await expect(protectBooking(input, vi.fn())).rejects.toThrow("BOOKING_UNCERTAIN");
  finish();
  await expect(pending).rejects.toThrow("timeout");
  await expect(protectBooking(input, vi.fn())).rejects.toThrow("BOOKING_UNCERTAIN");
});
it("allows correction after validation fails before a provider attempt", async () => {
  await expect(
    protectBooking(input, async () => {
      throw new Error("invalid");
    })
  ).rejects.toThrow("invalid");
  expect(await protectBooking(input, async () => output)).toEqual(output);
});

it("allows a new attempt after the replay record expires", async () => {
  const create = vi.fn(async (mark: () => Promise<void>) => {
    await mark();
    return output;
  });
  await protectBooking(input, create);
  for (const key of records.keys()) records.set(key, { expires: 0 });
  await protectBooking(input, create);
  expect(create).toHaveBeenCalledTimes(2);
});
