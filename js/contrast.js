// 清濁對比 (inside the 五十音 module): a contrast table of 清音／濁音／半濁音
// sets (か／が, は／ば／ぱ …) that read out in sequence, plus a 10-question
// 分辨練習: hear one kana, pick which member of its set it was.
//
// Sets are derived from KANA_ROWS (row ka ↔ ga, sa ↔ za, ta ↔ da,
// ha ↔ ba ↔ pa, same vowel position), so no kana data is duplicated.
// Answers go through ctx.onAnswer, i.e. the same stats/mistakes as the
// other 五十音 quizzes (red dots, 答啱過 count).
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;
  const { KANA, KANA_ROWS } = window.App.Content;

  const CATEGORIES = ["清音", "濁音", "半濁音"]; // by member position
  const CONTRAST_ROWS = [
    { key: "ka", rows: ["ka", "ga"] },
    { key: "sa", rows: ["sa", "za"] },
    { key: "ta", rows: ["ta", "da"], note: "ぢ、づ 好少用，讀音同 じ、ず 一樣" },
    { key: "ha", rows: ["ha", "ba", "pa"] },
  ];

  const rowCells = (key) => KANA_ROWS.find((r) => r.key === key).cells;

  // The 5 sets of a contrast row: [[ka, ga], [ki, gi], …] (kana ids).
  function setsOf(crow) {
    return [0, 1, 2, 3, 4].map((i) => crow.rows.map((r) => rowCells(r)[i]));
  }

  function tableScript(prefs) {
    return prefs.script === "kata" ? "kata" : "hira";
  }

  function rowTitle(crow, script) {
    return crow.rows.map((r) => `${KANA[rowCells(r)[0]][script]}行`).join(" ／ ");
  }

  // view: "table" | "quiz"; quiz: { questions, index, picked, results }
  const ui = { view: "table", quiz: null, scrollFeedback: false };

  function reset() {
    ui.view = "table";
    ui.quiz = null;
  }

  function helpers() {
    return window.App.KanaModule.helpers;
  }

  // ── contrast table ───────────────────────────────────────────────────

  function setButton(ids, script, settings) {
    const chars = ids.map((id) => KANA[id][script]);
    return h(
      "button",
      {
        class: "pair-btn",
        "aria-label": `聽 ${chars.join("、")}`,
        onclick: () => speakSequence(chars, settings),
      },
      h(
        "span",
        { class: "pair-items" },
        ids.map((id, m) => [
          m > 0 && h("span", { class: "pair-sep", "aria-hidden": "true" }, "／"),
          h("span", { class: "pair-item" }, jp(KANA[id][script]), settings.showRomaji && h("span", { class: "rom" }, KANA[id].romaji)),
        ])
      ),
      isTTSSupported() && h("span", { class: "pair-play", "aria-hidden": "true" }, "🔊")
    );
  }

  function contrastTable(ctx) {
    const { settings, kana } = ctx;
    const prefs = kana.prefs;
    const script = tableScript(prefs);
    const tts = isTTSSupported();
    const selected = prefs.contrastRows;
    const toggleRow = (key) =>
      ctx.onPrefsChange({ contrastRows: selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key] });

    return [
      h(
        "p",
        { class: "small muted mb-4" },
        "清音同濁音嘅分別：濁音發音時喉嚨要震（廣東話冇呢類音）。半濁音係 は行 加「゜」，讀 p。撳一組，會順序讀出嚟。"
      ),
      CONTRAST_ROWS.map((crow) =>
        h(
          "div",
          { class: "card accent mb-4" },
          h("p", { lang: "ja", class: "h-heading accent-text jp", style: { fontWeight: 700 } }, rowTitle(crow, script)),
          h("p", { class: "xs muted mb-3" }, crow.rows.map((_, m) => CATEGORIES[m]).join(" ／ ")),
          h("div", { class: "stack-sm" }, setsOf(crow).map((ids) => setButton(ids, script, settings))),
          crow.note && h("p", { class: "note gold mt-3" }, `💡 ${crow.note}`)
        )
      ),
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "分辨練習"),
        h(
          "p",
          { class: "xs muted mb-3" },
          `每輪 ${helpers().QUIZ_LENGTH} 題：聽一個字，揀係清音、濁音定半濁音。練習用「練邊種？」揀咗嘅平假名／片假名。`
        ),
        h("p", { class: "small mb-1" }, "練習範圍"),
        h(
          "div",
          { class: "wrap" },
          CONTRAST_ROWS.map((crow) =>
            chip(`${KANA[rowCells(crow.key)[0]][script]}行`, selected.includes(crow.key), () => toggleRow(crow.key), {
              lang: "ja",
              class: "row-chip jp",
            })
          )
        ),
        selected.length === 0 && h("p", { class: "xs mt-3", style: { color: "var(--stamp)" } }, "最少揀一行"),
        h(
          "div",
          { class: "stack mt-4" },
          inkButton("👂 開始分辨練習", () => startQuiz(ctx), { accent: true, disabled: selected.length === 0 || !tts, class: "w-full" }),
          !tts && h("p", { class: "xs muted" }, "呢個瀏覽器冇發音功能，所以用唔到分辨練習")
        )
      ),
    ];
  }

  // ── 分辨練習 ─────────────────────────────────────────────────────────

  // Every (set, member) in the chosen rows is a possible question; the
  // script is fixed by 練邊種？, or random per question for 兩樣.
  function buildQuiz(prefs) {
    const { shuffle, QUIZ_LENGTH } = helpers();
    const pool = [];
    CONTRAST_ROWS.filter((c) => prefs.contrastRows.includes(c.key)).forEach((crow) =>
      setsOf(crow).forEach((ids) => ids.forEach((_, m) => pool.push({ ids, answer: m })))
    );
    let order = [];
    while (order.length < QUIZ_LENGTH) order = order.concat(shuffle(pool));
    return order.slice(0, QUIZ_LENGTH).map((q) => ({
      ...q,
      script: prefs.script === "both" ? (Math.random() < 0.5 ? "hira" : "kata") : prefs.script,
    }));
  }

  const charOf = (q, m) => KANA[q.ids[m]][q.script];

  // Built inside the start tap so the first sound plays within the user
  // gesture (iOS requirement).
  function startQuiz(ctx) {
    ui.quiz = { questions: buildQuiz(ctx.kana.prefs), index: 0, picked: null, results: [] };
    ui.view = "quiz";
    const q = ui.quiz.questions[0];
    speak(charOf(q, q.answer), ctx.settings);
    ctx.rerender({ scrollTop: true });
  }

  function contrastQuiz(ctx, back) {
    const { settings } = ctx;
    const { romajiText, yueLine, speakButton, QUIZ_LENGTH } = helpers();
    const quiz = ui.quiz;
    const toTable = () => {
      ui.view = "table";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };

    if (quiz.index >= quiz.questions.length) return quizResult(ctx, toTable);

    const q = quiz.questions[quiz.index];
    const target = charOf(q, q.answer);
    const answered = quiz.picked !== null;
    const gotIt = answered && quiz.picked === q.answer;
    const correctSoFar = quiz.results.filter((r) => r.correct).length;

    function pick(m) {
      if (quiz.picked !== null) return;
      const correct = m === q.answer;
      quiz.picked = m;
      quiz.results.push({ char: target, id: q.ids[q.answer], correct });
      ui.scrollFeedback = true;
      ctx.onAnswer(target, correct); // same stats/mistakes as other quizzes; saves + rerenders
    }

    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (quiz.index < quiz.questions.length) {
        const nq = quiz.questions[quiz.index];
        speak(charOf(nq, nq.answer), settings);
      }
      ctx.rerender({ scrollTop: true });
    }

    const options = h(
      "div",
      { class: `opt-grid ${q.ids.length === 3 ? "three" : ""}`.trim() },
      q.ids.map((id, m) => {
        let state = "";
        if (answered && m === q.answer) state = "correct";
        else if (answered && m === quiz.picked) state = "wrong";
        else if (answered) state = "dim";
        return h(
          "button",
          { class: `opt opt-cat ${state}`.trim(), disabled: answered, onclick: () => pick(m) },
          jp(charOf(q, m)),
          h("span", { class: "opt-label" }, CATEGORIES[m])
        );
      })
    );

    let feedback = null;
    if (answered) {
      const autoscroll = ui.scrollFeedback;
      ui.scrollFeedback = false;
      const setChars = q.ids.map((_, m) => charOf(q, m));
      feedback = h(
        "div",
        { class: "card mt-4 feedback", "data-autoscroll": autoscroll ? "end" : null },
        h("p", { class: `fb-title ${gotIt ? "ok" : "no"}` }, gotIt ? "✅ 啱咗！" : "❌ 唔啱，答案係："),
        h(
          "div",
          { class: "row mt-1" },
          jp(target, "fb-kana"),
          h(
            "div",
            null,
            h("p", { class: "small", style: { color: "var(--a-dark)" } }, CATEGORIES[q.answer]),
            settings.showRomaji && h("p", { class: "big-rom", style: { fontSize: "1.25rem" } }, romajiText(q.ids[q.answer]))
          )
        ),
        yueLine(q.ids[q.answer], settings, "mt-2"),
        h(
          "div",
          { class: "row-sm mt-4" },
          speakButton(target, settings, "再聽", "grow"),
          isTTSSupported() &&
            h("button", { class: "btn-soft grow", onclick: () => speakSequence(setChars, settings) }, `🔊 重聽整組`)
        ),
        h("p", { lang: "ja", class: "xs muted center mt-2 jp" }, setChars.join(" … ")),
        inkButton(quiz.index + 1 < QUIZ_LENGTH ? "下一題 →" : "睇結果", next, { class: "w-full mt-3" })
      );
    }

    return [
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${QUIZ_LENGTH} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `啱 ${correctSoFar} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / QUIZ_LENGTH) * 100}%` } })),
      h(
        "div",
        { class: "card accent center mb-4" },
        h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "聽下係邊個？"),
        h("button", { class: "hear-btn", onclick: () => speak(target, settings), "aria-label": "再聽一次" }, "🔊"),
        h("p", { class: "xs muted mt-3" }, "撳喇叭可以再聽")
      ),
      options,
      feedback,
    ];
  }

  function quizResult(ctx, toTable) {
    const { settings } = ctx;
    const { QUIZ_LENGTH } = helpers();
    const quiz = ui.quiz;
    const score = quiz.results.filter((r) => r.correct).length;
    const wrong = quiz.results.filter((r) => !r.correct);
    return h(
      "div",
      { class: "card accent center" },
      h("p", { style: { fontSize: "3rem", marginBottom: "8px" } }, score === QUIZ_LENGTH ? "🎉" : score >= 7 ? "👍" : "💪"),
      h("p", { class: "score" }, `${score} / ${QUIZ_LENGTH}`),
      h(
        "p",
        { class: "muted mt-1", style: { fontWeight: 700 } },
        score === QUIZ_LENGTH ? "全對！耳仔好靈！" : score >= 7 ? "唔錯！再聽多幾次就分到" : "慢慢嚟，返去對比表多聽幾次"
      ),
      wrong.length > 0 &&
        h(
          "div",
          { class: "mt-4", style: { textAlign: "left" } },
          h("p", { class: "caption mb-2" }, "答錯咗（撳一下聽發音）"),
          h(
            "div",
            { class: "wrap", style: { gap: "8px" } },
            wrong.map((r) =>
              h("button", { class: "wrong-chip", onclick: () => speak(r.char, settings) }, jp(r.char), h("span", { class: "r" }, KANA[r.id].romaji))
            )
          )
        ),
      h(
        "div",
        { class: "stack mt-4" },
        inkButton("再嚟一輪", () => startQuiz(ctx), { class: "w-full" }),
        inkButton("返回對比表", toTable, { accent: true, class: "w-full" })
      )
    );
  }

  // ── entry ────────────────────────────────────────────────────────────

  function render(ctx, back) {
    const inQuiz = ui.view === "quiz" && ui.quiz;
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader(inQuiz ? "分辨練習" : "清濁對比", inQuiz ? () => ((ui.view = "table"), (ui.quiz = null), ctx.rerender({ scrollTop: true })) : back),
      !inQuiz && notice && h("div", { class: "mb-4" }, notice),
      inQuiz ? contrastQuiz(ctx, back) : contrastTable(ctx)
    );
  }

  window.App.Contrast = { render, reset };
})();
