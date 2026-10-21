import { afterEach, describe, expect, it, vi } from "vitest";
import { createSavvyCalClient } from "../../server/utils/scheduling/client";
import { createSchedulingService, schedulingRange } from "../../server/utils/scheduling/service";
import { schedulingLinks, type SchedulingChoiceConfig } from "../../server/utils/scheduling/config";
import { schedulingFixtureEvent, schedulingFixtureLink } from "../fixtures/scheduling";

const start = "2027-01-05T10:00:00Z";
const end = "2027-01-05T10:20:00Z";
const input = {
  language: "nl" as const,
  start_at: start,
  end_at: end,
  display_name: "Fixture Person",
  email: "person@example.test",
  phone_number: "+31612345678",
  time_zone: "Europe/Amsterdam",
  answers: [{ field_id: "field_topic", values: ["Teaching routes"] }],
  confirmed: true as const
};

/** Build an isolated provider double with fresh mutable metadata for regression cases. */
function fixture() {
  const link = schedulingFixtureLink();
  const client = {
    getLink: vi.fn(async () => link),
    getSlots: vi.fn(async () => [{ start_at: start, end_at: end, duration: 20, rank: 1 }]),
    createEvent: vi.fn(async () => schedulingFixtureEvent("nl", start))
  };
  return { link, client, service: createSchedulingService(client), guard: vi.fn(async () => {}) };
}
afterEach(() => vi.useRealTimers());

describe("scheduling ranges", () => {
  it("uses contiguous three-day, four-day, eight-day, then weekly windows", () => {
    const now = Date.parse("2027-01-01T00:00:00Z");
    for (const [window, first, last] of [
      [0, 0, 3],
      [1, 3, 7],
      [2, 7, 15],
      [3, 15, 22],
      [4, 22, 29]
    ] as const) {
      const range = schedulingRange({ language: "nl", window }, now);
      expect(Date.parse(range.from)).toBe(now + first * 86400000);
      expect(Date.parse(range.until)).toBe(now + last * 86400000);
    }
  });
  it("honors explicit dates even when a later default window is supplied", () => {
    expect(
      schedulingRange(
        { language: "en", from: start, until: end, window: 10 },
        Date.parse("2027-01-01T00:00:00Z")
      )
    ).toEqual({ from: "2027-01-05T10:00:00.000Z", until: "2027-01-05T10:20:00.000Z" });
    expect(() => schedulingRange({ language: "nl", from: end, until: start }, 0)).toThrow(
      "INVALID_INPUT"
    );
    expect(() =>
      schedulingRange({ language: "nl", until: "2027-03-01T00:00:00Z" }, Date.parse(start))
    ).toThrow("INVALID_INPUT");
    expect(() => schedulingRange({ language: "nl", from: start }, Date.parse(end))).toThrow(
      "INVALID_INPUT"
    );
  });
});

describe("scheduling workflow", () => {
  it("reports missing choices without guessing or hiding current required fields", async () => {
    const { link, service } = fixture();
    link.fields.push({
      id: "field_education",
      label: "Education",
      type: "select",
      is_required: true
    });
    const result = await service.getLink({ language: "nl" });
    expect(result).toMatchObject({ booking_ready: false, blocking_field_ids: ["field_education"] });
    expect(result.fields.map(({ id }) => id)).not.toContain(schedulingLinks.nl.attributionField);
    expect(result.fields.find(({ id }) => id === "field_education")).toMatchObject({
      options: [],
      configured: false
    });
  });
  it("validates fresh required fields and consumes quota only just before creation", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { service, client, guard, link } = fixture();
    await expect(service.book({ ...input, answers: [] }, { beforeCreate: guard })).rejects.toThrow(
      "INVALID_ANSWERS"
    );
    expect(guard).not.toHaveBeenCalled();
    link.fields.push({
      id: "field_new",
      label: "New required answer",
      type: "short_text",
      is_required: true
    });
    await expect(service.book(input, { beforeCreate: guard })).rejects.toThrow("INVALID_ANSWERS");
    link.fields.pop();
    guard.mockImplementation(async () => {
      expect(client.getSlots).toHaveBeenCalled();
      expect(client.createEvent).not.toHaveBeenCalled();
    });
    const result = await service.book(input, { beforeCreate: guard, clientName: "Test MCP" });
    expect(result.message).toContain("Je boeking bij het Onderwijsloket is gelukt!");
    expect(result.message).toContain("Fixture Adviser");
    expect(result.message).toContain("11:00");
    expect(result).not.toHaveProperty("email");
    expect(client.createEvent.mock.calls[0]).toBeDefined();
    expect(client.createEvent).toHaveBeenCalledWith(
      "nl",
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ id: schedulingLinks.nl.attributionField, value: "Test MCP" })
        ])
      })
    );
    expect(guard).toHaveBeenCalledOnce();
  });
  it("requires confirmation, prevents hidden overrides and duplicate answers", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { service, guard } = fixture();
    await expect(
      service.book({ ...input, confirmed: false } as never, { beforeCreate: guard })
    ).rejects.toThrow("INVALID_INPUT");
    for (const answers of [
      [...input.answers, ...input.answers],
      [...input.answers, { field_id: schedulingLinks.nl.attributionField, values: ["Forged"] }]
    ]) {
      await expect(service.book({ ...input, answers }, { beforeCreate: guard })).rejects.toThrow(
        "INVALID_ANSWERS"
      );
    }
    expect(guard).not.toHaveBeenCalled();
  });
  it("validates owner-supplied choices against exact current field metadata", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { client, link, guard } = fixture();
    link.fields.push({
      id: "field_education",
      label: "Education",
      type: "select",
      is_required: true
    });
    const choices: SchedulingChoiceConfig = {
      nl: {
        field_education: { label: "Education", type: "select", values: ["Bachelor", "Master"] }
      },
      en: {}
    };
    const service = createSchedulingService(client, choices);
    const answers = [...input.answers, { field_id: "field_education", values: ["Invented"] }];
    await expect(service.book({ ...input, answers }, { beforeCreate: guard })).rejects.toThrow(
      "INVALID_ANSWERS"
    );
    answers[1]!.values = ["Bachelor"];
    await service.book({ ...input, answers }, { beforeCreate: guard });
    expect(client.createEvent).toHaveBeenCalledWith(
      "nl",
      expect.objectContaining({
        fields: expect.arrayContaining([expect.objectContaining({ value: "Unknown MCP Client" })])
      })
    );
    choices.nl.field_education!.label = "Old label";
    await expect(service.book({ ...input, answers }, { beforeCreate: guard })).rejects.toThrow(
      "FORM_NOT_CONFIGURED"
    );
  });
  it("blocks missing checkbox choices, then serializes confirmed selections as readable string values", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { client, link, guard } = fixture();
    link.fields.push({
      id: "field_sectors",
      label: "Sectors",
      type: "checkboxes",
      is_required: true
    });
    await expect(
      createSchedulingService(client).book(input, { beforeCreate: guard })
    ).rejects.toThrow("FORM_NOT_CONFIGURED");
    expect(guard).not.toHaveBeenCalled();
    const service = createSchedulingService(client, {
      nl: {
        field_sectors: { label: "Sectors", type: "checkboxes", values: ["Primary", "Secondary"] }
      },
      en: {}
    });
    await service.book(
      {
        ...input,
        answers: [...input.answers, { field_id: "field_sectors", values: ["Primary", "Secondary"] }]
      },
      { beforeCreate: guard }
    );
    expect(client.createEvent).toHaveBeenCalledWith(
      "nl",
      expect.objectContaining({
        fields: expect.arrayContaining([
          expect.objectContaining({ id: "field_sectors", value: "Primary\nSecondary" })
        ])
      })
    );
  });
  it("rejects stale slots and malformed availability without consuming quota", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { client, service, guard } = fixture();
    client.getSlots.mockResolvedValueOnce([]);
    await expect(service.book(input, { beforeCreate: guard })).rejects.toThrow("SLOT_UNAVAILABLE");
    client.getSlots.mockResolvedValueOnce([
      { start_at: start, end_at: end, duration: 60, rank: 1 }
    ]);
    await expect(service.book(input, { beforeCreate: guard })).rejects.toThrow("INVALID_RESPONSE");
    expect(guard).not.toHaveBeenCalled();
  });
  it("does not expand explicit preferences and returns continuation only for empty default windows", async () => {
    const { client, service } = fixture();
    client.getSlots.mockResolvedValue([]);
    expect((await service.getSlots({ language: "nl" }, Date.parse(start))).next_window).toBe(1);
    expect(
      (await service.getSlots({ language: "nl", from: start, until: end }, Date.parse(start)))
        .next_window
    ).toBeNull();
  });
  it("treats unexpected create responses as uncertain and never retries", async () => {
    vi.useFakeTimers().setSystemTime(new Date("2027-01-01T00:00:00Z"));
    const { client, service, guard } = fixture();
    client.createEvent.mockResolvedValueOnce({
      ...schedulingFixtureEvent("nl", start),
      state: "awaiting_approval"
    });
    await expect(service.book(input, { beforeCreate: guard })).rejects.toThrow("BOOKING_UNCERTAIN");
    expect(client.createEvent).toHaveBeenCalledOnce();
  });
  it("rejects unexpected link identities and new hidden fields", async () => {
    const { link, service } = fixture();
    link.id = schedulingLinks.en.id;
    await expect(service.getLink({ language: "nl" })).rejects.toThrow("INVALID_RESPONSE");
    link.id = schedulingLinks.nl.id;
    link.fields.push({ id: "field_unknown", label: "Hidden", type: "hidden", is_required: true });
    await expect(service.getLink({ language: "nl" })).rejects.toThrow("INVALID_RESPONSE");
  });
});

describe("SavvyCal HTTP adapter", () => {
  it("uses fixed authenticated paths, blocks redirects, strips arbitrary fields and never retries writes", async () => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(schedulingFixtureLink()), {
        headers: { "content-type": "application/json" }
      })
    );
    const client = createSavvyCalClient("private-test-token", transport);
    await client.getLink("nl");
    expect(transport.mock.calls[0]![0]).toBe(
      `https://api.savvycal.com/v1/links/${schedulingLinks.nl.id}`
    );
    const init = transport.mock.calls[0]![1]!;
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer private-test-token");
    expect(init.redirect).toBe("error");
    await expect(client.getLink("https://evil.test" as never)).rejects.toThrow("INVALID_INPUT");
    transport.mockReset().mockResolvedValue(
      new Response('{"secret":"upstream-private"}', {
        status: 500,
        headers: { "content-type": "application/json" }
      })
    );
    const body = {
      display_name: input.display_name,
      email: input.email,
      phone_number: input.phone_number,
      time_zone: input.time_zone,
      start_at: start,
      end_at: end,
      fields: []
    };
    await expect(client.createEvent("en", body)).rejects.toThrow("BOOKING_UNCERTAIN");
    expect(transport).toHaveBeenCalledOnce();
    await expect(
      client.createEvent("en", { ...body, metadata: { unsafe: true } } as never)
    ).rejects.toThrow("INVALID_INPUT");
    expect(transport).toHaveBeenCalledOnce();
    await expect(createSavvyCalClient("", transport).getLink("nl")).rejects.toThrow(
      "NOT_CONFIGURED"
    );
  });
  it("sanitizes read errors and distinguishes documented write rejection from uncertain outcomes", async () => {
    const transport = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response('{"private":"sensitive"}', {
          status: 422,
          headers: { "content-type": "application/json" }
        })
    );
    const client = createSavvyCalClient("private-token", transport);
    await expect(client.getLink("nl")).rejects.toThrow("UNAVAILABLE");
    await expect(
      client.createEvent("nl", {
        display_name: input.display_name,
        email: input.email,
        phone_number: input.phone_number,
        time_zone: input.time_zone,
        start_at: start,
        end_at: end,
        fields: []
      })
    ).rejects.toThrow("BOOKING_REJECTED");
  });
});
