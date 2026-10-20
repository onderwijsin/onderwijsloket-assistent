import { readFileSync } from "node:fs";
import { compile, createSSRApp, defineComponent, h } from "vue";
import { parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";
import { Markdown } from "@comark/vue";
import { describe, expect, it } from "vitest";

// Compile the production template so a regression in its renderer prop is observable.
const { descriptor } = parse(
  readFileSync(new URL("../../app/components/chat/ChatMarkdown.vue", import.meta.url), "utf8")
);
const ChatMarkdown = defineComponent({
  props: { text: String, streaming: Boolean },
  render: compile(descriptor.template!.content)
});

describe("chat Markdown rendering", () => {
  it.each([true, false])(
    "renders assistant/reasoning text with streaming=%s",
    async (streaming) => {
      const app = createSSRApp({
        render: () =>
          h(ChatMarkdown, {
            text: "Je hebt een **bevoegdheid** nodig.\n\n- Eerst je opleiding\n- Daarna lesgeven",
            streaming
          })
      });
      app.component("Markdown", Markdown);
      const html = await renderToString(app);
      expect(html).toContain("<strong>bevoegdheid</strong>");
      expect(html).toContain("Eerst je opleiding");
      expect(html).toContain("Daarna lesgeven");
      expect(html).not.toContain('markdown="');
    }
  );
});
