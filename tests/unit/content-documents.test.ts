import { describe, expect, it } from "vitest";
import { injectContentData } from "../../server/utils/content/inject-content-data";
import { renderContentDocument } from "../../server/utils/content/render-content-document";
import type { ContentNode } from "../../server/utils/content/types";

const options = { assetBaseUrl: "https://assets.example.test" };
const text = (value: string): ContentNode => ({ type: "text", text: value });
const paragraph = (...content: ContentNode[]): ContentNode => ({ type: "paragraph", content });
const relation = (id: string, collection: string, inline = false): ContentNode => ({
  type: inline ? "relation-inline-block" : "relation-block",
  attrs: { id, collection }
});
const doc = (...content: ContentNode[]) => ({ type: "doc", content });
const mention = {
  title: "Custom mention",
  item: [
    {
      collection: "articles",
      item: { id: "target", title: "Related article", path: "/kennisbank/artikelen/related" }
    }
  ]
};

describe("content documents", () => {
  it("optionally prepends record metadata, using nonblank fallbacks without mutating the document", () => {
    const document = doc(paragraph(text("Body")));
    const before = structuredClone(document);
    const metadata = {
      title: "  ",
      name: "A *name*",
      description: "",
      introduction: "Introduction",
      summary: "Unused"
    };
    expect(renderContentDocument(document, [], { ...options, metadata }).markdown).toBe("Body");
    expect(
      renderContentDocument(document, [], { ...options, metadata, ensureHeadingOne: true }).markdown
    ).toBe("# A \\*name\\*\n\nIntroduction\n\nBody");
    expect(document).toEqual(before);
  });

  it.each([false, true])("preserves a leading H1, with blank opening paragraphs: %s", (blank) => {
    const heading: ContentNode = {
      type: "heading",
      attrs: { level: 1 },
      content: [text("Existing")]
    };
    const document = doc(
      ...(blank ? [paragraph(), paragraph(text("  "))] : []),
      heading,
      paragraph(text("Body"))
    );
    const result = renderContentDocument(document, [], {
      ...options,
      ensureHeadingOne: true,
      metadata: { title: "Replacement", description: "Do not insert" }
    });
    expect(result.markdown?.trim()).toBe("# Existing\n\nBody");
  });

  it("prepends before an H2 or later H1, but cannot invent a missing title", () => {
    const document = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Section")] },
      { type: "heading", attrs: { level: 1 }, content: [text("Later")] }
    );
    expect(
      renderContentDocument(document, [], {
        ...options,
        ensureHeadingOne: true,
        metadata: { label: "Page", summary: "Summary" }
      }).markdown
    ).toBe("# Page\n\nSummary\n\n## Section\n\n# Later");
    expect(
      renderContentDocument(document, [], { ...options, ensureHeadingOne: true }).markdown
    ).toBe("## Section\n\n# Later");
  });

  it("keeps long content including generated metadata and preserves missing-document warnings", () => {
    const result = renderContentDocument(doc(paragraph(text("x".repeat(19999)))), [], {
      ...options,
      ensureHeadingOne: true,
      metadata: { title: "Title" }
    });
    expect(result.markdown).toHaveLength(20008);
    expect(result.markdown?.startsWith("# Title\n\n")).toBe(true);
    expect(result.truncated).toBe(false);
    expect(
      renderContentDocument(null, [], {
        ...options,
        ensureHeadingOne: true,
        metadata: { title: "Title" }
      })
    ).toMatchObject({ markdown: null, warnings: ["No content document is available."] });
  });

  it.each([
    null,
    undefined,
    [],
    { type: "doc", content: [] },
    { type: "doc", content: [{ type: "paragraph" }] }
  ])("does not fabricate a body from metadata for empty source content (%j)", (document) => {
    const result = renderContentDocument(document, [], {
      ...options,
      ensureHeadingOne: true,
      metadata: { title: "Title", description: "Description", summary: "Summary" }
    });
    expect(result.markdown).toBeNull();
    expect(result.warnings).toContain("No content document is available.");
    expect(result.truncated).toBe(false);
  });

  it("hydrates all seven Onderwijsloket relation types, including nested callout mentions", () => {
    const nodes = [
      { id: "button", collection: "buttons", item: { label: "Advice", to: "/advies" } },
      {
        id: "callout",
        collection: "callouts",
        item: {
          title: "Good to know",
          description: doc(paragraph(text("Read "), relation("nested", "mentions", true))),
          actions: [{ label: "Contact", to: "/contact" }],
          editor_nodes: [{ id: "nested", collection: "mentions", item: mention }]
        }
      },
      {
        id: "image",
        collection: "images",
        item: { alt_text: "A classroom", image: { id: "image-id" } }
      },
      {
        id: "media",
        collection: "mediaplayers",
        item: {
          type: "audio",
          title: "Podcast",
          artist: "Onderwijsloket",
          audio: { source: "audio-id" },
          chapters: [{ label: "Introduction", time: 65 }]
        }
      },
      {
        id: "list",
        collection: "content_lists",
        item: {
          items: [
            { title: "Second", sort: 2 },
            { title: "First", description: "Useful information", link: "/first", sort: 1 }
          ]
        }
      },
      {
        id: "related",
        collection: "related_content_lists",
        item: {
          items: [
            { collection: "sectors", item: { title: "Primair", slug: "primair-onderwijs" } },
            {
              collection: "articles",
              item: { title: "Article", path: "/article", description: "A source" }
            }
          ]
        }
      },
      { id: "mention", collection: "mentions", item: mention }
    ];
    const document = doc(
      relation("button", "buttons"),
      relation("callout", "callouts"),
      relation("image", "images"),
      relation("media", "mediaplayers"),
      relation("list", "content_lists"),
      relation("related", "related_content_lists"),
      paragraph(relation("mention", "mentions", true))
    );
    const before = structuredClone({ document, nodes });
    const result = renderContentDocument(document, nodes, options);
    expect(result.warnings).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.markdown).toContain("[Advice](<https://onderwijsloket.com/advies>)");
    expect(result.markdown).toContain("> **Good to know**");
    expect(result.markdown).toContain(
      "[Custom mention](<https://onderwijsloket.com/kennisbank/artikelen/related>)"
    );
    expect(result.markdown).toContain("![A classroom](<https://assets.example.test/image-id>)");
    expect(result.markdown).toContain("[Audio: Podcast](<https://assets.example.test/audio-id>)");
    expect(result.markdown).toContain("1:05 Introduction");
    expect(result.markdown).toContain("audio-id#t=65");
    expect(result.markdown?.indexOf("First")).toBeLessThan(result.markdown!.indexOf("Second"));
    expect(result.markdown).toContain("[Primair](<https://onderwijsloket.com/primair-onderwijs>)");
    expect(result.markdown).toContain("A source");
    expect({ document, nodes }).toEqual(before);
  });

  it.each(["audio", "video"])("renders %s media with the legacy id payload", (type) => {
    const result = renderContentDocument(
      doc(relation("legacy", "mediaplayers")),
      [
        {
          id: "legacy",
          collection: "mediaplayers",
          item: { type, title: "Media", [type]: { id: "legacy-id" } }
        }
      ],
      options
    );
    expect(result.markdown).toContain("https://assets.example.test/legacy-id");
    expect(result.warnings).toEqual([]);
  });

  it("preserves headings, formatting, lists, code and tables through Tiptap", () => {
    const document = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("Routes")] },
      paragraph(
        { ...text("Bold"), marks: [{ type: "bold" }] },
        text(" "),
        { ...text("Italic"), marks: [{ type: "italic" }] },
        text(" "),
        { ...text("Code"), marks: [{ type: "code" }] }
      ),
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph(text("Bullet"))] }] },
      {
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [paragraph(text("Ordered"))] }]
      },
      { type: "codeBlock", attrs: { language: "js" }, content: [text("const x = 1;")] },
      {
        type: "table",
        content: [
          {
            type: "tableRow",
            content: [
              { type: "tableHeader", content: [paragraph(text("Name"))] },
              { type: "tableHeader", content: [paragraph(text("Route"))] }
            ]
          },
          {
            type: "tableRow",
            content: [
              { type: "tableCell", content: [paragraph(text("A | B"))] },
              { type: "tableCell", content: [paragraph(text("Pabo"))] }
            ]
          }
        ]
      }
    );
    const { markdown } = renderContentDocument(document, [], options);
    expect(markdown).toContain("## Routes");
    expect(markdown).toContain("**Bold**");
    expect(markdown).toContain("*Italic*");
    expect(markdown).toContain("`Code`");
    expect(markdown).toMatch(/[-*] Bullet/);
    expect(markdown).toContain("3. Ordered");
    expect(markdown).toContain("```js\nconst x = 1;");
    expect(markdown).toContain("| Name | Route |");
    expect(markdown).toContain("A \\| B");
  });

  it("does not trust pre-injected data and reports missing or cyclic relations", () => {
    const node = relation("missing", "buttons");
    node.attrs!.data = { label: "Untrusted", to: "https://example.test" };
    const missing = renderContentDocument(doc(node), [], options);
    expect(missing.markdown).not.toContain("Untrusted");
    expect(missing.warnings).toContain("Unresolved editor node: buttons/missing.");
    const document = doc(relation("cycle", "callouts"));
    const cyclic = renderContentDocument(
      document,
      [{ id: "cycle", collection: "callouts", item: { title: "Nested", description: document } }],
      options
    );
    expect(cyclic.warnings).toContain("Cyclic editor node: callouts/cycle.");
  });

  it("matches both junction id and collection and resolves relation marks", () => {
    const document = doc(
      paragraph({
        ...text("Marked text"),
        marks: [{ type: "relation-mark", attrs: { id: "mark", collection: "mentions" } }]
      })
    );
    const injected = injectContentData(document, [
      { id: "mark", collection: "buttons", item: { label: "Wrong" } },
      { id: "mark", collection: "mentions", item: mention }
    ]);
    expect(injected.warnings).toEqual([]);
    expect(
      renderContentDocument(
        document,
        [{ id: "mark", collection: "mentions", item: mention }],
        options
      ).markdown
    ).toContain("[Marked text](<https://onderwijsloket.com/kennisbank/artikelen/related>)");
  });

  it("uses local junctions inside callouts and allows repeated references in separate branches", () => {
    const local = {
      title: "Local mention",
      item: [{ collection: "articles", item: { title: "Local", path: "/local" } }]
    };
    const rows = [
      { id: "shared", collection: "mentions", item: mention },
      {
        id: "callout",
        collection: "callouts",
        item: {
          description: doc(paragraph(relation("shared", "mentions", true))),
          editor_nodes: [{ id: "shared", collection: "mentions", item: local }]
        }
      }
    ];
    const result = renderContentDocument(
      doc(
        relation("callout", "callouts"),
        paragraph(
          relation("shared", "mentions", true),
          text(" and "),
          relation("shared", "mentions", true)
        )
      ),
      rows,
      options
    );
    expect(result.markdown).toContain("[Local mention](<https://onderwijsloket.com/local>)");
    expect(result.markdown?.match(/Custom mention/g)).toHaveLength(2);
    expect(result.warnings).toEqual([]);
  });

  it("validates malformed documents and junction rows at the boundary", () => {
    expect(() => renderContentDocument({ content: [] }, [], options)).toThrow();
    expect(() => renderContentDocument(doc(), [{ collection: "buttons" }], options)).toThrow();
    expect(renderContentDocument([paragraph(text("Array document"))], [], options).markdown).toBe(
      "Array document"
    );
  });

  it("reports the node-count limit for wide documents as well as deep ones", () => {
    const result = renderContentDocument(
      doc(...Array.from({ length: 10001 }, () => paragraph())),
      [],
      options
    );
    expect(result.truncated).toBe(true);
    expect(result.warnings).toEqual(["Document traversal limit reached."]);
  });

  it("retains meaningful fallbacks when expanded relation payloads have missing fields", () => {
    const nodes = [
      { id: "mention", collection: "mentions", item: { title: "Missing mention", item: [] } },
      { id: "image", collection: "images", item: {} },
      { id: "media", collection: "mediaplayers", item: { title: "Missing media", type: "video" } },
      { id: "related", collection: "related_content_lists", item: { items: [{ item: null }] } },
      { id: "future", collection: "future_blocks", item: { title: "Unknown" } }
    ];
    const result = renderContentDocument(
      doc(...nodes.map((node) => relation(node.id, node.collection))),
      nodes,
      options
    );
    expect(result.markdown).toContain("Missing mention");
    expect(result.markdown).toContain("[Image unavailable]");
    expect(result.markdown).toContain("Video: Missing media");
    expect(result.markdown).toContain("[Related content unavailable]");
    expect(result.markdown).toContain("[Unsupported future\\_blocks]");
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        "Unresolved mention target.",
        "Image asset is missing.",
        "Media asset is missing.",
        "Unresolved related content item.",
        "Unsupported editor node collection: future_blocks."
      ])
    );
  });

  it("renders callout plain text, list images and media artwork while ignoring invalid chapters", () => {
    const nodes = [
      { id: "callout", collection: "callouts", item: { description: "A *literal* description" } },
      {
        id: "list",
        collection: "content_lists",
        item: { items: [{ title: "Image", mediatype: "image", image: "image-id" }] }
      },
      {
        id: "media",
        collection: "mediaplayers",
        item: {
          title: "Video",
          type: "video",
          video: "video-id",
          artwork: "artwork-id",
          chapters: [
            { time: -1, label: "Negative" },
            { time: "invalid", label: "Invalid" },
            { time: 0, label: "Start" }
          ]
        }
      }
    ];
    const result = renderContentDocument(
      doc(...nodes.map((node) => relation(node.id, node.collection))),
      nodes,
      options
    );
    expect(result.markdown).toContain("> A \\*literal\\* description");
    expect(result.markdown).toContain("![Image](<https://assets.example.test/image-id>)");
    expect(result.markdown).toContain("![Video](<https://assets.example.test/artwork-id>)");
    expect(result.markdown).toContain("0:00 Start");
    expect(result.markdown).not.toContain("Negative");
    expect(result.markdown).not.toContain("Invalid");
    expect(result.warnings).toEqual([]);
  });

  it("flattens merged and uneven tables without treating the first data row as a header", () => {
    const result = renderContentDocument(
      doc(
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  attrs: { colspan: 2, rowspan: 2 },
                  content: [paragraph(text("First"))]
                }
              ]
            },
            {
              type: "tableRow",
              content: [{ type: "tableCell", content: [paragraph(text("Second"))] }]
            }
          ]
        },
        { type: "table", content: [] },
        paragraph(
          { ...text("sub"), marks: [{ type: "subscript" }] },
          { ...text("sup"), marks: [{ type: "superscript" }] }
        )
      ),
      [],
      options
    );
    expect(result.markdown).toContain("|  |  |\n| --- | --- |\n| First |  |\n| Second |  |");
    expect(result.markdown).toContain("<sub>sub</sub><sup>sup</sup>");
    expect(result.warnings).toEqual(["Merged table cells are flattened in Markdown."]);
  });

  it("still reports traversal truncation for excessively deep documents", () => {
    let nested = paragraph(text("Deep"));
    for (let depth = 0; depth < 45; depth++) {
      nested = { type: "blockquote", content: [nested] };
    }
    const result = renderContentDocument(doc(nested), [], options);
    expect(result.truncated).toBe(true);
    expect(result.warnings).toContain("Document traversal limit reached.");
  });

  it("reports unknown nodes, ignores unsafe link protocols and preserves long output", () => {
    const result = renderContentDocument(
      doc(
        { type: "future-node", content: [text("Preserved")] },
        paragraph({
          ...text("Unsafe"),
          marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }]
        })
      ),
      [],
      options
    );
    expect(result.markdown).toContain("Preserved");
    expect(result.markdown).not.toContain("javascript:");
    expect(result.warnings).toContain("Unsupported document node: future-node.");
    expect(
      renderContentDocument(doc(paragraph(text("a".repeat(25000)))), [], options)
    ).toMatchObject({ truncated: false, markdown: "a".repeat(25000) });
    expect(renderContentDocument(null, [], options)).toMatchObject({
      markdown: null,
      truncated: false
    });
  });
});
