// Data model + localStorage persistence, shared under window.App
window.App = window.App || {};

(function () {
  const STORAGE_KEY = "japaneseOps:v1";
  const UNDO_KEY = STORAGE_KEY + ":beforeRestore"; // progress kept just before a 還原 (one undo)

  // `implemented` modules are tappable on Home; the rest show as "即將推出".
  // `accent` keys into MODULE_ACCENTS in theme.jsx.
  const MODULES = [
    { key: "kana", label: "五十音", sub: "平假名・片假名", emoji: "あ", implemented: true },
    { key: "phrases", label: "情境句子庫", sub: "11 個旅行情境", emoji: "💬", implemented: true },
    { key: "listening", label: "聽力練習", sub: "聽句子選意思", emoji: "🎧", implemented: true },
    { key: "speaking", label: "口語練習", sub: "看意思讀日文", emoji: "🎤", implemented: true },
    { key: "numbers", label: "數字・價錢", sub: "價錢、時間、號碼", emoji: "🔢", implemented: true },
    { key: "reading", label: "看得懂", sub: "片假名詞、餐牌、標示", emoji: "🪧", implemented: true },
    { key: "dialogue", label: "情境對話", sub: "與店員一問一答", emoji: "🛎️", implemented: true },
    { key: "show", label: "指給店員看", sub: "全螢幕大字日文", emoji: "📱", implemented: true },
  ];

  function defaultSettings() {
    return { showRomaji: true, showYue: true, voiceURI: null, rate: 0.8, travelDate: null, dailyNew: 5, theme: "auto" };
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
      // sim*: 相似字分辨 (stage 10) — simScript hira|kata|both, simGroups = group ids (null = all of the script),
      // simCount 5|10|20, simMode hear|see
      prefs: { script: "hira", rows: ["a", "ka", "sa", "ta", "na"], contrastRows: ["ka", "sa", "ta", "ha"], simScript: "both", simGroups: null, simCount: 10, simMode: "hear" },
    };
  }

  // listen (stage 5 聽力練習):
  //   prefs: scenes picked, staffOnly (只練店員講), count (5/10/20)
  //   stats: { [sentence id]: { c, w, last } }
  // sv = which set of 情境 the saved 聽力／口語 情境 choice knew about. 2 = 機場入境 exists,
  // 3 = 觀光景點／溫泉／預約與電話 exist.
  // An older save (no sv) that had ALL seven old 情境 ticked gets 機場入境 added once; a save
  // before sv 3 that had all eight ticked gets the three new 情境 added once. After that
  // sv = 3, so un-ticking a 情境 later is respected (see normalizeState).
  const SCENE_SET = 3;
  const NEW_SCENES_V3 = ["sight", "onsen", "call"];
  const OLD_SCENES = ["polite", "restaurant", "shopping", "transport", "hotel", "directions", "emergency"];

  function defaultListen() {
    return {
      prefs: { scenes: ["polite", "restaurant", "shopping", "transport", "hotel", "directions", "emergency", "airport", "sight", "onsen", "call"], sv: SCENE_SET, staffOnly: false, count: 10 },
      stats: {},
    };
  }

  // speak (stage 6 口語練習):
  //   prefs: scenes picked, count (5/10/20), mode "voice" | "dictation" | "self"
  //   stats: { [sentence id]: { c, w, last } } — first attempt per question only
  function defaultSpeak() {
    return {
      prefs: { scenes: ["polite", "restaurant", "shopping", "transport", "hotel", "directions", "emergency", "airport", "sight", "onsen", "call"], sv: SCENE_SET, count: 10, mode: "voice" },
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

  // help (「怎樣用」說明卡, js/help.js): { [table|kata|contrast|lookalike]: "seen" } — a page whose card has
  // been shown once starts collapsed from then on.
  function defaultHelp() {
    return {};
  }

  // show (stage 8 item 3 指給店員看): what the user typed or ticked for the cards.
  //   saved:     { hotelName, hotelAddress, hotelTel } (text, ≤ 300 chars each; hotel details
  //              for the taxi cards)
  //   allergens: ticked 過敏卡 item ids; avoid: ticked 不吃卡 item ids (js/content/showcards.js)
  //   prefs:     small lines under a card in the viewer: yue (中文), en (English), reading (讀音)
  //   custom:    我的卡片 (stage 10 ⑨): the user's own cards [{ id: "c-<n>", ja, kana, note }], at most
  //              CUSTOM_MAX; ja ≤ 200 chars (required), kana ≤ 200 (optional, read aloud when present), note ≤ 100 (中文備註)
  const CUSTOM_MAX = 20;
  const CUSTOM_LIMITS = { ja: 200, kana: 200, note: 100 };
  const cleanCardText = (x, max) => (typeof x === "string" ? x.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").slice(0, max) : "");
  // → a clean list of custom cards: bad entries (not an object, bad id, empty ja) dropped, duplicate ids dropped, capped
  function cleanCustomCards(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    for (const c of list) {
      if (out.length >= CUSTOM_MAX) break;
      if (!c || typeof c !== "object" || Array.isArray(c)) continue;
      if (typeof c.id !== "string" || !/^c-\d{1,9}$/.test(c.id) || seen.has(c.id)) continue;
      const ja = cleanCardText(c.ja, CUSTOM_LIMITS.ja);
      if (!ja.trim()) continue;
      seen.add(c.id);
      out.push({ id: c.id, ja, kana: cleanCardText(c.kana, CUSTOM_LIMITS.kana), note: cleanCardText(c.note, CUSTOM_LIMITS.note) });
    }
    return out;
  }
  function defaultShow() {
    return { saved: { hotelName: "", hotelAddress: "", hotelTel: "" }, allergens: [], avoid: [], prefs: { yue: true, en: false, reading: false }, custom: [] };
  }
  // add (card has no id) or update (card.id of an existing card); → { state, ok, id, reason? }; reason: empty | full | missing
  function saveCustomCard(state, card) {
    const list = cleanCustomCards(state.show.custom);
    const ja = cleanCardText(card.ja, CUSTOM_LIMITS.ja);
    if (!ja.trim()) return { state, ok: false, reason: "empty" };
    const clean = { ja, kana: cleanCardText(card.kana, CUSTOM_LIMITS.kana), note: cleanCardText(card.note, CUSTOM_LIMITS.note) };
    let next;
    let id = card.id;
    if (id) {
      if (!list.some((c) => c.id === id)) return { state, ok: false, reason: "missing" };
      next = list.map((c) => (c.id === id ? { id, ...clean } : c));
    } else {
      if (list.length >= CUSTOM_MAX) return { state, ok: false, reason: "full" };
      id = "c-" + (list.reduce((m, c) => Math.max(m, Number(c.id.slice(2))), 0) + 1);
      next = [...list, { id, ...clean }];
    }
    return { state: { ...state, show: { ...state.show, custom: next } }, ok: true, id };
  }
  function deleteCustomCard(state, id) {
    return { ...state, show: { ...state.show, custom: cleanCustomCards(state.show.custom).filter((c) => c.id !== id) } };
  }

  // numbers (stage 8 步驟 2-B 數字聽力): randomly generated questions, so no per-question
  //   stats — only per category kind.
  //   prefs: cats (price / time / things / num / date), level 1–3 (入門／一般／進階), count (5/10/20)
  //   stats: { [kind: yen|time|ban|nin|fun|num|month|day|date]: { c, w, last } }
  //   A wrong answer enters 錯題重溫 as "n:<kind>:<value>" (see js/numquiz.js).
  function defaultNumbers() {
    return { prefs: { cats: ["yen", "time", "things", "num", "date"], level: 1, count: 10 }, stats: {} };
  }

  // pairs (stage 10 ⑫ 近音詞分辨, js/minimal.js): minimal pairs (長音／促音／清濁), 19 of them with ids
  //   "l1"…"l8" / "s1"…"s6" / "v1"…"v5" (js/content/minimal.js). Practice settings are NOT saved.
  //   stats: { [pair id]: { c, w, last } }  (either word of the pair counts for the pair)
  //   A wrong answer enters 錯題重溫 as "q:<pair id>" (reviewed inside 聽力 錯題重溫).
  const PAIR_ID = /^[lsv]\d{1,2}$/;
  function defaultPairs() {
    return { stats: {} };
  }

  // swap (stage 10 ⑥ 換字練習): fixed sentence patterns with one swappable word (js/content/swap.js).
  //   prefs: pats (pattern ids "p1"…"p6" to practise), count (5/10/20)
  //   stats: { [pattern id]: { c, w, last } }  (聽力 and 口語 together)
  //   A wrong answer enters 錯題重溫 as "w:h:<pattern>:<word>" (聽力) or "w:s:<pattern>:<word>" (口語).
  function defaultSwap() {
    return { prefs: { pats: ["p1", "p2", "p3", "p4", "p5", "p6"], count: 10 }, stats: {} };
  }

  // read (stage 10 ⑦ 看得懂, js/reading.js): katakana-word reading practice.
  //   prefs: scenes (null = all 情境, else an array of 情境 names), mode (see 看詞選意思 | hear 聽音選詞 | mix), count (5/10/20)
  //   stats: { [word]: { c, w, last } }   (the 120 words of KATAKANA_EXAMPLES)
  //   A wrong answer enters 錯題重溫 as "r:<word>" (reviewed inside the 看得懂 module).
  //   menu (stage 10 ⑦ 版本二 模擬餐牌): prefs { menus: null (all) | [menu id], count }, stats { "<menu id>:<line 0–4>": { c, w, last } };
  //   a wrong answer enters 錯題重溫 as "m:<menu id>:<line 0–4>".
  function defaultRead() {
    return { prefs: { scenes: null, mode: "mix", count: 10 }, stats: {}, menu: { prefs: { menus: null, count: 10 }, stats: {} } };
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

  // path (stage 10 30 日入門路線): mode "free" | "route"; start = the route day the user began at;
  //   doneDays = { "<day 1–30>": "YYYY-MM-DD" } route days completed (that date).  skipDays = same shape: days the user marked 已學過 (路線地圖);
  //   promptSeen = the one-time 主頁 prompt about the route has been answered or the route was started.  The route day of a
  //   calendar day is fixed in daily.days[date].routeDay; one new route day unlocks per calendar day.
  function defaultPath() {
    return { mode: "free", start: 1, doneDays: {}, skipDays: {}, promptSeen: false };
  }

  // backup (進度備份): lastExportAt = ISO time of the last 匯出 (shown in 設定; the
  // weekly reminder on 進度頁 uses it).  Restored from a backup file as stored there.
  // favs: 句子庫 sentence ids the user marked ⭐ 收藏 (stage 10).
  // flags: 句子庫 sentence ids the user marked 🚩 讀錯 (pronunciation is
  // wrong on their phone) — listed in 設定 so they can copy and send them.
  // review (stage 5 錯題重溫, spaced repetition): items keyed
  //   "p:<sentence id>" (聽力), "s:<sentence id>" (口語, stage 6),
  //   "k:<kana char>", "n:<kind>:<value>" (數字聽力, e.g. "n:yen:1800") or
  //   "w:h:<pattern>:<word>" / "w:s:<pattern>:<word>" (換字練習 聽力/口語) → { box, due }
  //   "q:<pair id>" (近音詞分辨, 聽力重溫) → { box, due }
  //   box = correct review answers in a row (0–4); due = local date
  //   "YYYY-MM-DD" when it is next asked. See REVIEW_INTERVALS.
  function defaultState() {
    return { settings: defaultSettings(), kana: defaultKana(), flags: [], favs: [], listen: defaultListen(), speak: defaultSpeak(), dialogue: defaultDialogue(), numbers: defaultNumbers(), swap: defaultSwap(), pairs: defaultPairs(), read: defaultRead(), show: defaultShow(), help: defaultHelp(), daily: defaultDaily(), path: defaultPath(), review: { items: {}, graduated: 0 }, backup: { lastExportAt: null } };
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
    if (!["hira", "kata", "both"].includes(kana.prefs.simScript)) kana.prefs.simScript = "both";
    kana.prefs.simGroups = Array.isArray(kana.prefs.simGroups) ? kana.prefs.simGroups.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 12).slice(0, 60) : null;
    if (![5, 10, 20].includes(kana.prefs.simCount)) kana.prefs.simCount = 10;
    if (!["hear", "see"].includes(kana.prefs.simMode)) kana.prefs.simMode = "hear";
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
    [[listen, parsed.listen], [speak, parsed.speak]].forEach(([block, saved]) => {
      const savedSv = saved && saved.prefs && saved.prefs.sv;
      if (!(savedSv >= 2) && OLD_SCENES.every((k) => block.prefs.scenes.includes(k)) && !block.prefs.scenes.includes("airport")) {
        block.prefs.scenes = [...block.prefs.scenes, "airport"];
      }
      if (!(savedSv >= 3) && [...OLD_SCENES, "airport"].every((k) => block.prefs.scenes.includes(k))) {
        block.prefs.scenes = [...block.prefs.scenes, ...NEW_SCENES_V3.filter((k) => !block.prefs.scenes.includes(k))];
      }
      block.prefs.sv = SCENE_SET;
    });
    const dialogue = { ...base.dialogue, ...(parsed.dialogue || {}) };
    dialogue.prefs = { ...base.dialogue.prefs, ...((parsed.dialogue && parsed.dialogue.prefs) || {}) };
    if (!dialogue.stats || typeof dialogue.stats !== "object") dialogue.stats = {};
    const numbers = { ...base.numbers, ...(parsed.numbers || {}) };
    numbers.prefs = { ...base.numbers.prefs, ...((parsed.numbers && parsed.numbers.prefs) || {}) };
    if (!Array.isArray(numbers.prefs.cats)) numbers.prefs.cats = base.numbers.prefs.cats;
    if (![1, 2, 3].includes(numbers.prefs.level)) numbers.prefs.level = 1;
    if (![5, 10, 20].includes(numbers.prefs.count)) numbers.prefs.count = 10;
    if (!numbers.stats || typeof numbers.stats !== "object" || Array.isArray(numbers.stats)) numbers.stats = {};
    const swap = { ...base.swap, ...(parsed.swap || {}) };
    swap.prefs = { ...base.swap.prefs, ...((parsed.swap && parsed.swap.prefs) || {}) };
    swap.prefs.pats = Array.isArray(swap.prefs.pats) ? swap.prefs.pats.filter((p) => /^p[1-6]$/.test(p)) : base.swap.prefs.pats;
    if (![5, 10, 20].includes(swap.prefs.count)) swap.prefs.count = 10;
    if (!swap.stats || typeof swap.stats !== "object" || Array.isArray(swap.stats)) swap.stats = {};
    const pairs = { stats: {} };
    const pst = parsed.pairs && typeof parsed.pairs === "object" && parsed.pairs.stats;
    if (pst && typeof pst === "object" && !Array.isArray(pst))
      Object.keys(pst).forEach((k) => {
        const v = pst[k];
        if (PAIR_ID.test(k) && v && typeof v === "object" && Number.isFinite(v.c) && Number.isFinite(v.w) && v.c >= 0 && v.w >= 0) pairs.stats[k] = { c: Math.floor(v.c), w: Math.floor(v.w), last: typeof v.last === "string" ? v.last : null };
      });
    const read = { ...base.read, ...(parsed.read || {}) };
    read.prefs = { ...base.read.prefs, ...((parsed.read && parsed.read.prefs) || {}) };
    read.prefs.scenes = Array.isArray(read.prefs.scenes) ? read.prefs.scenes.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 12).slice(0, 20) : null;
    if (!["see", "hear", "mix"].includes(read.prefs.mode)) read.prefs.mode = "mix";
    if (![5, 10, 20].includes(read.prefs.count)) read.prefs.count = 10;
    if (!read.stats || typeof read.stats !== "object" || Array.isArray(read.stats)) read.stats = {};
    const mn = parsed.read && typeof parsed.read.menu === "object" && parsed.read.menu ? parsed.read.menu : {};
    read.menu = { prefs: { ...base.read.menu.prefs, ...(mn.prefs && typeof mn.prefs === "object" ? mn.prefs : {}) }, stats: mn.stats && typeof mn.stats === "object" && !Array.isArray(mn.stats) ? mn.stats : {} };
    read.menu.prefs.menus = Array.isArray(read.menu.prefs.menus) ? read.menu.prefs.menus.filter((x) => typeof x === "string" && /^[a-z]{1,10}$/.test(x)).slice(0, 12) : null;
    if (![5, 10, 20].includes(read.menu.prefs.count)) read.menu.prefs.count = 10;
    const show = { ...base.show, ...(parsed.show || {}) };
    show.saved = { ...base.show.saved, ...(parsed.show && typeof parsed.show.saved === "object" && parsed.show.saved ? parsed.show.saved : {}) };
    Object.keys(show.saved).forEach((k) => {
      if (typeof show.saved[k] !== "string") show.saved[k] = "";
    });
    show.prefs = { ...base.show.prefs, ...((parsed.show && typeof parsed.show.prefs === "object" && parsed.show.prefs) || {}) };
    if (!Array.isArray(show.allergens)) show.allergens = [];
    if (!Array.isArray(show.avoid)) show.avoid = [];
    show.custom = cleanCustomCards(show.custom);
    const help = {};
    if (parsed.help && typeof parsed.help === "object" && !Array.isArray(parsed.help)) {
      ["table", "kata", "contrast", "lookalike"].forEach((k) => parsed.help[k] === "seen" && (help[k] = "seen"));
    }
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
    if (!["auto", "light", "dark"].includes(settings.theme)) settings.theme = "auto";
    if (typeof settings.travelDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(settings.travelDate)) settings.travelDate = null;
    const daily = { ...base.daily, ...(parsed.daily || {}) };
    ["learned", "days", "activity"].forEach((k) => {
      if (!daily[k] || typeof daily[k] !== "object" || Array.isArray(daily[k])) daily[k] = {};
    });
    if (!(daily.cursor >= 0)) daily.cursor = 0;
    const path = { mode: "free", start: 1, doneDays: {}, skipDays: {}, promptSeen: false };
    if (parsed.path && typeof parsed.path === "object" && !Array.isArray(parsed.path)) {
      if (parsed.path.mode === "route") path.mode = "route";
      if (Number.isInteger(parsed.path.start) && parsed.path.start >= 1 && parsed.path.start <= 30) path.start = parsed.path.start;
      const dd = parsed.path.doneDays;
      if (dd && typeof dd === "object" && !Array.isArray(dd)) {
        Object.keys(dd).forEach((k) => /^([1-9]|[12]\d|30)$/.test(k) && typeof dd[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dd[k]) && (path.doneDays[k] = dd[k]));
      }
      for (const field of ["skipDays"]) {
        const m = parsed.path[field];
        if (m && typeof m === "object" && !Array.isArray(m)) {
          Object.keys(m).forEach((k) => /^([1-9]|[12]\d|30)$/.test(k) && typeof m[k] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(m[k]) && (path[field][k] = m[k]));
        }
      }
      if (parsed.path.promptSeen === true) path.promptSeen = true;
    }
    const backup = {
      lastExportAt: parsed.backup && typeof parsed.backup.lastExportAt === "string" && parsed.backup.lastExportAt.length <= 40 ? parsed.backup.lastExportAt : null,
    };
    return {
      ...base,
      ...parsed,
      settings,
      kana,
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      favs: Array.isArray(parsed.favs) ? [...new Set(parsed.favs.filter((id) => typeof id === "string" && id.length > 0 && id.length <= 40))].slice(0, 400) : [],
      listen,
      speak,
      dialogue,
      numbers,
      swap,
      pairs,
      read,
      show,
      help,
      daily,
      review,
      backup,
      path,
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

  // 數字聽力／重溫 answer. `kind` = yen | time | ban | nin | fun | num | month | day | date, `key` = the
  // 錯題重溫 key ("n:<kind>:<value>"); a wrong one (re)enters 錯題重溫.
  function recordNumberAnswer(state, kind, key, correct) {
    const prev = state.numbers.stats[kind] || { c: 0, w: 0, last: null };
    const stats = {
      ...state.numbers.stats,
      [kind]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() },
    };
    const next = bumpActivity({ ...state, numbers: { ...state.numbers, stats } }, correct);
    return correct ? next : reviewWrong(next, key);
  }

  // 換字練習 answer. `mode` "h" (聽力) or "s" (口語); a wrong one (re)enters 錯題重溫 as "w:<mode>:<pattern>:<word>".
  function recordSwapAnswer(state, mode, pat, wid, correct) {
    const prev = state.swap.stats[pat] || { c: 0, w: 0, last: null };
    const stats = { ...state.swap.stats, [pat]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() } };
    const next = bumpActivity({ ...state, swap: { ...state.swap, stats } }, correct);
    return correct ? next : reviewWrong(next, `w:${mode}:${pat}:${wid}`);
  }

  // 近音詞分辨 answer (js/minimal.js). A wrong one (re)enters 錯題重溫 as "q:<pair id>".
  function recordPairAnswer(state, pairId, correct) {
    if (!PAIR_ID.test(pairId)) return state;
    const prev = state.pairs.stats[pairId] || { c: 0, w: 0, last: null };
    const stats = { ...state.pairs.stats, [pairId]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() } };
    const next = bumpActivity({ ...state, pairs: { ...state.pairs, stats } }, correct);
    return correct ? next : reviewWrong(next, `q:${pairId}`);
  }

  // 看得懂 answer (js/reading.js). A wrong one (re)enters 錯題重溫 as "r:<word>".
  function recordReadAnswer(state, word, correct) {
    const prev = state.read.stats[word] || { c: 0, w: 0, last: null };
    const stats = { ...state.read.stats, [word]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() } };
    const next = bumpActivity({ ...state, read: { ...state.read, stats } }, correct);
    return correct ? next : reviewWrong(next, `r:${word}`);
  }

  // 模擬餐牌 answer (js/reading.js). `line` 0–4; a wrong one (re)enters 錯題重溫 as "m:<menu id>:<line>".
  function recordMenuAnswer(state, menuId, line, correct) {
    const key = `${menuId}:${line}`;
    const prev = state.read.menu.stats[key] || { c: 0, w: 0, last: null };
    const stats = { ...state.read.menu.stats, [key]: { c: prev.c + (correct ? 1 : 0), w: prev.w + (correct ? 0 : 1), last: new Date().toISOString() } };
    const next = bumpActivity({ ...state, read: { ...state.read, menu: { ...state.read.menu, stats } } }, correct);
    return correct ? next : reviewWrong(next, `m:${key}`);
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

  function toggleFav(state, id) {
    const favs = state.favs.includes(id) ? state.favs.filter((f) => f !== id) : [...state.favs, id];
    return { ...state, favs };
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
    if (!isObj(v)) return undefined;
    const done = {};
    if (isObj(v.done)) ["reviewL", "reviewS", "new", "speak", "dialogue", "kana"].forEach((k) => v.done[k] === true && (done[k] = true));
    const due0 = isObj(v.due0) ? v.due0 : {};
    return {
      newIds: strList(v.newIds, 20, 40) || [],
      speakIds: strList(v.speakIds, 20, 40) || [],
      dialogueId: isShortStr(v.dialogueId) ? v.dialogueId : null,
      ...(isInt(v.routeDay, 1, 30) ? { routeDay: v.routeDay } : {}),
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
    ["settings", "kana", "listen", "speak", "dialogue", "numbers", "swap", "pairs", "read", "show", "daily", "review"].forEach((k) => {
      if (raw[k] !== undefined && !isObj(raw[k])) throw new TypeError(k);
    });
    if (raw.flags !== undefined && !Array.isArray(raw.flags)) throw new TypeError("flags");
    if (raw.favs !== undefined && !Array.isArray(raw.favs)) throw new TypeError("favs");
    if (raw.path !== undefined && !isObj(raw.path)) throw new TypeError("path");
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
    put(out.settings, "theme", ["auto", "light", "dark"].includes(st.theme) ? st.theme : undefined);
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
    put(out.kana.prefs, "simScript", ["hira", "kata", "both"].includes(kp.simScript) ? kp.simScript : undefined);
    put(out.kana.prefs, "simGroups", strList(kp.simGroups, 60, 12));
    put(out.kana.prefs, "simCount", [5, 10, 20].includes(kp.simCount) ? kp.simCount : undefined);
    put(out.kana.prefs, "simMode", ["hear", "see"].includes(kp.simMode) ? kp.simMode : undefined);

    ["listen", "speak"].forEach((name) => {
      const b = raw[name] || {};
      const p = isObj(b.prefs) ? b.prefs : {};
      out[name] = { stats: cleanMap(b.stats, cleanStat), prefs: {} };
      put(out[name].prefs, "scenes", strList(p.scenes, 20, 20));
      put(out[name].prefs, "count", [5, 10, 20].includes(p.count) ? p.count : undefined);
      put(out[name].prefs, "sv", Number.isInteger(p.sv) && p.sv >= 1 && p.sv <= SCENE_SET ? p.sv : undefined);
      if (name === "listen") put(out[name].prefs, "staffOnly", bool(p.staffOnly));
      else put(out[name].prefs, "mode", ["voice", "dictation", "self"].includes(p.mode) ? p.mode : undefined);
    });

    const d = raw.dialogue || {};
    const dp = isObj(d.prefs) ? d.prefs : {};
    out.dialogue = { stats: cleanMap(d.stats, cleanDialogueStat), prefs: {} };
    put(out.dialogue.prefs, "showText", bool(dp.showText));
    put(out.dialogue.prefs, "showMeaning", bool(dp.showMeaning));

    const nm = raw.numbers || {};
    const np = isObj(nm.prefs) ? nm.prefs : {};
    out.numbers = {
      stats: cleanMap(nm.stats, cleanStat, (key) => ["yen", "time", "ban", "nin", "fun", "num", "month", "day", "date"].includes(key)),
      prefs: {},
    };
    put(out.numbers.prefs, "cats", Array.isArray(np.cats) ? np.cats.filter((c) => ["yen", "time", "things", "num", "date"].includes(c)).slice(0, 5) : null);
    put(out.numbers.prefs, "level", [1, 2, 3].includes(np.level) ? np.level : undefined);
    put(out.numbers.prefs, "count", [5, 10, 20].includes(np.count) ? np.count : undefined);

    const sw = raw.swap || {};
    const swp = isObj(sw.prefs) ? sw.prefs : {};
    out.swap = { stats: cleanMap(sw.stats, cleanStat, (key) => /^p[1-6]$/.test(key)), prefs: {} };
    put(out.swap.prefs, "pats", Array.isArray(swp.pats) ? [...new Set(swp.pats.filter((p) => typeof p === "string" && /^p[1-6]$/.test(p)))] : null);
    put(out.swap.prefs, "count", [5, 10, 20].includes(swp.count) ? swp.count : undefined);

    const pr = raw.pairs || {};
    out.pairs = { stats: cleanMap(pr.stats, cleanStat, (key) => PAIR_ID.test(key)) };

    const rd = raw.read || {};
    const rdp = isObj(rd.prefs) ? rd.prefs : {};
    out.read = { stats: cleanMap(rd.stats, cleanStat, (key) => isShortStr(key) && key.length <= 30), prefs: {} };
    put(out.read.prefs, "scenes", Array.isArray(rdp.scenes) ? [...new Set(rdp.scenes.filter((x) => typeof x === "string" && x.length > 0 && x.length <= 12))].slice(0, 20) : undefined);
    put(out.read.prefs, "mode", ["see", "hear", "mix"].includes(rdp.mode) ? rdp.mode : undefined);
    put(out.read.prefs, "count", [5, 10, 20].includes(rdp.count) ? rdp.count : undefined);
    const mnu = isObj(rd.menu) ? rd.menu : {};
    const mnp = isObj(mnu.prefs) ? mnu.prefs : {};
    out.read.menu = { stats: cleanMap(mnu.stats, cleanStat, (key) => /^[a-z]{1,10}:[0-4]$/.test(key)), prefs: {} };
    put(out.read.menu.prefs, "menus", Array.isArray(mnp.menus) ? [...new Set(mnp.menus.filter((x) => typeof x === "string" && /^[a-z]{1,10}$/.test(x)))].slice(0, 12) : undefined);
    put(out.read.menu.prefs, "count", [5, 10, 20].includes(mnp.count) ? mnp.count : undefined);

    const sh = raw.show || {};
    const ss = isObj(sh.saved) ? sh.saved : {};
    const cleanText = (x) => (typeof x === "string" ? x.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").slice(0, 300) : "");
    const sp = isObj(sh.prefs) ? sh.prefs : {};
    out.show = {
      saved: { hotelName: cleanText(ss.hotelName), hotelAddress: cleanText(ss.hotelAddress), hotelTel: cleanText(ss.hotelTel) },
      allergens: strList(sh.allergens, 30, 20) || [],
      avoid: strList(sh.avoid, 30, 20) || [],
      prefs: {},
      custom: cleanCustomCards(sh.custom),
    };
    ["yue", "en", "reading"].forEach((k) => put(out.show.prefs, k, bool(sp[k])));

    out.help = {};
    if (isObj(raw.help)) ["table", "kata", "contrast", "lookalike"].forEach((k) => raw.help[k] === "seen" && (out.help[k] = "seen"));

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
        (key) => /^[pskr]:.{1,30}$/.test(key) || /^m:[a-z]{1,10}:[0-4]$/.test(key) || /^n:(yen|time|ban|nin|fun|num|month|day|date):[0-9:]{1,8}$/.test(key) || /^w:[hs]:p[1-6]:[a-z0-9]{1,20}$/.test(key) || /^q:[lsv]\d{1,2}$/.test(key)
      ),
      graduated: isInt(rv.graduated, 0, 1e7) ? rv.graduated : 0,
    };

    out.flags = strList(raw.flags, 1000, 40) || [];
    out.favs = strList(raw.favs, 400, 40) || [];
    const rp = raw.path || {};
    out.path = {
      mode: rp.mode === "route" ? "route" : "free",
      start: isInt(rp.start, 1, 30) ? rp.start : 1,
      doneDays: cleanMap(rp.doneDays, (v) => (isDate(v) ? v : undefined), (k) => /^([1-9]|[12]\d|30)$/.test(k)),
      skipDays: cleanMap(rp.skipDays, (v) => (isDate(v) ? v : undefined), (k) => /^([1-9]|[12]\d|30)$/.test(k)),
      promptSeen: rp.promptSeen === true,
    };
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
    toggleFav,
    saveCustomCard,
    deleteCustomCard,
    cleanCustomCards,
    CUSTOM_MAX,
    CUSTOM_LIMITS,
    recordListenAnswer,
    recordSpeakAnswer,
    recordDialogue,
    recordNumberAnswer,
    recordSwapAnswer,
    recordPairAnswer,
    recordReadAnswer,
    recordMenuAnswer,
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
