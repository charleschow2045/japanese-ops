// App shell: state, bottom tab bar (主頁 / 設定), and the render loop.
// Any state change → save to localStorage → App.render() rebuilds the
// screen from scratch (the app is small, so this is simple and fast).
window.App = window.App || {};

(function () {
  const { Storage, Home, Settings, KanaModule, Phrases, Listening, Speaking, Dialogue, Speech } = window.App;
  const { h, accentVars } = window.App.UI;

  const TABS = [
    { key: "home", label: "主頁", icon: "🏠" },
    { key: "settings", label: "設定", icon: "⚙️" },
  ];

  let state = Storage.loadState();
  const nav = { tab: "home", view: "home" }; // view = screen inside the 主頁 tab

  const mainEl = document.getElementById("main");
  const overlayEl = document.getElementById("overlay");
  const tabbarEl = document.getElementById("tabbar");

  function setState(updater) {
    state = updater(state);
    Storage.saveState(state);
    render();
  }

  function openModule(key) {
    nav.view = key;
    if (key === "kana") KanaModule.reset();
    if (key === "phrases") Phrases.reset();
    if (key === "listening") Listening.reset();
    if (key === "speaking") Speaking.reset();
    if (key === "dialogue") Dialogue.reset();
    render({ scrollTop: true });
  }

  function selectTab(key) {
    nav.tab = key;
    if (key === "home") nav.view = "home"; // tapping 主頁 always returns to the module list
    Settings.reset();
    render({ scrollTop: true });
  }

  function renderTabBar() {
    tabbarEl.replaceChildren(
      h(
        "div",
        { class: "tabbar-inner" },
        TABS.map((t) =>
          h(
            "button",
            { class: `tab ${nav.tab === t.key ? "active" : ""}`, "aria-current": nav.tab === t.key ? "page" : null, onclick: () => selectTab(t.key) },
            h("span", { class: "tab-icon" }, t.icon),
            h("span", { class: "tab-label" }, t.label),
            h("span", { class: "tab-bar" })
          )
        )
      )
    );
  }

  function render(opts = {}) {
    let content = null;
    let overlay = null;

    if (nav.tab === "settings") {
      content = Settings.render({
        settings: state.settings,
        flags: state.flags,
        onChange: (patch) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
        onReset: () => {
          state = Storage.clearState();
          render();
        },
        rerender: render,
      });
    } else if (nav.view === "kana") {
      const out = KanaModule.render({
        settings: state.settings,
        kana: state.kana,
        onPrefsChange: (patch) => setState((s) => ({ ...s, kana: { ...s.kana, prefs: { ...s.kana.prefs, ...patch } } })),
        onAnswer: (char, correct) => setState((s) => Storage.recordKanaAnswer(s, char, correct)),
        onBack: () => {
          nav.view = "home";
          render({ scrollTop: true });
        },
        rerender: render,
      });
      content = h("div", { style: accentVars("kana") }, out.main);
      overlay = out.overlay;
    } else if (nav.view === "phrases") {
      content = h(
        "div",
        { style: accentVars("phrases") },
        Phrases.render({
          settings: state.settings,
          flags: state.flags,
          onToggleFlag: (id) => setState((s) => Storage.toggleFlag(s, id)),
          onBack: () => {
            nav.view = "home";
            render({ scrollTop: true });
          },
          rerender: render,
        })
      );
    } else if (nav.view === "listening") {
      content = h(
        "div",
        { style: accentVars("listening") },
        Listening.render({
          state,
          onPrefsChange: (patch) => setState((s) => ({ ...s, listen: { ...s.listen, prefs: { ...s.listen.prefs, ...patch } } })),
          // Wrong answers (re)enter 錯題重溫 inside record*Answer; only a
          // correct answer DURING 重溫 moves an item to its next interval.
          onAnswer: (q, correct, mode) =>
            setState((s) => {
              if (q.type === "phrase") {
                const next = Storage.recordListenAnswer(s, q.target.p.id, correct);
                return correct && mode === "review" ? Storage.reviewCorrect(next, `p:${q.target.p.id}`) : next;
              }
              const next = Storage.recordKanaAnswer(s, q.target.char, correct);
              return correct && mode === "review" ? Storage.reviewCorrect(next, `k:${q.target.char}`) : next;
            }),
          onBack: () => {
            nav.view = "home";
            render({ scrollTop: true });
          },
          rerender: render,
        })
      );
    } else if (nav.view === "dialogue") {
      content = h(
        "div",
        { style: accentVars("dialogue") },
        Dialogue.render({
          state,
          onPrefsChange: (patch) => setState((s) => ({ ...s, dialogue: { ...s.dialogue, prefs: { ...s.dialogue.prefs, ...patch } } })),
          // First wrong pick of a turn: a sentence you should say → 口語重溫 ("s:"),
          // a staff line you misheard → 聽力重溫 ("p:").
          onMistake: (kind, id) => setState((s) => Storage.reviewWrong(s, `${kind === "speak" ? "s" : "p"}:${id}`)),
          onFinish: (id, correct, total) => setState((s) => Storage.recordDialogue(s, id, correct, total)),
          onBack: () => {
            Dialogue.reset();
            nav.view = "home";
            render({ scrollTop: true });
          },
          rerender: render,
        })
      );
    } else if (nav.view === "speaking") {
      content = h(
        "div",
        { style: accentVars("speaking") },
        Speaking.render({
          state,
          onPrefsChange: (patch) => setState((s) => ({ ...s, speak: { ...s.speak, prefs: { ...s.speak.prefs, ...patch } } })),
          // First attempt of a question (review: only a correct answer moves
          // the item on; a wrong one — here or in practice — (re)enters 重溫).
          onAnswer: (item, correct, kind) =>
            setState((s) => {
              const next = Storage.recordSpeakAnswer(s, item.p.id, correct);
              return correct && kind === "review" ? Storage.reviewCorrect(next, `s:${item.p.id}`) : next;
            }),
          onBack: () => {
            Speaking.reset();
            nav.view = "home";
            render({ scrollTop: true });
          },
          rerender: render,
        })
      );
    } else {
      nav.view = "home";
      content = Home.render(state, openModule);
    }

    mainEl.replaceChildren(content);
    overlayEl.replaceChildren(...(overlay ? [overlay] : []));
    renderTabBar();
    if (opts.scrollTop) window.scrollTo(0, 0);
    const auto = mainEl.querySelector("[data-autoscroll]");
    if (auto) auto.scrollIntoView({ block: auto.getAttribute("data-autoscroll") });
  }

  App.render = render;
  // Read-only view of current settings for js/speech.js's notice (which
  // voice is chosen matters when offline).
  App.currentSettings = () => state.settings;
  Speech.onVoicesChanged(() => render());
  render();
})();
