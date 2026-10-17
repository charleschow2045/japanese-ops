// 相似字分辨 (stage 10, inside the 五十音 module): groups of characters that look alike
// (シ／ツ、ソ／ン、ぬ／め …, content: KANA_LOOKALIKES in js/content/kana.js).
//   對照卡  every group side by side, tap a character to hear it, with the 分辨重點
//   練習    two kinds of question; every option comes from the SAME group, so only the
//           shape tells them apart:
//             👂 聽音選字  hear a sound, pick the character
//             👀 看字選音  see a character, pick its reading (rōmaji)
//           Characters you got wrong or answered right less than twice come up more often.
// Answers go through ctx.onAnswer, i.e. the same stats / red dots / 錯題重溫 ("k:<char>")
// as the other 五十音 quizzes. Settings live in state.kana.prefs (simScript, simGroups,
// simCount, simMode). A group with 2 characters is a 2-choice question by design.
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;
  const { KANA } = window.App.Content;

  const COUNTS = [5, 10, 20];
  const SCRIPTS = [
    { key: "hira", label: "平假名" },
    { key: "kata", label: "片假名" },
    { key: "both", label: "兩種" },
  ];
  const MODES = [
    { key: "hear", label: "👂 聽音選字" },
    { key: "see", label: "👀 看字選音" },
  ];

  // view: "main" | "quiz"; tableScript = which script the 對照卡 show (null → follows 五十音 prefs)
  const ui = { view: "main", quiz: null, scrollFeedback: false, tableScript: null };
  function reset() {
    ui.view = "main";
    ui.quiz = null;
    ui.tableScript = null;
  }

  const helpers = () => window.App.KanaModule.helpers;
  const groups = () => window.App.Content.KANA_LOOKALIKES;

  // kana id of a character (cached)
  const idCache = {};
  function idOf(script, ch) {
    const key = `${script}:${ch}`;
    if (!(key in idCache)) idCache[key] = Object.keys(KANA).find((id) => KANA[id][script] === ch) || null;
    return idCache[key];
  }
  const members = (g) => g.chars.map((ch) => ({ ch, id: idOf(g.script, ch), script: g.script }));

  // ── which groups are selected ────────────────────────────────────────

  const scriptOk = (prefs, g) => prefs.simScript === "both" || g.script === prefs.simScript;
  function selectedIds(prefs) {
    const all = groups().map((g) => g.id);
    return prefs.simGroups === null ? all : prefs.simGroups.filter((id) => all.includes(id));
  }
  const activeGroups = (prefs) => groups().filter((g) => scriptOk(prefs, g) && selectedIds(prefs).includes(g.id));

  // 掌握 = answered right 2+ times and not currently on the red-dot list (same as 進度頁)
  const isMastered = (kana, ch) => (kana.stats[ch] || { c: 0 }).c >= 2 && !kana.mistakes.includes(ch);
  const masteredOf = (kana, g) => g.chars.filter((ch) => isMastered(kana, ch)).length;

  // ── 對照卡 ───────────────────────────────────────────────────────────

  function charButton(m, settings, on) {
    return h(
      "button",
      {
        class: `sim-btn${on ? " on" : ""}`,
        "aria-label": `聽 ${m.ch}`,
        onclick: () => speak(m.ch, settings),
      },
      jp(m.ch),
      settings.showRomaji && h("span", { class: "rom" }, KANA[m.id].romaji)
    );
  }

  function groupCard(ctx, g) {
    const { settings, kana } = ctx;
    const ms = members(g);
    return h(
      "div",
      { class: "card accent sim-card mb-3" },
      h(
        "div",
        { class: "row-between mb-2" },
        h("p", { lang: "ja", class: "h-heading accent-text jp", style: { fontWeight: 700 } }, g.chars.join("／")),
        h("span", { class: "xs muted" }, `已掌握 ${masteredOf(kana, g)} / ${g.chars.length}`)
      ),
      h("div", { class: "sim-row" }, ms.map((m) => charButton(m, settings, false))),
      h("p", { class: "sim-diff" }, `💡 ${g.diff}`),
      isTTSSupported() && h("button", { class: "btn-soft w-full mt-3", onclick: () => speakSequence(g.chars, settings) }, "🔊 依次聽")
    );
  }

  // ── 練習設定 ─────────────────────────────────────────────────────────

  function settingsCard(ctx) {
    const { kana } = ctx;
    const prefs = kana.prefs;
    const tts = isTTSSupported();
    const sel = selectedIds(prefs);
    const visible = groups().filter((g) => scriptOk(prefs, g));
    const active = activeGroups(prefs);
    const questions = active.reduce((n, g) => n + g.chars.length, 0);
    const toggle = (id) => ctx.onPrefsChange({ simGroups: sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id] });
    const needTts = prefs.simMode === "hear" && !tts;

    return h(
      "div",
      { class: "card accent mb-4" },
      h("p", { class: "h-heading accent-text" }, "分辨練習"),
      h("p", { class: "xs muted mb-3" }, "每題的選項都是長得很像的同一組字，要看清楚筆畫才能選對。兩個字的組別是二選一。"),
      h("p", { class: "small mb-1" }, "文字"),
      h("div", { class: "chips-fill mb-3" }, SCRIPTS.map((s) => chip(s.label, prefs.simScript === s.key, () => ctx.onPrefsChange({ simScript: s.key })))),
      h("p", { class: "small mb-1" }, "題型"),
      h("div", { class: "chips-fill mb-3" }, MODES.map((m) => chip(m.label, prefs.simMode === m.key, () => ctx.onPrefsChange({ simMode: m.key })))),
      h("p", { class: "small mb-1" }, "題數"),
      h("div", { class: "chips-fill mb-3" }, COUNTS.map((n) => chip(`${n} 題`, prefs.simCount === n, () => ctx.onPrefsChange({ simCount: n })))),
      h(
        "div",
        { class: "row-between mb-1" },
        h("p", { class: "small" }, "練習哪幾組"),
        h(
          "span",
          { class: "row-sm" },
          h("button", { class: "btn-soft", style: { minHeight: "44px", padding: "0 12px" }, onclick: () => ctx.onPrefsChange({ simGroups: null }) }, "全選"),
          h("button", { class: "btn-soft", style: { minHeight: "44px", padding: "0 12px" }, onclick: () => ctx.onPrefsChange({ simGroups: [] }) }, "清除")
        )
      ),
      h("div", { class: "wrap" }, visible.map((g) => chip(g.chars.join("／"), sel.includes(g.id), () => toggle(g.id), { lang: "ja", class: "row-chip jp" }))),
      h(
        "p",
        { class: "xs mt-3", style: { color: active.length ? "var(--muted)" : "var(--stamp)" } },
        active.length ? `已選 ${active.length} 組，共 ${questions} 個字` : "請至少選擇一組"
      ),
      h(
        "div",
        { class: "stack mt-4" },
        inkButton("🔍 開始分辨練習", () => startQuiz(ctx), { accent: true, disabled: !active.length || needTts, class: "w-full" }),
        needTts && h("p", { class: "xs muted" }, "此瀏覽器沒有發音功能，無法使用「聽音選字」，請改選「看字選音」")
      )
    );
  }

  function mainScreen(ctx) {
    const prefs = ctx.kana.prefs;
    const script = ui.tableScript || (prefs.script === "kata" ? "kata" : "hira");
    return [
      h("p", { class: "small muted mb-4" }, "把長得很像的字放在一起比較，再用練習認清它們。"),
      settingsCard(ctx),
      h("p", { class: "h-heading mb-2" }, "對照卡"),
      h(
        "div",
        { class: "chips-fill mb-3" },
        SCRIPTS.slice(0, 2).map((s) =>
          chip(s.label, script === s.key, () => {
            ui.tableScript = s.key;
            ctx.rerender();
          })
        )
      ),
      groups()
        .filter((g) => g.script === script)
        .map((g) => groupCard(ctx, g)),
    ];
  }

  // ── 練習 ─────────────────────────────────────────────────────────────

  // Every (group, character) of the selected groups is a possible question. Each question is drawn
  // at random with a weight: wrong now (3), answered right fewer than 2 times (2), otherwise (1).
  // The same character never comes twice in a row (unless only 2 different characters are selected,
  // where forbidding repeats would make the answer predictable).
  function buildQuiz(kana) {
    const { shuffle } = helpers();
    const prefs = kana.prefs;
    const pool = [];
    activeGroups(prefs).forEach((g) => members(g).forEach((m) => pool.push({ g, m })));
    const weight = (m) => (kana.mistakes.includes(m.ch) ? 3 : (kana.stats[m.ch] || { c: 0 }).c < 2 ? 2 : 1);
    const distinct = new Set(pool.map((p) => p.m.ch)).size;
    const order = [];
    while (order.length < prefs.simCount) {
      const prev = order.length ? order[order.length - 1].m.ch : null;
      const cands = distinct >= 3 ? pool.filter((p) => p.m.ch !== prev) : pool;
      let r = Math.random() * cands.reduce((n, p) => n + weight(p.m), 0);
      order.push(cands.find((p) => (r -= weight(p.m)) < 0) || cands[cands.length - 1]);
    }
    return order.map((p) => ({ group: p.g, answer: p.m, options: shuffle(members(p.g)) }));
  }

  // Built inside the start tap so that, for 聽音選字, the first sound plays inside the same user
  // gesture (iOS requirement).
  function startQuiz(ctx) {
    ui.quiz = { mode: ctx.kana.prefs.simMode, questions: buildQuiz(ctx.kana), index: 0, picked: null, results: [] };
    ui.view = "quiz";
    if (ui.quiz.mode === "hear") speak(ui.quiz.questions[0].answer.ch, ctx.settings);
    ctx.rerender({ scrollTop: true });
  }

  function quizScreen(ctx) {
    const { settings } = ctx;
    const { romajiText, speakButton } = helpers();
    const quiz = ui.quiz;
    const hear = quiz.mode === "hear";
    const total = quiz.questions.length;
    const toMain = () => {
      ui.view = "main";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return quizResult(ctx, toMain);

    const q = quiz.questions[quiz.index];
    const answered = quiz.picked !== null;
    const correctSoFar = quiz.results.filter((r) => r.correct).length;
    const gotIt = answered && q.options[quiz.picked].ch === q.answer.ch;

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = q.options[i].ch === q.answer.ch;
      quiz.picked = i;
      quiz.results.push({ char: q.answer.ch, id: q.answer.id, correct });
      if (!hear) speak(q.answer.ch, settings);
      ui.scrollFeedback = true;
      ctx.onAnswer(q.answer.ch, correct); // same stats / red dots / 錯題重溫 as the other 五十音 quizzes; saves + rerenders
    }

    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (hear && quiz.index < total) speak(quiz.questions[quiz.index].answer.ch, settings);
      ctx.rerender({ scrollTop: true });
    }

    const prompt = hear
      ? h(
          "div",
          { class: "card accent center mb-4" },
          h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "聽聽看是哪一個字？"),
          h("button", { class: "hear-btn", onclick: () => speak(q.answer.ch, settings), "aria-label": "再聽一次" }, "🔊"),
          h("p", { class: "xs muted mt-3" }, "選項都是長得很像的字")
        )
      : h(
          "div",
          { class: "card accent center mb-4" },
          h("p", { class: "muted mb-1", style: { fontWeight: 700 } }, "這個字怎麼讀？"),
          jp(q.answer.ch, "quiz-kana"),
          h("p", { class: "xs muted mt-1" }, "選項都是長得很像的字的讀音")
        );

    const options = h(
      "div",
      { class: `opt-grid ${q.options.length === 3 ? "three" : ""}`.trim() },
      q.options.map((m, i) => {
        let state = "";
        if (answered && m.ch === q.answer.ch) state = "correct";
        else if (answered && i === quiz.picked) state = "wrong";
        else if (answered) state = "dim";
        return h("button", { class: `opt ${state}`.trim(), disabled: answered, onclick: () => pick(i) }, hear ? jp(m.ch) : KANA[m.id].romaji);
      })
    );

    let feedback = null;
    if (answered) {
      const autoscroll = ui.scrollFeedback;
      ui.scrollFeedback = false;
      feedback = h(
        "div",
        { class: "card mt-4 feedback", "data-autoscroll": autoscroll ? "end" : null },
        window.App.Feedback.banner(gotIt),
        !gotIt && h("p", { class: "caption fb-lead" }, "答案是："),
        h("div", { class: "row mt-1" }, jp(q.answer.ch, "fb-kana"), h("div", null, settings.showRomaji && h("p", { class: "big-rom", style: { fontSize: "1.25rem" } }, romajiText(q.answer.id)))),
        h("p", { class: "caption mt-3 mb-1" }, "並排對照（按字可聽發音）"),
        h("div", { class: "sim-row" }, members(q.group).map((m) => charButton(m, settings, m.ch === q.answer.ch))),
        h("p", { class: "sim-diff" }, `💡 ${q.group.diff}`),
        h("div", { class: "row-sm mt-4" }, speakButton(q.answer.ch, settings, "再聽", "grow")),
        inkButton(quiz.index + 1 < total ? "下一題 →" : "查看結果", next, { class: "w-full mt-3" })
      );
    }

    return [
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${total} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `答對 ${correctSoFar} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / total) * 100}%` } })),
      prompt,
      options,
      feedback,
    ];
  }

  function quizResult(ctx, toMain) {
    const { settings } = ctx;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const score = quiz.results.filter((r) => r.correct).length;
    const wrong = quiz.results.filter((r) => !r.correct);
    return h(
      "div",
      { class: "card accent center" },
      window.App.Feedback.hero(score, total),
      h("p", { class: "score" }, `${score} / ${total}`),
      h("p", { class: "muted mt-1", style: { fontWeight: 700 } }, score === total ? "全對！眼力很好！" : score >= total * 0.7 ? "不錯！多看幾次就能認清了" : "慢慢來，回到對照卡看看分辨重點"),
      wrong.length > 0 &&
        h(
          "div",
          { class: "mt-4", style: { textAlign: "left" } },
          h("p", { class: "caption mb-2" }, "答錯的字（按一下可聽發音，已加入錯題重溫）"),
          h(
            "div",
            { class: "wrap", style: { gap: "8px" } },
            wrong.map((r) => h("button", { class: "wrong-chip", onclick: () => speak(r.char, settings) }, jp(r.char), h("span", { class: "r" }, KANA[r.id].romaji)))
          )
        ),
      h("div", { class: "stack mt-4" }, inkButton("再來一輪", () => startQuiz(ctx), { class: "w-full" }), inkButton("返回對照卡", toMain, { accent: true, class: "w-full" }))
    );
  }

  // ── entry ────────────────────────────────────────────────────────────

  // ctx: the 五十音 ctx ({ settings, kana, onPrefsChange, onAnswer, rerender }); back: leave to the 五十音 menu
  function render(ctx, back) {
    const inQuiz = ui.view === "quiz" && ui.quiz;
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader(inQuiz ? "分辨練習" : "相似字分辨", inQuiz ? () => ((ui.view = "main"), (ui.quiz = null), ctx.rerender({ scrollTop: true })) : back),
      !inQuiz && notice && h("div", { class: "mb-4" }, notice),
      !inQuiz && window.App.Help.card("lookalike"),
      inQuiz ? quizScreen(ctx) : mainScreen(ctx)
    );
  }

  // `buildQuiz` / `activeGroups` are exposed for the automated tests.
  window.App.Lookalike = { render, reset, activeGroups, buildQuiz };
})();
