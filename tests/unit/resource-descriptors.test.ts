import { describe, expect, it } from "vitest";
import { describeResource, resourceUri } from "../../server/utils/resources/descriptors";

const record = { id: "example-id", title: "Title", description: "Description" };

describe("collection-independent resource descriptors", () => {
  it("builds resource links for different collections without fetching documents", () => {
    expect(resourceUri("articles", record.id)).toBe("onderwijsloket://articles/example-id");
    expect(describeResource("examples", record)).toEqual({
      uri: "onderwijsloket://examples/example-id",
      name: record.id,
      title: record.title,
      description: record.description,
      mimeType: "text/markdown"
    });
  });

  it("omits absent descriptor fields so cached catalogue metadata remains stable", () => {
    const descriptor = describeResource("faqs", { id: "faq-1", title: "Question?" });
    expect(descriptor).not.toHaveProperty("description");
    expect(JSON.parse(JSON.stringify(descriptor))).toEqual(descriptor);
  });

  it("adds valid source update annotations and omits unknown dates", () => {
    expect(
      describeResource("examples", { ...record, date_updated: "2026-10-19T12:00:00Z" }).annotations
    ).toEqual({ lastModified: "2026-10-19T12:00:00.000Z" });
    expect(describeResource("examples", { ...record, date_updated: "invalid" })).not.toHaveProperty(
      "annotations"
    );
    expect(describeResource("examples", { ...record, date_updated: null })).not.toHaveProperty(
      "annotations"
    );
  });
});
