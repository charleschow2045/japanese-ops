// Data model + localStorage persistence, shared under window.App
window.App = window.App || {};

(function () {
  const STORAGE_KEY = "japaneseOps:v1";

  // `implemented` modules are tappable on Home; the rest show as "即將推出".
  // `accent` keys into MODULE_ACCENTS in theme.jsx.
  const MODULES = [
    { key: "kana", label: "五十音", sub: "平假名・片假名", emoji: "あ", implemented: true },
    { key: "phrases", label: "情境句子庫", sub: "7 個旅行情境：餐廳、交通、酒店…", emoji: "💬", implemented: true },
    { key: "listening", label: "聽力練習", sub: "聽句子選意思・錯題重溫", emoji: "🎧", implemented: true },
    { key: "speaking", label: "口語練習", sub: "看意思讀日文・語音辨識／鍵盤聽寫", emoji: "🎤", implemented: true },
    { key: "reading", label: "看得懂", sub: "餐牌、商品、車站", emoji: "🪧", implemented: false },
    { key: "dialogue", label: "情境對話", sub: "9 個情境・與店員一問一答", emoji: "🛎️", implemented: true },
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

  // listen (stage 5 聽力練習):
  //   prefs: scenes picked, staffOnly (只練店員講), count (5/10/20)
  //   stats: { [sentence id]: { c, w, last } }
  function defaultListen() {
    return {
      prefs: { scenes: ["polite", "restaurant", "shopping", "transport", "hotel", "directions", "emergency"], staffOnly: false, count: 10 },
      stats: {},
    };
  }

  // speak (stage 6 口語練習):
  //   prefs: scenes picked, count (5/10/20), mode "voice" | "dictation" | "self"
  //   stats: { [sentence id]: { c, w, last } } — first attempt per question only
  function defaultSpeak() {
    return {
      prefs: { scenes: ["polite", "restaurant", "shopping", "transport", "hotel", "directions", "emergency"], count: 10, mode: "voice" },
      stats: {},
    };
  }

  // dialogue (stage 7a 情境對話):
  //   prefs: showText (對方的話預設顯示文字；關 = 先聽後看), showMeaning (選項顯示中文意思)
  //   stats: { [dialogue id]: { plays, perfect, best, last } } — perfect = 一次過全對嘅次數,
  //          best = 最佳首次答對率 (0–100)
  function defaultDialogue() {
    return { prefs: { showText: true, showMeaning: true }, stats: {} };
  }

  // flags: 句子庫 sentence ids the user marked 🚩 讀錯 (pronunciation is
  // wrong on their phone) — listed in 設定 so they can copy and send them.
  // review (stage 5 錯題重溫, spaced repetition): items keyed
  //   "p:<sentence id>" (聽力), "s:<sentence id>" (口語, stage 6) or
  //   "k:<kana char>" → { box, due }
  //   box = correct review answers in a row (0–4); due = local date
  //   "YYYY-MM-DD" when it is next asked. See REVIEW_INTERVALS.
  function defaultState() {
    return { settings: defaultSettings(), kana: defaultKana(), flags: [], listen: defaultListen(), speak: defaultSpeak(), dialogue: defaultDialogue(), review: { items: {} } };
  }

  // ── local dates (phone's own calendar day — never UTC) ──
  function pad(n) {
    return String(n).padStart(2, "0");
  }
  function formatLocal(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function todayLocal() {
    return formatLocal(new Date());
  }
  function addDaysLocal(dateStr, n) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return formatLocal(new Date(y, m - 1, d + n)); // local-time constructor handles month ends
  }

  // ── 錯題重溫 schedule ──
  // Wrong (anywhere) → box 0, due today. Correct IN REVIEW → next box:
  // 1st correct → 1 day, 2nd → 3, 3rd → 7, 4th → 14, 5th → 畢業 (removed).
  const REVIEW_INTERVALS = [1, 3, 7, 14];

  function reviewWrong(state, key) {
    return { ...state, review: { items: { ...state.review.items, [key]: { box: 0, due: todayLocal() } } } };
  }

  function reviewCorrect(state, key) {
    const item = state.review.items[key];
    if (!item) return state;
    const items = { ...state.review.items };
    const box = item.box + 1;
    if (box > REVIEW_INTERVALS.length) delete items[key];
    else items[key] = { box, due: addDaysLocal(todayLocal(), REVIEW_INTERVALS[box - 1]) };
    return { ...state, review: { items } };
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
      const listen = { ...base.listen, ...(parsed.listen || {}) };
      listen.prefs = { ...base.listen.prefs, ...((parsed.listen && parsed.listen.prefs) || {}) };
      if (!Array.isArray(listen.prefs.scenes)) listen.prefs.scenes = base.listen.prefs.scenes;
      if (![5, 10, 20].includes(listen.prefs.count)) listen.prefs.count = 10;
      if (!listen.stats || typeof listen.stats !== "object") listen.stats = {};
      const speak = { ...base.speak, ...(parsed.speak || {}) };
      speak.prefs = { ...base.speak.prefs, ...((parsed.speak && parsed.speak.prefs) || {}) };
      if (!Array.isArray(speak.prefs.scenes)) speak.prefs.scenes = base.speak.prefs.scenes;
      if (![5, 10, 20].includes(speak.prefs.count)) speak.prefs.count = 10;
      if (!["voice", "dictation", "self"].includes(speak.prefs.mode)) speak.prefs.mode = "voice";
      if (!speak.stats || typeof speak.stats !== "object") speak.stats = {};
      const dialogue = { ...base.dialogue, ...(parsed.dialogue || {}) };
      dialogue.prefs = { ...base.dialogue.prefs, ...((parsed.dialogue && parsed.dialogue.prefs) || {}) };
      if (!dialogue.stats || typeof dialogue.stats !== "object") dialogue.stats = {};
      let review = parsed.review &&parsed.review.items && typeof parsed.review.items === "object" ? parsed.review : null;
      if (!review) {
        // First load with stage 5: existing 五十音 red-dot characters
        // join 錯題重溫, due today.
        review = { items: {} };
        kana.mistakes.forEach((ch) => (review.items[`k:${ch}`] = { box: 0, due: todayLocal() }));
      }
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        kana,
        flags: Array.isArray(parsed.flags) ? parsed.flags : [],
        listen,
        speak,
        dialogue,
        review,
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
    const next = { ...state, kana: { ...state.kana, stats, mistakes } };
    // Any wrong 五十音 answer (字表練習、清濁對比、重溫) also (re)enters 錯題重溫.
    return correct ? next : reviewWrong(next, `k:${char}`);
  }

  // 聽力練習／重溫 answer for a 句子庫 sentence.
  function recordListenAnswer(state, id, correct) {
    const prev = state.listen.stats[id] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.listen.stats,
      [id]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() },
    };
    const next = { ...state, listen: { ...state.listen, stats } };
    return correct ? next : reviewWrong(next, `p:${id}`);
  }

  // 口語練習／口語重溫 answer (first attempt of a question). A wrong one
  // enters 錯題重溫 as "s:<id>" (separate from 聽力 "p:<id>").
  function recordSpeakAnswer(state, id, correct) {
    const prev = state.speak.stats[id] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.speak.stats,
      [id]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() },
    };
    const next = { ...state, speak: { ...state.speak, stats } };
    return correct ? next : reviewWrong(next, `s:${id}`);
  }

  // A finished 情境對話: `correct` of `total` first-try answers (用戶選擇題 + 理解題).
  function recordDialogue(state, id, correct, total) {
    const prev = state.dialogue.stats[id] || { plays: 0, perfect: 0, best: 0, last: null };
    const pct = total ? Math.round((correct / total) * 100) : 100;
    const stats = {
      ...state.dialogue.stats,
      [id]: { plays: prev.plays + 1, perfect: prev.perfect + (correct === total ? 1 : 0), best: Math.max(prev.best, pct), last: new Date().toISOString() },
    };
    return { ...state, dialogue: { ...state.dialogue, stats } };
  }

  function toggleFlag(state, id) {
    const flags = state.flags.includes(id) ? state.flags.filter((f) => f !== id) : [...state.flags, id];
    return { ...state, flags };
  }

  window.App.Storage = {
    toggleFlag,
    recordListenAnswer,
    recordSpeakAnswer,
    recordDialogue,
    reviewWrong,
    reviewCorrect,
    todayLocal,
    addDaysLocal,
    REVIEW_INTERVALS,
    MODULES,
    loadState,
    saveState,
    clearState,
    recordKanaAnswer,
  };
})();
