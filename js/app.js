// App shell: state, bottom tab bar (主頁 / 設定), and the render loop.
// Any state change → save to localStorage → App.render() rebuilds the
// screen from scratch (the app is small, so this is simple and fast).
window.App = window.App || {};

(function () {
  const { Storage, Home, Settings, KanaModule, Phrases, Speech } = window.App;
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
