import { describe, expect, it } from "vitest";
import {
  authorSourceSchema,
  profileSourceSchema,
  documentSourceSchema
} from "../../server/utils/projections/supporting";
import { author, profile, document } from "../fixtures/article-evidence-and-testimonials";
describe("distinct supporting-person and asset contracts", () => {
  it("keeps author and profile identities separate and does not expose biographies or staff relations", () => {
    const writer = authorSourceSchema.parse(author);
    const participant = profileSourceSchema.parse(profile);
    expect(writer.image?.url).toContain("/image/upload/");
    expect(participant.source_url).toBe("https://onderwijsloket.com/media/profielen/featured");
    expect(participant.image).toBeNull();
    expect(participant).not.toHaveProperty("name");
    expect(participant).not.toHaveProperty("body");
    expect(writer).not.toHaveProperty("team_member");
    expect(
      authorSourceSchema.parse({ ...author, image: null, job_title: undefined })
    ).toMatchObject({ image: null, job_title: null });
    expect(
      profileSourceSchema.parse({
        ...profile,
        image: { id: "profile-image" },
        last_name: undefined
      })
    ).toMatchObject({ last_name: null, image: { id: "profile-image" } });
  });
  it("retains unsupported or unexpanded document assets with explicit unknown delivery URLs", () => {
    for (const asset of ["raw-file", { id: "raw-file", type: "application/zip" }])
      expect(documentSourceSchema.parse({ ...document, asset }).asset).toEqual({
        id: "raw-file",
        url: null
      });
  });
});
