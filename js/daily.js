// 每日任務 (stage 7b): five tasks a day (~15–20 min), a streak, and the
// 旅行日期倒數.  Data: state.daily (see js/storage.js).
//
//   ① 錯題重溫   聽力重溫（句子＋五十音）＋ 口語重溫      (existing review sessions)
//   ② 今日新句子 學 N 句（默認 5）→ 這幾句的聽力小測       (sentences by scene rotation)
//   ③ 口語練習   3 句（優先：聽力答對過、口語未答對過）
//   ④ 今日對話   1 個（未拿滿分、玩得最少的優先）
//   ⑤ 五十音熱身 5 題聽音選字
//
// Each day's plan (which sentences / dialogue) is fixed the first time the
// app renders that day, so leaving and coming back shows the same tasks.
// A task counts as done only when its session reaches the result screen;
// answers given on the way are saved as usual.  `done` flags never go back
// to undone.  A day with ≥ 3 tasks done extends the streak.
//
// 路線模式 (stage 10, state.path, Content.ROUTE_DAYS): instead of the scene rotation, each calendar day
// takes the next unfinished day of the 30 日入門路線 — its sentences, its dialogue and its 五十音 rows.
// A route day is complete when 新句子、口語、五十音 are all done; the next route day unlocks the next
// calendar day (at most one per day).  The 自由模式 above is the default and is unchanged.
// 版本二: 路線地圖 (every day, 標記為已學過), 今日新字課 (kana cards before the ⑤ quiz) and a one-time
// 主頁 prompt (see home.js).
// 版本三: 今日延伸 are links (back returns to the page they were on), a 結業 card with the numbers so far (and
// 重新開始路線), the 進度頁 route section, and days 29–30 practise the 必學 30 句 not yet 熟練.
//
// The sessions themselves are the existing 聽力／口語／對話 screens: this
// module only decides what to ask and hands a "task" spec to app.js
// (ctx.onLaunch), which opens the module and returns here afterwards.
window.App = window.App || {};

(function () {
  const { h, inkButton, modHeader, chip } = window.App.UI;
  const { Storage } = window.App;

  const STREAK_MIN = 3; // tasks needed for a day to count towards the streak
  const TASK_KEYS = ["review", "new", "speak", "dialogue", "kana"];
  const SPEAK_COUNT = 3;
  const KANA_COUNT = 5;
  const KEEP_DAYS = 365;

  // view: "list" | "learn" | "routeStart" (choose where the 30 日入門路線 starts); pick = the day chosen there
  // map = "routeMap" (路線地圖: `open` = the expanded day, `confirmSkip` = a day waiting for 確定略過);
  // "kanaLesson" = 今日新字課
  const ui = { view: "list", pick: null, open: null, confirmSkip: null, confirmRestart: false };
  function reset() {
    ui.view = "list";
    ui.pick = null;
    ui.open = null;
    ui.confirmSkip = null;
    ui.confirmRestart = false;
  }
  // Open the 路線地圖 directly (進度頁 button, 今日延伸 return).
  function openMap(open) {
    ui.view = "routeMap";
    ui.open = open || null;
    ui.confirmSkip = null;
  }
  // Open the 起點 screen directly (主頁 prompt).
  function openStart() {
    ui.view = "routeStart";
    ui.pick = null;
  }

  // ── sentences ────────────────────────────────────────────────────────

  const scenes = () => window.App.Content.PHRASE_SCENES;
  const dialogues = () => window.App.Content.DIALOGUES;

  // Every sentence (questions and their answers) in scene order.
  let allCache = null;
  function allSentences() {
    if (!allCache) {
      allCache = [];
      scenes().forEach((s, si) =>
        s.phrases.forEach((p) =>
          [p, ...(p.replies || [])].forEach((x) => allCache.push({ p: x, scene: s, si, mine: x.who === "me" || x.who === "both" }))
        )
      );
    }
    return allCache;
  }
  const byId = (id) => allSentences().find((x) => x.p.id === id) || null;

  // "mastered" (熟練) = 聽力連續答對 ≥ 2, (你說的句子) 口語連續答對 ≥ 1, and not
  // in 錯題重溫.  "learning" = seen/answered/learnt but not mastered; "new" = untouched.
  function statusOf(state, x) {
    const id = x.p.id;
    const L = state.listen.stats[id];
    const S = state.speak.stats[id];
    const inReview = !!(state.review.items[`p:${id}`] || state.review.items[`s:${id}`]);
    if (Storage.runOf(L) >= 2 && (!x.mine || Storage.runOf(S) >= 1) && !inReview) return "mastered";
    if (L || S || inReview || state.daily.learned[id]) return "learning";
    return "new";
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── 30 日入門路線 ────────────────────────────────────────────────────

  const ROUTE_KANA_MAX = 10; // most 五十音 questions on a day with new characters
  const routeDays = () => window.App.Content.ROUTE_DAYS || [];
  const routeDayOf = (n) => routeDays().find((d) => d.day === n) || null;
  const SCRIPT_NAME = { hira: "平假名", kata: "片假名" };

  // Characters of the KANA_ROWS rows `rowKeys`, in table order, in one script.
  function rowChars(script, rowKeys) {
    const { KANA, KANA_ROWS } = window.App.Content;
    const out = [];
    KANA_ROWS.filter((r) => rowKeys.includes(r.key)).forEach((r) => r.cells.filter(Boolean).forEach((id) => KANA[id][script] && out.push(KANA[id][script])));
    return out;
  }
  const routeNewChars = (d) => (d && d.kana ? rowChars(d.kana.script, d.kana.rows) : []);
  // Characters taught up to route day n (days skipped by starting later count as known), optionally one script only.
  function routeKnownChars(n, script) {
    const out = [];
    routeDays()
      .filter((d) => d.day <= n && d.kana && (!script || d.kana.script === script))
      .forEach((d) => routeNewChars(d).forEach((c) => !out.includes(c) && out.push(c)));
    return out;
  }
  const routeKnownIds = (n) => new Set(routeDays().filter((d) => d.day <= n).flatMap((d) => d.sentences));
  const routeDialogueIds = (n) => routeDays().filter((d) => d.day <= n && d.dialogue).map((d) => d.dialogue);

  // First route day ≥ the start day that is not completed (null: all done).
  function nextRouteDayFrom(path, from) {
    for (let n = from; n <= routeDays().length; n++) if (!path.doneDays[n] && !(path.skipDays || {})[n]) return n;
    return null;
  }
  const nextRouteDay = (state) => nextRouteDayFrom(state.path, state.path.start);

  // ⑤ on a route day: today's new characters (at most ROUTE_KANA_MAX); fewer than KANA_COUNT, or none
  // (review days, day 18+): fill up with the weakest characters learnt so far.
  function routeKanaPlan(state, n) {
    const d = routeDayOf(n);
    const stats = state.kana.stats;
    const weight = (ch) => (state.kana.mistakes.includes(ch) ? -1 : (stats[ch] || { c: 0 }).c);
    let chars = shuffle(routeNewChars(d)).slice(0, ROUTE_KANA_MAX);
    if (chars.length < KANA_COUNT) {
      const pool = routeKnownChars(n, d && d.review ? d.review : null).filter((c) => !chars.includes(c));
      chars = chars.concat(shuffle(pool).sort((a, b) => weight(a) - weight(b)).slice(0, KANA_COUNT - chars.length));
    }
    return chars;
  }

  // ④ on a route day: the dialogue unlocked that day, else one already unlocked (least played), else none.
  function routeDialogue(state, n, avoid) {
    const d = routeDayOf(n);
    if (d && d.dialogue) return d.dialogue;
    const unlocked = routeDialogueIds(n);
    const order = dialogueOrder(state, null).filter((id) => unlocked.includes(id));
    return order.find((id) => id !== avoid) || order[0] || null;
  }

  // Days 29–30 teach nothing new: ③ practises the 必學 30 句 (the ones you say) that are not 熟練 yet,
  // then the usual choice fills up.
  function pickSpeakMust(state, allowed) {
    const must = (window.App.Content.MUST_HAVE || []).map(byId).filter((x) => x && x.mine && !state.flags.includes(x.p.id) && statusOf(state, x) !== "mastered");
    const ids = shuffle(must).slice(0, SPEAK_COUNT).map((x) => x.p.id);
    const rest = pickSpeak(state, [], allowed).filter((id) => !ids.includes(id));
    return ids.concat(rest).slice(0, SPEAK_COUNT);
  }

  function makeRoutePlan(state, today, n) {
    const d = routeDayOf(n);
    const yesterday = state.daily.days[Storage.addDaysLocal(today, -1)];
    return {
      routeDay: n,
      newIds: d.sentences.filter((id) => !!byId(id)),
      speakIds: d.day >= 29 ? pickSpeakMust(state, routeKnownIds(n)) : pickSpeak(state, d.sentences, routeKnownIds(n)),
      dialogueId: routeDialogue(state, n, yesterday && yesterday.dialogueId),
      kanaChars: routeKanaPlan(state, n),
      due0: { l: window.App.Listening.dueCount(state), s: window.App.Speaking.dueCount(state) },
      done: {},
    };
  }

  // A route day is complete when 新句子、口語、五十音 are all done (tasks with nothing to do count as done).
  // Records the date in state.path.doneDays; the next route day then unlocks on the next calendar day.
  function syncRoute(state, date) {
    const day = state.daily.days[date];
    if (!day || !day.routeDay || state.path.doneDays[day.routeDay]) return state;
    const f = doneFlags(day);
    if (!(f.new && f.speak && f.kana)) return state;
    return { ...state, path: { ...state.path, doneDays: { ...state.path.doneDays, [day.routeDay]: date } } };
  }

  // Switch mode / change the start day. Today's plan is rebuilt at once unless something was already
  // answered today (then the change applies from tomorrow, so today's progress and streak are kept).
  function applyPath(state, patch) {
    const path = { ...state.path, ...patch, promptSeen: true };
    const today = Storage.todayLocal();
    let daily = state.daily;
    const answered = ((daily.activity[today] || {}).a || 0) > 0;
    if (!answered && daily.days[today]) {
      const days = { ...daily.days };
      delete days[today];
      daily = { ...daily, days };
    }
    return { ...state, path, daily };
  }
  const answeredToday = (state) => ((state.daily.activity[Storage.todayLocal()] || {}).a || 0) > 0;

  const dropTodayPlan = (state) => {
    const days = { ...state.daily.days };
    delete days[Storage.todayLocal()];
    return { ...state, daily: { ...state.daily, days } };
  };

  // 標記為已學過: the day is treated as done and never comes up as a task; sentence / kana statuses
  // do not change. If it is today's route day and nothing was answered today, today's plan is rebuilt
  // with the next day at once (skipping is not unlocking new content).
  function skipRouteDay(state, n) {
    const p = state.path;
    if (p.doneDays[n] || (p.skipDays || {})[n] || n < p.start) return state;
    let next = { ...state, path: { ...p, skipDays: { ...(p.skipDays || {}), [n]: Storage.todayLocal() } } };
    const day = next.daily.days[Storage.todayLocal()];
    if (day && day.routeDay === n && !answeredToday(next)) next = dropTodayPlan(next);
    return next;
  }

  function unskipRouteDay(state, n) {
    const skipDays = { ...(state.path.skipDays || {}) };
    if (!skipDays[n]) return state;
    delete skipDays[n];
    return { ...state, path: { ...state.path, skipDays } };
  }

  // One-time prompt on 主頁: only for people who never started the route and did not answer it yet.
  function showPrompt(state) {
    const p = state.path;
    return p.mode === "free" && !p.promptSeen && Object.keys(p.doneDays).length === 0 && Object.keys(p.skipDays || {}).length === 0 && routeDays().length > 0;
  }
  const dismissPrompt = (state) => (state.path.promptSeen ? state : { ...state, path: { ...state.path, promptSeen: true } });


  // ── building a day's plan ────────────────────────────────────────────

  // 今日新句子: scene rotation — today's scene is the next one (from the
  // cursor) that still has untouched sentences; its sentences are taken in
  // order, then the following scenes fill up what is missing.
  function pickNew(state, n) {
    const usable = allSentences().filter((x) => !state.flags.includes(x.p.id));
    const fresh = usable.filter((x) => statusOf(state, x) === "new");
    const count = scenes().length;
    if (!fresh.length) {
      // everything has been seen: practise the weakest again
      const weak = usable
        .filter((x) => statusOf(state, x) !== "mastered")
        .sort((a, b) => Storage.runOf(state.listen.stats[a.p.id]) - Storage.runOf(state.listen.stats[b.p.id]));
      return { ids: shuffle(weak.slice(0, n * 2)).slice(0, n).map((x) => x.p.id), cursor: state.daily.cursor };
    }
    let first = state.daily.cursor % count;
    for (let k = 0; k < count; k++) {
      const si = (state.daily.cursor + k) % count;
      if (fresh.some((x) => x.si === si)) {
        first = si;
        break;
      }
    }
    const ids = [];
    for (let k = 0; k < count && ids.length < n; k++) {
      const si = (first + k) % count;
      fresh.filter((x) => x.si === si).forEach((x) => ids.length < n && ids.push(x.p.id));
    }
    return { ids, cursor: (first + 1) % count };
  }

  // ③ 口語: sentences you say that you have heard (listening answered or
  // learnt) but never said correctly; then today's new ones; then the weakest.
  function pickSpeak(state, newIds, allowed) {
    const mine = allSentences().filter((x) => x.mine && !state.flags.includes(x.p.id) && (!allowed || allowed.has(x.p.id)));
    const said = (x) => !!(state.speak.stats[x.p.id] && state.speak.stats[x.p.id].c > 0);
    const heard = (x) => !!(state.listen.stats[x.p.id] || state.daily.learned[x.p.id]);
    const when = (x) => (state.daily.learned[x.p.id] || "") + ((state.listen.stats[x.p.id] || {}).last || "");
    const out = [];
    const add = (list) => list.forEach((x) => out.length < SPEAK_COUNT && !out.includes(x.p.id) && out.push(x.p.id));
    add(mine.filter((x) => heard(x) && !said(x) && !newIds.includes(x.p.id)).sort((a, b) => (when(a) < when(b) ? 1 : -1)));
    add(mine.filter((x) => newIds.includes(x.p.id)));
    add(shuffle(mine.filter((x) => statusOf(state, x) !== "mastered")));
    add(shuffle(mine));
    return out;
  }

  // ④ the dialogue played least (never perfect first), not yesterday's.
  function dialogueOrder(state, avoid) {
    const stats = state.dialogue.stats;
    return dialogues()
      .map((d, i) => ({ d, i, perfect: (stats[d.id] || {}).perfect ? 1 : 0, plays: (stats[d.id] || {}).plays || 0 }))
      .sort((a, b) => a.perfect - b.perfect || a.plays - b.plays || a.i - b.i)
      .map((x) => x.d.id)
      .filter((id, _, arr) => arr.length < 2 || id !== avoid);
  }

  // ⑤ kana: the rows/script chosen on the 五十音 page; weak characters first.
  function kanaPool(state) {
    const { KANA, KANA_ROWS } = window.App.Content;
    const prefs = state.kana.prefs;
    const scripts = prefs.script === "both" ? ["hira", "kata"] : [prefs.script];
    const chars = [];
    KANA_ROWS.filter((r) => prefs.rows.includes(r.key)).forEach((r) =>
      r.cells.filter(Boolean).forEach((id) => scripts.forEach((s) => KANA[id][s] && chars.push(KANA[id][s])))
    );
    if (!chars.length) {
      KANA_ROWS.filter((r) => r.key === "a").forEach((r) => r.cells.filter(Boolean).forEach((id) => KANA[id].hira && chars.push(KANA[id].hira)));
    }
    return chars;
  }

  function pickKana(state) {
    const stats = state.kana.stats;
    const weight = (ch) => (state.kana.mistakes.includes(ch) ? -1 : (stats[ch] || { c: 0 }).c);
    return shuffle(kanaPool(state))
      .sort((a, b) => weight(a) - weight(b))
      .slice(0, KANA_COUNT);
  }

  function makePlan(state, today) {
    const rn = state.path.mode === "route" ? nextRouteDay(state) : null;
    if (rn) return { cursor: state.daily.cursor, plan: makeRoutePlan(state, today, rn) };
    const n = state.settings.dailyNew;
    const nw = pickNew(state, n);
    const yesterday = state.daily.days[Storage.addDaysLocal(today, -1)];
    const dlgOrder = dialogueOrder(state, yesterday && yesterday.dialogueId);
    return {
      cursor: nw.cursor,
      plan: {
        newIds: nw.ids,
        speakIds: pickSpeak(state, nw.ids),
        dialogueId: dlgOrder[0],
        kanaChars: pickKana(state),
        due0: { l: window.App.Listening.dueCount(state), s: window.App.Speaking.dueCount(state) },
        done: {},
      },
    };
  }

  // Called before every render (app.js): creates today's plan on first use
  // and ticks off tasks that have nothing to do (e.g. no reviews due).
  // Returns the same object when nothing changed.
  function ensureToday(state) {
    const today = Storage.todayLocal();
    let daily = state.daily;
    let changed = false;
    if (!daily.days[today]) {
      const { plan, cursor } = makePlan(state, today);
      const cutoff = Storage.addDaysLocal(today, -KEEP_DAYS);
      const keep = (obj) => Object.fromEntries(Object.entries(obj).filter(([d]) => d >= cutoff));
      daily = { ...daily, cursor, days: { ...keep(daily.days), [today]: plan }, activity: keep(daily.activity) };
      changed = true;
    }
    const day = daily.days[today];
    const done = { ...day.done };
    const tick = (key, cond) => {
      if (!done[key] && cond) done[key] = true;
    };
    tick("reviewL", window.App.Listening.dueCount({ ...state, daily }) === 0);
    tick("reviewS", window.App.Speaking.dueCount({ ...state, daily }) === 0);
    tick("new", day.newIds.length === 0);
    tick("speak", day.speakIds.length === 0);
    tick("kana", day.kanaChars.length === 0);
    tick("dialogue", !day.dialogueId);
    if (Object.keys(done).length !== Object.keys(day.done).length) {
      daily = { ...daily, days: { ...daily.days, [today]: { ...day, done } } };
      changed = true;
    }
    return syncRoute(changed ? { ...state, daily } : state, today);
  }

  // ── state changes ────────────────────────────────────────────────────

  function markDone(state, date, key) {
    const day = state.daily.days[date];
    if (!day || day.done[key]) return state;
    return syncRoute({ ...state, daily: { ...state.daily, days: { ...state.daily.days, [date]: { ...day, done: { ...day.done, [key]: true } } } } }, date);
  }

  function markLearned(state, ids) {
    const today = Storage.todayLocal();
    const learned = { ...state.daily.learned };
    ids.forEach((id) => {
      if (!learned[id]) learned[id] = today;
    });
    return { ...state, daily: { ...state.daily, learned } };
  }

  function swapDialogue(state) {
    const today = Storage.todayLocal();
    const day = state.daily.days[today];
    if (!day) return state;
    let order = dialogueOrder(state, null);
    if (day.routeDay) {
      const unlocked = routeDialogueIds(day.routeDay);
      order = order.filter((id) => unlocked.includes(id));
    }
    if (order.length < 2) return state;
    const next = order[(order.indexOf(day.dialogueId) + 1) % order.length];
    return { ...state, daily: { ...state.daily, days: { ...state.daily.days, [today]: { ...day, dialogueId: next, done: { ...day.done, dialogue: false } } } } };
  }

  // ── status, streak, countdown ────────────────────────────────────────

  function doneFlags(day) {
    const d = (day && day.done) || {};
    return { review: !!(d.reviewL && d.reviewS), new: !!d.new, speak: !!d.speak, dialogue: !!d.dialogue, kana: !!d.kana };
  }
  const doneCount = (day) => Object.values(doneFlags(day)).filter(Boolean).length;

  // { current, best, todayCount, todayCounts } — a day counts when ≥ STREAK_MIN tasks are done.
  function streakInfo(state) {
    const today = Storage.todayLocal();
    const ok = (date) => doneCount(state.daily.days[date]) >= STREAK_MIN;
    let cur = 0;
    let d = ok(today) ? today : Storage.addDaysLocal(today, -1);
    while (ok(d)) {
      cur += 1;
      d = Storage.addDaysLocal(d, -1);
    }
    const dates = Object.keys(state.daily.days).filter(ok).sort();
    let best = 0;
    let run = 0;
    dates.forEach((date, i) => {
      run = i > 0 && Storage.addDaysLocal(dates[i - 1], 1) === date ? run + 1 : 1;
      best = Math.max(best, run);
    });
    return { current: cur, best: Math.max(best, cur), todayCount: doneCount(state.daily.days[today]), todayCounts: ok(today) };
  }

  // Whole days from today to the trip (0 = today); null when unset; negative = past.
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map(Number);
    const [ty, tm, td] = Storage.todayLocal().split("-").map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 86400000);
  }

  function countdownText(state) {
    const n = daysUntil(state.settings.travelDate);
    if (n === null || n < 0) return null;
    return n === 0 ? "✈️ 今天出發！" : `✈️ 距離出發還有 ${n} 天`;
  }

  // ── screens ──────────────────────────────────────────────────────────

  const TITLES = {
    review: "錯題重溫",
    new: "今日新句子",
    speak: "口語練習",
    dialogue: "今日對話",
    kana: "五十音熱身",
  };

  // The 五十音 task is called 五十音熱身 normally and 五十音練習 on a route day.
  const titleOf = (key, day) => (key === "kana" && day && day.routeDay ? "五十音練習" : TITLES[key]);

  function firstUndone(day) {
    const f = doneFlags(day);
    return TASK_KEYS.find((k) => !f[k]) || null;
  }

  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
  function dateLabel(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${m}月${d}日（${WEEKDAY[new Date(y, m - 1, d).getDay()]}）`;
  }

  // 必學 30 句 (Content.MUST_HAVE): how many are 熟練 (see statusOf).
  function mustCounts(state) {
    const ids = window.App.Content.MUST_HAVE || [];
    const mastered = ids.filter((id) => {
      const x = byId(id);
      return x && statusOf(state, x) === "mastered";
    }).length;
    return { mastered, total: ids.length };
  }

  // For the 主頁 card.
  function summary(state) {
    const day = state.daily.days[Storage.todayLocal()];
    const streak = streakInfo(state);
    const next = day ? firstUndone(day) : null;
    const total = routeDays().length;
    return {
      count: doneCount(day),
      total: TASK_KEYS.length,
      streak,
      next,
      nextTitle: next ? titleOf(next, day) : null,
      countdown: countdownText(state),
      routeText: state.path.mode === "route" && day && day.routeDay ? `🗾 路線第 ${day.routeDay} / ${total} 天` : null,
    };
  }

  function statusIcon(done, n) {
    return h("span", { class: `task-num ${done ? "done" : ""}`.trim(), "aria-label": done ? "已完成" : `第 ${n} 項` }, done ? "✓" : String(n));
  }

  function taskCard(done, n, title, sub, ...body) {
    return h(
      "div",
      { class: `card task-card ${done ? "is-done" : ""}`.trim() },
      h("div", { class: "row" }, statusIcon(done, n), h("div", { class: "grow" }, h("p", { class: "task-title" }, title), h("p", { class: "xs muted" }, sub))),
      body
    );
  }

  // ── 路線 card (top of 今日任務) and 起點 screen ──────────────────────

  // 今日延伸 as links: `go` is opened by app.js (openExtra); 返回 there comes back to this page.
  function extraList(ctx, extras) {
    return h(
      "ul",
      { class: "extras" },
      extras.map((x) =>
        h("li", null, x.go && ctx.onOpenExtra ? h("button", { class: "extra-link", onclick: () => ctx.onOpenExtra(x.go, { view: ui.view, open: ui.open }) }, `${x.text} ›`) : x.text)
      )
    );
  }

  // The 30 dots: done (green), skipped (gold), today (outlined), before the start (faint).
  function routeDots(state, todayDay) {
    const p = state.path;
    const skipped = p.skipDays || {};
    const doneN = Object.keys(p.doneDays).length;
    const total = routeDays().length;
    return h(
      "div",
      { class: "route-dots", role: "img", "aria-label": `路線進度：已完成 ${doneN} / ${total} 天` },
      routeDays().map((d) => h("span", { class: `route-dot${p.doneDays[d.day] ? " done" : skipped[d.day] ? " skipped" : ""}${d.day === todayDay ? " today" : ""}${d.day < p.start && !p.doneDays[d.day] && !skipped[d.day] ? " skip" : ""}` }))
    );
  }

  // The numbers shown on the 結業 card and in the 進度頁 route section.
  function routeStatsList(state) {
    const st = window.App.Progress.routeStats(state);
    return h(
      "ul",
      { class: "route-stats" },
      h("li", null, `📌 必學 30 句：熟練 ${st.must.mastered} / ${st.must.total}`),
      h("li", null, `あ 五十音掌握：平假名 ${st.hira.done} / ${st.hira.total}・片假名 ${st.kata.done} / ${st.kata.total}`),
      h("li", null, `💬 句子熟練：${st.sentences.mastered} / ${st.sentences.all}`),
      h("li", null, `🛎️ 情境對話：已玩 ${st.dialogues.played} / ${st.dialogues.total}`, h("span", { class: "xs muted" }, "　藥妝店、觀光景點、溫泉、預約與電話的對話不在路線內"))
    );
  }

  // 重新開始路線: clears the done / skipped days and starts again at day 1 (statuses of sentences and kana stay).
  function restartConfirm(ctx) {
    return h(
      "div",
      { class: "confirm mt-3" },
      h("p", { class: "mb-3" }, "確定重新開始？完成和略過的天數會清除，從第 1 天重來；句子和五十音的熟練狀態不變。"),
      h(
        "div",
        { class: "row-sm" },
        h("button", { class: "btn-plain grow", onclick: () => ((ui.confirmRestart = false), ctx.rerender()) }, "取消"),
        inkButton(
          "確定重新開始",
          () => {
            ui.confirmRestart = false;
            ui.view = "list";
            ctx.onUpdate((s) => applyPath(s, { mode: "route", start: 1, doneDays: {}, skipDays: {} }));
            window.App.Speech.toast("路線已重新開始：第 1 天");
            ctx.rerender({ scrollTop: true });
          },
          { class: "grow" }
        )
      )
    );
  }

  // All 30 days are done or skipped.
  function finishCard(ctx) {
    const { state } = ctx;
    const p = state.path;
    const total = routeDays().length;
    const doneN = Object.keys(p.doneDays).length;
    const skipN = Object.keys(p.skipDays || {}).length;
    const mapBtn = h("button", { class: "btn-soft w-full", onclick: () => ((ui.view = "routeMap"), (ui.open = null), ctx.rerender({ scrollTop: true })) }, "📍 路線地圖");
    return h(
      "div",
      { class: "card accent route-card route-finish" },
      window.App.Feedback.hero(1, 1),
      h("p", { class: "h-heading center" }, "🎉 30 日入門路線結業"),
      h("p", { class: "small center mt-1" }, `共 ${total} 天：完成 ${doneN} 天${skipN ? `、略過 ${skipN} 天` : ""}`),
      routeStatsList(state),
      p.mode === "route" && h("p", { class: "xs muted mt-2" }, "現在的每日任務使用自由模式的選題。"),
      ui.confirmRestart
        ? restartConfirm(ctx)
        : h(
            "div",
            { class: "mt-3 stack-sm" },
            p.mode === "route" &&
              inkButton(
                "回到自由模式",
                () => {
                  ctx.onUpdate((s) => applyPath(s, { mode: "free" }));
                  window.App.Speech.toast("已回到自由模式");
                },
                { accent: true, class: "w-full" }
              ),
            mapBtn,
            h("button", { class: "btn-soft w-full", onclick: () => ((ui.confirmRestart = true), ctx.rerender()) }, "重新開始路線")
          )
    );
  }

  function routeCard(ctx, rd) {
    const { state } = ctx;
    const p = state.path;
    const skipped = p.skipDays || {};
    const total = routeDays().length;
    const doneN = Object.keys(p.doneDays).length;
    const skipN = Object.keys(skipped).length;
    const go = (view) => {
      ui.view = view;
      ui.pick = null;
      ui.open = null;
      ui.confirmSkip = null;
      ctx.rerender({ scrollTop: true });
    };
    const toFree = () => {
      ctx.onUpdate((s) => applyPath(s, { mode: "free" }));
      window.App.Speech.toast("已回到自由模式");
    };
    const mapBtn = (cls) => h("button", { class: `btn-soft ${cls}`.trim(), onclick: () => go("routeMap") }, "📍 路線地圖");
    const buttons = h(
      "div",
      { class: "mt-3" },
      mapBtn("w-full"),
      h(
        "div",
        { class: "row-sm mt-2" },
        h("button", { class: "btn-soft grow", onclick: () => go("routeStart") }, "更換起點"),
        h("button", { class: "btn-soft grow", onclick: toFree }, "回到自由模式")
      )
    );

    const next = nextRouteDay(state);
    if (next === null && doneN + skipN > 0) return finishCard(ctx);
    if (p.mode !== "route") {
      return h(
        "div",
        { class: "card accent route-card" },
        h("p", { class: "h-heading" }, "🗾 30 日入門路線"),
        h("p", { class: "small muted mt-1" }, "從零開始：每天解鎖一點新內容（五十音、句子、對話），每日任務會跟著路線出題。已經學過的，可以從中途開始。"),
        doneN + skipN > 0 && h("p", { class: "xs mt-2" }, `你之前已完成 ${doneN} 天${skipN ? `、略過 ${skipN} 天` : ""}，進度仍保留。`),
        inkButton(doneN + skipN > 0 ? "繼續路線" : "開始路線", () => go("routeStart"), { accent: true, class: "w-full mt-3" }),
        doneN + skipN > 0 && mapBtn("w-full mt-2")
      );
    }
    if (!rd) {
      // route is on but today's plan is not a route day: finished, or switched on after answering today
      return h(
        "div",
        { class: "card accent route-card" },
        h("p", { class: "h-heading" }, "🗾 30 日入門路線"),
        next === null
          ? h("p", { class: "small mt-1" }, "🎉 你已完成全部 30 天。現在的每日任務使用自由模式的選題。")
          : h("p", { class: "small mt-1" }, `路線已設定：第 ${next} 天會從明天開始（今天已有答題，所以今天的任務維持不變）。`),
        buttons
      );
    }
    const newChars = routeNewChars(rd);
    const kanaLine = rd.kana
      ? `今日新字：${rd.kana.label}（${newChars.length} 個）`
      : rd.review
        ? `今日：${SCRIPT_NAME[rd.review]}總複習`
        : rd.day >= 18 && rd.day <= 28
          ? "五十音：複習已學過的字"
          : null;
    const finished = !!p.doneDays[rd.day];
    return h(
      "div",
      { class: "card accent route-card" },
      h("div", { class: "row-between" }, h("p", { class: "h-heading" }, `🗾 路線第 ${rd.day} / ${total} 天`), h("span", { class: "small", style: { color: "var(--a-solid)" } }, `已完成 ${doneN} 天`)),
      h("p", { class: "small mt-1" }, rd.title),
      h(
        "div",
        { class: "route-dots", role: "img", "aria-label": `路線進度：已完成 ${doneN} / ${total} 天` },
        routeDays().map((d) => h("span", { class: `route-dot${p.doneDays[d.day] ? " done" : skipped[d.day] ? " skipped" : ""}${d.day === rd.day ? " today" : ""}${d.day < p.start && !p.doneDays[d.day] ? " skip" : ""}` }))
      ),
      kanaLine && h("p", { class: "small mt-3" }, kanaLine),
      rd.extras.length > 0 &&
        h("div", { class: "mt-2" }, h("p", { class: "xs muted" }, "今日延伸（可選，不算任務）"), extraList(ctx, rd.extras)),
      finished
        ? h("p", { class: "note gold mt-3" }, rd.day < total ? `🎉 第 ${rd.day} 天完成！第 ${rd.day + 1} 天會在明天解鎖。` : "🎉 30 日入門路線全部完成！")
        : h("p", { class: "xs muted mt-3" }, `完成「新句子」「口語」「五十音」三項，就完成第 ${rd.day} 天；第 ${rd.day + 1 <= total ? rd.day + 1 : rd.day} 天會在明天解鎖。`),
      buttons
    );
  }

  // ── 路線地圖: all 30 days, with 標記為已學過 ───────────────────────────

  const ST_LABEL = { done: "✓ 完成", skipped: "⏭ 已略過", before: "起點之前", today: "📍 今天", next: "下一天", tomorrow: "明天解鎖", locked: "未解鎖" };

  function mapScreen(ctx) {
    const { state } = ctx;
    const p = state.path;
    const skipped = p.skipDays || {};
    const total = routeDays().length;
    const plan = state.daily.days[Storage.todayLocal()];
    const todayDay = p.mode === "route" && plan && plan.routeDay ? plan.routeDay : null;
    const next = nextRouteDay(state);
    const doneN = Object.keys(p.doneDays).length;
    const skipN = Object.keys(skipped).length;
    const back = () => {
      ui.view = "list";
      ui.open = null;
      ui.confirmSkip = null;
      ctx.rerender({ scrollTop: true });
    };
    const status = (n) =>
      p.doneDays[n] ? "done" : skipped[n] ? "skipped" : n < p.start ? "before" : n === todayDay ? "today" : n === next ? (todayDay === null ? "next" : "tomorrow") : "locked";
    const sentenceRow = (id) => {
      const x = byId(id);
      return x && h("li", null, h("span", { lang: "ja", class: "jp" }, x.p.ja), h("span", { class: "xs muted block" }, x.p.yue));
    };

    function detail(d, st) {
      const dlg = d.dialogue && dialogues().find((x) => x.id === d.dialogue);
      const newChars = routeNewChars(d);
      return h(
        "div",
        { class: "route-detail" },
        d.kana && h("p", { class: "small" }, `新字：${d.kana.label}（${newChars.length} 個）`),
        d.review && h("p", { class: "small" }, `${SCRIPT_NAME[d.review]}總複習`),
        st === "locked"
          ? h("p", { class: "xs muted mt-2" }, `${d.sentences.length} 句新句子${d.dialogue ? "，有新對話" : ""}。這一天解鎖後會顯示完整內容。`)
          : [
              d.sentences.length > 0 && h("p", { class: "caption mt-2" }, `新句子（${d.sentences.length} 句）`),
              d.sentences.length > 0 && h("ul", { class: "route-sentences" }, d.sentences.map(sentenceRow)),
              dlg && h("p", { class: "small mt-2" }, `新對話：${dlg.emoji} ${dlg.title}`),
              d.extras.length > 0 && h("div", { class: "mt-2" }, h("p", { class: "caption" }, "今日延伸"), extraList(ctx, d.extras)),
            ],
        st === "done" && h("p", { class: "xs muted mt-2" }, `完成日期：${p.doneDays[d.day]}`),
        st === "skipped" &&
          h("button", { class: "btn-soft w-full mt-3", onclick: () => ctx.onUpdate((s) => unskipRouteDay(s, d.day)) }, "取消略過（這一天重新出現在路線中）"),
        ["today", "next", "tomorrow", "locked"].includes(st) &&
          (ui.confirmSkip === d.day
            ? h(
                "div",
                { class: "confirm mt-3" },
                h("p", { class: "mb-3" }, `確定把第 ${d.day} 天標記為已學過？這一天的任務不會再出現，句子和五十音的熟練狀態不變。`),
                h(
                  "div",
                  { class: "row-sm" },
                  h("button", { class: "btn-plain grow", onclick: () => ((ui.confirmSkip = null), ctx.rerender()) }, "取消"),
                  inkButton(
                    "確定略過",
                    () => {
                      ui.confirmSkip = null;
                      ctx.onUpdate((s) => skipRouteDay(s, d.day));
                      window.App.Speech.toast(`第 ${d.day} 天已標記為已學過`);
                    },
                    { class: "grow" }
                  )
                )
              )
            : h("button", { class: "btn-soft w-full mt-3", onclick: () => ((ui.confirmSkip = d.day), ctx.rerender()) }, "標記為已學過（略過這一天）"))
      );
    }

    return h(
      "div",
      { class: "stack-lg" },
      modHeader("路線地圖", back),
      h(
        "div",
        { class: "card accent" },
        h("p", { class: "small" }, `已完成 ${doneN} 天${skipN ? `・略過 ${skipN} 天` : ""}・共 ${total} 天`),
        h(
          "div",
          { class: "route-dots", role: "img", "aria-label": `路線進度：已完成 ${doneN} / ${total} 天` },
          routeDays().map((d) => h("span", { class: `route-dot${p.doneDays[d.day] ? " done" : skipped[d.day] ? " skipped" : ""}${d.day === todayDay ? " today" : ""}${d.day < p.start && !p.doneDays[d.day] && !skipped[d.day] ? " skip" : ""}` }))
        ),
        h("p", { class: "xs muted mt-2" }, "路線不會鎖住其他功能。按一天可以看內容；已經學過的天數可以標記為已學過。")
      ),
      routeDays().map((d) => {
        const st = status(d.day);
        const open = ui.open === d.day;
        const sub = [d.kana ? d.kana.label : d.review ? `${SCRIPT_NAME[d.review]}複習` : null, d.sentences.length ? `${d.sentences.length} 句` : null, d.dialogue ? "新對話" : null].filter(Boolean).join("・");
        return h(
          "div",
          { class: `card route-row st-${st}${open ? " open" : ""}` },
          h(
            "button",
            { class: "route-row-head", "aria-expanded": open ? "true" : "false", onclick: () => ((ui.open = open ? null : d.day), (ui.confirmSkip = null), ctx.rerender()) },
            h("span", { class: "route-n" }, String(d.day)),
            h("span", { class: "grow" }, h("span", { class: "route-title" }, d.title), sub && h("span", { class: "xs muted block" }, sub)),
            h("span", { class: `route-st ${st}` }, ST_LABEL[st])
          ),
          open && detail(d, st)
        );
      })
    );
  }

  // ── 今日新字課 (⑤ on a route day with new characters) ───────────────

  // The 五十音 quiz of today's plan (also started from the lesson).
  function launchKana(ctx, day, rd) {
    ctx.onLaunch({ key: "kana", module: "listening", mode: "practice", kana: day.kanaChars, title: rd ? (routeNewChars(rd).length ? "五十音・今日新字" : "五十音複習") : "五十音熱身" });
  }

  function lessonScreen(ctx) {
    const { state, settings } = ctx;
    const day = state.daily.days[Storage.todayLocal()];
    const rd = day && day.routeDay ? routeDayOf(day.routeDay) : null;
    if (!rd || !rd.kana) {
      ui.view = "list";
      return listScreen(ctx);
    }
    const { KANA, KANA_ROWS } = window.App.Content;
    const script = rd.kana.script;
    const noteKey = script === "hira" ? "hiraNote" : "kataNote";
    const tts = window.App.Speech.isTTSSupported();
    const back = () => {
      ui.view = "list";
      ctx.rerender({ scrollTop: true });
    };
    const rows = KANA_ROWS.filter((r) => rd.kana.rows.includes(r.key));
    const rowTitle = (r) =>
      r.key === "n"
        ? KANA.n[script]
        : ["seion", "dakuon", "handakuon"].includes(r.group)
          ? `${KANA[r.cells.find(Boolean)][script]}行`
          : r.cells.filter(Boolean).map((id) => KANA[id][script]).filter(Boolean).join("・");
    const card = (id) => {
      const k = KANA[id];
      const ch = k[script];
      const note = [k.note, k[noteKey]].filter(Boolean).join("；");
      return h(
        "button",
        { class: "lesson-card", "aria-label": `聽 ${ch}`, onclick: () => window.App.Speech.speak(ch, settings) },
        h("span", { lang: "ja", class: "jp lesson-ch" }, ch),
        settings.showRomaji && h("span", { class: "lesson-rom" }, k.romaji + (k.romajiAlt ? `（亦寫 ${k.romajiAlt}）` : "")),
        settings.showYue && h("span", { class: "lesson-yue" }, k.yue ? `近似：${k.yue}` : "廣東話沒有對應"),
        note && h("span", { class: "lesson-note" }, `💡 ${note}`),
        window.App.UI.mnemonic(ch, { compact: true })
      );
    };
    const start = () => {
      ui.view = "list"; // so 返回今日任務 from the quiz lands on the task list, not on this lesson
      launchKana(ctx, day, rd);
    };
    return h(
      "div",
      { class: "stack-lg" },
      modHeader("今日新字", back),
      h(
        "div",
        { class: "card accent" },
        h("p", { class: "h-heading" }, `第 ${rd.day} 天：${rd.kana.label}`),
        h("p", { class: "small muted mt-1" }, `共 ${routeNewChars(rd).length} 個新字。按每個字可以聽發音，看清楚拼音；小測會從這些字抽 ${day.kanaChars.length} 題。`),
        settings.showYue && h("p", { class: "xs muted mt-1" }, "廣東話近似讀音僅供參考，請以發音為準。"),
        tts && inkButton(`直接開始小測（${day.kanaChars.length} 題）`, start, { accent: true, class: "w-full mt-3" })
      ),
      rows.map((r) =>
        h(
          "div",
          null,
          h("p", { lang: "ja", class: "h-heading jp mb-2" }, rowTitle(r)),
          h("div", { class: "lesson-grid" }, r.cells.filter(Boolean).filter((id) => KANA[id][script]).map(card))
        )
      ),
      inkButton(tts ? `開始小測（${day.kanaChars.length} 題）` : "返回", tts ? start : back, { accent: true, class: "w-full" }),
      !tts && h("p", { class: "xs muted center" }, "此瀏覽器沒有發音功能，無法進行聽音小測。"),
      h("button", { class: "btn-soft w-full", onclick: back }, "稍後再做")
    );
  }

  const START_PRESETS = [
    { n: 1, title: "完全零基礎", sub: "從第 1 天開始：先學平假名和基本禮貌" },
    { n: 10, title: "已經會平假名", sub: "從第 10 天開始：片假名加購物句子" },
    { n: 18, title: "平假名和片假名都會", sub: "從第 18 天開始：交通、酒店、緊急等情境句子" },
  ];

  function startScreen(ctx) {
    const { state } = ctx;
    const p = state.path;
    const days = routeDays();
    const back = () => {
      ui.view = "list";
      ui.pick = null;
      ctx.rerender({ scrollTop: true });
    };
    const pick = ui.pick;
    const resume = pick ? nextRouteDayFrom(p, pick) : null;
    const rd = resume ? routeDayOf(resume) : null;
    const doneN = Object.keys(p.doneDays).length;
    const choose = (n) => {
      ui.pick = n;
      ctx.rerender();
    };
    const confirm = () => {
      const late = answeredToday(state);
      ctx.onUpdate((s) => applyPath(s, { mode: "route", start: pick }));
      ui.view = "list";
      ui.pick = null;
      window.App.Speech.toast(late ? "今天已有答題：路線從明天開始" : `路線已開始：第 ${resume} 天`);
      ctx.rerender({ scrollTop: true });
    };
    return h(
      "div",
      { class: "stack-lg" },
      modHeader("30 日入門路線", back),
      h(
        "div",
        { class: "card accent" },
        h("p", { class: "small" }, "你從哪裡開始？"),
        h("p", { class: "xs muted mt-1" }, "每個日曆日最多解鎖一天；漏掉的日子不會被跳過。已完成的天數會保留，路線也不會鎖住其他功能。"),
        p.mode === "route" && h("p", { class: "xs mt-2" }, `目前路線進行中，已完成 ${doneN} 天。`)
      ),
      h(
        "div",
        { class: "stack-sm" },
        START_PRESETS.map((o) =>
          h(
            "button",
            { class: `mode-opt ${pick === o.n ? "active" : ""}`.trim(), "aria-pressed": pick === o.n ? "true" : "false", onclick: () => choose(o.n) },
            h("span", { class: "mode-title" }, o.title),
            h("span", { class: "mode-desc" }, o.sub)
          )
        )
      ),
      h(
        "div",
        { class: "card" },
        h("p", { class: "small mb-2" }, "或自選第幾天"),
        h("div", { class: "wrap" }, days.map((d) => chip(String(d.day), pick === d.day, () => choose(d.day), { class: "row-chip" })))
      ),
      pick &&
        h(
          "div",
          { class: "card accent" },
          resume === null
            ? h("p", { class: "small" }, "這個起點之後的天數都已經完成。請選擇較早的一天。")
            : [
                resume !== pick && h("p", { class: "xs muted mb-1" }, `第 ${pick} 天已經完成或已略過，會從第 ${resume} 天繼續。`),
                h("p", { class: "h-heading" }, `第 ${rd.day} 天：${rd.title}`),
                h(
                  "p",
                  { class: "small mt-1" },
                  rd.kana ? `新字：${rd.kana.label}（${routeNewChars(rd).length} 個）・` : rd.review ? `${SCRIPT_NAME[rd.review]}總複習・` : "",
                  `${rd.sentences.length} 句新句子`,
                  rd.dialogue ? "・有新對話" : ""
                ),
              ]
        ),
      inkButton(resume ? `從第 ${resume} 天開始` : "請先選擇起點", confirm, { accent: true, class: "w-full", disabled: !pick || resume === null })
      ,
      doneN + Object.keys(p.skipDays || {}).length > 0 &&
        (ui.confirmRestart ? restartConfirm(ctx) : h("button", { class: "btn-plain w-full", onclick: () => ((ui.confirmRestart = true), ctx.rerender()) }, "重新開始路線（清除完成與略過紀錄）"))
    );
  }

  // ctx: { state, settings, flags, onBack, onLaunch(spec), onUpdate(fn), onToggleFlag, rerender }
  function listScreen(ctx) {
    const { state } = ctx;
    const today = Storage.todayLocal();
    const day = state.daily.days[today];
    const flags = doneFlags(day);
    const streak = streakInfo(state);
    const count = doneCount(day);
    const next = firstUndone(day);
    const dueL = window.App.Listening.dueCount(state);
    const dueS = window.App.Speaking.dueCount(state);
    const dlg = dialogues().find((d) => d.id === day.dialogueId);
    const tts = window.App.Speech.isTTSSupported();
    const countdown = countdownText(state);
    const rd = day.routeDay ? routeDayOf(day.routeDay) : null; // today's 路線 day (null in 自由模式)
    const canSwap = !day.routeDay || routeDialogueIds(day.routeDay).length >= 2;
    // what 「繼續」 launches: for ①, whichever half still has something to do
    const nextKey = next === "review" ? (!day.done.reviewL && dueL > 0 ? "reviewL" : "reviewS") : next;

    const minutes =
      (flags.review ? 0 : Math.max(1, Math.round((Math.min(dueL, 10) + Math.min(dueS, 10)) * 0.3))) +
      (flags.new ? 0 : 4) +
      (flags.speak ? 0 : 3) +
      (flags.dialogue ? 0 : 4) +
      (flags.kana ? 0 : 2);

    const launch = (key) => {
      if (key === "new") {
        ui.view = "learn";
        ctx.rerender({ scrollTop: true });
      } else if (key === "reviewL") ctx.onLaunch({ key: "reviewL", module: "listening", mode: "review", title: "聽力重溫" });
      else if (key === "reviewS") ctx.onLaunch({ key: "reviewS", module: "speaking", kind: "review" });
      else if (key === "speak") ctx.onLaunch({ key: "speak", module: "speaking", kind: "practice", ids: day.speakIds });
      else if (key === "dialogue") ctx.onLaunch({ key: "dialogue", module: "dialogue", dlgId: day.dialogueId });
      else if (key === "kana") {
        if (rd && routeNewChars(rd).length) {
          ui.view = "kanaLesson";
          ctx.rerender({ scrollTop: true });
        } else launchKana(ctx, day, rd);
      }
    };
    const startBtn = (key, done, label, opts = {}) =>
      done
        ? h("button", { class: `btn-soft ${opts.class || "w-full"}`.trim(), onclick: () => launch(key), disabled: opts.disabled }, "再練一次")
        : inkButton(label || "開始", () => launch(key), { accent: true, class: opts.class || "w-full", disabled: opts.disabled });

    const reviewSub = (done) =>
      done ? "已完成" : dueL + dueS > 0 ? `今天待重溫：聽力 ${dueL}（含五十音、數字、近音詞）・口語 ${dueS}` : "今天沒有需要重溫的內容";
    // one half of ①: nothing due → greyed ✓; due → button (soft once already done today)
    const part = (key, doneKey, label, due) => {
      if (due === 0) return h("button", { class: "btn-soft grow", disabled: true }, `${label} ✓`);
      const needTts = key === "reviewL" && !tts;
      return day.done[doneKey]
        ? h("button", { class: "btn-soft grow", disabled: needTts, onclick: () => launch(key) }, `${label}（${due}）再練`)
        : inkButton(`${label}（${due}）`, () => launch(key), { accent: true, class: "grow", disabled: needTts });
    };

    return h(
      "div",
      { class: "stack-lg" },
      modHeader("今日任務", ctx.onBack),

      // 30 日入門路線
      routeCard(ctx, rd),

      // overview
      h(
        "div",
        { class: "card accent" },
        h("div", { class: "row-between" }, h("p", { class: "h-heading" }, dateLabel(today)), h("p", { class: "small", style: { color: "var(--a-solid)" } }, `已完成 ${count} / ${TASK_KEYS.length}`)),
        h("div", { class: "bar accent mt-2" }, h("div", { style: { width: `${(count / TASK_KEYS.length) * 100}%` } })),
        h(
          "p",
          { class: "small mt-3" },
          streak.current > 0 ? `🔥 連續 ${streak.current} 天` : "🔥 尚未開始連續",
          countdown ? `　${countdown}` : ""
        ),
        h(
          "p",
          { class: "xs muted mt-1" },
          streak.todayCounts
            ? "今天已計入連續天數 ✅"
            : `今天再完成 ${Math.max(0, STREAK_MIN - count)} 項，就會計入連續天數（每天至少完成 ${STREAK_MIN} 項）。`
        ),
        count < TASK_KEYS.length && h("p", { class: "xs muted mt-1" }, `剩下的任務預計約 ${minutes} 分鐘。次序只是建議，可以隨意先做哪一項。`)
      ),

      count === TASK_KEYS.length &&
        h("div", { class: "card center", style: { background: "var(--good-tint)", borderColor: "var(--good-solid)" } }, window.App.Feedback.hero(1, 1), h("p", { class: "h-heading" }, "今天的任務全部完成！"), h("p", { class: "small muted mt-1" }, "明天再來。想多練習的話，也可以隨時重做任何一項。")),

      // ① review
      taskCard(
        flags.review,
        1,
        "錯題重溫",
        reviewSub(flags.review),
        h("div", { class: "row-sm mt-3" }, part("reviewL", "reviewL", "聽力重溫", dueL), part("reviewS", "reviewS", "口語重溫", dueS))
      ),

      // ② new sentences
      taskCard(
        flags.new,
        2,
        `今日新句子 ${day.newIds.length} 句`,
        flags.new ? (day.newIds.length ? "已完成" : "今天沒有新句子（複習日）") : "先逐句學習，再做一個小測・約 4 分鐘",
        day.newIds.length > 0 && startBtn("new", flags.new, "學習新句子", { class: "w-full mt-3" })
      ),

      // ③ speaking
      taskCard(
        flags.speak,
        3,
        `口語練習 ${day.speakIds.length} 句`,
        flags.speak ? "已完成" : "看中文意思，讀出日文・約 3 分鐘",
        day.speakIds.length > 0 && startBtn("speak", flags.speak, "開始口語練習", { class: "w-full mt-3" })
      ),

      // ④ dialogue
      dlg
        ? taskCard(
            flags.dialogue,
            4,
            `今日對話：${dlg.emoji} ${dlg.title}`,
            flags.dialogue ? "已完成" : rd && !(routeDayOf(rd.day).dialogue) ? "重玩一個已解鎖的對話・約 4 分鐘" : "和店員一問一答・約 4 分鐘",
            h(
              "div",
              { class: "row-sm mt-3" },
              startBtn("dialogue", flags.dialogue, "開始對話", { class: "grow" }),
              !flags.dialogue && canSwap && h("button", { class: "btn-soft", onclick: () => ctx.onUpdate(swapDialogue) }, "換一個")
            )
          )
        : taskCard(true, 4, "今日對話", "今天沒有對話（路線第 9 天起，每隔幾天會解鎖一個）"),

      // ⑤ kana warm-up
      taskCard(
        flags.kana,
        5,
        rd ? (routeNewChars(rd).length ? `五十音：今日新字 ${day.kanaChars.length} 題` : `五十音複習 ${day.kanaChars.length} 題`) : "五十音熱身",
        flags.kana ? "已完成" : rd ? `聽音選字・${rd.kana ? rd.kana.label : "已學過的字"}・約 ${routeNewChars(rd).length ? 5 : 2} 分鐘` : `聽音選字 ${day.kanaChars.length} 題（取自「五十音」頁選擇的行）・約 2 分鐘`,
        day.kanaChars.length > 0 && startBtn("kana", flags.kana, rd ? (routeNewChars(rd).length ? "學習新字" : "開始練習") : "開始熱身", { class: "w-full mt-3", disabled: !tts })
      ),

      !tts && h("p", { class: "notice" }, "此瀏覽器沒有發音功能，聽力類任務無法使用。"),

      next && inkButton(`繼續：${titleOf(next, day)}`, () => launch(nextKey), { class: "w-full", disabled: !!nextKey && (nextKey === "reviewL" || nextKey === "kana") && !tts })
    );
  }

  // ② step 1: the new sentences, studied one by one, then the quiz.
  function learnScreen(ctx) {
    const { state } = ctx;
    const day = state.daily.days[Storage.todayLocal()];
    const items = day.newIds.map(byId).filter(Boolean);
    const tts = window.App.Speech.isTTSSupported();
    const start = () => {
      ctx.onUpdate((s) => markLearned(s, day.newIds));
      ui.view = "list";
      ctx.onLaunch({ key: "new", module: "listening", ids: day.newIds, title: "今日新句子・小測" });
    };
    return h(
      "div",
      { class: "stack-lg" },
      modHeader("今日新句子", () => {
        ui.view = "list";
        ctx.rerender({ scrollTop: true });
      }),
      h("p", { class: "small muted" }, `今天的 ${items.length} 句。逐句按 🔊 聽幾遍、看懂意思，然後做小測。`),
      items.map((x) =>
        h(
          "div",
          { class: "card accent phrase-card" },
          h("p", { class: "caption mb-1" }, `${x.scene.emoji} ${x.scene.label}`),
          window.App.Phrases.sentenceCard(x.p, { settings: ctx.settings, flags: ctx.flags, onToggleFlag: ctx.onToggleFlag, favs: ctx.favs, onToggleFav: ctx.onToggleFav })
        )
      ),
      inkButton(tts ? `開始小測（${items.length} 題）` : "返回", tts ? start : () => ((ui.view = "list"), ctx.rerender({ scrollTop: true })), { accent: true, class: "w-full" }),
      !tts && h("p", { class: "xs muted center" }, "此瀏覽器沒有發音功能，無法進行聽力小測。"),
      h("button", { class: "btn-soft w-full", onclick: () => ((ui.view = "list"), ctx.rerender({ scrollTop: true })) }, "稍後再做")
    );
  }

  function render(ctx) {
    if (ui.view === "learn") return learnScreen(ctx);
    if (ui.view === "routeStart") return startScreen(ctx);
    if (ui.view === "routeMap") return mapScreen(ctx);
    if (ui.view === "kanaLesson") return lessonScreen(ctx);
    return listScreen(ctx);
  }

  window.App.Daily = {
    render,
    reset,
    ensureToday,
    markDone,
    markLearned,
    summary,
    streakInfo,
    daysUntil,
    countdownText,
    statusOf,
    mustCounts,
    routeDays,
    routeDayOf,
    routeNewChars,
    routeKnownChars,
    routeKnownIds,
    nextRouteDay,
    applyPath,
    syncRoute,
    skipRouteDay,
    unskipRouteDay,
    openMap,
    routeDots,
    routeStatsList,
    showPrompt,
    dismissPrompt,
    openStart,
    allSentences,
    kanaPool,
    STREAK_MIN,
    TASK_KEYS,
    doneCount,
    doneFlags,
    dateLabel,
  };
})();
