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
  it.each([false, true])(
    "keeps the composer outside the scrolling transcript for mode=%s",
    async (showTranscript) => {
      const app = createSSRApp({ render: () => h(Interface, { showTranscript }) });
      registerStubs(app, ["ChatWelcome", "ChatComposer", "ChatTranscript", "UAlert", "UButton"]);
      const html = await renderToString(app);
      expect(html).not.toContain("overflow-x-auto");
      expect(html).not.toContain("fixed inset-x-0");
      expect(html).toContain("overflow-y-auto");
      if (showTranscript) expect(html).toContain("shrink-0 bg-sand-light");
      const disclaimer =
        "AI kan fouten maken. Controleer belangrijke informatie bij een opleider of adviseur.";
      if (showTranscript) expect(html).not.toContain(disclaimer);
      else expect(html).toContain(disclaimer);
    }
  );

  it("removes the retired site shell", async () => {
    const app = createSSRApp(Shell);
    registerStubs(app, [
      "UApp",
      "NuxtRouteAnnouncer",
      "NuxtLoadingIndicator",
      "NuxtLayout",
      "NuxtPage"
    ]);
    const html = await renderToString(app);
    expect(html).not.toContain("NewsletterBanner");
    expect(html).not.toContain("Header");
    expect(html).not.toContain("Footer");
    expect(html).toContain('data-component="NuxtPage"');
  });

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
  it.each(["ready", "submitted", "streaming"])(
    "keeps the composer focusable while status=%s",
    async (status) => {
      const app = createSSRApp({ render: () => h(Composer, { status, compact: true }) });
      app.component(
        "UChatPrompt",
        defineComponent({
          inheritAttrs: false,
          props: ["readonly", "disabled"],
          setup: (props) => () =>
            h("textarea", {
              readonly: props.readonly,
              disabled: props.disabled
            })
        })
      );
      const html = await renderToString(app);
      expect(html).not.toContain("disabled");
      expect(html.includes("readonly")).toBe(status !== "ready");
    }
  );
});
