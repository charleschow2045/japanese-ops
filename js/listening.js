// 聽力練習 + 錯題重溫 (stage 5).
//
// 聽力練習: hear a 句子庫 sentence (Japanese hidden), pick its 廣東話意思
// from 4 options. Settings: scenes (multi), 只練店員講, 5/10/20 題.
// 錯題重溫: due items from state.review — 句子 (same question format) and
// 五十音 characters (聽音選字 format). Schedule lives in js/storage.js
// (wrong → today; correct in review → 1/3/7/14 days → 畢業).
//
// 🚩-flagged sentences are never asked (their audio is known to be wrong);
// a flagged sentence that is due simply waits until the flag is removed.
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip, toggle } = window.App.UI;
  const { speak, isTTSSupported, speechNotice } = window.App.Speech;
  const { Storage } = window.App;

  const SLOW_RATE = 0.6;
  const COUNTS = [5, 10, 20];
  const REVIEW_MAX = 10;
  const WHO = { me: "🗣️ 你說", staff: "👂 店員說", both: "🗣️👂 你與店員都會說" };

  // view: "menu" | "quiz"; quiz: { mode, questions, index, picked, results }
  const ui = { view: "menu", quiz: null, scrollFeedback: false, taskId: null };
  function reset() {
    ui.view = "menu";
    ui.quiz = null;
  }

  const scenes = () => window.App.Content.PHRASE_SCENES;
  const kanaHelpers = () => window.App.KanaModule.helpers;
  const sayText = (p) => p.say || p.ja;
  const reading = (p) => p.kana.replace(/[。、？！\s]/g, ""); // same reading = same audio

  // Every sentence with its scene, answers included.
  let allCache = null;
  function allPhrases() {
    if (!allCache) {
      allCache = [];
      scenes().forEach((s) => s.phrases.forEach((p) => [p, ...(p.replies || [])].forEach((x) => allCache.push({ p: x, scene: s }))));
    }
    return allCache;
  }
  const phraseById = (id) => allPhrases().find((x) => x.p.id === id) || null;

  // kana char → { id, script }
  let kanaIndex = null;
  function kanaInfo(ch) {
    if (!kanaIndex) {
      kanaIndex = {};
      Object.entries(window.App.Content.KANA).forEach(([id, k]) => {
        if (k.hira) kanaIndex[k.hira] = { id, script: "hira" };
        if (k.kata) kanaIndex[k.kata] = { id, script: "kata" };
      });
    }
    return kanaIndex[ch] || null;
  }

  // ── pools & questions ────────────────────────────────────────────────

  function practicePool(prefs, flags) {
    const all = allPhrases().filter((x) => prefs.scenes.includes(x.scene.key));
    const byWho = prefs.staffOnly ? all.filter((x) => x.p.who === "staff" || x.p.who === "both") : all;
    const usable = byWho.filter((x) => !flags.includes(x.p.id));
    return { usable, skippedFlagged: byWho.length - usable.length };
  }

  // 3 wrong options: never the same reading (identical audio) or the same
  // meaning as the answer or each other. Same scene first, then anywhere.
  function pickPhraseOptions(target) {
    const usedYue = new Set([target.p.yue]);
    const usedReading = new Set([reading(target.p)]);
    const out = [];
    const { shuffle } = kanaHelpers();
    const same = allPhrases().filter((x) => x.scene.key === target.scene.key);
    [shuffle(same), shuffle(allPhrases())].forEach((cands) =>
      cands.forEach((c) => {
        if (out.length >= 3 || usedYue.has(c.p.yue) || usedReading.has(reading(c.p))) return;
        usedYue.add(c.p.yue);
        usedReading.add(reading(c.p));
        out.push(c);
      })
    );
    return shuffle([target, ...out]);
  }

  function phraseQuestion(x) {
    return { type: "phrase", target: x, options: pickPhraseOptions(x) };
  }

  function kanaQuestion(ch) {
    const info = kanaInfo(ch);
    const target = { id: info.id, script: info.script, char: ch };
    const { pickDistractors, shuffle } = kanaHelpers();
    return { type: "kana", target, options: shuffle([target, ...pickDistractors(target, [])]) };
  }

  function buildPractice(prefs, flags) {
    const { shuffle } = kanaHelpers();
    const { usable } = practicePool(prefs, flags);
    if (!usable.length) return [];
    let order = [];
    while (order.length < prefs.count) order = order.concat(shuffle(usable));
    return order.slice(0, prefs.count).map(phraseQuestion);
  }

  // Due review items that can be asked now (flagged sentences wait).
  function dueItems(state) {
    const today = Storage.todayLocal();
    return Object.entries(state.review.items)
      .filter(([key, it]) => it.due <= today)
      .filter(([key]) => {
        if (key.startsWith("p:")) return !!phraseById(key.slice(2)) && !state.flags.includes(key.slice(2));
        return !!kanaInfo(key.slice(2));
      })
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0));
  }

  function buildReview(state) {
    const { shuffle } = kanaHelpers();
    const picked = dueItems(state).slice(0, REVIEW_MAX); // earliest due first
    return shuffle(picked).map(([key]) => (key.startsWith("p:") ? phraseQuestion(phraseById(key.slice(2))) : kanaQuestion(key.slice(2))));
  }

  const playQ = (q, settings, rate) => {
    const s = rate ? { ...settings, rate } : settings;
    if (q.type === "phrase") speak(sayText(q.target.p), s);
    else speak(q.target.char, s);
  };

  // ── quiz ─────────────────────────────────────────────────────────────

  // Built inside the start tap so the first sound plays within the user
  // gesture (iOS requirement).
  function start(ctx, mode) {
    const questions = mode === "review" ? buildReview(ctx.state) : buildPractice(ctx.state.listen.prefs, ctx.state.flags);
    if (!questions.length) return;
    ui.quiz = { mode, questions, index: 0, picked: null, results: [] };
    ui.view = "quiz";
    playQ(questions[0], ctx.state.settings);
    ctx.rerender({ scrollTop: true });
  }

  // 每日任務 (stage 7b): the 今日任務 page hands over a spec — { mode: "review" } for
  // 錯題重溫, { ids: [sentence ids] } for 今日新句子小測, { kana: [chars] } for
  // 五十音熱身. Built while rendering, which runs inside the launching tap, so
  // the first sound still plays within the user gesture.
  function startTask(ctx) {
    const t = ctx.task;
    const { shuffle } = kanaHelpers();
    let questions;
    if (t.mode === "review") questions = buildReview(ctx.state);
    else if (t.kana) questions = shuffle(t.kana.filter((ch) => kanaInfo(ch))).map(kanaQuestion);
    else questions = shuffle((t.ids || []).filter((id) => !!phraseById(id) && !ctx.state.flags.includes(id))).map((id) => phraseQuestion(phraseById(id)));
    if (!questions.length) {
      ui.quiz = null;
      ui.view = "menu";
      return;
    }
    ui.quiz = { mode: t.mode === "review" ? "review" : "practice", questions, index: 0, picked: null, results: [] };
    ui.view = "quiz";
    playQ(questions[0], ctx.state.settings);
  }

  const isRight = (q, opt) => (q.type === "phrase" ? opt.p.id === q.target.p.id : opt.char === q.target.char);

  function feedbackBody(q, settings) {
    const { romajiText, yueLine } = kanaHelpers();
    if (q.type === "kana") {
      const t = q.target;
      return [
        h("div", { class: "row mt-1" }, jp(t.char, "fb-kana"), settings.showRomaji && h("p", { class: "big-rom", style: { fontSize: "1.25rem" } }, romajiText(t.id))),
        yueLine(t.id, settings, "mt-2"),
      ];
    }
    const p = q.target.p;
    const showKana = reading(p) !== p.ja.replace(/[。、？！\s]/g, "");
    return [
      h("p", { class: "caption mt-1" }, `${q.target.scene.emoji} ${q.target.scene.label}・${WHO[p.who]}`),
      h("p", { lang: "ja", class: "jp phrase-ja mt-1" }, p.ja),
      showKana && h("p", { lang: "ja", class: "jp phrase-kana" }, p.kana),
      settings.showRomaji && h("p", { class: "phrase-rom" }, p.romaji),
      h("p", { class: "phrase-yue" }, p.yue),
      h("p", { class: "phrase-use" }, p.use),
    ];
  }

  function quizScreen(ctx) {
    const settings = ctx.state.settings;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const title = ctx.task && ctx.task.title ? ctx.task.title : quiz.mode === "review" ? "錯題重溫" : "聽力練習";
    const back = () => {
      if (ctx.task) return ctx.onBack();
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return resultScreen(ctx, title, back);

    const q = quiz.questions[quiz.index];
    const answered = quiz.picked !== null;
    const gotIt = answered && isRight(q, q.options[quiz.picked]);

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = isRight(q, q.options[i]);
      quiz.picked = i;
      quiz.results.push({ q, correct });
      ui.scrollFeedback = true;
      ctx.onAnswer(q, correct, quiz.mode); // saves + rerenders
    }

    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (quiz.index < total) playQ(quiz.questions[quiz.index], settings);
      else if (ctx.task) ctx.onTaskDone(); // 每日任務: finished the whole set
      ctx.rerender({ scrollTop: true });
    }

    const options = h(
      "div",
      { class: q.type === "kana" ? "opt-grid" : "stack-sm" },
      q.options.map((opt, i) => {
        let state = "";
        if (answered && isRight(q, opt)) state = "correct";
        else if (answered && i === quiz.picked) state = "wrong";
        else if (answered) state = "dim";
        return h(
          "button",
          { class: `opt ${q.type === "phrase" ? "opt-text" : ""} ${state}`.trim(), disabled: answered, onclick: () => pick(i) },
          q.type === "phrase" ? opt.p.yue : jp(opt.char)
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
        h("p", { class: `fb-title ${gotIt ? "ok" : "no"}` }, gotIt ? "✅ 答對了！" : "❌ 答錯了，正確答案是："),
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
      h(
        "div",
        { class: "card accent center mb-4" },
        h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, q.type === "phrase" ? "聽聽看這句是什麼意思？" : "聽聽看是哪一個字？（五十音）"),
        h("button", { class: "hear-btn", onclick: () => playQ(q, settings), "aria-label": "再聽一次" }, "🔊"),
        h(
          "div",
          { class: "row-sm mt-3", style: { justifyContent: "center" } },
          h("button", { class: "btn-soft", onclick: () => playQ(q, settings, SLOW_RATE) }, "🐢 慢慢聽")
        )
      ),
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
    const review = quiz.mode === "review";
    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "card accent center" },
        h("p", { style: { fontSize: "3rem", marginBottom: "8px" } }, score === total ? "🎉" : score >= total * 0.7 ? "👍" : "💪"),
        h("p", { class: "score" }, `${score} / ${total}`),
        h(
          "p",
          { class: "muted mt-1", style: { fontWeight: 700 } },
          review
            ? score === total
              ? "全部答對！這些會隔較長時間才再出現"
              : "答錯的今天會再出現，答對的會隔幾天才再重溫"
            : score === total
              ? "全對！聽力很好！"
              : "答錯的已加入「錯題重溫」"
        ),
        wrong.length > 0 &&
          h(
            "div",
            { class: "mt-4", style: { textAlign: "left" } },
            h("p", { class: "caption mb-2" }, "答錯的內容（按一下可再聽）"),
            h(
              "div",
              { class: "stack-sm" },
              wrong.map(({ q }) =>
                h(
                  "button",
                  { class: "ex-card", onclick: () => playQ(q, settings) },
                  q.type === "phrase"
                    ? [h("span", { class: "grow" }, h("span", { lang: "ja", class: "jp ex-word", style: { fontSize: "1.1rem" } }, q.target.p.ja), h("span", { class: "small" }, q.target.p.yue)), h("span", null, "🔊")]
                    : [h("span", { class: "grow" }, jp(q.target.char, "ex-word")), h("span", null, "🔊")]
                )
              )
            )
          ),
        h(
          "div",
          { class: "stack mt-4" },
          !review && !ctx.task && inkButton("再來一輪", () => start(ctx, "practice"), { class: "w-full" }),
          inkButton(ctx.task ? "返回今日任務" : "返回聽力練習", back, { accent: true, class: "w-full" })
        )
      )
    );
  }

  // ── menu ─────────────────────────────────────────────────────────────

  function nextDueDate(state) {
    const today = Storage.todayLocal();
    const future = Object.values(state.review.items).map((it) => it.due).filter((d) => d > today).sort();
    return future[0] || null;
  }

  function menu(ctx) {
    const { state } = ctx;
    const prefs = state.listen.prefs;
    const tts = isTTSSupported();
    const due = dueItems(state);
    const dueP = due.filter(([k]) => k.startsWith("p:")).length;
    const dueK = due.length - dueP;
    const waitingFlagged = Object.entries(state.review.items).filter(
      ([k, it]) => k.startsWith("p:") && it.due <= Storage.todayLocal() && state.flags.includes(k.slice(2))
    ).length;
    const later = nextDueDate(state);
    const { usable, skippedFlagged } = practicePool(prefs, state.flags);
    // Wrong options can come from any scene, so one usable sentence is enough.
    const enough = usable.length > 0;
    const toggleScene = (key) =>
      ctx.onPrefsChange({ scenes: prefs.scenes.includes(key) ? prefs.scenes.filter((k) => k !== key) : [...prefs.scenes, key] });
    const notice = speechNotice();

    return h(
      "div",
      null,
      modHeader("聽力練習", ctx.onBack),
      notice && h("div", { class: "mb-4" }, notice),

      // 錯題重溫
      h(
        "div",
        { class: "card review-card mb-4" },
        h("p", { class: "h-heading" }, "📝 錯題重溫"),
        due.length > 0
          ? h("p", { class: "review-count" }, `今天需重溫 ${due.length} 句`)
          : h("p", { class: "small muted mt-1" }, "今天沒有需要重溫的內容 🎉"),
        due.length > 0 && h("p", { class: "xs muted" }, `句子 ${dueP}・五十音 ${dueK}${due.length > REVIEW_MAX ? `（每次最多 ${REVIEW_MAX} 題）` : ""}`),
        waitingFlagged > 0 && h("p", { class: "xs muted mt-1" }, `另有 ${waitingFlagged} 句已標記 🚩 讀錯，修正前不會出題`),
        later && h("p", { class: "xs muted mt-1" }, `下一批重溫：${later}`),
        h("p", { class: "xs muted mt-1" }, "答錯 → 今天再出現；重溫答對 → 隔 1、3、7、14 天再出現，第 5 次答對即畢業。"),
        inkButton("開始重溫", () => start(ctx, "review"), { disabled: due.length === 0 || !tts, class: "w-full mt-3" })
      ),

      // 聽力練習 settings
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🎧 聽句子選意思"),
        h("p", { class: "xs muted mb-3" }, "播放一句日文（不顯示文字），從 4 個中文意思中選出一個。"),
        h("p", { class: "small mb-1" }, "情境"),
        h("div", { class: "wrap mb-3" }, scenes().map((s) => chip(`${s.emoji} ${s.label}`, prefs.scenes.includes(s.key), () => toggleScene(s.key)))),
        toggle("只練「👂 店員說」", "專門練習聽懂店員、司機與廣播", prefs.staffOnly, (v) => ctx.onPrefsChange({ staffOnly: v })),
        h("p", { class: "small mb-1 mt-2" }, "題數"),
        h("div", { class: "chips-fill" }, COUNTS.map((n) => chip(`${n} 題`, prefs.count === n, () => ctx.onPrefsChange({ count: n })))),
        h(
          "p",
          { class: "xs mt-3", style: { color: enough ? "var(--muted)" : "var(--stamp)" } },
          enough
            ? `可出題的句子：${usable.length} 句${skippedFlagged ? `（略過 🚩 讀錯 ${skippedFlagged} 句）` : ""}`
            : "請至少選擇一個情境（或關閉「只練店員說」）"
        ),
        inkButton("👂 開始聽力練習", () => start(ctx, "practice"), { accent: true, disabled: !enough || !tts, class: "w-full mt-3" }),
        !tts && h("p", { class: "xs muted mt-2" }, "此瀏覽器沒有發音功能，因此無法使用聽力練習")
      )
    );
  }

  // ctx: { state, task, onPrefsChange, onAnswer(q, correct, mode), onTaskDone, onBack, rerender }
  function emptyTask(ctx) {
    return h(
      "div",
      null,
      modHeader(ctx.task.title || "錯題重溫", ctx.onBack),
      h("div", { class: "card accent center" }, h("p", { class: "h-heading" }, "今天沒有需要重溫的內容 🎉"), inkButton("返回今日任務", ctx.onBack, { accent: true, class: "w-full mt-4" }))
    );
  }

  function render(ctx) {
    if (ctx.task && ui.taskId !== ctx.task.id) {
      ui.taskId = ctx.task.id;
      startTask(ctx);
    }
    if (ctx.task && !ui.quiz) return emptyTask(ctx);
    if (ui.view === "quiz" && ui.quiz) return quizScreen(ctx);
    ui.view = "menu";
    return menu(ctx);
  }

  // For the 主頁 row: how many review items can be done today.
  function dueCount(state) {
    return dueItems(state).length;
  }

  window.App.Listening = { render, reset, dueCount };
})();
