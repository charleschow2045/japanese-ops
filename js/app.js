// App shell: state, bottom tab bar (主頁 / 進度 / 設定), and the render loop.
// Any state change → save to localStorage → App.render() rebuilds the
// screen from scratch (the app is small, so this is simple and fast).
window.App = window.App || {};

(function () {
  const { Storage, Home, Settings, KanaModule, Phrases, Listening, Speaking, Dialogue, Speech, Daily, Progress, Show } = window.App;
  const { h, accentVars } = window.App.UI;

  const TABS = [
    { key: "home", label: "主頁", icon: "🏠" },
    { key: "progress", label: "進度", icon: "📊" },
    { key: "settings", label: "設定", icon: "⚙️" },
  ];

  let state = Storage.loadState();
  const nav = { tab: "home", view: "home", task: null }; // view = screen inside the 主頁 tab; task = 每日任務 session in progress
  let taskSeq = 0;

  const mainEl = document.getElementById("main");
  const overlayEl = document.getElementById("overlay");
  const tabbarEl = document.getElementById("tabbar");

  function setState(updater) {
    state = updater(state);
    Storage.saveState(state);
    render();
  }

  // 進度備份 (stage 8). A restore first keeps the current progress for one
  // 撤銷; this phone's own voice choice is kept (voices differ per device).
  function restoreBackup(imported) {
    if (!Storage.saveUndo(state)) return false;
    state = { ...imported, settings: { ...imported.settings, voiceURI: state.settings.voiceURI, theme: state.settings.theme } };
    Storage.saveState(state);
    nav.task = null;
    Daily.reset();
    render();
    return true;
  }

  function undoRestore() {
    const undo = Storage.loadUndo();
    if (!undo) return false;
    state = undo.state;
    Storage.saveState(state);
    Storage.clearUndo();
    nav.task = null;
    Daily.reset();
    render();
    return true;
  }

  function openBackup() {
    nav.tab = "settings";
    nav.task = null;
    Settings.open("backup");
    render({ scrollTop: true });
  }

  // Back from a module to the module list (also drops any half-finished session).
  function goHome() {
    Listening.reset();
    Speaking.reset();
    Dialogue.reset();
    Show.reset();
    nav.view = "home";
    render({ scrollTop: true });
  }

  function openModule(key) {
    nav.view = key;
    nav.task = null;
    if (key === "daily") Daily.reset();
    if (key === "kana") KanaModule.reset();
    if (key === "phrases") Phrases.reset();
    if (key === "listening" || key === "numbers") Listening.reset();
    if (key === "speaking") Speaking.reset();
    if (key === "dialogue") Dialogue.reset();
    if (key === "show") Show.reset();
    render({ scrollTop: true });
  }

  // 每日任務: hand a spec from the 今日任務 page to the module that runs it.
  // The module starts the session while rendering (inside the tap that
  // launched it, so audio is allowed on iOS) and reports back through
  // onTaskDone; leaving returns to the 今日任務 page.
  function launchTask(spec) {
    nav.task = { ...spec, id: ++taskSeq, date: Storage.todayLocal() };
    nav.tab = "home";
    nav.view = spec.module;
    Listening.reset();
    Speaking.reset();
    Dialogue.reset();
    render({ scrollTop: true });
  }

  function taskDone() {
    const t = nav.task;
    if (t) setState((s) => Daily.markDone(s, t.date, t.key));
  }

  function leaveTask() {
    nav.task = null;
    Listening.reset();
    Speaking.reset();
    Dialogue.reset();
    nav.view = "daily";
    render({ scrollTop: true });
  }

  function selectTab(key) {
    nav.tab = key;
    nav.task = null;
    Show.reset(); // closes a held-up card (and lets the screen sleep again)
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

  // 外觀: "auto" follows the phone (CSS prefers-color-scheme); light/dark force one via
  // html[data-theme]. The <meta name="theme-color"> follows the paper colour.
  const THEME_COLOR = { light: "#E8F3FF", dark: "#0F1830" };
  function applyTheme() {
    const t = state.settings.theme;
    const root = document.documentElement;
    if (t === "light" || t === "dark") root.setAttribute("data-theme", t);
    else root.removeAttribute("data-theme");
    const dark = t === "dark" || (t !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? THEME_COLOR.dark : THEME_COLOR.light);
  }
  if (window.matchMedia) {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme();
    if (mq.addEventListener) mq.addEventListener("change", onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  function render(opts = {}) {
    applyTheme();
    let content = null;
    let overlay = null;

    // Today's 每日任務 plan is fixed the first time the app renders that day.
    const ready = Daily.ensureToday(state);
    if (ready !== state) {
      state = ready;
      Storage.saveState(state);
    }

    if (nav.tab === "progress") {
      content = h("div", { style: accentVars("daily") }, Progress.render({ state, onOpenBackup: openBackup }));
    } else if (nav.tab === "settings") {
      content = Settings.render({
        settings: state.settings,
        state,
        flags: state.flags,
        onUpdate: (fn) => setState(fn),
        onRestore: restoreBackup,
        onUndo: undoRestore,
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
          state,
          flags: state.flags,
          favs: state.favs,
          onToggleFav: (id) => setState((s) => Storage.toggleFav(s, id)),
          onToggleFlag: (id) => setState((s) => Storage.toggleFlag(s, id)),
          onBack: () => {
            nav.view = "home";
            render({ scrollTop: true });
          },
          rerender: render,
        })
      );
    } else if (nav.view === "listening" || nav.view === "numbers") {
      content = h(
        "div",
        { style: accentVars(nav.view) },
        Listening.render({
          state,
          section: nav.view === "numbers" ? "numbers" : null, // 數字・價錢 tile: only the number cards
          task: nav.task,
          onTaskDone: taskDone,
          onPrefsChange: (patch) => setState((s) => ({ ...s, listen: { ...s.listen, prefs: { ...s.listen.prefs, ...patch } } })),
          onNumberPrefsChange: (patch) => setState((s) => ({ ...s, numbers: { ...s.numbers, prefs: { ...s.numbers.prefs, ...patch } } })),
          // Wrong answers (re)enter 錯題重溫 inside record*Answer; only a
          // correct answer DURING 重溫 moves an item to its next interval.
          onAnswer: (q, correct, mode) =>
            setState((s) => {
              if (q.type === "number") {
                const next = Storage.recordNumberAnswer(s, q.kind, q.key, correct);
                return correct && mode === "review" ? Storage.reviewCorrect(next, q.key) : next;
              }
              if (q.type === "phrase") {
                const next = Storage.recordListenAnswer(s, q.target.p.id, correct);
                return correct && mode === "review" ? Storage.reviewCorrect(next, `p:${q.target.p.id}`) : next;
              }
              const next = Storage.recordKanaAnswer(s, q.target.char, correct);
              return correct && mode === "review" ? Storage.reviewCorrect(next, `k:${q.target.char}`) : next;
            }),
          onBack: () => (nav.task ? leaveTask() : goHome()),
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
          onFinish: (id, correct, total) =>
            setState((s) => {
              const next = Storage.recordDialogue(s, id, correct, total);
              return nav.task && nav.task.key === "dialogue" ? Daily.markDone(next, nav.task.date, "dialogue") : next;
            }),
          task: nav.task,
          onBack: () => (nav.task ? leaveTask() : goHome()),
          rerender: render,
        })
      );
    } else if (nav.view === "show") {
      const out = Show.render({
        state,
        settings: state.settings,
        onUpdate: (fn) => setState(fn),
        getState: () => state,
        onSilentUpdate: (fn) => {
          state = fn(state);
          Storage.saveState(state);
          return state;
        },
        onBack: goHome,
        rerender: render,
      });
      content = h("div", { style: accentVars("show") }, out.main);
      overlay = out.overlay && h("div", { style: accentVars("show") }, out.overlay);
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
          task: nav.task,
          onTaskDone: taskDone,
          onBack: () => (nav.task ? leaveTask() : goHome()),
          rerender: render,
        })
      );
    } else if (nav.view === "daily") {
      content = h(
        "div",
        { style: accentVars("daily") },
        Daily.render({
          state,
          settings: state.settings,
          flags: state.flags,
          favs: state.favs,
          onToggleFav: (id) => setState((s) => Storage.toggleFav(s, id)),
          onToggleFlag: (id) => setState((s) => Storage.toggleFlag(s, id)),
          onUpdate: (fn) => setState(fn),
          onLaunch: launchTask,
          onBack: () => {
            Daily.reset();
            goHome();
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
  // 「怎樣用」說明卡 (js/help.js): has this page's card been shown before? Marking it
  // seen is saved without a redraw.
  App.helpSeen = (key) => state.help[key] === "seen";
  App.helpMarkSeen = (key) => {
    state = { ...state, help: { ...state.help, [key]: "seen" } };
    Storage.saveState(state);
  };
  // Read-only view of current settings for js/speech.js's notice (which
  // voice is chosen matters when offline).
  App.currentSettings = () => state.settings;
  Speech.onVoicesChanged(() => render());
  render();
})();
