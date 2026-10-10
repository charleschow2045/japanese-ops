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
// The sessions themselves are the existing 聽力／口語／對話 screens: this
// module only decides what to ask and hands a "task" spec to app.js
// (ctx.onLaunch), which opens the module and returns here afterwards.
window.App = window.App || {};

(function () {
  const { h, inkButton, modHeader } = window.App.UI;
  const { Storage } = window.App;

  const STREAK_MIN = 3; // tasks needed for a day to count towards the streak
  const TASK_KEYS = ["review", "new", "speak", "dialogue", "kana"];
  const SPEAK_COUNT = 3;
  const KANA_COUNT = 5;
  const KEEP_DAYS = 365;

  // view: "list" | "learn"
  const ui = { view: "list" };
  function reset() {
    ui.view = "list";
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
  function pickSpeak(state, newIds) {
    const mine = allSentences().filter((x) => x.mine && !state.flags.includes(x.p.id));
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
    if (Object.keys(done).length !== Object.keys(day.done).length) {
      daily = { ...daily, days: { ...daily.days, [today]: { ...day, done } } };
      changed = true;
    }
    return changed ? { ...state, daily } : state;
  }

  // ── state changes ────────────────────────────────────────────────────

  function markDone(state, date, key) {
    const day = state.daily.days[date];
    if (!day || day.done[key]) return state;
    return { ...state, daily: { ...state.daily, days: { ...state.daily.days, [date]: { ...day, done: { ...day.done, [key]: true } } } } };
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
    const order = dialogueOrder(state, null);
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

  function firstUndone(day) {
    const f = doneFlags(day);
    return TASK_KEYS.find((k) => !f[k]) || null;
  }

  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
  function dateLabel(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return `${m}月${d}日（${WEEKDAY[new Date(y, m - 1, d).getDay()]}）`;
  }

  // For the 主頁 card.
  function summary(state) {
    const day = state.daily.days[Storage.todayLocal()];
    const streak = streakInfo(state);
    const next = day ? firstUndone(day) : null;
    return { count: doneCount(day), total: TASK_KEYS.length, streak, next, nextTitle: next ? TITLES[next] : null, countdown: countdownText(state) };
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
      else if (key === "kana") ctx.onLaunch({ key: "kana", module: "listening", mode: "practice", kana: day.kanaChars, title: "五十音熱身" });
    };
    const startBtn = (key, done, label, opts = {}) =>
      done
        ? h("button", { class: `btn-soft ${opts.class || "w-full"}`.trim(), onclick: () => launch(key), disabled: opts.disabled }, "再練一次")
        : inkButton(label || "開始", () => launch(key), { accent: true, class: opts.class || "w-full", disabled: opts.disabled });

    const reviewSub = (done) =>
      done ? "已完成" : dueL + dueS > 0 ? `今天待重溫：聽力 ${dueL}（含五十音、數字）・口語 ${dueS}` : "今天沒有需要重溫的內容";
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
        h("div", { class: "card center", style: { background: "var(--good-tint)", borderColor: "var(--good-solid)" } }, h("p", { style: { fontSize: "2rem" } }, "🎉"), h("p", { class: "h-heading" }, "今天的任務全部完成！"), h("p", { class: "small muted mt-1" }, "明天再來。想多練習的話，也可以隨時重做任何一項。")),

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
        flags.new ? "已完成" : "先逐句學習，再做一個小測・約 4 分鐘",
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
      taskCard(
        flags.dialogue,
        4,
        `今日對話：${dlg ? `${dlg.emoji} ${dlg.title}` : ""}`,
        flags.dialogue ? "已完成" : "和店員一問一答・約 4 分鐘",
        h(
          "div",
          { class: "row-sm mt-3" },
          startBtn("dialogue", flags.dialogue, "開始對話", { class: "grow" }),
          !flags.dialogue && h("button", { class: "btn-soft", onclick: () => ctx.onUpdate(swapDialogue) }, "換一個")
        )
      ),

      // ⑤ kana warm-up
      taskCard(
        flags.kana,
        5,
        "五十音熱身",
        flags.kana ? "已完成" : `聽音選字 ${day.kanaChars.length} 題（取自「五十音」頁選擇的行）・約 2 分鐘`,
        day.kanaChars.length > 0 && startBtn("kana", flags.kana, "開始熱身", { class: "w-full mt-3", disabled: !tts })
      ),

      !tts && h("p", { class: "notice" }, "此瀏覽器沒有發音功能，聽力類任務無法使用。"),

      next && inkButton(`繼續：${TITLES[next]}`, () => launch(nextKey), { class: "w-full", disabled: !!nextKey && (nextKey === "reviewL" || nextKey === "kana") && !tts })
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
          window.App.Phrases.sentenceCard(x.p, { settings: ctx.settings, flags: ctx.flags, onToggleFlag: ctx.onToggleFlag })
        )
      ),
      inkButton(tts ? `開始小測（${items.length} 題）` : "返回", tts ? start : () => ((ui.view = "list"), ctx.rerender({ scrollTop: true })), { accent: true, class: "w-full" }),
      !tts && h("p", { class: "xs muted center" }, "此瀏覽器沒有發音功能，無法進行聽力小測。"),
      h("button", { class: "btn-soft w-full", onclick: () => ((ui.view = "list"), ctx.rerender({ scrollTop: true })) }, "稍後再做")
    );
  }

  function render(ctx) {
    return ui.view === "learn" ? learnScreen(ctx) : listScreen(ctx);
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
    allSentences,
    kanaPool,
    STREAK_MIN,
    TASK_KEYS,
    doneCount,
    doneFlags,
    dateLabel,
  };
})();
