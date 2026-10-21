// 換字練習 (stage 10 ⑥ 版本二). Content: SWAP_PATTERNS in js/content/swap.js.
//
// A pattern + a word becomes a *virtual sentence* shaped like a 句子庫 entry, so the existing
// 聽力 (js/listening.js) and 口語 (js/speaking.js) screens can ask it unchanged:
//   item = { p: { id: "p1:tamago", ja, kana, romaji, yue, use, who: "me", say, swap: { pat, wid, word } },
//            scene: { key: "swap", emoji: "🔁", label: "換字練習・〇〇は入っていますか。" } }
// Answers are recorded in state.swap (js/storage.js recordSwapAnswer); a wrong one enters 錯題重溫 as
//   "w:h:<pattern>:<word>"  (聽力 — reviewed in 聽力 錯題重溫)  or  "w:s:<pattern>:<word>"  (口語 — 口語重溫).
// Nothing here touches state; the menu card (pattern chips, count, 詞庫) is shared by both menus.
window.App = window.App || {};

(function () {
  const { h, jp, chip, inkButton } = window.App.UI;
  const COUNTS = [5, 10, 20];

  const patterns = () => window.App.Content.SWAP_PATTERNS;
  const patOf = (id) => patterns().find((p) => p.id === id) || null;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── items ────────────────────────────────────────────────────────────

  const cache = {};
  function make(pat, w) {
    const key = `${pat.id}:${w.id}`;
    if (!cache[key]) {
      cache[key] = {
        p: {
          id: key,
          ja: w.ja + pat.post,
          kana: w.kana + pat.postKana,
          romaji: `${w.romaji} ${pat.postRomaji}`,
          yue: pat.yue.replace("{m}", w.yue),
          use: "換字練習：同一句型可以換成其他詞",
          who: "me",
          say: w.kana + pat.post, // the slot word is spoken from its kana
          swap: { pat: pat.id, wid: w.id, word: w },
        },
        scene: { key: "swap", emoji: "🔁", label: `換字練習・${pat.label}` },
      };
    }
    return cache[key];
  }

  const itemsOf = (patId) => {
    const pat = patOf(patId);
    return pat ? pat.words.map((w) => make(pat, w)) : [];
  };
  const item = (patId, wid) => {
    const pat = patOf(patId);
    const w = pat && pat.words.find((x) => x.id === wid);
    return w ? make(pat, w) : null;
  };

  // "w:h:p1:tamago" / "w:s:p1:tamago" → { mode, item } or null
  function parseKey(key) {
    const m = /^w:([hs]):(p[1-6]):([a-z0-9]{1,20})$/.exec(key || "");
    if (!m) return null;
    const it = item(m[2], m[3]);
    return it ? { mode: m[1], item: it } : null;
  }
  const itemOfKey = (key, mode) => {
    const r = parseKey(key);
    return r && r.mode === mode ? r.item : null;
  };
  const keyOf = (mode, it) => `w:${mode}:${it.p.swap.pat}:${it.p.swap.wid}`;

  // ── questions ────────────────────────────────────────────────────────

  // 3 wrong options from the same pattern: never the same meaning or the same reading.
  function options(target) {
    const seenYue = new Set([target.p.yue]);
    const seenKana = new Set([target.p.kana]);
    const out = [];
    shuffle(itemsOf(target.p.swap.pat)).forEach((c) => {
      if (out.length >= 3 || seenYue.has(c.p.yue) || seenKana.has(c.p.kana)) return;
      seenYue.add(c.p.yue);
      seenKana.add(c.p.kana);
      out.push(c);
    });
    return shuffle([target, ...out]);
  }

  // prefs: { pats: ["p1", …], count }. Patterns take turns; no repeated word inside a round
  // (unless the selected patterns have fewer words than the round needs).
  function buildPractice(prefs) {
    const pats = patterns().filter((p) => prefs.pats.includes(p.id));
    if (!pats.length) return [];
    const bag = pats.map((p) => shuffle(itemsOf(p.id)));
    const out = [];
    for (let i = 0; i < prefs.count; i++) {
      const b = bag[i % pats.length];
      if (!b.length) bag[i % pats.length] = shuffle(itemsOf(pats[i % pats.length].id));
      out.push(bag[i % pats.length].pop());
    }
    return shuffle(out);
  }

  const wordCount = (prefs) => patterns().filter((p) => prefs.pats.includes(p.id)).reduce((n, p) => n + p.words.length, 0);

  // ── menu card ────────────────────────────────────────────────────────

  const ui = { openWords: null };
  function reset() {
    ui.openWords = null;
  }

  function wordList(pat, settings, speak) {
    return h(
      "div",
      { class: "stack-sm mt-2" },
      pat.words.map((w) =>
        h(
          "button",
          { class: "ex-card", onclick: () => speak && speak(w.kana, settings), "aria-label": `${w.ja} ${w.kana}` },
          h("span", { class: "grow" }, jp(w.ja, "ex-word"), jp(w.kana, "ex-kana"), settings.showRomaji && h("span", { class: "ex-rom" }, w.romaji)),
          h("span", { class: "small", style: { flexShrink: 0, maxWidth: "7em", textAlign: "right" } }, w.yue)
        )
      )
    );
  }

  // kind: "listen" | "speak". ctx: { state, onSwapPrefsChange(patch), rerender }; `start` runs inside the tap.
  function card(ctx, kind, start, disabled) {
    const prefs = ctx.state.swap.prefs;
    const settings = ctx.state.settings;
    const { speak } = window.App.Speech;
    const toggle = (id) => ctx.onSwapPrefsChange({ pats: prefs.pats.includes(id) ? prefs.pats.filter((x) => x !== id) : [...prefs.pats, id] });
    const enough = prefs.pats.length > 0;
    const open = ui.openWords ? patOf(ui.openWords) : null;
    return h(
      "div",
      { class: "card accent mb-4" },
      h("p", { class: "h-heading accent-text" }, kind === "listen" ? "🔁 換字練習（聽力）" : "🔁 換字練習（口語）"),
      h(
        "p",
        { class: "xs muted mb-3" },
        kind === "listen"
          ? "同一個句型，每次換一個詞。聽整句，從 4 個中文意思中選出一個。"
          : "同一個句型，每次換一個詞。看中文意思，說出整句日文。"
      ),
      h("p", { class: "small mb-1" }, "句型"),
      h("div", { class: "wrap mb-3" }, patterns().map((p) => chip(`${p.label}（${p.words.length}）`, prefs.pats.includes(p.id), () => toggle(p.id), { lang: "ja" }))),
      h("p", { class: "small mb-1" }, "題數"),
      h("div", { class: "chips-fill" }, COUNTS.map((n) => chip(`${n} 題`, prefs.count === n, () => ctx.onSwapPrefsChange({ count: n })))),
      h(
        "p",
        { class: "xs mt-3", style: { color: enough ? "var(--muted)" : "var(--stamp)" } },
        enough ? `可換的詞：${wordCount(prefs)} 個組合` : "請至少選擇一個句型"
      ),
      inkButton(kind === "listen" ? "🔁 開始換字聽力" : "🔁 開始換字口語", start, { accent: true, disabled: !enough || !!disabled, class: "w-full mt-3" }),
      h("p", { class: "small mb-1 mt-4" }, "📖 查看詞庫"),
      h("div", { class: "wrap" }, patterns().map((p) => chip(p.label, ui.openWords === p.id, () => { ui.openWords = ui.openWords === p.id ? null : p.id; ctx.rerender(); }, { lang: "ja" }))),
      open && wordList(open, settings, speak)
    );
  }

  window.App.Swap = { COUNTS, patterns, patOf, item, itemsOf, itemOfKey, parseKey, keyOf, options, buildPractice, card, reset };
})();
