// 五十音 module (stage 1a): menu, chart + detail sheet, 看字選音,
// 聽音選字, 片假名實例. Content lives in js/content/kana.js.
//
// Plain-JS pattern: `ui` holds this module's screen state; every
// interaction mutates it (or app state via ctx callbacks) and calls
// ctx.rerender(), which rebuilds the whole screen.
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, isTTSSupported, speechNotice } = window.App.Speech;
  const { KANA, KANA_ROWS, KANA_GROUPS, KATAKANA_EXAMPLES } = window.App.Content;

  const QUIZ_LENGTH = 10;
  const SCRIPTS = [
    { key: "hira", label: "平假名" },
    { key: "kata", label: "片假名" },
    { key: "both", label: "兩樣" },
  ];

  // view: "menu" | "chart" | "see" | "hear" | "examples"
  // quiz: { questions, index, picked, results } while in see/hear
  const ui = { view: "menu", chartScript: "hira", openId: null, quiz: null, scrollFeedback: false };

  function reset() {
    ui.view = "menu";
    ui.openId = null;
    ui.quiz = null;
  }

  // ── helpers ──────────────────────────────────────────────────────────

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function rowLabel(row, script) {
    const first = KANA[row.cells[0]];
    const ch = script === "kata" ? first.kata : first.hira;
    return row.key === "n" ? ch : `${ch}行`;
  }

  // All practice items for the chosen rows/script: { id, char, script }.
  // Skips characters that don't exist in a script (外來語組合 have no
  // hiragana).
  function buildPool(rows, script) {
    const scripts = script === "both" ? ["hira", "kata"] : [script];
    const items = [];
    KANA_ROWS.filter((r) => rows.includes(r.key)).forEach((r) =>
      r.cells
        .filter(Boolean)
        .forEach((id) => scripts.forEach((s) => KANA[id][s] && items.push({ id, script: s, char: KANA[id][s] })))
    );
    return items;
  }

  function distinctRomaji(items) {
    return new Set(items.map((it) => KANA[it.id].romaji)).size;
  }

  // kana id → group key (seion / dakuon / handakuon / yoon / gairaigo)
  const GROUP_OF = {};
  KANA_ROWS.forEach((r) => r.cells.forEach((id) => id && (GROUP_OF[id] = r.group)));

  // Three distractors with romaji different from the answer and from each
  // other (so お/を or じ/ぢ can never both be "right"). Order of preference:
  // same group within the chosen range, rest of the range, same group in
  // the whole table, then anything of the same script — so a 拗音 question
  // gets 拗音 options (きゃ vs しゃ, not きゃ vs あ) whenever possible.
  function pickDistractors(target, pool) {
    const used = new Set([KANA[target.id].romaji]);
    const out = [];
    const sameScript = (list) => list.filter((it) => it.script === target.script);
    const sameGroup = (list) => list.filter((it) => GROUP_OF[it.id] === GROUP_OF[target.id]);
    const allOfScript = Object.keys(KANA)
      .filter((id) => KANA[id][target.script])
      .map((id) => ({ id, script: target.script, char: KANA[id][target.script] }));
    const inRange = sameScript(pool);
    [shuffle(sameGroup(inRange)), shuffle(inRange), shuffle(sameGroup(allOfScript)), shuffle(allOfScript)].forEach((cands) => {
      cands.forEach((c) => {
        const r = KANA[c.id].romaji;
        if (out.length < 3 && !used.has(r)) {
          used.add(r);
          out.push(c);
        }
      });
    });
    return out;
  }

  function buildQuiz(pool) {
    let order = [];
    while (order.length < QUIZ_LENGTH) order = order.concat(shuffle(pool));
    return order.slice(0, QUIZ_LENGTH).map((target) => ({
      target,
      options: shuffle([target, ...pickDistractors(target, pool)]),
    }));
  }

  // Does `word` contain the sound `char`? A match followed by a small
  // ャュョァィゥェォ is a different sound (シ in シャワー is シャ), so it
  // doesn't count.
  const SMALL = "ャュョァィゥェォゃゅょ";
  function containsSound(word, char) {
    let i = word.indexOf(char);
    while (i !== -1) {
      if (!SMALL.includes(word[i + char.length] || "")) return true;
      i = word.indexOf(char, i + 1);
    }
    return false;
  }

  function otherScript(script) {
    return script === "hira" ? "kata" : "hira";
  }

  // ── small display pieces ─────────────────────────────────────────────

  function romajiText(id) {
    const k = KANA[id];
    return h("span", null, k.romaji, k.romajiAlt && h("span", { class: "muted" }, `（亦寫 ${k.romajiAlt}）`));
  }

  function yueLine(id, settings, cls = "") {
    if (!settings.showYue) return null;
    const k = KANA[id];
    return h(
      "div",
      { class: `small ${cls}`.trim() },
      k.yue
        ? [
            `廣東話近似讀音：「${k.yue}」`,
            k.yueHint && h("span", { class: "muted" }, `（${k.yueHint}）`),
            h("span", { class: "xs muted", style: { display: "block", marginTop: "2px" } }, "只係近似，唔理聲調，以發音為準"),
          ]
        : h("span", { class: "muted" }, "廣東話冇對應，請聽發音")
    );
  }

  function speakButton(text, settings, label = "聽發音", cls = "") {
    if (!isTTSSupported()) return null;
    return h(
      "button",
      {
        class: `btn-soft ${cls}`.trim(),
        onclick: (e) => {
          e.stopPropagation();
          speak(text, settings);
        },
      },
      `🔊 ${label}`
    );
  }

  // ── detail sheet ─────────────────────────────────────────────────────

  function kanaDetail(ctx) {
    const { settings } = ctx;
    const id = ui.openId;
    const script = ui.chartScript;
    const k = KANA[id];
    const char = k[script];
    const scriptNote = script === "hira" ? k.hiraNote : k.kataNote;
    const examples = script === "kata" ? KATAKANA_EXAMPLES.filter((ex) => containsSound(ex.word, char)) : [];
    const close = () => {
      ui.openId = null;
      ctx.rerender();
    };

    return h(
      "div",
      { class: "sheet-wrap", style: window.App.UI.accentVars("kana") },
      h("div", { class: "sheet-backdrop", onclick: close }),
      h(
        "div",
        { class: "sheet", role: "dialog", "aria-modal": "true" },
        h(
          "div",
          { class: "row-between", style: { alignItems: "flex-start" } },
          h(
            "div",
            null,
            jp(char, "sheet-kana"),
            k[otherScript(script)]
              ? h("p", { class: "small muted mt-2" }, `${script === "hira" ? "片假名" : "平假名"}：`, jp(k[otherScript(script)]))
              : h("p", { class: "small muted mt-2" }, "只用喺片假名外來語")
          ),
          h("button", { class: "sheet-close", onclick: close, "aria-label": "關閉" }, "✕")
        ),
        settings.showRomaji && h("p", { class: "big-rom mt-3" }, romajiText(id)),
        yueLine(id, settings, "mt-2"),
        (k.note || scriptNote) &&
          h(
            "div",
            { class: "stack-sm mt-3" },
            k.note && h("p", { class: "note blue" }, `💡 ${k.note}`),
            scriptNote && h("p", { class: "note gold" }, `👀 ${scriptNote}`)
          ),
        speakButton(char, settings, "聽發音", "w-full mt-4"),
        examples.length > 0 &&
          h(
            "div",
            { class: "mt-4" },
            h("p", { class: "caption mb-2" }, "喺日本會見到"),
            h(
              "div",
              { class: "stack-sm" },
              examples.map((ex) =>
                h(
                  "button",
                  { class: "ex-row", onclick: () => speak(ex.word, settings) },
                  h(
                    "span",
                    null,
                    jp(ex.word, "ex-word-inline"),
                    settings.showRomaji && h("span", { class: "small muted", style: { marginLeft: "8px" } }, ex.romaji)
                  ),
                  h("span", { class: "small" }, `${ex.meaning} 🔊`)
                )
              )
            )
          )
      )
    );
  }

  // ── chart ────────────────────────────────────────────────────────────

  function kanaChart(ctx) {
    const { settings, kana } = ctx;
    const script = ui.chartScript;
    return h(
      "div",
      null,
      modHeader("字表", () => {
        ui.view = "menu";
        ctx.rerender({ scrollTop: true });
      }),
      h(
        "div",
        { class: "chips-fill mb-3" },
        SCRIPTS.slice(0, 2).map((s) =>
          chip(s.label, script === s.key, () => {
            ui.chartScript = s.key;
            ctx.rerender();
          })
        )
      ),
      h("p", { class: "xs muted mb-3" }, "撳一個字：聽發音、睇讀音同提示。紅點 = 之前答錯過"),
      KANA_GROUPS.filter((g) => !(g.kataOnly && script === "hira")).map((g) =>
        h(
          "div",
          { class: "card accent mb-4" },
          h("p", { class: "h-heading accent-text" }, g.label),
          h("p", { class: "xs muted mb-3" }, g.note),
          KANA_ROWS.filter((r) => r.group === g.key).map((r) =>
            h(
              "div",
              { class: "kana-grid", style: g.cols ? { gridTemplateColumns: `repeat(${g.cols}, 1fr)` } : null },
              r.cells.map((id) => {
                if (!id) return h("div");
                const char = KANA[id][script];
                return h(
                  "button",
                  {
                    class: "kana-cell",
                    "aria-label": `${char} ${KANA[id].romaji}`,
                    onclick: () => {
                      speak(char, settings);
                      ui.openId = id;
                      ctx.rerender();
                    },
                  },
                  jp(char),
                  settings.showRomaji && h("span", { class: "rom" }, KANA[id].romaji),
                  kana.mistakes.includes(char) && h("span", { class: "dot" })
                );
              })
            )
          ),
          // 聽對比 pairs for the group (e.g. びょういん／びよういん under 拗音)
          g.contrast && h("div", { class: "mt-4" }, window.App.Sounds.pairList(g.contrast, settings))
        )
      )
    );
  }

  // ── quiz (看字選音 / 聽音選字) ───────────────────────────────────────

  // Built from the menu tap so that, for 聽音選字, the first sound plays
  // inside the same user gesture (iOS requirement).
  function startQuiz(ctx, mode, pool) {
    ui.quiz = { pool, questions: buildQuiz(pool), index: 0, picked: null, results: [] };
    ui.view = mode;
    if (mode === "hear") speak(ui.quiz.questions[0].target.char, ctx.settings);
    ctx.rerender({ scrollTop: true });
  }

  function kanaQuiz(ctx) {
    const { settings } = ctx;
    const quiz = ui.quiz;
    const hear = ui.view === "hear";
    const title = hear ? "聽音選字" : "看字選音";
    const back = () => {
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };

    if (quiz.index >= quiz.questions.length) return quizResult(ctx, title, back);

    const q = quiz.questions[quiz.index];
    const answered = quiz.picked !== null;
    const gotIt = answered && q.options[quiz.picked].char === q.target.char;
    const correctSoFar = quiz.results.filter((r) => r.correct).length;

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = q.options[i].char === q.target.char;
      quiz.picked = i;
      quiz.results.push({ char: q.target.char, id: q.target.id, correct });
      if (!hear) speak(q.target.char, settings);
      ui.scrollFeedback = true;
      ctx.onAnswer(q.target.char, correct); // saves + rerenders
    }

    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (hear && quiz.index < quiz.questions.length) speak(quiz.questions[quiz.index].target.char, settings);
      ctx.rerender({ scrollTop: true });
    }

    const prompt = hear
      ? h(
          "div",
          { class: "card accent center mb-4" },
          h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, "聽下係邊個字？"),
          h("button", { class: "hear-btn", onclick: () => speak(q.target.char, settings), "aria-label": "再聽一次" }, "🔊"),
          h("p", { class: "xs muted mt-3" }, "撳喇叭可以再聽")
        )
      : h(
          "div",
          { class: "card accent center mb-4" },
          h("p", { class: "muted mb-1", style: { fontWeight: 700 } }, "呢個字點讀？"),
          jp(q.target.char, "quiz-kana")
        );

    const options = h(
      "div",
      { class: "opt-grid" },
      q.options.map((opt, i) => {
        const isAnswer = opt.char === q.target.char;
        let state = "";
        if (answered && isAnswer) state = "correct";
        else if (answered && i === quiz.picked) state = "wrong";
        else if (answered) state = "dim";
        return h(
          "button",
          { class: `opt ${state}`.trim(), disabled: answered, onclick: () => pick(i) },
          hear ? jp(opt.char) : KANA[opt.id].romaji
        );
      })
    );

    let feedback = null;
    if (answered) {
      const t = q.target;
      // data-autoscroll: app.js scrolls this into view (clear of the tab
      // bar) right after the screen is mounted — only on the answering tap.
      const autoscroll = ui.scrollFeedback;
      ui.scrollFeedback = false;
      feedback = h(
        "div",
        { class: "card mt-4 feedback", "data-autoscroll": autoscroll ? "end" : null },
        h("p", { class: `fb-title ${gotIt ? "ok" : "no"}` }, gotIt ? "✅ 啱咗！" : "❌ 唔啱，答案係："),
        h(
          "div",
          { class: "row mt-1" },
          jp(t.char, "fb-kana"),
          h(
            "div",
            null,
            (settings.showRomaji || !hear) && h("p", { class: "big-rom", style: { fontSize: "1.25rem" } }, romajiText(t.id)),
            KANA[t.id][otherScript(t.script)] &&
              h("p", { class: "small muted" }, `${t.script === "hira" ? "片假名" : "平假名"}：`, jp(KANA[t.id][otherScript(t.script)]))
          )
        ),
        yueLine(t.id, settings, "mt-2"),
        KANA[t.id].note && h("p", { class: "small muted mt-2" }, `💡 ${KANA[t.id].note}`),
        h(
          "div",
          { class: "row-sm mt-4" },
          speakButton(t.char, settings, "再聽"),
          inkButton(quiz.index + 1 < QUIZ_LENGTH ? "下一題 →" : "睇結果", next, { class: "grow" })
        )
      );
    }

    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${QUIZ_LENGTH} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `啱 ${correctSoFar} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / QUIZ_LENGTH) * 100}%` } })),
      prompt,
      options,
      feedback
    );
  }

  function quizResult(ctx, title, back) {
    const { settings } = ctx;
    const quiz = ui.quiz;
    const score = quiz.results.filter((r) => r.correct).length;
    const wrong = quiz.results.filter((r) => !r.correct);
    const restart = () => startQuiz(ctx, ui.view, quiz.pool);

    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "card accent center" },
        h("p", { style: { fontSize: "3rem", marginBottom: "8px" } }, score === QUIZ_LENGTH ? "🎉" : score >= 7 ? "👍" : "💪"),
        h("p", { class: "score" }, `${score} / ${QUIZ_LENGTH}`),
        h(
          "p",
          { class: "muted mt-1", style: { fontWeight: 700 } },
          score === QUIZ_LENGTH ? "全對！好嘢！" : score >= 7 ? "唔錯！再練多幾次就熟" : "慢慢嚟，多聽多睇就會記得"
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
        h("div", { class: "stack mt-4" }, inkButton("再嚟一輪", restart, { class: "w-full" }), inkButton("返回五十音", back, { accent: true, class: "w-full" }))
      )
    );
  }

  // ── 片假名實例 ───────────────────────────────────────────────────────

  function katakanaExamples(ctx) {
    const { settings } = ctx;
    const scenes = [...new Set(KATAKANA_EXAMPLES.map((e) => e.scene))];
    const tts = isTTSSupported();
    return h(
      "div",
      null,
      modHeader("片假名實例", () => {
        ui.view = "menu";
        ctx.rerender({ scrollTop: true });
      }),
      h(
        "p",
        { class: "small muted mb-4" },
        "外來語多數用片假名寫。以下都係喺日本餐牌、商店、酒店、車站成日見到嘅字。撳一下聽發音。"
      ),
      scenes.map((scene) =>
        h(
          "div",
          { class: "mb-4" },
          h("p", { class: "caption mb-2" }, scene),
          h(
            "div",
            { class: "stack-sm" },
            KATAKANA_EXAMPLES.filter((e) => e.scene === scene).map((ex) =>
              h(
                "button",
                { class: "ex-card", onclick: () => speak(ex.word, settings) },
                h(
                  "span",
                  { class: "grow" },
                  h("span", { lang: "ja", class: "jp ex-word" }, ex.word),
                  settings.showRomaji && h("span", { class: "ex-rom" }, ex.romaji)
                ),
                h("span", { class: "row-sm", style: { flexShrink: 0 } }, h("span", { class: "ex-mean" }, ex.meaning), tts && h("span", { style: { fontSize: "1.25rem" } }, "🔊"))
              )
            )
          )
        )
      )
    );
  }

  // ── menu ─────────────────────────────────────────────────────────────

  function menuCard(emoji, title, sub, onclick) {
    return h(
      "button",
      { class: "mod-row live", onclick },
      h("span", { class: "mod-icon" }, emoji),
      h("span", { class: "grow" }, h("span", { class: "mod-title" }, title), h("span", { class: "mod-sub" }, sub))
    );
  }

  function rangePicker(ctx) {
    const prefs = ctx.kana.prefs;
    const script = prefs.script === "kata" ? "kata" : "hira";
    const toggleRow = (key) =>
      ctx.onPrefsChange({ rows: prefs.rows.includes(key) ? prefs.rows.filter((r) => r !== key) : [...prefs.rows, key] });
    const setGroup = (groupKey, on) => {
      const keys = KANA_ROWS.filter((r) => r.group === groupKey).map((r) => r.key);
      const rest = prefs.rows.filter((r) => !keys.includes(r));
      ctx.onPrefsChange({ rows: on ? [...rest, ...keys] : rest });
    };
    return h(
      "div",
      { class: "stack" },
      KANA_GROUPS.map((g) => {
        const rows = KANA_ROWS.filter((r) => r.group === g.key);
        const allOn = rows.every((r) => prefs.rows.includes(r.key));
        // One chip for the whole group (外來語組合)
        if (g.single)
          return h(
            "div",
            null,
            h("span", { class: "small mb-1", style: { display: "block" } }, g.label),
            h(
              "div",
              { class: "wrap" },
              chip(g.kataOnly ? `${g.label}（只限片假名）` : g.label, allOn, () => setGroup(g.key, !allOn))
            ),
            g.kataOnly &&
              allOn &&
              prefs.script === "hira" &&
              h("p", { class: "xs muted mt-1" }, "揀咗「平假名」，所以呢組唔會出題")
          );
        return h(
          "div",
          null,
          h(
            "div",
            { class: "row-between mb-1" },
            h("span", { class: "small" }, g.label),
            h("button", { class: "link-btn", onclick: () => setGroup(g.key, !allOn) }, allOn ? "全部取消" : "全選")
          ),
          h(
            "div",
            { class: "wrap" },
            rows.map((r) => chip(rowLabel(r, script), prefs.rows.includes(r.key), () => toggleRow(r.key), { lang: "ja", class: "row-chip jp" }))
          )
        );
      })
    );
  }

  function kanaMenu(ctx) {
    const { kana } = ctx;
    const prefs = kana.prefs;
    const pool = buildPool(prefs.rows, prefs.script);
    const enough = distinctRomaji(pool) >= 4;
    const tts = isTTSSupported();
    const learnt = Object.values(kana.stats).filter((s) => s.c > 0).length;
    const go = (view) => {
      ui.view = view;
      if (view === "chart") ui.chartScript = prefs.script === "kata" ? "kata" : "hira";
      if (view === "contrast") window.App.Contrast.reset();
      ctx.rerender({ scrollTop: true });
    };

    return h(
      "div",
      null,
      modHeader("五十音", ctx.onBack),
      (() => {
        const n = speechNotice();
        return n && h("div", { class: "mb-4" }, n);
      })(),
      h(
        "div",
        { class: "stack mb-4" },
        menuCard("📋", "字表", "清音・濁音・半濁音，撳字聽發音", () => go("chart")),
        menuCard("🪧", "片假名實例", "餐牌、商店、酒店見到嘅字", () => go("examples")),
        menuCard("👂", "清濁對比", "か／が 並排聽，練分辨清音濁音", () => go("contrast")),
        menuCard("⏸️", "促音・長音", "きて／きって、おばさん／おばあさん", () => go("sounds"))
      ),
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "練習"),
        h("p", { class: "xs muted mb-3" }, `每輪 ${QUIZ_LENGTH} 題。已經答啱過嘅字：${learnt} / ${window.App.Content.KANA_TOTAL}`),
        h("p", { class: "small mb-1" }, "練邊種？"),
        h(
          "div",
          { class: "chips-fill mb-4" },
          SCRIPTS.map((s) => chip(s.label, prefs.script === s.key, () => ctx.onPrefsChange({ script: s.key })))
        ),
        h("p", { class: "small mb-1" }, "練習範圍"),
        rangePicker(ctx),
        h(
          "p",
          { class: "xs mt-3", style: { color: enough ? "var(--muted)" : "var(--stamp)" } },
          enough ? `揀咗 ${pool.length} 個字` : "揀多啲行（最少要有 4 個唔同讀音先出到題）"
        ),
        h(
          "div",
          { class: "stack mt-4" },
          inkButton("👀 看字選音", () => startQuiz(ctx, "see", pool), { accent: true, disabled: !enough, class: "w-full" }),
          inkButton("👂 聽音選字", () => startQuiz(ctx, "hear", pool), { accent: true, disabled: !enough || !tts, class: "w-full" }),
          !tts && h("p", { class: "xs muted" }, "呢個瀏覽器冇發音功能，所以用唔到聽音選字")
        )
      )
    );
  }

  // ctx: { settings, kana, onPrefsChange, onAnswer, onBack, rerender }
  // Returns { main, overlay } — the sheet must sit outside the page's
  // stacking context so it covers the tab bar.
  function render(ctx) {
    let main;
    if (ui.view === "chart") main = kanaChart(ctx);
    else if ((ui.view === "see" || ui.view === "hear") && ui.quiz) main = kanaQuiz(ctx);
    else if (ui.view === "examples") main = katakanaExamples(ctx);
    else if (ui.view === "sounds")
      main = window.App.Sounds.render(ctx, () => {
        ui.view = "menu";
        ctx.rerender({ scrollTop: true });
      });
    else if (ui.view === "contrast")
      main = window.App.Contrast.render(ctx, () => {
        ui.view = "menu";
        ctx.rerender({ scrollTop: true });
      });
    else {
      ui.view = "menu";
      main = kanaMenu(ctx);
    }
    const overlay = ui.view === "chart" && ui.openId ? kanaDetail(ctx) : null;
    return { main, overlay };
  }

  // `helpers` are shared with js/contrast.js (清濁對比) so both screens
  // display romaji / 廣東話近似讀音 / speak buttons identically.
  window.App.KanaModule = { render, reset, helpers: { shuffle, romajiText, yueLine, speakButton, otherScript, QUIZ_LENGTH } };
})();
