import { readFileSync } from "node:fs";
import { compile, computed, createSSRApp, defineComponent, h } from "vue";
import { parse } from "vue/compiler-sfc";
import { renderToString } from "vue/server-renderer";
import { describe, expect, it } from "vitest";

/** Compile production templates without a browser or a new Vue test plugin. */
function template(name: string, directory = "../../app/components/chat/") {
  const { descriptor } = parse(
    readFileSync(new URL(`${directory}${name}.vue`, import.meta.url), "utf8")
  );
  return compile(descriptor.template!.content);
}

const Transcript = defineComponent({
  props: ["status", "messages"],
  render: template("ChatTranscript")
});
const Composer = defineComponent({
  props: ["status", "compact"],
  setup(props) {
    return {
      input: "",
      settings: {},
      models: [],
      features: [],
      selectedIcon: undefined,
      busy: computed(() => props.status === "submitted" || props.status === "streaming")
    };
  },
  render: template("ChatComposer")
});

const Interface = defineComponent({
  props: ["showTranscript"],
  setup: () => ({
    input: "",
    settings: {},
    status: "ready",
    messages: [],
    error: undefined,
    dockHeight: 160,
    submit: () => {},
    stop: () => {},
    selectSuggestion: () => {},
    regenerate: () => {},
    clearError: () => {}
  }),
  render: template("ChatInterface")
});
const Shell = defineComponent({
  props: ["chatTranscriptActive"],
  setup: () => ({ nl: {} }),
  render: template("app", "../../app/")
});

/** Render shell composition without mounting Nuxt or calling AI providers. */
function registerStubs(app: ReturnType<typeof createSSRApp>, names: string[]) {
  for (const name of names) {
    app.component(
      name,
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h("div", { "data-component": name }, slots.default?.())
      })
    );
  }
}

describe("chat viewport contracts", () => {
  it.each([false, true])("uses page scrolling in transcript mode=%s", async (showTranscript) => {
    const app = createSSRApp({ render: () => h(Interface, { showTranscript }) });
    registerStubs(app, ["ChatWelcome", "ChatComposer", "ChatTranscript", "UAlert", "UButton"]);
    const html = await renderToString(app);
    expect(html).not.toContain("overflow-y-auto");
    expect(html).not.toContain("overflow-x-auto");
    expect(html.includes("fixed inset-x-0 bottom-0")).toBe(showTranscript);
    if (showTranscript) expect(html).toContain("padding-bottom:160px");
  });

  it.each([false, true])(
    "hides newsletter and footer only in transcript mode=%s",
    async (chatTranscriptActive) => {
      const app = createSSRApp({ render: () => h(Shell, { chatTranscriptActive }) });
      registerStubs(app, [
        "UApp",
        "NuxtRouteAnnouncer",
        "NuxtLoadingIndicator",
        "Header",
        "UMain",
        "NuxtLayout",
        "NuxtPage",
        "NewsletterBanner",
        "Footer"
      ]);
      const html = await renderToString(app);
      expect(html.includes('data-component="NewsletterBanner"')).toBe(!chatTranscriptActive);
      expect(html.includes('data-component="Footer"')).toBe(!chatTranscriptActive);
    }
  );

  it("does not trigger the library's document-scrolling submitted handler", async () => {
    const app = createSSRApp({
      render: () => h(Transcript, { status: "submitted", messages: [] })
    });
    app.component(
      "UChatMessages",
      defineComponent({
        props: ["status", "shouldScrollToBottom"],
        setup: (props) => () =>
          h("div", {
            "data-status": props.status,
            "data-initial-scroll": String(props.shouldScrollToBottom)
          })
      })
    );
    const html = await renderToString(app);
    expect(html).toContain('data-status="ready"');
    expect(html).toContain('data-initial-scroll="false"');
    expect(html).toContain("Even nadenken…");
  });

  it.each([false, true])(
    "uses safe composer height and focus settings for compact=%s",
    async (compact) => {
      const app = createSSRApp({ render: () => h(Composer, { status: "ready", compact }) });
      app.component(
        "UChatPrompt",
        defineComponent({
          inheritAttrs: false,
          props: ["rows", "maxrows", "autofocus"],
          setup: (props) => () =>
            h("div", {
              "data-rows": props.rows,
              "data-maxrows": props.maxrows,
              "data-autofocus": String(props.autofocus)
            })
        })
      );
      const html = await renderToString(app);
      expect(html).toContain(`data-rows="${compact ? 1 : 2}"`);
      expect(html).toContain(`data-maxrows="${compact ? 5 : 8}"`);
      expect(html).toContain(`data-autofocus="${!compact}"`);
    }
  );
});
