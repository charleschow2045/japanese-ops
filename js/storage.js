// Data model + localStorage persistence, shared under window.App
window.App = window.App || {};

(function () {
  const STORAGE_KEY = "japaneseOps:v1";

  // `implemented` modules are tappable on Home; the rest show as "即將推出".
  // `accent` keys into MODULE_ACCENTS in theme.jsx.
  const MODULES = [
    { key: "kana", label: "五十音", sub: "平假名・片假名", emoji: "あ", implemented: true },
    { key: "phrases", label: "情境句子庫", sub: "7 個旅行情境：餐廳、交通、酒店…", emoji: "💬", implemented: true },
    { key: "listening", label: "聽力練習", sub: "聽句子揀意思", emoji: "🎧", implemented: false },
    { key: "speaking", label: "口語練習", sub: "讀出嚟，語音辨識", emoji: "🎤", implemented: false },
    { key: "reading", label: "看得明", sub: "餐牌、商品、車站", emoji: "🪧", implemented: false },
    { key: "dialogue", label: "情境對話", sub: "同店員一問一答", emoji: "🛎️", implemented: false },
    { key: "daily", label: "每日任務及進度", sub: "每日 15–20 分鐘", emoji: "📅", implemented: false },
  ];

  function defaultSettings() {
    return { showRomaji: true, showYue: true, voiceURI: null, rate: 0.8 };
  }

  // kana.stats is keyed by the character itself (あ and ア tracked
  // separately, since the two scripts are learnt separately):
  //   { c: correct count, w: wrong count, last: ISO date of last answer }
  // kana.mistakes: characters answered wrong and not yet answered right
  // since — groundwork for 錯題重溫 (stage 4); stage 1a only records it.
  function defaultKana() {
    return {
      stats: {},
      mistakes: [],
      // contrastRows: rows picked for 清濁對比 分辨練習 (keys of the 清音 row)
      prefs: { script: "hira", rows: ["a", "ka", "sa", "ta", "na"], contrastRows: ["ka", "sa", "ta", "ha"] },
    };
  }

  function defaultState() {
    return { settings: defaultSettings(), kana: defaultKana() };
  }

  // Merges a saved state onto the defaults so saves from older versions
  // pick up any fields added since.
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();
      const base = defaultState();
      const kana = { ...base.kana, ...(parsed.kana || {}) };
      kana.prefs = { ...base.kana.prefs, ...((parsed.kana && parsed.kana.prefs) || {}) };
      if (!kana.stats || typeof kana.stats !== "object") kana.stats = {};
      if (!Array.isArray(kana.mistakes)) kana.mistakes = [];
      if (!Array.isArray(kana.prefs.rows)) kana.prefs.rows = base.kana.prefs.rows;
      if (!Array.isArray(kana.prefs.contrastRows)) kana.prefs.contrastRows = base.kana.prefs.contrastRows;
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        kana,
      };
    } catch (e) {
      return defaultState();
    }
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Private mode / storage full — the app keeps working for this session.
    }
  }

  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    return defaultState();
  }

  function recordKanaAnswer(state, char, correct) {
    const prev = state.kana.stats[char] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.kana.stats,
      [char]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() },
    };
    const without = state.kana.mistakes.filter((m) => m !== char);
    const mistakes = correct ? without : [...without, char];
    return { ...state, kana: { ...state.kana, stats, mistakes } };
  }

  window.App.Storage = {
    MODULES,
    loadState,
    saveState,
    clearState,
    recordKanaAnswer,
  };
})();
