// 看得懂 (stage 10 ⑦ 版本一): reading katakana words you will see on signs, menus and packages.
// Words: KATAKANA_EXAMPLES in js/content/kana.js (120, all checked by the user earlier).
//
// Two question types, both with 4 options:
//   see   👀 看詞選意思 — the katakana word is shown, pick its 中文意思 (distractors: same 情境 first)
//   hear  👂 聽音選詞   — the word is spoken, pick how it is written (distractors: words that look alike —
//                         same characters / similar length — so it is a real reading exercise)
// A wrong answer enters 錯題重溫 as "r:<word>"; the 重溫 card lives in this module (these are reading
// questions, not listening ones). Stats: state.read.stats[word] = { c, w, last } (js/storage.js).
// 認得 = answered right 2+ times and not on the 重溫 list (same rule as 熟練/掌握 elsewhere).
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, isTTSSupported, speechNotice } = window.App.Speech;
  const { Storage } = window.App;

  const COUNTS = [5, 10, 20];
  const REVIEW_MAX = 10;
  const SLOW_RATE = 0.6;
  const MODES = [
    { key: "see", label: "👀 看詞選意思" },
    { key: "hear", label: "👂 聽音選詞" },
    { key: "mix", label: "🔀 兩種混合" },
  ];

  const words = () => window.App.Content.KATAKANA_EXAMPLES;
  const wordOf = (w) => words().find((x) => x.word === w) || null;
  const sceneList = () => [...new Set(words().map((x) => x.scene))];

  // view: "menu" | "quiz"; quiz: { kind: "practice" | "review", questions, index, picked, results }
  const ui = { view: "menu", quiz: null, scrollFeedback: false };
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

  // ── counts ───────────────────────────────────────────────────────────

  const known = (state, w) => (state.read.stats[w] || { c: 0 }).c >= 2 && !state.review.items[`r:${w}`];
  function counts(state) {
    const total = words().length;
    let k = 0;
    let seen = 0;
    words().forEach((x) => {
      if (known(state, x.word)) k += 1;
      else if (state.read.stats[x.word]) seen += 1;
    });
    return { total, known: k, learning: seen, unseen: total - k - seen };
  }

  function dueItems(state) {
    const today = Storage.todayLocal();
    return Object.entries(state.review.items)
      .filter(([key, it]) => key.startsWith("r:") && it.due <= today && wordOf(key.slice(2)))
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0));
  }
  const dueCount = (state) => dueItems(state).length;

  // ── questions ────────────────────────────────────────────────────────

  // Wrong now / answered right fewer than 2 times weigh more (same idea as 相似字分辨).
  const weightOf = (state, w) => {
    const st = state.read.stats[w];
    if (!st) return 2;
    return st.w > st.c ? 3 : st.c < 2 ? 2 : 1;
  };

  // `n` distinct words from the pool, weighted; when the pool is smaller than n it is used again.
  function pickWords(state, pool, n) {
    const out = [];
    let left = [];
    while (out.length < n && pool.length) {
      if (!left.length) left = pool.slice();
      let r = Math.random() * left.reduce((s, x) => s + weightOf(state, x.word), 0);
      const i = left.findIndex((x) => (r -= weightOf(state, x.word)) < 0);
      out.push(left.splice(i < 0 ? left.length - 1 : i, 1)[0]);
    }
    return out;
  }

  // 3 wrong 中文意思: never the same meaning; same 情境 first.
  function meaningOptions(item) {
    const used = new Set([item.meaning]);
    const out = [];
    [shuffle(words().filter((x) => x.scene === item.scene)), shuffle(words())].forEach((cands) =>
      cands.forEach((c) => {
        if (out.length >= 3 || used.has(c.meaning)) return;
        used.add(c.meaning);
        out.push(c);
      })
    );
    return shuffle([item, ...out]);
  }

  // 3 wrong written forms that look like the answer: shared characters count most, then similar length,
  // then the same 情境. Never the same reading (romaji) as the answer or each other.
  function writtenOptions(item) {
    const chars = new Set(item.word.split(""));
    const score = (c) => c.word.split("").filter((ch) => chars.has(ch)).length * 2 - Math.abs(c.word.length - item.word.length) + (c.scene === item.scene ? 1 : 0) + Math.random() * 0.8;
    const ranked = words().filter((c) => c.word !== item.word && c.romaji !== item.romaji).map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s);
    const usedRomaji = new Set([item.romaji]);
    const out = [];
    ranked.forEach(({ c }) => {
      if (out.length >= 3 || usedRomaji.has(c.romaji)) return;
      usedRomaji.add(c.romaji);
      out.push(c);
    });
    return shuffle([item, ...out]);
  }

  function question(item, type) {
    return { type, item, options: type === "see" ? meaningOptions(item) : writtenOptions(item) };
  }
  const typeFor = (mode) => (mode === "mix" ? (Math.random() < 0.5 ? "see" : "hear") : mode);

  function pool(prefs) {
    return prefs.scenes === null ? words() : words().filter((x) => prefs.scenes.includes(x.scene));
  }

  function buildPractice(state) {
    const prefs = state.read.prefs;
    const picked = pickWords(state, pool(prefs), prefs.count);
    if (prefs.mode !== "mix") return picked.map((x) => question(x, prefs.mode));
    // mixed: half see, half hear (shuffled)
    const kinds = shuffle(picked.map((_, i) => (i % 2 ? "hear" : "see")));
    return picked.map((x, i) => question(x, kinds[i]));
  }

  function buildReview(state) {
    return shuffle(dueItems(state).slice(0, REVIEW_MAX)).map(([key]) => question(wordOf(key.slice(2)), typeFor(state.read.prefs.mode)));
  }

  // Built inside the tap that starts it, so the first sound (聽音選詞) plays within the user gesture.
  function start(ctx, kind) {
    const questions = kind === "review" ? buildReview(ctx.state) : buildPractice(ctx.state);
    if (!questions.length) return;
    ui.quiz = { kind, questions, index: 0, picked: null, results: [] };
    ui.view = "quiz";
    playQ(questions[0], ctx.state.settings, null, true);
    ctx.rerender({ scrollTop: true });
  }

  // 聽音選詞 speaks the question; 看詞選意思 only speaks when asked (reading first).
  function playQ(q, settings, rate, auto) {
    if (auto && q.type === "see") return;
    speak(q.item.word, rate ? { ...settings, rate } : settings);
  }

  const isRight = (q, opt) => opt.word === q.item.word;

  // ── screens ──────────────────────────────────────────────────────────

  function feedbackBody(q, settings) {
    const it = q.item;
    return [
      h("p", { class: "caption mt-1" }, `🪧 ${it.scene}`),
      jp(it.word, "read-word mt-1"),
      settings.showRomaji && h("p", { class: "phrase-rom" }, it.romaji),
      h("p", { class: "phrase-yue" }, it.meaning),
      it.en && h("p", { class: "phrase-use" }, it.en),
    ];
  }

  function quizScreen(ctx) {
    const settings = ctx.state.settings;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const title = quiz.kind === "review" ? "看得懂重溫" : "片假名詞練習";
    const back = () => {
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return resultScreen(ctx, title, back);

    const q = quiz.questions[quiz.index];
    const answered = quiz.picked !== null;
    const gotIt = answered && isRight(q, q.options[quiz.picked]);
    const tts = isTTSSupported();

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = isRight(q, q.options[i]);
      quiz.picked = i;
      quiz.results.push({ q, correct });
      ui.scrollFeedback = true;
      ctx.onAnswer(q.item.word, correct, quiz.kind); // saves + rerenders
    }
    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (quiz.index < total) playQ(quiz.questions[quiz.index], settings, null, true);
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
        return h(
          "button",
          { class: `opt opt-text ${state}`.trim(), disabled: answered, onclick: () => pick(i) },
          q.type === "see" ? opt.meaning : jp(opt.word, "read-opt")
        );
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
        !gotIt && h("p", { class: "caption fb-lead" }, "正確答案是："),
        feedbackBody(q, settings),
        tts &&
          h(
            "div",
            { class: "row-sm mt-3" },
            h("button", { class: "btn-soft grow", onclick: () => playQ(q, settings) }, "🔊 聽發音"),
            h("button", { class: "btn-soft grow", onclick: () => playQ(q, settings, SLOW_RATE) }, "🐢 慢慢聽")
          ),
        inkButton(quiz.index + 1 < total ? "下一題 →" : "查看結果", next, { class: "w-full mt-3" })
      );
    }

    const prompt =
      q.type === "see"
        ? [h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "這個詞是什麼意思？"), jp(q.item.word, "read-word")]
        : [
            h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "聽聽看，哪一個是剛才聽到的詞？"),
            h("button", { class: "hear-btn", onclick: () => playQ(q, settings), "aria-label": "再聽一次" }, "🔊"),
            h("div", { class: "row-sm mt-3", style: { justifyContent: "center" } }, h("button", { class: "btn-soft", onclick: () => playQ(q, settings, SLOW_RATE) }, "🐢 慢慢聽")),
          ];

    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${total} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `答對 ${quiz.results.filter((r) => r.correct).length} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / total) * 100}%` } })),
      h("div", { class: "card accent center mb-4" }, ...prompt),
      options,
      feedback
    );
  }

  function resultScreen(ctx, title, back) {
    const settings = ctx.state.settings;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const score = quiz.results.filter((r) => r.correct).length;
    const wrong = quiz.results.filter((r) => !r.correct);
    const review = quiz.kind === "review";
    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "card accent center" },
        window.App.Feedback.hero(score, total),
        h("p", { class: "score" }, `${score} / ${total}`),
        h(
          "p",
          { class: "muted mt-1", style: { fontWeight: 700 } },
          review
            ? score === total
              ? "全部答對！這些會隔較長時間才再出現"
              : "答錯的今天會再出現，答對的會隔幾天才再重溫"
            : score === total
              ? "全對！看得很準！"
              : "答錯的已加入「重溫」"
        ),
        wrong.length > 0 &&
          h(
            "div",
            { class: "mt-4", style: { textAlign: "left" } },
            h("p", { class: "caption mb-2" }, "答錯的詞（按一下可聽發音）"),
            h(
              "div",
              { class: "stack-sm" },
              wrong.map(({ q }) =>
                h(
                  "button",
                  { class: "ex-card", onclick: () => speak(q.item.word, settings) },
                  h("span", { class: "grow" }, jp(q.item.word, "ex-word"), h("span", { class: "small" }, q.item.meaning)),
                  h("span", null, "🔊")
                )
              )
            )
          ),
        h(
          "div",
          { class: "stack mt-4" },
          !review && inkButton("再來一輪", () => start(ctx, "practice"), { class: "w-full" }),
          inkButton("返回看得懂", back, { accent: true, class: "w-full" })
        )
      )
    );
  }

  function menu(ctx) {
    const { state } = ctx;
    const prefs = state.read.prefs;
    const tts = isTTSSupported();
    const due = dueItems(state);
    const c = counts(state);
    const all = sceneList();
    const active = prefs.scenes === null ? all : prefs.scenes.filter((s) => all.includes(s));
    const available = pool(prefs).length;
    const needsTts = prefs.mode !== "see";
    const toggleScene = (s) => {
      const next = active.includes(s) ? active.filter((x) => x !== s) : all.filter((x) => active.includes(x) || x === s);
      ctx.onPrefsChange({ scenes: next.length === all.length ? null : next });
    };
    const enough = available > 0 && (!needsTts || tts);
    const notice = speechNotice();
    const later = Object.entries(state.review.items)
      .filter(([k, it]) => k.startsWith("r:") && it.due > Storage.todayLocal())
      .map(([, it]) => it.due)
      .sort()[0];

    return h(
      "div",
      null,
      modHeader("看得懂", ctx.onBack),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "在日本的餐牌、商品、指示牌上，很多詞是片假名寫的。練習認讀這些常見的片假名詞。"),

      // progress
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🪧 認得的片假名詞"),
        h("p", { class: "big-count" }, `${c.known} / ${c.total}`),
        h("p", { class: "xs muted" }, `學習中 ${c.learning}・未練習 ${c.unseen}（答對 2 次以上、而且不在重溫清單，才算「認得」）`)
      ),

      // 重溫
      h(
        "div",
        { class: "card review-card mb-4" },
        h("p", { class: "h-heading" }, "📝 看得懂重溫"),
        due.length > 0 ? h("p", { class: "review-count" }, `今天需重溫 ${due.length} 個詞`) : h("p", { class: "small muted mt-1" }, "今天沒有需要重溫的內容 🎉"),
        due.length > REVIEW_MAX && h("p", { class: "xs muted" }, `每次最多 ${REVIEW_MAX} 題`),
        later && h("p", { class: "xs muted mt-1" }, `下一批重溫：${later}`),
        h("p", { class: "xs muted mt-1" }, "答錯 → 今天再出現；重溫答對 → 隔 1、3、7、14 天再出現，第 5 次答對即畢業。"),
        inkButton("開始重溫", () => start(ctx, "review"), { disabled: due.length === 0 || (needsTts && !tts), class: "w-full mt-3" })
      ),

      // practice
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🔤 片假名詞練習"),
        h("p", { class: "xs muted mb-3" }, "看到片假名選意思，或聽發音選出寫法。每題 4 個選項。"),
        h("p", { class: "small mb-1" }, "題型"),
        h("div", { class: "wrap mb-3" }, MODES.map((m) => chip(m.label, prefs.mode === m.key, () => ctx.onPrefsChange({ mode: m.key })))),
        h("p", { class: "small mb-1" }, "情境"),
        h("div", { class: "wrap mb-3" }, all.map((s) => chip(s, active.includes(s), () => toggleScene(s)))),
        h("p", { class: "small mb-1" }, "題數"),
        h("div", { class: "chips-fill" }, COUNTS.map((n) => chip(`${n} 題`, prefs.count === n, () => ctx.onPrefsChange({ count: n })))),
        h(
          "p",
          { class: "xs mt-3", style: { color: enough ? "var(--muted)" : "var(--stamp)" } },
          available === 0 ? "請至少選擇一個情境" : needsTts && !tts ? "此瀏覽器沒有發音功能，請選「看詞選意思」" : `可出題的詞：${available} 個`
        ),
        inkButton("🔤 開始練習", () => start(ctx, "practice"), { accent: true, disabled: !enough, class: "w-full mt-3" })
      )
    );
  }

  // ctx: { state, onPrefsChange(patch), onAnswer(word, correct, kind), onBack, rerender }
  function render(ctx) {
    if (ui.view === "quiz" && ui.quiz) return quizScreen(ctx);
    ui.view = "menu";
    return menu(ctx);
  }

  window.App.Reading = { render, reset, dueCount, counts, buildPractice, buildReview, question, scenes: sceneList };
})();
