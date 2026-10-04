// 口語練習 + 口語重溫 (stage 6).
//
// A 句子庫 sentence is shown as its 廣東話意思 + 使用場合; the user says the
// Japanese. Only "🗣️ 你講" sentences (me / both) are practised.
// Three ways to answer (same scoring for the first two):
//   voice     語音辨識 (Web Speech API SpeechRecognition, ja-JP)
//             – needs internet, unless Chrome has the ja-JP on-device pack
//               (processLocally); NOT available in iPhone home-screen apps
//   dictation 鍵盤聽寫: type/dictate into a box with the phone keyboard's
//             🎤 (works in iPhone home-screen apps — no web mic permission)
//   self      自己對答案: reveal the answer and judge yourself (always works)
//
// Scoring: heard text vs the sentence written both ways (漢字原句 and the
// full kana reading); best of up to 5 recognition alternatives.
//   ≥ 90% ✅  60–90% 🟡  < 60% ❌   (🟡 and ❌ count as wrong)
// Only the FIRST attempt of a question is recorded (再試 doesn't count);
// 「其實我讀啱 ✔」 turns a wrong first attempt into correct before it is
// recorded (recorded when moving on with 下一題).
// Wrong → 錯題重溫 item "s:<id>" (口語, kept apart from 聽力 "p:<id>").
// 🚩-flagged sentences are not asked (their audio is wrong).
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, chip } = window.App.UI;
  const { speak, isTTSSupported } = window.App.Speech;
  const { Storage } = window.App;

  const COUNTS = [5, 10, 20];
  const REVIEW_MAX = 10;
  const GOOD = 0.9;
  const NEAR = 0.6;

  // ── matching ─────────────────────────────────────────────────────────

  const KANJI_DIGITS = "〇一二三四五六七八九";

  // Compare "sounds", not writing: NFKC (full/half width), lower-case,
  // single digits → 漢数字, katakana → hiragana, punctuation/spaces out.
  function norm(s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[0-9]/g, (d) => KANJI_DIGITS[+d])
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s。、，．,.?？!！「」『』（）()・\-~〜…:：;；"'“”‘’]/g, "");
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function similarity(a, b) {
    const n = Math.max(a.length, b.length);
    return n === 0 ? 0 : 1 - lev(a, b) / n;
  }

  // p: a 句子庫 sentence; alts: recognised/typed strings (best first).
  // → { sim, grade: "good"|"near"|"bad", best } — best = the alternative used.
  function score(p, alts) {
    const targets = [norm(p.ja), norm(p.kana)];
    let sim = 0;
    let best = "";
    (alts || []).forEach((alt) => {
      const a = norm(alt);
      if (!a) return;
      targets.forEach((t) => {
        const s = similarity(a, t);
        if (s > sim) {
          sim = s;
          best = alt;
        }
      });
    });
    return { sim, grade: sim >= GOOD ? "good" : sim >= NEAR ? "near" : "bad", best };
  }

  const GRADE_TEXT = { good: "✅ 啱！", near: "🟡 差少少", bad: "❌ 唔啱" };

  // ── what this phone can do ───────────────────────────────────────────

  const SR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () =>
    window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  // Chrome on-device ja-JP pack? Checked once (async), then cached.
  let localJa = false;
  let localChecked = false;
  function checkLocal() {
    if (localChecked) return;
    localChecked = true;
    const Ctor = SR();
    if (!Ctor || typeof Ctor.available !== "function") return;
    try {
      Promise.resolve(Ctor.available({ langs: ["ja-JP"], processLocally: true }))
        .then((r) => {
          if (r === "available" && !localJa) {
            localJa = true;
            if (window.App.render) window.App.render();
          }
        })
        .catch(() => {});
    } catch (e) {}
  }

  // { ok, reason, note }
  function voiceStatus() {
    checkLocal();
    if (!SR()) return { ok: false, reason: "呢個瀏覽器唔支援語音辨識（例如 Firefox）。" };
    if (isIOS() && isStandalone())
      return {
        ok: false,
        reason:
          "Apple 未開放主畫面 app 用語音辨識。想用就喺 Safari 打開（但 Safari 同主畫面版嘅進度係分開嘅）；主畫面版可以用「鍵盤聽寫」。",
      };
    if (!navigator.onLine && !localJa)
      return { ok: false, reason: "📴 而家冇網絡：語音辨識要上網（由 Apple／Google 處理）。可以用「鍵盤聽寫」或者「自己對答案」。" };
    return {
      ok: true,
      note: localJa ? "✅ 日文離線辨識已啟用：錄音留喺手機入面。" : "錄音會傳去 Apple／Google 處理，所以要上網。第一次用要允許使用咪。",
    };
  }

  // The mode actually used: voice falls back to 自己對答案 when unavailable.
  function effectiveMode(pref) {
    return pref === "voice" && !voiceStatus().ok ? "self" : pref;
  }

  function micMessage(err) {
    switch (err) {
      case "not-allowed":
      case "service-not-allowed":
        return "用唔到咪：請允許咪權限。iPhone：設定 → Safari → 咪；Android：撳網址列左邊嘅 🔒 → 權限。（iPhone 亦要開啟「設定 → 一般 → 鍵盤 → 啟用聽寫」。）";
      case "no-speech":
        return "冇聽到聲音，請再撳 🎤 試一次。";
      case "audio-capture":
        return "搵唔到咪，請檢查手機有冇咪。";
      case "network":
        return "網絡有問題，辨識唔到。請再試，或者轉用「鍵盤聽寫」／「自己對答案」。";
      case "language-not-supported":
        return "呢部裝置未支援日文辨識。請轉用「鍵盤聽寫」或者「自己對答案」。";
      case "aborted":
        return "已取消。";
      default:
        return "辨識失敗，請再試一次。";
    }
  }

  // ── sentence pool ────────────────────────────────────────────────────

  const scenes = () => window.App.Content.PHRASE_SCENES;
  let allCache = null;
  // Sentences the user says (me / both), with their scene.
  function allMine() {
    if (!allCache) {
      allCache = [];
      scenes().forEach((s) =>
        s.phrases.forEach((p) =>
          [p, ...(p.replies || [])].forEach((x) => {
            if (x.who === "me" || x.who === "both") allCache.push({ p: x, scene: s });
          })
        )
      );
    }
    return allCache;
  }
  const byId = (id) => allMine().find((x) => x.p.id === id) || null;

  function practicePool(prefs, flags) {
    const mine = allMine().filter((x) => prefs.scenes.includes(x.scene.key));
    const usable = mine.filter((x) => !flags.includes(x.p.id));
    return { usable, skippedFlagged: mine.length - usable.length };
  }

  function dueItems(state) {
    const today = Storage.todayLocal();
    return Object.entries(state.review.items)
      .filter(([key, it]) => key.startsWith("s:") && it.due <= today)
      .filter(([key]) => byId(key.slice(2)) && !state.flags.includes(key.slice(2)))
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0));
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── session state ────────────────────────────────────────────────────

  // view: "menu" | "quiz".  quiz: { kind: "practice"|"review", mode,
  // questions, index, results[] }.  q: state of the current question.
  const ui = { view: "menu", quiz: null, q: null, scrollFeedback: false };
  let rec = null; // active SpeechRecognition

  function newQ() {
    ui.q = { phase: "ask", typed: "", interim: "", msg: "", hint: false, sim: 0, grade: null, heard: "", attempt: 0 };
  }

  function stopRec() {
    if (rec) {
      try {
        rec.onend = rec.onresult = rec.onerror = null;
        rec.abort();
      } catch (e) {}
      rec = null;
    }
  }

  function reset() {
    stopRec();
    ui.view = "menu";
    ui.quiz = null;
    ui.q = null;
  }

  // Built in the start tap (user gesture).
  function start(ctx, kind) {
    const state = ctx.state;
    const mode = effectiveMode(state.speak.prefs.mode);
    let questions;
    if (kind === "review") {
      questions = shuffle(dueItems(state).slice(0, REVIEW_MAX)).map(([key]) => byId(key.slice(2)));
    } else {
      const { usable } = practicePool(state.speak.prefs, state.flags);
      let order = [];
      while (usable.length && order.length < state.speak.prefs.count) order = order.concat(shuffle(usable));
      questions = order.slice(0, state.speak.prefs.count);
    }
    if (!questions.length) return;
    ui.quiz = { kind, mode, questions, index: 0, results: [] };
    ui.view = "quiz";
    newQ();
    ctx.rerender({ scrollTop: true });
  }

  // Record the first attempt of the current question (once). Called when
  // moving on, so 其實我讀啱 can still change it.
  function commit(ctx) {
    const quiz = ui.quiz;
    const r = quiz.results[quiz.index];
    if (!r || r.recorded) return;
    r.recorded = true;
    ctx.onAnswer(quiz.questions[quiz.index], r.correct, quiz.kind);
  }

  function finishScore(ctx, grade, sim, heard) {
    const quiz = ui.quiz;
    const q = ui.q;
    q.phase = "scored";
    q.attempt = (q.attempt || 0) + 1; // 1 = the attempt that counts
    q.grade = grade;
    q.sim = sim;
    q.heard = heard;
    if (!quiz.results[quiz.index]) {
      // first attempt of this question counts
      quiz.results[quiz.index] = { grade, correct: grade === "good", recorded: false };
    }
    ui.scrollFeedback = true;
    ctx.rerender();
  }

  // ── voice recognition ────────────────────────────────────────────────

  function updateLive() {
    const el = document.getElementById("live-heard");
    if (el && ui.q) el.textContent = ui.q.interim || "…";
  }

  function listen(ctx) {
    const Ctor = SR();
    const q = ui.q;
    const target = ui.quiz.questions[ui.quiz.index].p;
    stopRec();
    q.msg = "";
    q.interim = "";
    const alts = [];
    let lastErr = null;
    try {
      rec = new Ctor();
      rec.lang = "ja-JP";
      rec.interimResults = true;
      rec.maxAlternatives = 5;
      rec.continuous = false;
      if (localJa) rec.processLocally = true;
      rec.onresult = (e) => {
        const res = e.results[e.results.length - 1];
        q.interim = res[0].transcript;
        updateLive();
        if (res.isFinal) {
          alts.length = 0;
          for (let i = 0; i < res.length; i++) alts.push(res[i].transcript);
        }
      };
      rec.onerror = (e) => {
        lastErr = e.error;
      };
      rec.onend = () => {
        rec = null;
        if (!alts.length && q.interim) alts.push(q.interim); // stopped before a final result
        if (alts.length) {
          const s = score(target, alts);
          finishScore(ctx, s.grade, s.sim, s.best || alts[0]);
        } else {
          q.phase = "ask";
          q.msg = micMessage(lastErr || "no-speech");
          ctx.rerender();
        }
      };
      q.phase = "listening";
      rec.start();
      ctx.rerender();
    } catch (e) {
      rec = null;
      q.phase = "ask";
      q.msg = micMessage(e && e.name === "NotAllowedError" ? "not-allowed" : "other");
      ctx.rerender();
    }
  }

  function checkTyped(ctx) {
    const q = ui.q;
    const target = ui.quiz.questions[ui.quiz.index].p;
    if (!norm(q.typed)) {
      q.msg = "請先用鍵盤聽寫（或者打字）輸入你讀嘅日文。";
      ctx.rerender();
      return;
    }
    const s = score(target, [q.typed]);
    finishScore(ctx, s.grade, s.sim, q.typed);
  }

  // ── screens ──────────────────────────────────────────────────────────

  function answerBlock(p, settings) {
    return [
      h("p", { lang: "ja", class: "jp phrase-ja mt-1" }, p.ja),
      p.kana !== p.ja && h("p", { lang: "ja", class: "jp phrase-kana" }, p.kana),
      settings.showRomaji && h("p", { class: "phrase-rom" }, p.romaji),
    ];
  }

  function hintText(p) {
    if (p.kana !== p.ja) return p.kana;
    const n = Math.ceil(p.ja.length / 2);
    return p.ja.slice(0, n) + "…";
  }

  function quizScreen(ctx) {
    const { state } = ctx;
    const settings = state.settings;
    const quiz = ui.quiz;
    const q = ui.q;
    const total = quiz.questions.length;
    const title = quiz.kind === "review" ? "口語重溫" : "口語練習";
    const back = () => {
      stopRec();
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return resultScreen(ctx, title, back);

    const item = quiz.questions[quiz.index];
    const p = item.p;
    const result = quiz.results[quiz.index];
    const tts = isTTSSupported();

    function next() {
      commit(ctx);
      quiz.index += 1;
      newQ();
      ctx.rerender({ scrollTop: true });
    }
    function retry() {
      q.phase = "ask";
      q.msg = "";
      q.interim = "";
      q.typed = "";
      ctx.rerender();
    }

    // prompt: meaning + scene
    const prompt = h(
      "div",
      { class: "card accent center mb-4" },
      h("p", { class: "caption" }, `${item.scene.emoji} ${item.scene.label}`),
      h("p", { class: "speak-yue" }, p.yue),
      h("p", { class: "phrase-use" }, p.use),
      q.phase === "ask" || q.phase === "listening"
        ? q.hint
          ? h("p", { lang: "ja", class: "jp speak-hint" }, `💡 ${hintText(p)}`)
          : h("button", { class: "btn-soft mt-3", onclick: () => ((q.hint = true), ctx.rerender()) }, "💡 提示")
        : null
    );

    // answer area by phase
    let body = null;
    if (q.phase === "ask" || q.phase === "listening") {
      if (quiz.mode === "voice") {
        const listening = q.phase === "listening";
        body = h(
          "div",
          { class: "center" },
          h(
            "button",
            {
              class: `mic-btn ${listening ? "on" : ""}`.trim(),
              onclick: () => (listening ? rec && rec.stop() : listen(ctx)),
              "aria-label": listening ? "停止" : "開始讀",
            },
            listening ? "⏹" : "🎤"
          ),
          h("p", { class: "small muted mt-2" }, listening ? "聽緊…讀完會自動停止（或者撳 ⏹）" : "撳 🎤，然後讀出日文"),
          listening && h("p", { id: "live-heard", lang: "ja", class: "jp live-heard" }, q.interim || "…"),
          q.msg && h("p", { class: "notice mt-3", style: { textAlign: "left" } }, q.msg)
        );
      } else if (quiz.mode === "dictation") {
        body = h(
          "div",
          null,
          h("input", {
            type: "text",
            lang: "ja",
            class: "dict-input",
            value: q.typed,
            placeholder: "喺度用日文鍵盤聽寫…",
            autocomplete: "off",
            autocapitalize: "off",
            autocorrect: "off",
            spellcheck: "false",
            enterkeyhint: "done",
            "aria-label": "用日文鍵盤聽寫你讀嘅句子",
            oninput: (e) => (q.typed = e.target.value),
            onkeydown: (e) => {
              if (e.key === "Enter") checkTyped(ctx);
            },
          }),
          h("p", { class: "xs muted mt-2" }, "撳輸入框 → 鍵盤切去日文（撳 🌐）→ 撳鍵盤上嘅 🎤 讀出句子 → 撳「對答案」。"),
          q.msg && h("p", { class: "notice mt-2" }, q.msg),
          inkButton("對答案", () => checkTyped(ctx), { accent: true, class: "w-full mt-3" })
        );
      } else {
        body = h(
          "div",
          null,
          h("p", { class: "small muted center mb-3" }, "先自己讀出嚟，然後撳「顯示答案」。"),
          inkButton("顯示答案", () => {
            q.phase = "reveal";
            if (tts) speak(p.say || p.ja, settings);
            ctx.rerender();
          }, { accent: true, class: "w-full" })
        );
      }
    }

    // self-check: answer shown, user judges
    if (q.phase === "reveal") {
      body = h(
        "div",
        { class: "card feedback" },
        h("p", { class: "caption" }, "正確答案"),
        answerBlock(p, settings),
        tts && h("button", { class: "btn-soft w-full mt-3", onclick: () => speak(p.say || p.ja, settings) }, "🔊 再聽"),
        h("p", { class: "small mt-3 mb-2" }, "你讀得啱唔啱？"),
        h(
          "div",
          { class: "row-sm" },
          h("button", { class: "btn-soft grow", onclick: () => finishScore(ctx, "good", 1, "") }, "✅ 我讀啱"),
          h("button", { class: "btn-soft grow", onclick: () => finishScore(ctx, "bad", 0, "") }, "❌ 要再練")
        )
      );
    }

    // scored feedback
    if (q.phase === "scored") {
      const selfMode = quiz.mode === "self";
      const first = q.attempt === 1; // retries don't count
      const overridden = first && result && result.correct && q.grade !== "good";
      const autoscroll = ui.scrollFeedback;
      ui.scrollFeedback = false;
      body = h(
        "div",
        { class: "card feedback", "data-autoscroll": autoscroll ? "end" : null },
        h(
          "p",
          { class: `fb-title ${(first ? result && result.correct : q.grade === "good") ? "ok" : "no"}` },
          overridden ? "✅ 已當作答啱" : first ? GRADE_TEXT[q.grade] : `${GRADE_TEXT[q.grade]}（再試，唔計分）`
        ),
        !selfMode && h("p", { class: "small muted mt-1" }, `聽到／輸入：`, jp(q.heard || "（冇）"), `　相似度 ${Math.round(q.sim * 100)}%`),
        h("p", { class: "caption mt-2" }, "正確答案"),
        answerBlock(p, settings),
        tts && h("button", { class: "btn-soft w-full mt-3", onclick: () => speak(p.say || p.ja, settings) }, "🔊 聽正確讀音"),
        h(
          "div",
          { class: "row-sm mt-3" },
          h("button", { class: "btn-soft grow", onclick: retry }, "🔁 再試（唔計分）"),
          !selfMode &&
            first &&
            q.grade !== "good" &&
            !(result && result.correct) &&
            h("button", { class: "btn-soft grow", onclick: () => ((result.correct = true), ctx.rerender()) }, "其實我讀啱 ✔")
        ),
        result && !result.correct && h("p", { class: "xs muted mt-2" }, first ? "答錯嘅句子會加入「口語重溫」。" : "第一次冇答啱，已記錄為答錯，會加入「口語重溫」。"),
        inkButton(quiz.index + 1 < total ? "下一題 →" : "睇結果", next, { class: "w-full mt-3" })
      );
    }

    const correctSoFar = quiz.results.filter((r) => r && r.correct).length;
    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "row-between mb-2" },
        h("span", { class: "caption" }, `第 ${quiz.index + 1} / ${total} 題`),
        h("span", { class: "caption", style: { color: "var(--gold-dark)" } }, `啱 ${correctSoFar} 題`)
      ),
      h("div", { class: "bar accent mb-4" }, h("div", { style: { width: `${(quiz.index / total) * 100}%` } })),
      prompt,
      body
    );
  }

  function resultScreen(ctx, title, back) {
    const settings = ctx.state.settings;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const rs = quiz.results;
    const score_ = rs.filter((r) => r && r.correct).length;
    const wrong = quiz.questions.filter((_, i) => rs[i] && !rs[i].correct);
    const review = quiz.kind === "review";
    return h(
      "div",
      null,
      modHeader(title, back),
      h(
        "div",
        { class: "card accent center" },
        h("p", { style: { fontSize: "3rem", marginBottom: "8px" } }, score_ === total ? "🎉" : score_ >= total * 0.7 ? "👍" : "💪"),
        h("p", { class: "score" }, `${score_} / ${total}`),
        h(
          "p",
          { class: "muted mt-1", style: { fontWeight: 700 } },
          review ? "答錯嘅今日會再出，答啱嘅會隔幾日先再重溫" : score_ === total ? "全部啱！" : "答錯嘅已經加入「口語重溫」"
        ),
        wrong.length > 0 &&
          h(
            "div",
            { class: "mt-4", style: { textAlign: "left" } },
            h("p", { class: "caption mb-2" }, "要再練（撳一下聽正確讀音）"),
            h(
              "div",
              { class: "stack-sm" },
              wrong.map((it) =>
                h(
                  "button",
                  { class: "ex-card", onclick: () => speak(it.p.say || it.p.ja, settings) },
                  h("span", { class: "grow" }, h("span", { lang: "ja", class: "jp ex-word", style: { fontSize: "1.1rem" } }, it.p.ja), h("span", { class: "small" }, it.p.yue)),
                  h("span", null, "🔊")
                )
              )
            )
          ),
        h(
          "div",
          { class: "stack mt-4" },
          !review && inkButton("再嚟一輪", () => start(ctx, "practice"), { class: "w-full" }),
          inkButton("返回口語練習", back, { accent: true, class: "w-full" })
        )
      )
    );
  }

  // ── menu ─────────────────────────────────────────────────────────────

  const MODES = [
    { key: "voice", title: "🎤 語音辨識", desc: "對住咪讀，App 自動聽同評分" },
    { key: "dictation", title: "⌨️ 鍵盤聽寫", desc: "用手機鍵盤嘅 🎤 聽寫，再對答案（iPhone 主畫面版都用得）" },
    { key: "self", title: "✋ 自己對答案", desc: "自己讀出嚟，睇答案後自己判斷（冇網絡都用得）" },
  ];

  function dictationHelp() {
    return h(
      "div",
      { class: "note blue mt-2" },
      h("p", { class: "small mb-1" }, "加入日文鍵盤（只需做一次）"),
      h(
        "ul",
        { class: "rules" },
        h("li", null, "iPhone：設定 → 一般 → 鍵盤 → 鍵盤 → 新增鍵盤 → 日文"),
        h("li", null, "開啟聽寫：設定 → 一般 → 鍵盤 → 啟用聽寫"),
        h("li", null, "Android（Gboard）：設定 → 系統 → 語言 → 鍵盤 → Gboard → 語言 → 新增日文")
      ),
      h("p", { class: "small mt-2 mb-1" }, "點用"),
      h(
        "ul",
        { class: "rules" },
        h("li", null, "撳練習嘅輸入框，鍵盤出現後撳 🌐（或者長按）切換去日文鍵盤"),
        h("li", null, "撳鍵盤上嘅 🎤，讀出日文，手機會將讀音變成文字填入輸入框"),
        h("li", null, "撳「對答案」，用同語音辨識一樣嘅方法評分")
      ),
      h("p", { class: "xs muted mt-2" }, "聽寫出嚟嘅字有機會同答案唔同（漢字／假名），App 會容許。冇網絡時，聽寫能否使用要視乎手機。")
    );
  }

  function menu(ctx) {
    const { state } = ctx;
    const prefs = state.speak.prefs;
    const vs = voiceStatus();
    const eff = effectiveMode(prefs.mode);
    const due = dueItems(state);
    const waitingFlagged = Object.keys(state.review.items).filter(
      (k) => k.startsWith("s:") && state.review.items[k].due <= Storage.todayLocal() && state.flags.includes(k.slice(2))
    ).length;
    const { usable, skippedFlagged } = practicePool(prefs, state.flags);
    const mineScenes = scenes().filter((s) => allMine().some((x) => x.scene.key === s.key));
    const toggleScene = (key) =>
      ctx.onPrefsChange({ scenes: prefs.scenes.includes(key) ? prefs.scenes.filter((k) => k !== key) : [...prefs.scenes, key] });
    const later = Object.entries(state.review.items)
      .filter(([k, it]) => k.startsWith("s:") && it.due > Storage.todayLocal())
      .map(([, it]) => it.due)
      .sort()[0];

    return h(
      "div",
      null,
      modHeader("口語練習", ctx.onBack),

      // how to answer
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "點樣答？"),
        h("div", { class: "stack-sm mt-2" }, MODES.map((m) => modeOption(ctx, m, eff, vs))),
        eff === "dictation" && dictationHelp(),
        eff === "voice" && vs.note && h("p", { class: "xs muted mt-2" }, `🔒 ${vs.note}`),
        prefs.mode === "voice" && !vs.ok && h("p", { class: "notice mt-2" }, `${vs.reason}　而家會用「自己對答案」。`)
      ),

      // 口語重溫
      h(
        "div",
        { class: "card review-card mb-4" },
        h("p", { class: "h-heading" }, "📝 口語重溫"),
        due.length > 0 ? h("p", { class: "review-count" }, `今日要重溫 ${due.length} 句`) : h("p", { class: "small muted mt-1" }, "今日冇嘢要重溫 🎉"),
        due.length > REVIEW_MAX && h("p", { class: "xs muted" }, `每次最多 ${REVIEW_MAX} 題`),
        waitingFlagged > 0 && h("p", { class: "xs muted mt-1" }, `另有 ${waitingFlagged} 句標咗 🚩 讀錯，修正前唔會出`),
        later && h("p", { class: "xs muted mt-1" }, `下一批重溫：${later}`),
        h("p", { class: "xs muted mt-1" }, "第一次讀得 🟡 或 ❌ 嘅句會加入；重溫答啱隔 1、3、7、14 日再出，第 5 次答啱就畢業。"),
        inkButton("開始口語重溫", () => start(ctx, "review"), { disabled: due.length === 0, class: "w-full mt-3" })
      ),

      // practice settings
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🗣️ 睇意思讀日文"),
        h("p", { class: "xs muted mb-3" }, "畫面顯示廣東話意思，你讀出日文。只練「🗣️ 你講」嘅句子。"),
        h("p", { class: "small mb-1" }, "情境"),
        h("div", { class: "wrap mb-3" }, mineScenes.map((s) => chip(`${s.emoji} ${s.label}`, prefs.scenes.includes(s.key), () => toggleScene(s.key)))),
        h("p", { class: "small mb-1" }, "題數"),
        h("div", { class: "chips-fill" }, COUNTS.map((n) => chip(`${n} 題`, prefs.count === n, () => ctx.onPrefsChange({ count: n })))),
        h(
          "p",
          { class: "xs mt-3", style: { color: usable.length ? "var(--muted)" : "var(--stamp)" } },
          usable.length ? `可以出題嘅句子：${usable.length} 句${skippedFlagged ? `（略過 🚩 讀錯 ${skippedFlagged} 句）` : ""}` : "揀最少一個情境"
        ),
        inkButton("🎤 開始口語練習", () => start(ctx, "practice"), { accent: true, disabled: usable.length === 0, class: "w-full mt-3" })
      )
    );
  }

  function modeOption(ctx, m, eff, vs) {
    const disabled = m.key === "voice" && !vs.ok;
    const active = eff === m.key;
    return h(
      "button",
      {
        class: `mode-opt ${active ? "active" : ""} ${disabled ? "off" : ""}`.trim(),
        "aria-pressed": active ? "true" : "false",
        onclick: () => ctx.onPrefsChange({ mode: m.key }),
      },
      h("span", { class: "mode-title" }, m.title, disabled && h("span", { class: "mode-badge" }, "呢部手機用唔到")),
      h("span", { class: "mode-desc" }, m.key === "voice" && disabled ? vs.reason : m.desc)
    );
  }

  // ctx: { state, onPrefsChange, onAnswer(item, correct, kind), onBack, rerender }
  function render(ctx) {
    if (ui.view === "quiz" && ui.quiz && ui.q) return quizScreen(ctx);
    ui.view = "menu";
    return menu(ctx);
  }

  // For the 主頁 row: 口語 review items due today.
  function dueCount(state) {
    return dueItems(state).length;
  }

  window.App.Speaking = { render, reset, dueCount, score, norm, voiceStatus };
})();
