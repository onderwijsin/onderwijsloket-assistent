import { describe, it, expect, vi } from "vitest";
import { schedulingTool } from "../../server/utils/scheduling/tool";
import { SchedulingError } from "../../server/utils/scheduling/errors";
vi.mock("nitropack/runtime", () => ({ useRuntimeConfig: () => ({}) }));

/** Read the protocol's text fallback with explicit content-block narrowing. */
function errorData(result: Awaited<ReturnType<typeof schedulingTool>>) {
  const block = result.content[0];
  if (block?.type !== "text") throw new Error("Expected text error content");
  return JSON.parse(block.text);
}

describe("scheduling protocol errors", () => {
  it("provides the website fallback for changed options rejected by the provider", async () => {
    const result = await schedulingTool("nl", async () => {
      throw new SchedulingError("BOOKING_REJECTED");
    });
    expect(result).toMatchObject({ isError: true });
    const error = errorData(result);
    expect(error.code).toBe("BOOKING_REJECTED");
    expect(error.message).toContain("https://onderwijsloket.com/adviesgesprek");
  });
  it("includes uncertain-creation guidance in the displayed message itself", async () => {
    const result = await schedulingTool("en", async () => {
      throw new SchedulingError("BOOKING_UNCERTAIN");
    });
    expect(errorData(result).message).toContain(
      "Check your confirmation email before booking again"
    );
  });
  it("never exposes unexpected provider bodies or credentials", async () => {
    const result = await schedulingTool("nl", async () => {
      throw new Error("private-token person@example.test private upstream error");
    });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain("person@example.test");
    expect(errorData(result).code).toBe("UNAVAILABLE");
  });
});
