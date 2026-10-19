import { describe, expect, it } from "vitest";
import {
  resolveContentLink,
  renderMarkdownLink
} from "../../server/utils/content/markdown-formatting";
import { useSourceUrl } from "../../server/utils/use-source-url";

describe("content URL formatting", () => {
  it.each([
    ["/kennisbank/a?lang=nl#section", "https://onderwijsloket.com/kennisbank/a?lang=nl#section"],
    ["https://example.test/a(b)", "https://example.test/a(b)"],
    ["mailto:advies@example.test", "mailto:advies@example.test"],
    ["tel:+31123456789", "tel:+31123456789"],
    ["#section", "#section"]
  ])("resolves supported destination %s", (value, expected) => {
    expect(resolveContentLink(value)).toBe(expected);
  });

  it.each([
    null,
    {},
    "relative/path",
    "//other.test/path",
    "javascript:alert(1)",
    "https://example.test/a b",
    "https://example.test/\npath",
    "/\\other.test"
  ])("omits unsupported destination %j", (value) => {
    expect(resolveContentLink(value)).toBeNull();
    expect(renderMarkdownLink("Label", value)).toBe("Label");
  });

  it("escapes text and keeps punctuation in link destinations intact", () => {
    expect(renderMarkdownLink("A [label]", "https://example.test/a(b)>")).toBe(
      "[A \\[label\\]](<https://example.test/a(b)%3E>)"
    );
  });

  it("builds canonical source URLs only from local paths", () => {
    expect(useSourceUrl("/")).toBe("https://onderwijsloket.com");
    expect(useSourceUrl("/kennisbank/a?lang=nl#section")).toBe(
      "https://onderwijsloket.com/kennisbank/a?lang=nl#section"
    );
    for (const path of ["https://other.test", "//other.test", "/\\other.test", "relative"]) {
      expect(useSourceUrl(path)).toBeNull();
    }
  });
});
