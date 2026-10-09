// Data model + localStorage persistence, shared under window.App
window.App = window.App || {};

(function () {
  const STORAGE_KEY = "japaneseOps:v1";
  const UNDO_KEY = STORAGE_KEY + ":beforeRestore"; // progress kept just before a 還原 (one undo)

  // `implemented` modules are tappable on Home; the rest show as "即將推出".
  // `accent` keys into MODULE_ACCENTS in theme.jsx.
  const MODULES = [
    { key: "kana", label: "五十音", sub: "平假名・片假名", emoji: "あ", implemented: true },
    { key: "phrases", label: "情境句子庫", sub: "7 個旅行情境：餐廳、交通、酒店…", emoji: "💬", implemented: true },
    { key: "listening", label: "聽力練習", sub: "聽句子選意思・錯題重溫", emoji: "🎧", implemented: true },
    { key: "speaking", label: "口語練習", sub: "看意思讀日文・語音辨識／鍵盤聽寫", emoji: "🎤", implemented: true },
    { key: "reading", label: "看得懂", sub: "餐牌、商品、車站", emoji: "🪧", implemented: false },
    { key: "dialogue", label: "情境對話", sub: "9 個情境・與店員一問一答", emoji: "🛎️", implemented: true },
  ];

  function defaultSettings() {
    return { showRomaji: true, showYue: true, voiceURI: null, rate: 0.8, travelDate: null, dailyNew: 5 };
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

  // daily (stage 7b 每日任務):
  //   learned:  { [sentence id]: "YYYY-MM-DD" } 每日任務「今日新句子」學過的句子
  //   days:     { [date]: { newIds, speakIds, dialogueId, due0: { l, s }, done: { reviewL, reviewS, new, speak, dialogue, kana } } }
  //             每日的任務內容在當天第一次打開時固定下來；done 只增不減
  //   activity: { [date]: { a: 答題數, c: 答對數 } } 每次答題累加（包括不經任務頁的練習）
  //   cursor:   下一個輪到的情境（今日新句子按情境輪流）
  function defaultDaily() {
    return { learned: {}, days: {}, activity: {}, cursor: 0 };
  }

  // backup (進度備份): lastExportAt = ISO time of the last 匯出 (shown in 設定; the
  // weekly reminder on 進度頁 uses it).  Restored from a backup file as stored there.
  // flags: 句子庫 sentence ids the user marked 🚩 讀錯 (pronunciation is
  // wrong on their phone) — listed in 設定 so they can copy and send them.
  // review (stage 5 錯題重溫, spaced repetition): items keyed
  //   "p:<sentence id>" (聽力), "s:<sentence id>" (口語, stage 6) or
  //   "k:<kana char>" → { box, due }
  //   box = correct review answers in a row (0–4); due = local date
  //   "YYYY-MM-DD" when it is next asked. See REVIEW_INTERVALS.
  function defaultState() {
    return { settings: defaultSettings(), kana: defaultKana(), flags: [], listen: defaultListen(), speak: defaultSpeak(), dialogue: defaultDialogue(), daily: defaultDaily(), review: { items: {}, graduated: 0 }, backup: { lastExportAt: null } };
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
    return { ...state, review: { ...state.review, items: { ...state.review.items, [key]: { box: 0, due: todayLocal() } } } };
  }

  function reviewCorrect(state, key) {
    const item = state.review.items[key];
    if (!item) return state;
    const items = { ...state.review.items };
    const box = item.box + 1;
    let graduated = state.review.graduated || 0;
    if (box > REVIEW_INTERVALS.length) {
      delete items[key];
      graduated += 1; // 畢業
    } else items[key] = { box, due: addDaysLocal(todayLocal(), REVIEW_INTERVALS[box - 1]) };
    return { ...state, review: { ...state.review, items, graduated } };
  }

  // Merges a saved state onto the defaults so saves from older versions
  // pick up any fields added since.  Shared by loadState (localStorage) and
  // parseBackup (an imported file, after sanitizeState) so both paths end up
  // with exactly the same shape.  Throws (TypeError) on a malformed block;
  // callers catch.
  function normalizeState(parsed) {
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
    review = { ...review, graduated: Number(review.graduated) > 0 ? Math.floor(Number(review.graduated)) : 0 };
    const settings = { ...base.settings, ...(parsed.settings || {}) };
    if (![3, 5, 8].includes(settings.dailyNew)) settings.dailyNew = 5;
    if (typeof settings.travelDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(settings.travelDate)) settings.travelDate = null;
    const daily = { ...base.daily, ...(parsed.daily || {}) };
    ["learned", "days", "activity"].forEach((k) => {
      if (!daily[k] || typeof daily[k] !== "object" || Array.isArray(daily[k])) daily[k] = {};
    });
    if (!(daily.cursor >= 0)) daily.cursor = 0;
    const backup = {
      lastExportAt: parsed.backup && typeof parsed.backup.lastExportAt === "string" && parsed.backup.lastExportAt.length <= 40 ? parsed.backup.lastExportAt : null,
    };
    return {
      ...base,
      ...parsed,
      settings,
      kana,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      listen,
      speak,
      dialogue,
      daily,
      review,
      backup,
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return defaultState();
      return normalizeState(parsed);
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
      localStorage.removeItem(UNDO_KEY);
    } catch (e) {}
    return defaultState();
  }

  // Count one answered question towards today's activity (進度頁 最近 7 天).
  function bumpActivity(state, correct, n = 1, right = correct ? n : 0) {
    const today = todayLocal();
    const prev = state.daily.activity[today] || { a: 0, c: 0 };
    return { ...state, daily: { ...state.daily, activity: { ...state.daily.activity, [today]: { a: prev.a + n, c: prev.c + right } } } };
  }

  // Consecutive correct answers in a row. Saves from before stage 7b have no
  // `run`: a sentence never answered wrong counts its correct answers.
  function runOf(stat) {
    if (!stat) return 0;
    if (typeof stat.run === "number") return stat.run;
    return stat.w === 0 ? stat.c : 0;
  }

  function recordKanaAnswer(state, char, correct) {
    const prev = state.kana.stats[char] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.kana.stats,
      [char]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() },
    };
    const without = state.kana.mistakes.filter((m) => m !== char);
    const mistakes = correct ? without : [...without, char];
    const next = bumpActivity({ ...state, kana: { ...state.kana, stats, mistakes } }, correct);
    // Any wrong 五十音 answer (字表練習、清濁對比、重溫) also (re)enters 錯題重溫.
    return correct ? next : reviewWrong(next, `k:${char}`);
  }

  // 聽力練習／重溫 answer for a 句子庫 sentence.
  function recordListenAnswer(state, id, correct) {
    const prev = state.listen.stats[id] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.listen.stats,
      [id]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), run: correct ? runOf(prev) + 1 : 0, last: new Date().toISOString() },
    };
    const next = bumpActivity({ ...state, listen: { ...state.listen, stats } }, correct);
    return correct ? next : reviewWrong(next, `p:${id}`);
  }

  // 口語練習／口語重溫 answer (first attempt of a question). A wrong one
  // enters 錯題重溫 as "s:<id>" (separate from 聽力 "p:<id>").
  function recordSpeakAnswer(state, id, correct) {
    const prev = state.speak.stats[id] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.speak.stats,
      [id]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), run: correct ? runOf(prev) + 1 : 0, last: new Date().toISOString() },
    };
    const next = bumpActivity({ ...state, speak: { ...state.speak, stats } }, correct);
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
    return bumpActivity({ ...state, dialogue: { ...state.dialogue, stats } }, true, total, correct);
  }

  function toggleFlag(state, id) {
    const flags = state.flags.includes(id) ? state.flags.filter((f) => f !== id) : [...state.flags, id];
    return { ...state, flags };
  }

  // ── 進度備份／還原 (stage 8) ──────────────────────────────────────────
  // All progress is ONE localStorage key (STORAGE_KEY), so one file is the
  // whole app.  File: { app: "japanese-ops", version: 1, exportedAt: ISO,
  // data: { "japaneseOps:v1": <state> } }.  Nothing is written until the
  // user confirms (js/backup.js); the old progress is first copied to
  // UNDO_KEY so one 撤銷 is possible.  The voice choice is device-specific,
  // so a restore keeps this phone's own (app.js).
  const BACKUP_APP = "japanese-ops";
  const BACKUP_VERSION = 1;
  const MAX_BACKUP_BYTES = 2 * 1024 * 1024;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const BAD_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const MAX_ENTRIES = 5000;

  const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
  const isInt = (x, min, max) => Number.isInteger(x) && x >= min && x <= max;
  const isDate = (x) => typeof x === "string" && DATE_RE.test(x);
  const isShortStr = (x, max = 40) => typeof x === "string" && x.length > 0 && x.length <= max;
  const strList = (x, max, maxLen) => (Array.isArray(x) ? x.filter((s) => isShortStr(s, maxLen)).slice(0, max) : null);

  // Copies a map keeping only entries whose value passes `clean` (returns
  // undefined to drop one).  Never assigns "__proto__" & co.
  function cleanMap(src, clean, keyOk = (k) => isShortStr(k)) {
    const out = {};
    if (!isObj(src)) return out;
    let n = 0;
    for (const k of Object.keys(src)) {
      if (BAD_KEYS.has(k) || !keyOk(k)) continue;
      const v = clean(src[k], k);
      if (v === undefined) continue;
      out[k] = v;
      if (++n >= MAX_ENTRIES) break;
    }
    return out;
  }

  function cleanStat(v) {
    if (!isObj(v) || !isInt(v.c, 0, 1e6) || !isInt(v.w, 0, 1e6)) return undefined;
    const o = { c: v.c, w: v.w };
    if (isInt(v.run, 0, 1e6)) o.run = v.run;
    o.last = isShortStr(v.last) ? v.last : null;
    return o;
  }

  function cleanDialogueStat(v) {
    if (!isObj(v) || !isInt(v.plays, 0, 1e6) || !isInt(v.perfect, 0, 1e6) || !isInt(v.best, 0, 100)) return undefined;
    return { plays: v.plays, perfect: v.perfect, best: v.best, last: isShortStr(v.last) ? v.last : null };
  }

  function cleanDay(v) {
    if (!isObj(v) || !isShortStr(v.dialogueId)) return undefined;
    const done = {};
    if (isObj(v.done)) ["reviewL", "reviewS", "new", "speak", "dialogue", "kana"].forEach((k) => v.done[k] === true && (done[k] = true));
    const due0 = isObj(v.due0) ? v.due0 : {};
    return {
      newIds: strList(v.newIds, 20, 40) || [],
      speakIds: strList(v.speakIds, 20, 40) || [],
      dialogueId: v.dialogueId,
      kanaChars: strList(v.kanaChars, 20, 4) || [],
      due0: { l: isInt(due0.l, 0, 1e5) ? due0.l : 0, s: isInt(due0.s, 0, 1e5) ? due0.s : 0 },
      done,
    };
  }

  // Whitelists and type-checks an imported state: unknown fields are dropped,
  // malformed single entries are dropped, and a malformed whole block throws
  // (→ "invalid").  The result still goes through normalizeState.
  function sanitizeState(raw) {
    if (!isObj(raw)) throw new TypeError("state");
    ["settings", "kana", "listen", "speak", "dialogue", "daily", "review"].forEach((k) => {
      if (raw[k] !== undefined && !isObj(raw[k])) throw new TypeError(k);
    });
    if (raw.flags !== undefined && !Array.isArray(raw.flags)) throw new TypeError("flags");
    const out = {};
    const bool = (x) => (typeof x === "boolean" ? x : undefined);
    const put = (obj, key, v) => {
      if (v !== undefined && v !== null) obj[key] = v;
    };

    const st = raw.settings || {};
    out.settings = {};
    put(out.settings, "showRomaji", bool(st.showRomaji));
    put(out.settings, "showYue", bool(st.showYue));
    put(out.settings, "rate", typeof st.rate === "number" && st.rate >= 0.3 && st.rate <= 2 ? st.rate : undefined);
    put(out.settings, "travelDate", isDate(st.travelDate) ? st.travelDate : undefined);
    put(out.settings, "dailyNew", [3, 5, 8].includes(st.dailyNew) ? st.dailyNew : undefined);
    // voiceURI is deliberately not taken from a file (device-specific)

    const k = raw.kana || {};
    const kp = isObj(k.prefs) ? k.prefs : {};
    out.kana = {
      stats: cleanMap(k.stats, cleanStat, (key) => isShortStr(key, 8)),
      mistakes: strList(k.mistakes, 400, 8) || [],
      prefs: {},
    };
    put(out.kana.prefs, "script", ["hira", "kata", "both"].includes(kp.script) ? kp.script : undefined);
    put(out.kana.prefs, "rows", strList(kp.rows, 60, 12));
    put(out.kana.prefs, "contrastRows", strList(kp.contrastRows, 60, 12));

    ["listen", "speak"].forEach((name) => {
      const b = raw[name] || {};
      const p = isObj(b.prefs) ? b.prefs : {};
      out[name] = { stats: cleanMap(b.stats, cleanStat), prefs: {} };
      put(out[name].prefs, "scenes", strList(p.scenes, 20, 20));
      put(out[name].prefs, "count", [5, 10, 20].includes(p.count) ? p.count : undefined);
      if (name === "listen") put(out[name].prefs, "staffOnly", bool(p.staffOnly));
      else put(out[name].prefs, "mode", ["voice", "dictation", "self"].includes(p.mode) ? p.mode : undefined);
    });

    const d = raw.dialogue || {};
    const dp = isObj(d.prefs) ? d.prefs : {};
    out.dialogue = { stats: cleanMap(d.stats, cleanDialogueStat), prefs: {} };
    put(out.dialogue.prefs, "showText", bool(dp.showText));
    put(out.dialogue.prefs, "showMeaning", bool(dp.showMeaning));

    const dl = raw.daily || {};
    out.daily = {
      learned: cleanMap(dl.learned, (v) => (isDate(v) ? v : undefined)),
      days: cleanMap(dl.days, cleanDay, isDate),
      activity: cleanMap(dl.activity, (v) => (isObj(v) && isInt(v.a, 0, 1e7) && isInt(v.c, 0, 1e7) ? { a: v.a, c: v.c } : undefined), isDate),
      cursor: isInt(dl.cursor, 0, 1000) ? dl.cursor : 0,
    };

    const rv = raw.review || {};
    out.review = {
      items: cleanMap(
        rv.items,
        (v) => (isObj(v) && isInt(v.box, 0, 4) && isDate(v.due) ? { box: v.box, due: v.due } : undefined),
        (key) => /^[psk]:.{1,30}$/.test(key)
      ),
      graduated: isInt(rv.graduated, 0, 1e7) ? rv.graduated : 0,
    };

    out.flags = strList(raw.flags, 1000, 40) || [];
    out.backup = { lastExportAt: raw.backup && isShortStr(raw.backup.lastExportAt) ? raw.backup.lastExportAt : null };
    return out;
  }

  function backupFileName() {
    return `japanese-ops-backup-${todayLocal()}.json`;
  }

  // Remember when the user last exported (so 設定 can say "上次備份：…").
  function markExported(state, iso) {
    return { ...state, backup: { ...state.backup, lastExportAt: iso } };
  }

  function buildBackup(state, exportedAt) {
    return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt, data: { [STORAGE_KEY]: state } };
  }

  // Never throws.  → { ok: true, state, exportedAt } (state fully normalised,
  // ready to replace the live one) or { ok: false, reason } with reason one of
  // too_big, not_json, wrong_app, too_new, invalid.
  function parseBackup(text) {
    if (typeof text !== "string" || text.length > MAX_BACKUP_BYTES) return { ok: false, reason: "too_big" };
    let file;
    try {
      file = JSON.parse(text);
    } catch (e) {
      return { ok: false, reason: "not_json" };
    }
    if (!isObj(file)) return { ok: false, reason: "not_json" };
    if (file.app !== BACKUP_APP) return { ok: false, reason: "wrong_app" };
    if (!Number.isInteger(file.version) || file.version < 1) return { ok: false, reason: "invalid" };
    if (file.version > BACKUP_VERSION) return { ok: false, reason: "too_new" };
    try {
      const raw = isObj(file.data) ? file.data[STORAGE_KEY] : null;
      const state = normalizeState(sanitizeState(raw));
      const exportedAt = typeof file.exportedAt === "string" && !Number.isNaN(Date.parse(file.exportedAt)) ? file.exportedAt : null;
      return { ok: true, state, exportedAt };
    } catch (e) {
      return { ok: false, reason: "invalid" };
    }
  }

  // One 撤銷: the progress as it was just before a 還原.
  function saveUndo(state) {
    try {
      localStorage.setItem(UNDO_KEY, JSON.stringify({ savedAt: new Date().toISOString(), state }));
      return true;
    } catch (e) {
      return false;
    }
  }
  function loadUndo() {
    try {
      const raw = localStorage.getItem(UNDO_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      if (!isObj(o) || !isObj(o.state)) return null;
      return { savedAt: typeof o.savedAt === "string" ? o.savedAt : null, state: normalizeState(o.state) };
    } catch (e) {
      return null;
    }
  }
  function clearUndo() {
    try {
      localStorage.removeItem(UNDO_KEY);
    } catch (e) {}
  }

  // Whole local calendar days from date a to date b (both "YYYY-MM-DD").
  function daysBetween(a, b) {
    const [y1, m1, d1] = a.split("-").map(Number);
    const [y2, m2, d2] = b.split("-").map(Number);
    return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
  }
  const localDateOf = (iso) => formatLocal(new Date(iso));

  window.App.Storage = {
    toggleFlag,
    recordListenAnswer,
    recordSpeakAnswer,
    recordDialogue,
    runOf,
    bumpActivity,
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
    BACKUP_APP,
    BACKUP_VERSION,
    MAX_BACKUP_BYTES,
    buildBackup,
    parseBackup,
    backupFileName,
    markExported,
    saveUndo,
    loadUndo,
    clearUndo,
    daysBetween,
    localDateOf,
  };
})();
