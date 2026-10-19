import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { withFrontMatter } from "../../server/utils/content/front-matter";

describe("Markdown front matter", () => {
  it("serializes text, lists and nulls without allowing metadata to break the YAML block", () => {
    const metadata = {
      title: "Title\n---\nvalue: injected",
      tags: ["A: B", "yes"],
      updated: null,
      omitted: undefined,
      "unusual:key": "value"
    };
    const result = withFrontMatter("# Body\n\nOriginal content", metadata);
    const end = result.indexOf("\n---\n", 4);
    const { omitted: _omitted, ...expected } = metadata;
    expect(parse(result.slice(4, end))).toEqual(expected);
    expect(result.endsWith("# Body\n\nOriginal content")).toBe(true);
  });
});
