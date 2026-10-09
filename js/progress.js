// 進度頁 (stage 7b): the 📊 tab.  Read-only statistics computed from the
// saved state — nothing here writes anything.
//
//   概覽 → 最近 7 天 → 五十音 → 句子庫（各情境）→ 情境對話 → 錯題重溫
//
// Definitions (see CLAUDE.md):
//   五十音「掌握」 = 答對 ≥ 2 次，而且目前不在錯題清單
//   句子「熟練」   = 聽力連續答對 ≥ 2、(你說的句子) 口語連續答對 ≥ 1、不在錯題重溫
//   句子「學習中」 = 學過／答過但未熟練；「未學」 = 完全沒碰過
window.App = window.App || {};

(function () {
  const { h, jp } = window.App.UI;
  const { Storage, Daily } = window.App;

  const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];
  const BAR_MAX_H = 72; // px

  function section(title, ...children) {
    return h("div", { class: "card accent" }, h("p", { class: "h-heading mb-2" }, title), ...children);
  }

  const stat = (value, label) => h("div", { class: "stat" }, h("span", { class: "stat-n" }, value), h("span", { class: "stat-l" }, label));

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
    const due = { p: 0, s: 0, k: 0 };
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
      "概覽",
      h("div", { class: "stat-grid" }, stat(`🔥 ${streak.current}`, "連續天數"), stat(`🏅 ${streak.best}`, "最長紀錄"), stat(`${streak.todayCount} / ${Daily.TASK_KEYS.length}`, "今日任務"), stat(String(totalAnswers(state)), "累計答題")),
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
      "最近 7 天",
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
        { class: "mb-2" },
        h("div", { class: "row-between xs muted mb-1" }, h("span", null, label), h("span", { style: { color: "var(--a-solid)" } }, `${c.done} / ${c.total}`)),
        h("div", { class: "bar accent" }, h("div", { style: { width: `${c.total ? (c.done / c.total) * 100 : 0}%` } }))
      );
    return section(
      "五十音",
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
      "句子庫",
      h("p", { class: "small mb-2" }, `共 ${total.all} 句：`, h("span", { style: { color: "var(--good)" } }, `熟練 ${total.mastered}`), `・學習中 ${total.learning}・未學 ${total.new}`),
      segBar(total),
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
      "情境對話",
      h("p", { class: "small mb-2" }, `已玩 ${played} / ${list.length} 個・一次過全對 ${perfect} / ${list.length} 個`),
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

  function reviewSection(state) {
    const r = reviewCounts(state);
    const dueTotal = r.due.p + r.due.s + r.due.k;
    return section(
      "錯題重溫",
      h("p", { class: "small" }, dueTotal > 0 ? `今天待重溫 ${dueTotal}（聽力 ${r.due.p}・口語 ${r.due.s}・五十音 ${r.due.k}）` : "今天沒有需要重溫的內容 🎉"),
      h("div", { class: "stat-grid mt-3" }, stat(String(r.active), "重溫中"), stat(String(r.graduated), "已畢業")),
      h("p", { class: "xs muted mt-2" }, "「已畢業」只計算由階段 7b 開始畢業的項目。")
    );
  }

  // ctx: { state }
  function render(ctx) {
    const { state } = ctx;
    return h("div", { class: "stack-lg" }, h("h2", { class: "h-display" }, "進度"), overview(state), weekChart(state), kanaSection(state), phraseSection(state), dialogueSection(state), reviewSection(state));
  }

  window.App.Progress = { render };
})();
