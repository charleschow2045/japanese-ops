// 近音詞分辨 (stage 10 ⑫, inside the 五十音 module): hear ONE word, pick which of two near-identical
// words it was — 長音 (おばさん／おばあさん), 促音 (きて／きって), 清濁 (かぎ／かき).
// Words: MINIMAL_PAIRS in js/content/minimal.js (19 pairs; ids l1… s1… v1…).
//
// A question is { type: "pair", pair, side, options: [A, B] (shuffled) } — `side` (0|1) is the word that is
// spoken; an option is { side, word, romaji, meaning, kanji }. The speech is the kana (= `word`; the
// pairs are written in kana only, so there is no kanji to misread).
// Records: state.pairs.stats[pair id] = { c, w, last } — either word counts for the pair. A wrong answer
// enters 錯題重溫 as "q:<pair id>" and is reviewed inside 聽力 錯題重溫 (js/listening.js asks type "pair"
// with the helpers exported below). 掌握 = answered right 3+ times (only two options, so guessing is easy)
// and not on the 重溫 list. The practice settings (類別, 題數) are only kept while the app is open.
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, isTTSSupported, speechNotice } = window.App.Speech;

  const COUNTS = [5, 10, 20];
  const SLOW_RATE = 0.6;
  const MASTER_C = 3;

  const cats = () => window.App.Content.MINIMAL_CATS;
  const pairs = () => window.App.Content.MINIMAL_PAIRS;
  const pairOf = (id) => pairs().find((p) => p.id === id) || null;
  const catOf = (key) => cats().find((c) => c.key === key);

  // view: "menu" | "quiz"; prefs live only while the app is open (cats null = all three)
  const ui = { view: "menu", quiz: null, scrollFeedback: false, prefs: { cats: null, count: 10 } };
  function reset() {
    ui.view = "menu";
    ui.quiz = null;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── questions ────────────────────────────────────────────────────────

  function question(pairId, side) {
    const pair = pairOf(pairId);
    const opts = pair.words.map((w, i) => ({ side: i, word: w.word, romaji: w.romaji, meaning: w.meaning, kanji: w.kanji }));
    return { type: "pair", pair, side, options: Math.random() < 0.5 ? opts : [opts[1], opts[0]] };
  }
  const isRight = (q, opt) => opt.side === q.side;
  const heard = (q) => q.pair.words[q.side];
  const playQ = (q, settings, rate) => speak(heard(q).word, rate ? { ...settings, rate } : settings);

  // asked more often when answered wrong / not yet right 3 times
  const weightFor = (st) => (!st ? 2 : st.w > st.c ? 3 : st.c < MASTER_C ? 2 : 1);

  // `prefs`: { cats: null | [keys], count }; state needs only { pairs }
  function buildPractice(state, prefs) {
    const keys = prefs.cats === null ? cats().map((c) => c.key) : prefs.cats;
    const pool = [];
    pairs()
      .filter((p) => keys.includes(p.cat))
      .forEach((p) => [0, 1].forEach((side) => pool.push({ id: p.id, side })));
    const out = [];
    let left = [];
    while (out.length < prefs.count && pool.length) {
      if (!left.length) left = pool.slice();
      const last = out.length ? out[out.length - 1].id : null;
      let cands = left.filter((x) => x.id !== last); // not the same pair twice in a row
      if (!cands.length) cands = left;
      const wt = (x) => weightFor(state.pairs.stats[x.id]);
      let r = Math.random() * cands.reduce((s, x) => s + wt(x), 0);
      const pick = cands.find((x) => (r -= wt(x)) < 0) || cands[cands.length - 1];
      left.splice(left.indexOf(pick), 1);
      out.push(pick);
    }
    return out.map((x) => question(x.id, x.side));
  }

  // ── counts (進度頁, 選單) ─────────────────────────────────────────────

  function counts(state) {
    const total = pairs().length;
    let mastered = 0;
    let learning = 0;
    pairs().forEach((p) => {
      const st = state.pairs.stats[p.id];
      if (st && st.c >= MASTER_C && !state.review.items[`q:${p.id}`]) mastered += 1;
      else if (st) learning += 1;
    });
    return { total, mastered, learning, unseen: total - mastered - learning };
  }

  // ── shared pieces (also used by 聽力 錯題重溫) ─────────────────────────

  // The text of an answer button: the word (large) and its 中文意思.
  const optionContent = (opt) => [jp(opt.word, "pair-word"), h("span", { class: "pair-mean" }, opt.meaning)];

  // Both words side by side after answering; the spoken one is marked.
  function feedbackBody(q, settings) {
    const cat = catOf(q.pair.cat);
    return [
      h("p", { class: "caption mt-1" }, `👂 ${cat.label}`),
      h(
        "div",
        { class: "stack-sm mt-2" },
        q.pair.words.map((w, i) =>
          h(
            "button",
            { class: `ex-card pair-fb${i === q.side ? " heard" : ""}`, onclick: () => speak(w.word, settings) },
            h("span", { class: "grow" }, jp(w.word, "ex-word"), settings.showRomaji && h("span", { class: "ex-rom" }, w.romaji), h("span", { class: "small" }, w.meaning)),
            i === q.side && h("span", { class: "pair-tag" }, "聽到的"),
            h("span", null, "🔊")
          )
        )
      ),
      h("p", { class: "xs muted mt-2" }, cat.hint),
    ];
  }

  // ── quiz ─────────────────────────────────────────────────────────────

  // Built inside the start tap so the first sound plays within the user gesture (iOS).
  function start(ctx) {
    const questions = buildPractice({ pairs: ctx.pairs }, ui.prefs);
    if (!questions.length) return;
    ui.quiz = { questions, index: 0, picked: null, results: [] };
    ui.view = "quiz";
    playQ(questions[0], ctx.settings);
    ctx.rerender({ scrollTop: true });
  }

  function quizScreen(ctx) {
    const { settings } = ctx;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const toMenu = () => {
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return resultScreen(ctx, toMenu);

    const q = quiz.questions[quiz.index];
    const answered = quiz.picked !== null;
    const gotIt = answered && isRight(q, q.options[quiz.picked]);

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = isRight(q, q.options[i]);
      quiz.picked = i;
      quiz.results.push({ q, correct });
      ui.scrollFeedback = true;
      ctx.onPairAnswer(q.pair.id, correct); // saves (+ 錯題重溫 when wrong) and rerenders
    }
    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (quiz.index < total) playQ(quiz.questions[quiz.index], settings);
      ctx.rerender({ scrollTop: true });
    }

    const options = h(
      "div",
      { class: "stack-sm" },
      q.options.map((opt, i) => {
        let state = "";
        if (answered && isRight(q, opt)) state = "correct";
        else if (answered && i === quiz.picked) state = "wrong";
        else if (answered) state = "dim";
        return h("button", { class: `opt opt-text pair-opt ${state}`.trim(), disabled: answered, onclick: () => pick(i) }, ...optionContent(opt));
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
        !gotIt && h("p", { class: "caption fb-lead" }, "聽到的是："),
        feedbackBody(q, settings),
        isTTSSupported() &&
          h(
            "div",
            { class: "row-sm mt-3" },
            h("button", { class: "btn-soft grow", onclick: () => playQ(q, settings) }, "🔊 再聽"),
            h("button", { class: "btn-soft grow", onclick: () => playQ(q, settings, SLOW_RATE) }, "🐢 慢慢聽")
          ),
        inkButton(quiz.index + 1 < total ? "下一題 →" : "查看結果", next, { class: "w-full mt-3" })
      );
    }

    return [
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${total} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `答對 ${quiz.results.filter((r) => r.correct).length} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / total) * 100}%` } })),
      h(
        "div",
        { class: "card accent center mb-4" },
        h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "聽聽看是哪一個詞？"),
        h("button", { class: "hear-btn", onclick: () => playQ(q, settings), "aria-label": "再聽一次" }, "🔊"),
        h("div", { class: "row-sm mt-3", style: { justifyContent: "center" } }, h("button", { class: "btn-soft", onclick: () => playQ(q, settings, SLOW_RATE) }, "🐢 慢慢聽"))
      ),
      options,
      feedback,
    ];
  }

  function resultScreen(ctx, toMenu) {
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
      h("p", { class: "muted mt-1", style: { fontWeight: 700 } }, score === total ? "全對！聽得很準！" : "答錯的已加入「聽力錯題重溫」"),
      wrong.length > 0 &&
        h(
          "div",
          { class: "mt-4", style: { textAlign: "left" } },
          h("p", { class: "caption mb-2" }, "答錯的詞（按一下可再聽）"),
          h(
            "div",
            { class: "stack-sm" },
            wrong.map(({ q }) =>
              h(
                "button",
                { class: "ex-card", onclick: () => playQ(q, settings) },
                h("span", { class: "grow" }, jp(heard(q).word, "ex-word"), h("span", { class: "small" }, `${heard(q).meaning}（另一個：${q.pair.words[1 - q.side].word}）`)),
                h("span", null, "🔊")
              )
            )
          )
        ),
      h("div", { class: "stack mt-4" }, inkButton("再來一輪", () => start(ctx), { class: "w-full" }), inkButton("返回近音詞分辨", toMenu, { accent: true, class: "w-full" }))
    );
  }

  // ── menu ─────────────────────────────────────────────────────────────

  function menu(ctx) {
    const tts = isTTSSupported();
    const c = counts({ pairs: ctx.pairs, review: ctx.review });
    const all = cats().map((x) => x.key);
    const active = ui.prefs.cats === null ? all : ui.prefs.cats.filter((k) => all.includes(k));
    const toggleCat = (key) => {
      const next = active.includes(key) ? active.filter((k) => k !== key) : all.filter((k) => active.includes(k) || k === key);
      ui.prefs.cats = next.length === all.length ? null : next;
      ctx.rerender();
    };
    const nPairs = pairs().filter((p) => active.includes(p.cat)).length;
    const enough = nPairs > 0 && tts;
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader("近音詞分辨", ctx.back),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "只差一點點的兩個詞，意思完全不同。聽一個詞，從兩個詞中選出聽到的。"),
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "👂 近音詞練習"),
        h("p", { class: "big-count" }, `${c.mastered} / ${c.total}`),
        h("p", { class: "xs muted" }, `掌握的詞對（答對 ${MASTER_C} 次以上，而且不在重溫清單）。學習中 ${c.learning}・未練習 ${c.unseen}`),
        h("p", { class: "small mb-1 mt-3" }, "練習哪些？"),
        h("div", { class: "wrap mb-3" }, cats().map((x) => chip(x.label, active.includes(x.key), () => toggleCat(x.key)))),
        h("p", { class: "small mb-1" }, "題數"),
        h(
          "div",
          { class: "chips-fill" },
          COUNTS.map((n) =>
            chip(`${n} 題`, ui.prefs.count === n, () => {
              ui.prefs.count = n;
              ctx.rerender();
            })
          )
        ),
        h(
          "p",
          { class: "xs mt-3", style: { color: enough ? "var(--muted)" : "var(--stamp)" } },
          nPairs === 0 ? "請至少選擇一類" : !tts ? "此瀏覽器沒有發音功能，因此無法練習" : `${nPairs} 對詞（這張卡的選擇只在 App 開啟期間記住）`
        ),
        inkButton("👂 開始分辨", () => start(ctx), { accent: true, disabled: !enough, class: "w-full mt-3" })
      ),
      h("p", { class: "h-heading mb-2" }, "📖 全部近音詞對照"),
      h("p", { class: "xs muted mb-3" }, "每對可按「連續聽」比較，或逐個詞按一下聆聽。"),
      cats().map((cat) =>
        h(
          "div",
          { class: "card accent mb-4" },
          h("p", { class: "h-heading accent-text" }, cat.label),
          h("p", { class: "xs muted mb-3" }, cat.hint),
          window.App.Sounds.pairList({ labels: cat.key === "voice" ? [null, null] : cat.key === "long" ? ["短", "長"] : ["無 っ", "有 っ"], pairs: pairs().filter((p) => p.cat === cat.key).map((p) => p.words) }, ctx.settings)
        )
      )
    );
  }

  // ctx: { settings, pairs, review, onPairAnswer(pairId, correct), rerender } ; back = leave to the 五十音 menu
  function render(ctx, back) {
    const c = { ...ctx, back };
    if (ui.view === "quiz" && ui.quiz) {
      const toMenu = () => {
        ui.view = "menu";
        ui.quiz = null;
        ctx.rerender({ scrollTop: true });
      };
      return h("div", null, modHeader("近音詞練習", toMenu), quizScreen(c));
    }
    ui.view = "menu";
    return menu(c);
  }

  window.App.Minimal = { render, reset, pairOf, question, isRight, playQ, feedbackBody, optionContent, buildPractice, counts, MASTER_C };
})();
