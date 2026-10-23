// 進度頁 (stage 7b): the 📊 tab.  Read-only statistics computed from the
// saved state — nothing here writes anything.
//
//   概覽 → 旅行準備度 → 最近 7 天 → 五十音 → 句子庫（各情境）→ 情境對話 → 錯題重溫
//
// Definitions (see CLAUDE.md):
//   五十音「掌握」 = 答對 ≥ 2 次，而且目前不在錯題清單
//   句子「熟練」   = 聽力連續答對 ≥ 2、(你說的句子) 口語連續答對 ≥ 1、不在錯題重溫
//   句子「學習中」 = 學過／答過但未熟練；「未學」 = 完全沒碰過
window.App = window.App || {};

(function () {
  const { h, jp, accentVars } = window.App.UI;
  const { Storage, Daily } = window.App;

  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
  const BAR_MAX_H = 72; // px

  // Each section has its own module colour (accent key), like the module pages themselves.
  function section(title, accent, ...children) {
    return h("div", { class: "card accent", style: accentVars(accent) }, h("p", { class: "h-heading accent-text mb-3" }, title), ...children);
  }

  // Big number tile (版本三) in its own colour.
  const stat = (value, label, accent) => h("div", { class: "stat", style: accentVars(accent) }, h("span", { class: "stat-n" }, value), h("span", { class: "stat-l" }, label));

  // ── numbers ──────────────────────────────────────────────────────────

  function totalAnswers(state) {
    const sum = (stats) => Object.values(stats).reduce((n, s) => n + (s.c || 0) + (s.w || 0), 0);
    return sum(state.kana.stats) + sum(state.listen.stats) + sum(state.speak.stats);
  }

  function sentenceCounts(state) {
    const scenes = window.App.Content.PHRASE_SCENES;
    const rows = scenes.map((s) => ({ scene: s, mastered: 0, learning: 0, new: 0 }));
    Daily.allSentences().forEach((x) => {
      rows[x.si][Daily.statusOf(state, x)] += 1;
    });
    const total = rows.reduce((t, r) => ({ mastered: t.mastered + r.mastered, learning: t.learning + r.learning, new: t.new + r.new }), { mastered: 0, learning: 0, new: 0 });
    return { rows, total: { ...total, all: total.mastered + total.learning + total.new } };
  }

  function kanaCounts(state) {
    const { KANA } = window.App.Content;
    const out = { hira: { done: 0, total: 0 }, kata: { done: 0, total: 0 } };
    Object.values(KANA).forEach((k) => {
      ["hira", "kata"].forEach((sc) => {
        const ch = k[sc];
        if (!ch) return;
        out[sc].total += 1;
        const st = state.kana.stats[ch];
        if (st && st.c >= 2 && !state.kana.mistakes.includes(ch)) out[sc].done += 1;
      });
    });
    // 待加強: currently wrong first, then answered wrong more often than right
    const weakStats = Object.entries(state.kana.stats)
      .filter(([ch, st]) => st.w > st.c && !state.kana.mistakes.includes(ch))
      .map(([ch]) => ch);
    out.weak = [...state.kana.mistakes, ...weakStats].slice(0, 16);
    return out;
  }

  function reviewCounts(state) {
    const today = Storage.todayLocal();
    const due = { p: 0, s: 0, k: 0, n: 0, w: 0, r: 0 };
    Object.entries(state.review.items).forEach(([key, it]) => {
      if (it.due <= today && due[key[0]] !== undefined) due[key[0]] += 1;
    });
    return { due, active: Object.keys(state.review.items).length, graduated: state.review.graduated || 0 };
  }

  // ── sections ─────────────────────────────────────────────────────────

  function overview(state) {
    const streak = Daily.streakInfo(state);
    const countdown = Daily.countdownText(state);
    const left = Daily.daysUntil(state.settings.travelDate);
    const sc = sentenceCounts(state);
    const seen = sc.total.mastered + sc.total.learning;
    const perDay = state.settings.dailyNew;
    return section(
      "📊 概覽",
      "daily",
      h(
        "div",
        { class: "stat-grid" },
        stat(String(streak.current), "🔥 連續天數", "daily"),
        stat(String(streak.best), "🏅 最長紀錄", "show"),
        stat(`${streak.todayCount}/${Daily.TASK_KEYS.length}`, "⭐ 今日任務", "dialogue"),
        stat(String(totalAnswers(state)), "✏️ 累計答題", "numbers")
      ),
      countdown && h("p", { class: "small mt-3" }, countdown),
      left !== null &&
        left > 0 &&
        sc.total.new > 0 &&
        h(
          "p",
          { class: "xs muted mt-1" },
          `按每日 ${perDay} 句計算，出發前可學完約 ${Math.min(sc.total.all, seen + perDay * left)} / ${sc.total.all} 句（只計「今日新句子」）。`
        ),
      !state.settings.travelDate && h("p", { class: "xs muted mt-3" }, "在「設定 → 學習目標」輸入旅行日期，這裏會顯示倒數。")
    );
  }

  function weekChart(state) {
    const today = Storage.todayLocal();
    const days = [];
    for (let i = 6; i >= 0; i--) days.push(Storage.addDaysLocal(today, -i));
    const act = (d) => (state.daily.activity[d] || { a: 0 }).a;
    const max = Math.max(10, ...days.map(act));
    return section(
      "📅 最近 7 天",
      "daily",
      h(
        "div",
        { class: "week" },
        days.map((d) => {
          const a = act(d);
          const n = Daily.doneCount(state.daily.days[d]);
          const [y, m, dd] = d.split("-").map(Number);
          return h(
            "div",
            { class: `week-col ${d === today ? "today" : ""}`.trim() },
            h("span", { class: "week-n" }, a > 0 ? String(a) : ""),
            h("div", { class: `week-bar ${a > 0 ? "on" : ""}`.trim(), style: { height: `${Math.max(4, Math.round((a / max) * BAR_MAX_H))}px` } }),
            h("span", { class: "week-mark" }, n >= Daily.TASK_KEYS.length ? "★" : n >= Daily.STREAK_MIN ? "✓" : "·"),
            h("span", { class: "week-d" }, WEEKDAY[new Date(y, m - 1, dd).getDay()])
          );
        })
      ),
      h("p", { class: "xs muted mt-2" }, `長條 = 當天答題數。✓ = 完成 ${Daily.STREAK_MIN} 項以上（計入連續天數），★ = 全部完成。`)
    );
  }

  function kanaSection(state) {
    const k = kanaCounts(state);
    const row = (label, c) =>
      h(
        "div",
        { class: "mb-3" },
        h("div", { class: "big-count" }, String(c.done), h("small", null, `/ ${c.total}`)),
        h("div", { class: "xs muted mb-1" }, label),
        h("div", { class: "bar accent" }, h("div", { style: { width: `${c.total ? (c.done / c.total) * 100 : 0}%` } }))
      );
    return section(
      "あ 五十音",
      "kana",
      row("平假名掌握（含濁音、拗音）", k.hira),
      row("片假名掌握（含濁音、拗音、外來語音）", k.kata),
      h("p", { class: "xs muted" }, "「掌握」= 答對 2 次或以上，而且目前不在錯題清單。"),
      k.weak.length > 0 &&
        h(
          "div",
          { class: "mt-3" },
          h("p", { class: "small mb-1" }, "待加強（按一下可聽發音）"),
          h(
            "div",
            { class: "wrap", style: { gap: "8px" } },
            k.weak.map((ch) => h("button", { class: "wrong-chip", onclick: () => window.App.Speech.speak(ch, state.settings) }, jp(ch)))
          )
        )
    );
  }

  function segBar(c) {
    const all = c.mastered + c.learning + c.new || 1;
    return h(
      "div",
      { class: "seg", role: "img", "aria-label": `熟練 ${c.mastered}、學習中 ${c.learning}、未學 ${c.new}` },
      h("i", { class: "m", style: { width: `${(c.mastered / all) * 100}%` } }),
      h("i", { class: "l", style: { width: `${(c.learning / all) * 100}%` } })
    );
  }

  function phraseSection(state) {
    const { rows, total } = sentenceCounts(state);
    return section(
      "💬 句子庫",
      "phrases",
      h("p", { class: "small mb-2" }, `共 ${total.all} 句`),
      h("div", { class: "stat-grid three mb-3" }, stat(String(total.mastered), "熟練", "dialogue"), stat(String(total.learning), "學習中", "show"), stat(String(total.new), "未學", "phrases")),
      segBar(total),
      h(
        "p",
        { class: "small mt-2" },
        `📌 必學 30 句：熟練 ${window.App.Daily.mustCounts(state).mastered} / ${window.App.Daily.mustCounts(state).total}`
      ),
      h(
        "div",
        { class: "stack mt-3" },
        rows.map((r) =>
          h(
            "div",
            null,
            h("div", { class: "row-between xs mb-1" }, h("span", null, `${r.scene.emoji} ${r.scene.label}`), h("span", { class: "muted" }, `熟練 ${r.mastered}・學習中 ${r.learning}・未學 ${r.new}`)),
            segBar(r)
          )
        )
      ),
      h("p", { class: "xs muted mt-3" }, "熟練 = 聽力連續答對 2 次、（你說的句子）口語答對過，而且不在錯題重溫中。學習中 = 學過或答過但未熟練。")
    );
  }

  function dialogueSection(state) {
    const list = window.App.Content.DIALOGUES;
    const stats = state.dialogue.stats;
    const played = list.filter((d) => stats[d.id] && stats[d.id].plays > 0).length;
    const perfect = list.filter((d) => stats[d.id] && stats[d.id].perfect > 0).length;
    return section(
      "🛎️ 情境對話",
      "dialogue",
      h("div", { class: "stat-grid mb-3" }, stat(`${played}/${list.length}`, "已玩", "dialogue"), stat(`${perfect}/${list.length}`, "一次過全對 ⭐", "show")),
      h(
        "div",
        { class: "stack-sm" },
        list.map((d) => {
          const st = stats[d.id];
          return h(
            "div",
            { class: "row-between small" },
            h("span", null, `${d.emoji} ${d.title}`),
            h("span", { class: "muted xs" }, st && st.plays ? `玩 ${st.plays} 次・最佳 ${st.best}%${st.perfect ? " ⭐" : ""}` : "未玩過")
          );
        })
      )
    );
  }

  function readingSection(state) {
    const c = window.App.Reading.counts(state);
    return section(
      "🪧 看得懂",
      "reading",
      h("div", { class: "stat-grid three" }, stat(`${c.known}/${c.total}`, "認得的片假名詞", "reading"), stat(String(c.learning), "學習中", "listening"), stat(String(c.unseen), "未練習", "show")),
      h("p", { class: "small mt-3" }, `🍜 餐牌：認得 ${window.App.Reading.menuCounts(state).known} / ${window.App.Reading.menuCounts(state).total} 行`),
      h("p", { class: "xs muted mt-2" }, "「認得」＝答對 2 次以上，而且不在重溫清單。")
    );
  }

  function reviewSection(state) {
    const r = reviewCounts(state);
    const dueTotal = r.due.p + r.due.s + r.due.k + r.due.n + r.due.w + r.due.r;
    return section(
      "📝 錯題重溫",
      "listening",
      h("div", { class: "stat-grid three" }, stat(String(dueTotal), "今天待重溫", "speaking"), stat(String(r.active), "重溫中", "listening"), stat(String(r.graduated), "已畢業", "dialogue")),
      h("p", { class: "small mt-3" }, dueTotal > 0 ? `今天待重溫 ${dueTotal}（聽力 ${r.due.p}・口語 ${r.due.s}・五十音 ${r.due.k}・數字 ${r.due.n}・換字 ${r.due.w}・看得懂 ${r.due.r}）` : "今天沒有需要重溫的內容 🎉"),
      h("p", { class: "xs muted mt-2" }, "「已畢業」只計算由階段 7b 開始畢業的項目。")
    );
  }

  // One-line numbers for the backup confirmation screen (js/backup.js).
  function summary(state) {
    const streak = Daily.streakInfo(state);
    const sc = sentenceCounts(state);
    const k = kanaCounts(state);
    const list = window.App.Content.DIALOGUES;
    return {
      streak: streak.current,
      best: streak.best,
      answers: totalAnswers(state),
      mastered: sc.total.mastered,
      sentences: sc.total.all,
      kanaDone: k.hira.done + k.kata.done,
      kanaTotal: k.hira.total + k.kata.total,
      dialogues: list.filter((d) => state.dialogue.stats[d.id] && state.dialogue.stats[d.id].plays > 0).length,
      reviewActive: Object.keys(state.review.items).length,
    };
  }

  // 備份提醒: a quiet line, only once there is something worth protecting.
  function backupNudge(ctx) {
    const text = window.App.Backup.reminder(ctx.state);
    if (!text) return null;
    return h("div", { class: "note gold" }, h("p", null, `💾 ${text}`), ctx.onOpenBackup && h("button", { class: "btn-soft w-full mt-2", onclick: ctx.onOpenBackup }, "前往進度備份"));
  }

  // The numbers behind the 結業 card (js/daily.js) and the route section below.
  function routeStats(state) {
    const k = kanaCounts(state);
    const sc = sentenceCounts(state);
    const list = window.App.Content.DIALOGUES;
    return {
      must: Daily.mustCounts(state),
      hira: k.hira,
      kata: k.kata,
      sentences: { mastered: sc.total.mastered, all: sc.total.all },
      dialogues: { played: list.filter((d) => state.dialogue.stats[d.id] && state.dialogue.stats[d.id].plays > 0).length, total: list.length },
    };
  }

  // 30 日入門路線: only shown once the route was started (or has any done / skipped day).
  function routeSection(ctx) {
    const { state } = ctx;
    const p = state.path;
    const doneN = Object.keys(p.doneDays).length;
    const skipN = Object.keys(p.skipDays || {}).length;
    if (p.mode !== "route" && doneN + skipN === 0) return null;
    const total = Daily.routeDays().length;
    const next = Daily.nextRouteDay(state);
    const plan = state.daily.days[Storage.todayLocal()];
    const todayDay = p.mode === "route" && plan && plan.routeDay ? plan.routeDay : null;
    const rd = Daily.routeDayOf(todayDay || next || 0);
    return section(
      "🗾 30 日入門路線",
      "daily",
      next === null
        ? [h("p", { class: "small mb-2" }, "🎉 已結業"), Daily.routeStatsList(state)]
        : [
            h("p", { class: "small" }, rd ? `第 ${rd.day} / ${total} 天・${rd.title}` : `共 ${total} 天`),
            Daily.routeDots(state, todayDay),
            h("p", { class: "xs muted mt-2" }, `已完成 ${doneN} 天${skipN ? `・略過 ${skipN} 天` : ""}${p.mode === "route" ? "" : "・目前是自由模式"}`),
          ],
      ctx.onOpenRouteMap && h("button", { class: "btn-soft w-full mt-3", onclick: ctx.onOpenRouteMap }, "📍 路線地圖")
    );
  }

  // ctx: { state, onOpenBackup, onOpenRouteMap }
  // ── 旅行準備度 (stage 10 ⑧) ──────────────────────────────────────────
  // A read-only checklist (no single score): 16 items in 4 groups, each with a target, a state
  // (done ✓ / doing ◐ / todo ○), a progress bar, and — when not done — a hint and a 「前往」 button
  // (`go` is opened by app.js openExtra; 返回 comes back to this page).
  // The targets are this app's own reference, not a test of ability (the card says so).
  const READY_SCENE = { restaurant: "餐廳", transport: "交通", emergency: "緊急情況" };
  const READY_DIALOGUES = ["ramen", "station", "taxi", "hotel", "directions", "emergency", "airport"]; // 重點對話
  const READY_RATIO = { key: 0.4, other: 0.25, hira: 0.8, kata: 0.6 };
  const NUM_MIN = 20; // questions answered
  const NUM_ACC = 0.8; // answer rate
  const BACKUP_DAYS = 7;

  const HINT = {
    must: "先練「必學 30 句」：句子庫 → 📌 必學 30 句，再用聽力和口語各練幾次。",
    restaurant: "多練餐廳句子，或玩「拉麵店」「快餐店」對話。",
    transport: "多練交通句子，或玩「車站」「的士」對話。",
    emergency: "多練緊急情況句子，並記住日本緊急電話：報警 110、火警及救護車 119。",
    other: "每天完成每日任務，新句子會逐個情境輪流出現。",
    hira: "用五十音的「看字選音」「聽音選字」練習，或跟著 30 日路線。",
    kata: "用五十音的「看字選音」「聽音選字」練習，或跟著 30 日路線。",
    words: "到「看得懂」練習片假名詞。",
    menu: "到「看得懂」做「看餐牌練習」。",
    yen: "到「數字・價錢」做數字聽力（價錢）。",
    time: "到「數字・價錢」做數字聽力（時間）。",
    date: "到「數字・價錢」做數字聽力（日期）。",
    hotel: "在「指給店員看」填寫酒店名稱、地址和電話。",
    travel: "到設定輸入旅行日期，會顯示倒數。",
  };

  // numbers stats of a few kinds together → { n, acc }
  function numberStat(state, kinds) {
    let c = 0;
    let w = 0;
    kinds.forEach((k) => {
      const s = state.numbers.stats[k];
      if (s) {
        c += s.c || 0;
        w += s.w || 0;
      }
    });
    return { n: c + w, acc: c + w ? c / (c + w) : 0 };
  }

  function readiness(state) {
    const { PHRASE_SCENES, DIALOGUES } = window.App.Content;
    const sc = sentenceCounts(state);
    const kana = kanaCounts(state);
    const must = Daily.mustCounts(state);
    const reading = window.App.Reading.counts(state);
    const menus = window.App.Reading.menuCounts(state);
    const items = [];
    const add = (group, id, label, value, target, detail, hint, go, extra = {}) => {
      const done = extra.done !== undefined ? extra.done : value >= target;
      const pct = extra.pct !== undefined ? extra.pct : target ? Math.min(1, value / target) : 0;
      items.push({ group, id, label, value, target, pct, done, status: done ? "done" : pct > 0 ? "doing" : "todo", detail, hint: done ? null : hint, go, ...extra });
    };
    const ratioTarget = (total, r) => Math.ceil(total * r);

    // 🗣️ 說得出、聽得懂
    add("say", "must", "📌 必學 30 句熟練", must.mastered, 24, `熟練 ${must.mastered} / ${must.total}（目標 24）`, HINT.must, "phrases:must");
    Object.keys(READY_SCENE).forEach((key) => {
      const r = sc.rows.find((x) => x.scene.key === key);
      const t = ratioTarget(r.mastered + r.learning + r.new, READY_RATIO.key);
      add("say", key, `${r.scene.emoji} ${READY_SCENE[key]}句子熟練`, r.mastered, t, `熟練 ${r.mastered} / ${r.mastered + r.learning + r.new}（目標 ${t}）`, HINT[key], "phrases");
    });
    const others = sc.rows.filter((r) => !READY_SCENE[r.scene.key]);
    const oMastered = others.reduce((n, r) => n + r.mastered, 0);
    const oTotal = others.reduce((n, r) => n + r.mastered + r.learning + r.new, 0);
    const oTarget = ratioTarget(oTotal, READY_RATIO.other);
    add("say", "other", `💬 其他 ${others.length} 個情境句子熟練`, oMastered, oTarget, `熟練 ${oMastered} / ${oTotal}（目標 ${oTarget}）`, HINT.other, "daily");
    const played = READY_DIALOGUES.filter((id) => (state.dialogue.stats[id] || { plays: 0 }).plays > 0);
    const unplayed = READY_DIALOGUES.filter((id) => !played.includes(id)).map((id) => DIALOGUES.find((d) => d.id === id).title);
    add("say", "dialogues", "🛎️ 重點對話玩過", played.length, READY_DIALOGUES.length, `玩過 ${played.length} / ${READY_DIALOGUES.length}（拉麵店、車站、的士、酒店、問路、緊急、機場）`, `還沒玩的重點對話：${unplayed.join("、")}。`, "dialogue");

    // 🔤 認得出
    const hT = ratioTarget(kana.hira.total, READY_RATIO.hira);
    const kT = ratioTarget(kana.kata.total, READY_RATIO.kata);
    add("read", "hira", "あ 平假名掌握", kana.hira.done, hT, `掌握 ${kana.hira.done} / ${kana.hira.total}（目標 ${hT}）`, HINT.hira, "kana");
    add("read", "kata", "ア 片假名掌握", kana.kata.done, kT, `掌握 ${kana.kata.done} / ${kana.kata.total}（目標 ${kT}）`, HINT.kata, "kana");
    add("read", "words", "🪧 認得的片假名詞", reading.known, 60, `認得 ${reading.known} / ${reading.total}（目標 60）`, HINT.words, "reading");
    add("read", "menu", "🍜 認得的餐牌行", menus.known, 15, `認得 ${menus.known} / ${menus.total}（目標 15）`, HINT.menu, "reading");

    // 🔢 數字
    [
      ["yen", "💴 價錢", ["yen"]],
      ["time", "🕐 時間", ["time", "fun"]],
      ["date", "📅 日期", ["month", "day", "date"]],
    ].forEach(([id, label, kinds]) => {
      const s = numberStat(state, kinds);
      const done = s.n >= NUM_MIN && s.acc >= NUM_ACC;
      const pct = Math.min(1, s.n / NUM_MIN) * (s.n >= NUM_MIN ? Math.min(1, s.acc / NUM_ACC) : 1);
      add("num", id, `${label}（數字聽力）`, s.n, NUM_MIN, s.n ? `已答 ${s.n} 題・答對率 ${Math.round(s.acc * 100)}%（目標：答 ${NUM_MIN} 題以上、答對率 ${Math.round(NUM_ACC * 100)}% 以上）` : `還沒練習（目標：答 ${NUM_MIN} 題以上、答對率 ${Math.round(NUM_ACC * 100)}% 以上）`, HINT[id], "numbers", { done, pct, acc: s.acc });
    });

    // 🎒 旅行前準備
    const saved = state.show.saved;
    const filled = [saved.hotelName, saved.hotelAddress, saved.hotelTel].filter((x) => typeof x === "string" && x.trim()).length;
    add("prep", "hotel", "🏨 酒店資料已填", filled, 3, `已填 ${filled} / 3 欄（名稱、地址、電話）`, HINT.hotel, "show");
    const last = state.backup && state.backup.lastExportAt;
    const ago = last ? Storage.daysBetween(Storage.localDateOf(last), Storage.todayLocal()) : null;
    const backedUp = ago !== null && ago <= BACKUP_DAYS;
    add("prep", "backup", `💾 ${BACKUP_DAYS} 天內備份過`, backedUp ? 1 : 0, 1, ago === null ? "還沒有備份過" : ago === 0 ? "今天已備份" : `上次備份：${ago} 天前`, ago === null ? "到設定匯出進度備份（還沒有備份過）。" : `到設定匯出進度備份（超過 ${BACKUP_DAYS} 天沒有備份）。`, "backup", { done: backedUp, pct: backedUp ? 1 : 0 });
    const left = Daily.daysUntil(state.settings.travelDate);
    add("prep", "travel", "✈️ 旅行日期已設定", left === null ? 0 : 1, 1, left === null ? "還沒有設定" : left < 0 ? `旅行日期 ${state.settings.travelDate}（已過，可到設定更新）` : left === 0 ? `旅行日期 ${state.settings.travelDate}（今天！）` : `旅行日期 ${state.settings.travelDate}（還有 ${left} 天）`, HINT.travel, "settings", { done: left !== null, pct: left === null ? 0 : 1 });

    const GROUPS = [
      { key: "say", title: "🗣️ 說得出、聽得懂" },
      { key: "read", title: "🔤 認得出" },
      { key: "num", title: "🔢 數字" },
      { key: "prep", title: "🎒 旅行前準備" },
    ];
    const groups = GROUPS.map((g) => ({ ...g, items: items.filter((x) => x.group === g.key) }));
    const reached = items.filter((x) => x.done).length;
    return { items, groups, reached, total: items.length, next: items.find((x) => !x.done) || null };
  }

  const readyUi = { closed: new Set() }; // groups collapsed during this session (not saved)
  const STATUS_ICO = { done: "✓", doing: "◐", todo: "○" };

  function readySection(ctx) {
    const r = readiness(ctx.state);
    const go = (it) => ctx.onOpenGo && ctx.onOpenGo(it.go);
    const goBtn = (it, cls) => ctx.onOpenGo && h("button", { class: `btn-soft ready-go ${cls || ""}`.trim(), onclick: () => go(it), "aria-label": `前往：${it.label}` }, "前往 →");
    const row = (it) =>
      h(
        "div",
        { class: `ready-row st-${it.status}` },
        h("span", { class: "ready-ico", "aria-label": { done: "已達標", doing: "進行中", todo: "未開始" }[it.status] }, STATUS_ICO[it.status]),
        h(
          "div",
          { class: "ready-main" },
          h("p", { class: "ready-label" }, it.label),
          h("p", { class: "xs muted" }, it.detail),
          h("div", { class: "bar accent mt-1" }, h("div", { style: { width: `${Math.round(it.pct * 100)}%` } })),
          it.hint && h("p", { class: "xs mt-1" }, it.hint),
          it.hint && goBtn(it, "mt-2")
        )
      );
    return section(
      "🧳 旅行準備度",
      "daily",
      h("p", { class: "ready-total" }, `已達標 ${r.reached} / ${r.total} 項`),
      r.next &&
        h(
          "div",
          { class: "note gold mt-2" },
          h("p", null, `建議先做：${r.next.label}`),
          h("p", { class: "xs mt-1" }, r.next.hint),
          goBtn(r.next, "w-full mt-2")
        ),
      !r.next && h("p", { class: "note gold mt-2" }, "🎉 清單上的項目全部達標了！祝旅途愉快！"),
      h(
        "div",
        { class: "stack mt-3" },
        r.groups.map((g) => {
          const open = !readyUi.closed.has(g.key);
          const ok = g.items.filter((x) => x.done).length;
          return h(
            "div",
            { class: "ready-group" },
            h(
              "button",
              {
                class: "ready-head",
                "aria-expanded": open ? "true" : "false",
                onclick: () => {
                  if (open) readyUi.closed.add(g.key);
                  else readyUi.closed.delete(g.key);
                  ctx.rerender && ctx.rerender();
                },
              },
              h("span", { class: "grow" }, g.title),
              h("span", { class: "xs muted" }, `${ok} / ${g.items.length}`),
              h("span", { "aria-hidden": "true" }, open ? "▴" : "▾")
            ),
            open && h("div", { class: "stack-sm mt-2" }, g.items.map(row))
          );
        })
      ),
      h("p", { class: "xs muted mt-3" }, "「旅行準備度」是本 App 自訂的參考清單，不是能力測驗；目標只供參考，可以自己斟酌。")
    );
  }

  function render(ctx) {
    const { state } = ctx;
    return h("div", { class: "stack-lg" }, h("h2", { class: "h-display" }, "進度"), backupNudge(ctx), overview(state), readySection(ctx), routeSection(ctx), weekChart(state), kanaSection(state), phraseSection(state), dialogueSection(state), readingSection(state), reviewSection(state));
  }

  window.App.Progress = { render, summary, routeStats, readiness };
})();
