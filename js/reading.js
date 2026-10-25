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
//
// 階段 10 ⑪ 漢字標示・假朋友詞 (js/content/signs.js: SIGNS 44 in 9 groups, FALSE_FRIENDS 9): the same two question
// types and the same stats / 重溫 ("r:<word>") as the words above. A kanji item is spoken from its kana. 看詞選意思 for a
// 假朋友 always offers the meaning a Chinese reader wrongly guesses as one of the 4 options. The card's choices
// (groups, mode, count) are kept only while the app is open — no new saved state.
//
// 版本二 模擬餐牌 (menus: js/content/menus.js, 6 menus × 5 lines): a menu board is shown (name + price, no reading)
//   find  哪一行是「X」？   tap the line
//   max   最貴的是哪一行？  tap the line (only asked when the dearest line is unique)
//   min   最便宜的是哪一行？ (same, for the cheapest)
//   price 「X」要多少錢？   pick the price from 4 (prices of the same menu first)
// After answering, every line shows its reading + 中文. A wrong answer enters 錯題重溫 as "m:<menu id>:<line>";
// stats state.read.menu.stats["<menu id>:<line>"]; 認得 uses the same rule per line (30 lines).
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
  // 漢字標示・假朋友詞 (stage 10 ⑪, js/content/signs.js) use the same questions, stats and 重溫 as the
  // katakana words: state.read.stats[word], review key "r:<word>". A word is unique across the three lists.
  const signs = () => window.App.Content.SIGNS || [];
  const friends = () => window.App.Content.FALSE_FRIENDS || [];
  const signGroups = () => window.App.Content.SIGN_GROUPS || [];
  const FRIEND_KEY = "假朋友詞";
  const kindOf = (it) => (it.trapOpt ? "friend" : it.kana ? "sign" : "word");
  const sayOf = (it) => it.kana || it.word; // kanji are read from their kana
  const wordOf = (w) => words().find((x) => x.word === w) || signs().find((x) => x.word === w) || friends().find((x) => x.word === w) || null;
  const sceneList = () => [...new Set(words().map((x) => x.scene))];
  const menus = () => window.App.Content.MENUS;
  const menuOf = (id) => menus().find((m) => m.id === id) || null;
  const yen = (n) => `${n.toLocaleString("en-US")}円`;

  // The dearest / cheapest line of a menu when it is unique (else -1: such a question would be ambiguous).
  function extremes(menu) {
    const ps = menu.lines.map((l) => l.price);
    const at = (v) => (ps.indexOf(v) === ps.lastIndexOf(v) ? ps.indexOf(v) : -1);
    return { max: at(Math.max(...ps)), min: at(Math.min(...ps)) };
  }
  function eligibleTypes(menu, line) {
    const t = ["find", "price"];
    const e = extremes(menu);
    if (e.max === line) t.push("max");
    if (e.min === line) t.push("min");
    return t;
  }
  const TYPE_WEIGHT = { find: 5, price: 3, max: 1.5, min: 1.5 };

  // view: "menu" | "quiz"; quiz: { kind: "practice" | "review", questions, index, picked, results }
  // sign = the 漢字標示・假朋友詞 card's choices (kept only while the app is open): groups null = all
  const ui = { view: "menu", quiz: null, scrollFeedback: false, sign: { groups: null, mode: "mix", count: 10 } };
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
  function countOf(state, list) {
    const total = list.length;
    let k = 0;
    let seen = 0;
    list.forEach((x) => {
      if (known(state, x.word)) k += 1;
      else if (state.read.stats[x.word]) seen += 1;
    });
    return { total, known: k, learning: seen, unseen: total - k - seen };
  }
  const counts = (state) => countOf(state, words());
  const signCounts = (state) => countOf(state, signs()); // 漢字標示 (44)
  const friendCounts = (state) => countOf(state, friends()); // 假朋友詞 (9)

  // 模擬餐牌: 認得 per line (30 lines), same rule as words.
  function menuCounts(state) {
    let total = 0;
    let k = 0;
    let seen = 0;
    menus().forEach((m) =>
      m.lines.forEach((_, i) => {
        total += 1;
        const key = `${m.id}:${i}`;
        const st = state.read.menu.stats[key];
        if (st && st.c >= 2 && !state.review.items[`m:${key}`]) k += 1;
        else if (st) seen += 1;
      })
    );
    return { total, known: k, learning: seen, unseen: total - k - seen };
  }

  // "m:ramen:2" → { menu, line }
  function parseMenuKey(key) {
    const m = /^m:([a-z]{1,10}):([0-4])$/.exec(key);
    const menu = m && menuOf(m[1]);
    return menu ? { menu, line: Number(m[2]) } : null;
  }

  function dueItems(state) {
    const today = Storage.todayLocal();
    return Object.entries(state.review.items)
      .filter(([key, it]) => it.due <= today && (key.startsWith("r:") ? !!wordOf(key.slice(2)) : key.startsWith("m:") && !!parseMenuKey(key)))
      .sort((a, b) => (a[1].due < b[1].due ? -1 : a[1].due > b[1].due ? 1 : 0));
  }
  const dueCount = (state) => dueItems(state).length;

  // ── questions ────────────────────────────────────────────────────────

  // Wrong now / answered right fewer than 2 times weigh more (same idea as 相似字分辨).
  const weightOf = (state, w) => weightFor(state.read.stats[w]);
  const weightFor = (st) => {
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

  // The list an item belongs to (distractors come from the same list).
  const listOf = (item) => (kindOf(item) === "friend" ? friends() : kindOf(item) === "sign" ? signs() : words());

  // 3 wrong 中文意思: never the same meaning; same 情境 first.
  // 漢字標示: also never a meaning that contains / is contained in the answer (出口 vs 緊急出口, 含稅 vs 未含稅).
  // 假朋友詞: the options are the real meaning, the meaning a Chinese reader wrongly guesses (always present),
  // and 2 real meanings of other 假朋友詞.
  function meaningOptions(item) {
    const kind = kindOf(item);
    if (kind === "friend") {
      const trap = { word: `trap:${item.word}`, meaning: item.trapOpt, isTrap: true };
      const others = shuffle(friends().filter((f) => f.word !== item.word && f.meaning !== item.meaning && f.meaning !== item.trapOpt)).slice(0, 2);
      return shuffle([item, trap, ...others]);
    }
    const list = listOf(item);
    const clash = (m) => kind === "sign" && (m.includes(item.meaning) || item.meaning.includes(m));
    const used = new Set([item.meaning]);
    const out = [];
    [shuffle(list.filter((x) => x.scene === item.scene)), shuffle(list)].forEach((cands) =>
      cands.forEach((c) => {
        if (out.length >= 3 || used.has(c.meaning) || clash(c.meaning)) return;
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
    const ranked = listOf(item).filter((c) => c.word !== item.word && c.romaji !== item.romaji).map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s);
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
    return { family: "word", type, item, options: type === "see" ? meaningOptions(item) : writtenOptions(item) };
  }
  const typeFor = (mode) => (mode === "mix" ? (Math.random() < 0.5 ? "see" : "hear") : mode);

  function pool(prefs) {
    return prefs.scenes === null ? words() : words().filter((x) => prefs.scenes.includes(x.scene));
  }

  // ── menu questions ───────────────────────────────────────────────────

  // Price options: the answer + 3 others, prices of the same menu first, then the nearest prices elsewhere.
  function priceOptions(menu, line) {
    const ans = menu.lines[line].price;
    const out = [ans];
    const seen = new Set(out);
    const all = [...new Set(menus().flatMap((m) => m.lines.map((l) => l.price)))].sort((a, b) => Math.abs(a - ans) - Math.abs(b - ans));
    [...shuffle(menu.lines.map((l) => l.price)), ...all].forEach((p) => {
      if (out.length < 4 && !seen.has(p)) {
        seen.add(p);
        out.push(p);
      }
    });
    return out.sort((a, b) => a - b);
  }

  // `line` = the answer line (what is asked about; for max/min the dearest/cheapest). Rows are tapped for
  // find/max/min (options = line indexes 0–4); price shows the board plus 4 price buttons.
  function menuQuestion(menu, line, type) {
    return { family: "menu", type, menu, line, options: type === "price" ? priceOptions(menu, line) : menu.lines.map((_, i) => i) };
  }
  const menuKeyOf = (q) => `${q.menu.id}:${q.line}`;

  function pickType(menu, line, used) {
    const types = eligibleTypes(menu, line).filter((t) => !used || !used.has(`${menu.id}:${line}:${t}`));
    const pool = types.length ? types : eligibleTypes(menu, line);
    let r = Math.random() * pool.reduce((n, t) => n + TYPE_WEIGHT[t], 0);
    return pool.find((t) => (r -= TYPE_WEIGHT[t]) < 0) || pool[pool.length - 1];
  }

  function buildMenuPractice(state) {
    const prefs = state.read.menu.prefs;
    const pool = menus().filter((m) => prefs.menus === null || prefs.menus.includes(m.id));
    if (!pool.length) return [];
    const order = shuffle(pool);
    const used = new Set();
    const out = [];
    for (let i = 0; i < prefs.count; i++) {
      const menu = order[i % order.length];
      // lines answered wrong / rarely are asked more often
      const w = menu.lines.map((_, li) => weightFor(state.read.menu.stats[`${menu.id}:${li}`]));
      let r = Math.random() * w.reduce((n, x) => n + x, 0);
      let line = w.findIndex((x) => (r -= x) < 0);
      if (line < 0) line = w.length - 1;
      let type = pickType(menu, line, used);
      for (let tries = 0; tries < 20 && used.has(`${menu.id}:${line}:${type}`); tries++) {
        line = Math.floor(Math.random() * menu.lines.length);
        type = pickType(menu, line, used);
      }
      used.add(`${menu.id}:${line}:${type}`);
      out.push(menuQuestion(menu, line, type));
    }
    return out;
  }

  function buildPractice(state) {
    const prefs = state.read.prefs;
    const picked = pickWords(state, pool(prefs), prefs.count);
    if (prefs.mode !== "mix") return picked.map((x) => question(x, prefs.mode));
    // mixed: half see, half hear (shuffled)
    const kinds = shuffle(picked.map((_, i) => (i % 2 ? "hear" : "see")));
    return picked.map((x, i) => question(x, kinds[i]));
  }

  // 漢字標示・假朋友詞: the groups ticked on the card (null = all, incl. 假朋友詞), mixed see/hear like the words.
  function signPool() {
    const sel = ui.sign.groups;
    return [...signs().filter((x) => sel === null || sel.includes(x.scene)), ...(sel === null || sel.includes(FRIEND_KEY) ? friends() : [])];
  }
  function buildSignPractice(state) {
    const { mode, count } = ui.sign;
    const picked = pickWords(state, signPool(), count);
    if (mode !== "mix") return picked.map((x) => question(x, mode));
    const kinds = shuffle(picked.map((_, i) => (i % 2 ? "hear" : "see")));
    return picked.map((x, i) => question(x, kinds[i]));
  }

  function buildReview(state) {
    return shuffle(dueItems(state).slice(0, REVIEW_MAX)).map(([key]) => {
      if (key.startsWith("m:")) {
        const { menu, line } = parseMenuKey(key);
        return menuQuestion(menu, line, pickType(menu, line));
      }
      return question(wordOf(key.slice(2)), typeFor(state.read.prefs.mode));
    });
  }

  // Built inside the tap that starts it, so the first sound (聽音選詞) plays within the user gesture.
  function start(ctx, kind) {
    const questions = kind === "review" ? buildReview(ctx.state) : kind === "menu" ? buildMenuPractice(ctx.state) : kind === "sign" ? buildSignPractice(ctx.state) : buildPractice(ctx.state);
    if (!questions.length) return;
    ui.quiz = { kind: kind === "review" ? "review" : "practice", source: kind, questions, index: 0, picked: null, results: [] };
    ui.view = "quiz";
    playQ(questions[0], ctx.state.settings, null, true);
    ctx.rerender({ scrollTop: true });
  }

  // 聽音選詞 speaks the question; 看詞選意思 only speaks when asked (reading first).
  function playQ(q, settings, rate, auto) {
    if (auto && (q.family === "menu" || q.type === "see")) return;
    speak(q.family === "menu" ? q.menu.lines[q.line].kana : sayOf(q.item), rate ? { ...settings, rate } : settings);
  }

  const isRight = (q, opt) => (q.family === "menu" ? (q.type === "price" ? opt === q.menu.lines[q.line].price : opt === q.line) : opt.word === q.item.word);

  // ── screens ──────────────────────────────────────────────────────────

  function feedbackBody(q, settings) {
    if (q.family === "menu") {
      const line = q.menu.lines[q.line];
      return [
        h("p", { class: "caption mt-1" }, `${q.menu.emoji} ${q.menu.label}`),
        jp(line.ja, "read-word mt-1"),
        h("p", { lang: "ja", class: "jp phrase-kana" }, line.kana),
        settings.showRomaji && h("p", { class: "phrase-rom" }, line.romaji),
        h("p", { class: "phrase-yue" }, `${line.yue}　${yen(line.price)}`),
      ];
    }
    const it = q.item;
    const kind = kindOf(it);
    if (kind === "sign")
      return [
        h("p", { class: "caption mt-1" }, `🚏 ${it.scene}`),
        jp(it.word, "read-word mt-1"),
        h("p", { lang: "ja", class: "jp phrase-kana" }, it.kana),
        settings.showRomaji && h("p", { class: "phrase-rom" }, it.romaji),
        h("p", { class: "phrase-yue" }, it.meaning),
        it.detail && h("p", { class: "phrase-use" }, it.detail),
        it.warn && h("p", { class: "note gold mt-2" }, `⚠️ ${it.warn}`),
        h("p", { class: "phrase-use" }, `📍 常見於：${it.where}`),
      ];
    if (kind === "friend")
      return [
        h("p", { class: "caption mt-1" }, `⚠️ ${it.scene}`),
        jp(it.word, "read-word mt-1"),
        h("p", { lang: "ja", class: "jp phrase-kana" }, it.kana),
        settings.showRomaji && h("p", { class: "phrase-rom" }, it.romaji),
        h("p", { class: "phrase-yue" }, `日文的意思：${it.meaning}`),
        h("p", { class: "phrase-use" }, it.detail),
        h("p", { class: "note gold mt-2" }, `中文讀者容易誤會成：${it.trap}`),
        h("p", { class: "phrase-use" }, `📍 常見於：${it.where}`),
      ];
    return [
      h("p", { class: "caption mt-1" }, `🪧 ${it.scene}`),
      jp(it.word, "read-word mt-1"),
      settings.showRomaji && h("p", { class: "phrase-rom" }, it.romaji),
      h("p", { class: "phrase-yue" }, it.meaning),
      it.en && h("p", { class: "phrase-use" }, it.en),
    ];
  }

  // The menu board: one row per line (name + price). `rows` = tappable (find/max/min) or just shown (price).
  // After answering every row also shows its reading and 中文.
  function menuBoard(q, quiz, answered, settings, pickLine) {
    const tappable = q.type !== "price";
    return h(
      "div",
      { class: "card menu-board mb-4" },
      h("p", { class: "caption mb-2" }, `${q.menu.emoji} ${q.menu.label}`),
      h(
        "div",
        { class: "stack-sm" },
        q.menu.lines.map((line, i) => {
          let state = "";
          if (answered) {
            if (i === q.line) state = "correct";
            else if (tappable && i === quiz.picked) state = "wrong";
            else if (tappable) state = "dim";
          }
          const inner = [
            h(
              "span",
              { class: "menu-main" },
              jp(line.ja, "menu-name"),
              answered && h("span", { lang: "ja", class: "jp menu-read" }, `${line.kana}・${line.yue}`),
              answered && settings.showRomaji && h("span", { class: "menu-read" }, line.romaji)
            ),
            jp(yen(line.price), "menu-price"),
          ];
          return tappable
            ? h("button", { class: `opt menu-line ${state}`.trim(), disabled: answered, onclick: () => pickLine(i) }, ...inner)
            : h("div", { class: `menu-line static ${state}`.trim() }, ...inner);
        })
      )
    );
  }

  const MENU_ASK = {
    find: (line) => `「${line.yue}」是哪一行？`,
    price: (line) => `「${line.yue}」要多少錢？`,
    max: () => "最貴的是哪一行？",
    min: () => "最便宜的是哪一行？",
  };

  function quizScreen(ctx) {
    const settings = ctx.state.settings;
    const quiz = ui.quiz;
    const total = quiz.questions.length;
    const title = quiz.kind === "review" ? "看得懂重溫" : quiz.source === "menu" ? "餐牌練習" : quiz.source === "sign" ? "標示・假朋友練習" : "片假名詞練習";
    const back = () => {
      ui.view = "menu";
      ui.quiz = null;
      ctx.rerender({ scrollTop: true });
    };
    if (quiz.index >= total) return resultScreen(ctx, title, back);

    const q = quiz.questions[quiz.index];
    const isMenu = q.family === "menu";
    const answered = quiz.picked !== null;
    const gotIt = answered && isRight(q, q.options[quiz.picked]);
    const tts = isTTSSupported();

    function pick(i) {
      if (quiz.picked !== null) return;
      const correct = isRight(q, q.options[i]);
      quiz.picked = i;
      quiz.results.push({ q, correct });
      ui.scrollFeedback = true;
      ctx.onAnswer(q, correct, quiz.kind); // saves + rerenders
    }
    function next() {
      quiz.index += 1;
      quiz.picked = null;
      if (quiz.index < total) playQ(quiz.questions[quiz.index], settings, null, true);
      ctx.rerender({ scrollTop: true });
    }

    // options: word questions and menu price questions use buttons; menu find/max/min tap the board rows
    let options = null;
    if (!isMenu || q.type === "price") {
      options = h(
        "div",
        { class: isMenu ? "opt-grid" : "stack-sm" },
        q.options.map((opt, i) => {
          let state = "";
          if (answered && isRight(q, opt)) state = "correct";
          else if (answered && i === quiz.picked) state = "wrong";
          else if (answered) state = "dim";
          return h(
            "button",
            { class: `opt ${isMenu ? "" : "opt-text"} ${state}`.trim(), disabled: answered, onclick: () => pick(i) },
            isMenu ? jp(yen(opt), "num-opt") : q.type === "see" ? opt.meaning : jp(opt.word, "read-opt")
          );
        })
      );
    }

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

    let prompt;
    if (isMenu) prompt = [h("p", { class: "h-heading" }, MENU_ASK[q.type](q.menu.lines[q.line])), q.type !== "price" && !answered && h("p", { class: "xs muted mt-1" }, "點按餐牌上的一行")];
    else if (q.type === "see")
      prompt = [
        h("p", { class: "muted mb-3", style: { fontWeight: 700 } }, kindOf(q.item) === "sign" ? "這個標示是什麼意思？" : kindOf(q.item) === "friend" ? "這個詞在日文是什麼意思？（意思可能和中文不同）" : "這個詞是什麼意思？"),
        jp(q.item.word, "read-word"),
      ];
    else
      prompt = [
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
      isMenu && menuBoard(q, quiz, answered, settings, (i) => pick(i)),
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
            h("p", { class: "caption mb-2" }, "答錯的內容（按一下可聽發音）"),
            h(
              "div",
              { class: "stack-sm" },
              wrong.map(({ q }) =>
                q.family === "menu"
                  ? h(
                      "button",
                      { class: "ex-card", onclick: () => speak(q.menu.lines[q.line].kana, settings) },
                      h("span", { class: "grow" }, jp(q.menu.lines[q.line].ja, "ex-word"), h("span", { class: "small" }, `${q.menu.emoji} ${q.menu.label}・${q.menu.lines[q.line].yue}・${yen(q.menu.lines[q.line].price)}`)),
                      h("span", null, "🔊")
                    )
                  : h(
                      "button",
                      { class: "ex-card", onclick: () => speak(sayOf(q.item), settings) },
                      h("span", { class: "grow" }, jp(q.item.word, "ex-word"), h("span", { class: "small" }, q.item.meaning)),
                      h("span", null, "🔊")
                    )
              )
            )
          ),
        h(
          "div",
          { class: "stack mt-4" },
          !review && inkButton("再來一輪", () => start(ctx, quiz.source === "menu" ? "menu" : quiz.source === "sign" ? "sign" : "practice"), { class: "w-full" }),
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
    const mprefs = state.read.menu.prefs;
    const mc = menuCounts(state);
    const mAll = menus().map((m) => m.id);
    const mActive = mprefs.menus === null ? mAll : mprefs.menus.filter((x) => mAll.includes(x));
    const toggleMenu = (id) => {
      const next = mActive.includes(id) ? mActive.filter((x) => x !== id) : mAll.filter((x) => mActive.includes(x) || x === id);
      ctx.onMenuPrefsChange({ menus: next.length === mAll.length ? null : next });
    };
    // 漢字標示・假朋友詞 card (stage 10 ⑪)
    const sp = ui.sign;
    const sKeys = [...signGroups(), FRIEND_KEY];
    const sActive = sp.groups === null ? sKeys : sp.groups.filter((k) => sKeys.includes(k));
    const toggleSign = (k) => {
      const next = sActive.includes(k) ? sActive.filter((x) => x !== k) : sKeys.filter((x) => sActive.includes(x) || x === k);
      ui.sign.groups = next.length === sKeys.length ? null : next;
      ctx.rerender();
    };
    const sPoolN = signPool().length;
    const sEnough = sPoolN > 0 && (sp.mode === "see" || tts);
    const sc = signCounts(state);
    const fc = friendCounts(state);
    const needsTts = prefs.mode !== "see";
    const toggleScene = (s) => {
      const next = active.includes(s) ? active.filter((x) => x !== s) : all.filter((x) => active.includes(x) || x === s);
      ctx.onPrefsChange({ scenes: next.length === all.length ? null : next });
    };
    const enough = available > 0 && (!needsTts || tts);
    const notice = speechNotice();
    const later = Object.entries(state.review.items)
      .filter(([k, it]) => (k.startsWith("r:") || k.startsWith("m:")) && it.due > Storage.todayLocal())
      .map(([, it]) => it.due)
      .sort()[0];

    return h(
      "div",
      null,
      modHeader("看得懂", ctx.onBack),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "在日本的餐牌、商品、指示牌上，很多詞是片假名寫的，指示牌也常用漢字。練習認讀這些常見的詞。"),

      // progress
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🪧 認得的片假名詞"),
        h("p", { class: "big-count" }, `${c.known} / ${c.total}`),
        h("p", { class: "xs muted" }, `學習中 ${c.learning}・未練習 ${c.unseen}（答對 2 次以上、而且不在重溫清單，才算「認得」）`),
        h("p", { class: "small mt-2" }, `🍜 餐牌：認得 ${mc.known} / ${mc.total} 行`),
        h("p", { class: "small mt-1" }, `🚏 漢字標示：認得 ${sc.known} / ${sc.total}・⚠️ 假朋友詞：認得 ${fc.known} / ${fc.total}`)
      ),

      // 重溫
      h(
        "div",
        { class: "card review-card mb-4" },
        h("p", { class: "h-heading" }, "📝 看得懂重溫"),
        due.length > 0 ? h("p", { class: "review-count" }, `今天需重溫 ${due.length} 項`) : h("p", { class: "small muted mt-1" }, "今天沒有需要重溫的內容 🎉"),
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
      ),

      // 漢字標示・假朋友詞 (stage 10 ⑪)
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🚏 漢字標示・假朋友詞"),
        h("p", { class: "xs muted mb-3" }, "看懂旅行中常見的漢字標示（出口、改札口、準備中……），以及意思和中文不同的「假朋友」詞（手紙、大丈夫、勉強……）。每題 4 個選項。"),
        h("p", { class: "small mb-1" }, "題型"),
        h(
          "div",
          { class: "wrap mb-3" },
          [
            { key: "see", label: "👀 看詞選意思" },
            { key: "hear", label: "👂 聽音選詞" },
            { key: "mix", label: "🔀 混合" },
          ].map((m) =>
            chip(m.label, sp.mode === m.key, () => {
              ui.sign.mode = m.key;
              ctx.rerender();
            })
          )
        ),
        h("p", { class: "small mb-1" }, "範圍"),
        h("div", { class: "wrap mb-3" }, sKeys.map((k) => chip(k === FRIEND_KEY ? `⚠️ ${k}` : k, sActive.includes(k), () => toggleSign(k)))),
        h("p", { class: "small mb-1" }, "題數"),
        h(
          "div",
          { class: "chips-fill" },
          COUNTS.map((n) =>
            chip(`${n} 題`, sp.count === n, () => {
              ui.sign.count = n;
              ctx.rerender();
            })
          )
        ),
        h(
          "p",
          { class: "xs mt-3", style: { color: sEnough ? "var(--muted)" : "var(--stamp)" } },
          sPoolN === 0 ? "請至少選擇一個範圍" : sp.mode !== "see" && !tts ? "此瀏覽器沒有發音功能，請選「看詞選意思」" : `可出題：${sPoolN} 個（這張卡的選擇只在 App 開啟期間記住）`
        ),
        inkButton("🚏 開始標示練習", () => start(ctx, "sign"), { accent: true, disabled: !sEnough, class: "w-full mt-3" })
      ),

      // 模擬餐牌 (版本二)
      h(
        "div",
        { class: "card accent mb-4" },
        h("p", { class: "h-heading accent-text" }, "🍜 看餐牌練習"),
        h("p", { class: "xs muted mb-3" }, "看模擬餐牌：找出品名、最貴或最便宜的一行，或者看價錢。價錢只是示意。"),
        h("p", { class: "small mb-1" }, "餐牌"),
        h("div", { class: "wrap mb-3" }, menus().map((m) => chip(`${m.emoji} ${m.label}`, mActive.includes(m.id), () => toggleMenu(m.id)))),
        h("p", { class: "small mb-1" }, "題數"),
        h("div", { class: "chips-fill" }, COUNTS.map((n) => chip(`${n} 題`, mprefs.count === n, () => ctx.onMenuPrefsChange({ count: n })))),
        h("p", { class: "xs mt-3", style: { color: mActive.length ? "var(--muted)" : "var(--stamp)" } }, mActive.length ? `${mActive.length} 張餐牌・共 ${mActive.length * 5} 行` : "請至少選擇一張餐牌"),
        inkButton("🍜 開始餐牌練習", () => start(ctx, "menu"), { accent: true, disabled: mActive.length === 0, class: "w-full mt-3" })
      )

    );
  }

  // ctx: { state, onPrefsChange(patch), onMenuPrefsChange(patch), onAnswer(q, correct, kind), onBack, rerender }
  function render(ctx) {
    if (ui.view === "quiz" && ui.quiz) return quizScreen(ctx);
    ui.view = "menu";
    return menu(ctx);
  }

  window.App.Reading = { render, reset, dueCount, counts, menuCounts, signCounts, friendCounts, buildPractice, buildMenuPractice, buildSignPractice, buildReview, question, menuQuestion, extremes, eligibleTypes, priceOptions, signPool, scenes: sceneList };
})();
