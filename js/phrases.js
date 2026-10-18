// 情境句子庫 module (stage 2): scene list → scene page with 全部／🗣️ 我說／
// 👂 店員說 filter → sentence cards (日文、假名、拼音、廣東話意思、使用場合)
// with 🔊 聽, 🐢 慢慢聽 (0.6×) and, for 問答組合, 連續聽 question → answers.
// Stage 10 adds: ⭐ 收藏 on every card, a search box, and 📌 必學 30 句
// (Content.MUST_HAVE) — both shown as cross-scene lists.
// Content: js/content/phrases.js.
window.App = window.App || {};

(function () {
  const { h, jp, modHeader, chip } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;

  const SLOW_RATE = 0.6;
  const MAX_RESULTS = 60;
  const WHO = {
    me: "🗣️ 你說",
    staff: "👂 店員說",
    both: "🗣️👂 你與店員都會說",
  };
  const FILTERS = [
    { key: "all", label: "全部" },
    { key: "me", label: "🗣️ 我說" },
    { key: "staff", label: "👂 店員說" },
  ];

  // view: "scenes" | "scene" | "list" (list: "must" | "favs"); q = search text
  const ui = { view: "scenes", scene: null, filter: "all", list: null, q: "" };

  // Open the 必學 / 收藏 list straight from outside (路線的「今日延伸」連結): its 返回 leaves to where
  // the user came from (ctx.onBack) instead of to the scene list.
  function open(which) {
    ui.view = "list";
    ui.list = which;
    ui.scene = null;
    ui.q = "";
    ui.direct = true;
  }

  function reset() {
    ui.view = "scenes";
    ui.direct = false;
    ui.scene = null;
    ui.filter = "all";
    ui.list = null;
    ui.q = "";
  }

  const scenes = () => window.App.Content.PHRASE_SCENES;
  const mustIds = () => window.App.Content.MUST_HAVE || [];
  // Text for text-to-speech: the optional `say` fix, else the sentence.
  const sayText = (p) => p.say || p.ja;
  const countOf = (scene) => scene.phrases.reduce((n, p) => n + 1 + (p.replies ? p.replies.length : 0), 0);
  const stripPunct = (s) => s.replace(/[。、？！\s]/g, "");

  function matches(p, filter) {
    if (filter === "all") return true;
    return p.who === filter || p.who === "both";
  }

  // ── lookup ───────────────────────────────────────────────────────────

  // id → { scene, num, phrase }. `num` = position on the scene page, top
  // to bottom, answers included (the numbering used when reporting 讀錯).
  let index = null;
  let flat = null; // every sentence in scene order: [{ p, scene, order }]
  function build() {
    index = {};
    flat = [];
    scenes().forEach((s) => {
      let n = 0;
      const add = (p) => {
        index[p.id] = { scene: s, num: ++n, phrase: p };
        flat.push({ p, scene: s, order: flat.length });
      };
      s.phrases.forEach((p) => {
        add(p);
        (p.replies || []).forEach(add);
      });
    });
  }
  function locate(id) {
    if (!index) build();
    return index[id] || null;
  }
  function allFlat() {
    if (!flat) build();
    return flat;
  }
  const flatById = (id) => allFlat().find((x) => x.p.id === id) || null;

  // ── search ───────────────────────────────────────────────────────────

  // Compare "text", not writing: NFKC, lower-case, katakana → hiragana,
  // punctuation / spaces / apostrophes out (so honyaku finds hon’yaku).
  function norm(s) {
    return String(s || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
      .replace(/[\s。、，．,.?？!！「」『』（）()・\-~〜…:：;；"'’‘“”]/g, "");
  }

  let haystack = null; // id → normalised fields
  function fieldsOf(p) {
    if (!haystack) haystack = {};
    if (!haystack[p.id]) haystack[p.id] = [p.ja, p.kana, p.romaji, p.yue, p.use, p.id].map(norm);
    return haystack[p.id];
  }

  // Every space-separated term must appear in some field of the sentence.
  function search(query) {
    const terms = query
      .split(/\s+/)
      .map(norm)
      .filter(Boolean);
    if (!terms.length) return [];
    return allFlat().filter((x) => {
      const f = fieldsOf(x.p);
      return terms.every((t) => f.some((field) => field.includes(t)));
    });
  }

  // ── one sentence (used for questions and, smaller, for replies) ─────

  // ctx: { settings, flags, onToggleFlag, favs?, onToggleFav? }
  function sentence(p, ctx, isReply) {
    const { settings } = ctx;
    const tts = isTTSSupported();
    const showKana = stripPunct(p.kana) !== stripPunct(p.ja);
    const flagged = ctx.flags.includes(p.id);
    const loc = locate(p.id);
    const must = mustIds().includes(p.id);
    const canFav = typeof ctx.onToggleFav === "function";
    const fav = canFav && (ctx.favs || []).includes(p.id);
    return h(
      "div",
      { class: isReply ? "phrase reply" : "phrase" },
      h(
        "div",
        { class: "row-between" },
        h("span", { class: "phrase-tags" }, h("span", { class: `who-tag ${p.who}` }, WHO[p.who]), must && h("span", { class: "must-tag" }, "📌 必學")),
        h(
          "span",
          { class: "row-sm" },
          loc && h("span", { class: "phrase-num" }, `#${loc.num}`),
          canFav &&
            h(
              "button",
              {
                class: `fav-btn ${fav ? "on" : ""}`.trim(),
                "aria-pressed": fav ? "true" : "false",
                "aria-label": fav ? "取消收藏" : "加入收藏",
                onclick: () => ctx.onToggleFav(p.id),
              },
              fav ? "⭐" : "☆"
            )
        )
      ),
      h("p", { lang: "ja", class: "jp phrase-ja" }, p.ja),
      showKana && h("p", { lang: "ja", class: "jp phrase-kana" }, p.kana),
      settings.showRomaji && h("p", { class: "phrase-rom" }, p.romaji),
      h("p", { class: "phrase-yue" }, p.yue),
      h("p", { class: "phrase-use" }, p.use),
      tts &&
        h(
          "div",
          { class: "row-sm mt-2" },
          h("button", { class: "btn-soft grow", onclick: () => speak(sayText(p), settings) }, "🔊 聽"),
          h("button", { class: "btn-soft grow", onclick: () => speak(sayText(p), { ...settings, rate: SLOW_RATE }) }, "🐢 慢慢聽"),
          h(
            "button",
            {
              class: `btn-flag ${flagged ? "on" : ""}`.trim(),
              "aria-pressed": flagged ? "true" : "false",
              onclick: () => ctx.onToggleFlag(p.id),
            },
            flagged ? "🚩 已標記" : "🚩 讀錯"
          )
        )
    );
  }

  function phraseCard(p, ctx) {
    const { settings } = ctx;
    const replies = p.replies || [];
    return h(
      "div",
      { class: "card accent phrase-card" },
      sentence(p, ctx, false),
      replies.length > 0 &&
        h(
          "div",
          { class: "replies" },
          h("p", { class: "caption mb-1" }, replies.length > 1 ? "可這樣回答（任選一句）" : "可這樣回答"),
          replies.map((r) => sentence(r, ctx, true))
        ),
      replies.length > 0 &&
        isTTSSupported() &&
        h(
          "button",
          { class: "btn-ink accent w-full mt-3", style: { fontSize: "1rem" }, onclick: () => speakSequence([p, ...replies].map(sayText), settings) },
          "🔊 連續聽：問 → 答"
        )
    );
  }

  // One sentence on its own, with its scene — used by 必學 / 收藏 / 搜尋結果.
  function itemCard(x, ctx) {
    return h("div", { class: "card accent phrase-card" }, h("p", { class: "caption mb-1" }, `${x.scene.emoji} ${x.scene.label}`), sentence(x.p, ctx, false));
  }

  // Info card at the top of a scene (緊急情況: emergency numbers). Each
  // number is a tel: link, so tapping it opens the phone's dialler.
  function infoCard(info) {
    return h(
      "div",
      { class: "card info-card mb-4" },
      h("p", { class: "h-heading mb-2" }, `📞 ${info.title}`),
      h(
        "div",
        { class: "stack-sm" },
        info.items.map((it) =>
          h(
            "a",
            { class: "tel-row", href: `tel:${it.tel}`, "aria-label": `打電話 ${it.label} ${it.show}` },
            h("span", { class: "tel-label" }, it.label),
            h("span", { class: "tel-num" }, `📞 ${it.show}`)
          )
        )
      )
    );
  }

  // ── screens ──────────────────────────────────────────────────────────

  function toList(which, ctx) {
    ui.view = "list";
    ui.list = which;
    ctx.rerender({ scrollTop: true });
  }

  function searchResults(q, ctx) {
    const found = search(q);
    const shown = found.slice(0, MAX_RESULTS);
    if (!found.length) return h("p", { class: "small muted" }, "找不到符合的句子。可以試試用假名、拼音或中文意思搜尋。");
    return h(
      "div",
      { class: "stack" },
      h("p", { class: "small muted" }, found.length > shown.length ? `找到 ${found.length} 句，顯示前 ${shown.length} 句，請輸入更多字來縮小範圍。` : `找到 ${found.length} 句`),
      shown.map((x) => itemCard(x, ctx))
    );
  }

  function sceneList(ctx) {
    const must = window.App.Daily.mustCounts(ctx.state);
    const favCount = (ctx.favs || []).filter((id) => locate(id)).length;
    const browse = h(
      "div",
      { class: "stack" },
      h(
        "button",
        { class: "mod-row live", onclick: () => toList("must", ctx) },
        h("span", { class: "mod-icon" }, "📌"),
        h("span", { class: "grow" }, h("span", { class: "mod-title" }, "必學 30 句"), h("span", { class: "mod-sub" }, `旅行最需要的句子・已熟練 ${must.mastered} / ${must.total}`)),
        h("span", { class: "chev" }, "›")
      ),
      h(
        "button",
        { class: "mod-row live", onclick: () => toList("favs", ctx) },
        h("span", { class: "mod-icon" }, "⭐"),
        h("span", { class: "grow" }, h("span", { class: "mod-title" }, "我的收藏"), h("span", { class: "mod-sub" }, favCount ? `${favCount} 句` : "按句子右上角的 ☆ 收藏")),
        h("span", { class: "chev" }, "›")
      ),
      scenes().map((s) =>
        h(
          "button",
          {
            class: "mod-row live",
            onclick: () => {
              ui.view = "scene";
              ui.scene = s.key;
              ui.filter = "all";
              ctx.rerender({ scrollTop: true });
            },
          },
          h("span", { class: "mod-icon" }, s.emoji),
          h("span", { class: "grow" }, h("span", { class: "mod-title" }, s.label), h("span", { class: "mod-sub" }, `${countOf(s)} 句`)),
          h("span", { class: "chev" }, "›")
        )
      )
    );
    const results = h("div", null);
    // Typing only updates the two blocks below the box (no whole-screen
    // re-render), so the keyboard stays open.
    const update = () => {
      const q = ui.q.trim();
      browse.style.display = q ? "none" : "";
      results.replaceChildren(...(q ? [searchResults(q, ctx)] : []));
    };
    const input = h("input", {
      type: "search",
      class: "search-input",
      placeholder: "搜尋句子：日文、假名、拼音或中文",
      "aria-label": "搜尋句子",
      autocomplete: "off",
      autocapitalize: "off",
      autocorrect: "off",
      spellcheck: "false",
      enterkeyhint: "search",
      oninput: (e) => {
        ui.q = e.target.value;
        update();
      },
    });
    input.value = ui.q;
    update();
    return h(
      "div",
      null,
      modHeader("情境句子庫", ctx.onBack),
      (() => {
        const n = speechNotice();
        return n && h("div", { class: "mb-4" }, n);
      })(),
      h("p", { class: "small muted mb-3" }, "旅行時最常用的句子。每句都有日文、假名、拼音和中文意思，按 🔊 可聽發音。"),
      input,
      h("div", { class: "mt-4" }, browse, results)
    );
  }

  function listPage(ctx) {
    const must = ui.list === "must";
    const favs = ctx.favs || [];
    const items = must
      ? mustIds().map(flatById).filter(Boolean)
      : allFlat().filter((x) => favs.includes(x.p.id)); // scene order
    const back = () => {
      if (ui.direct) {
        ui.direct = false;
        ui.list = null;
        ctx.onBack();
        return;
      }
      ui.view = "scenes";
      ui.list = null;
      ctx.rerender({ scrollTop: true });
    };
    const counts = must ? window.App.Daily.mustCounts(ctx.state) : null;
    return h(
      "div",
      null,
      modHeader(must ? "📌 必學 30 句" : "⭐ 我的收藏", back),
      must &&
        h(
          "div",
          { class: "card accent mb-4" },
          h("p", { class: "small" }, `已熟練 ${counts.mastered} / ${counts.total}`),
          h("div", { class: "bar accent mt-2" }, h("div", { style: { width: `${counts.total ? (counts.mastered / counts.total) * 100 : 0}%` } })),
          h("p", { class: "xs muted mt-2" }, "旅行最需要的 30 句：21 句你要會說，9 句要聽得懂。熟練 = 聽力連續答對 2 次、（你說的句子）口語答對過，而且不在錯題重溫中。")
        ),
      items.length === 0
        ? h("p", { class: "small muted" }, "還沒有收藏。按句子右上角的 ☆，就會收藏在這裡。")
        : h("div", { class: "stack" }, items.map((x) => itemCard(x, ctx)))
    );
  }

  function scenePage(ctx) {
    const scene = scenes().find((s) => s.key === ui.scene);
    // A 問答組合 is shown whenever the question or any reply matches.
    const shown = scene.phrases.filter((p) => matches(p, ui.filter) || (p.replies || []).some((r) => matches(r, ui.filter)));
    return h(
      "div",
      null,
      modHeader(`${scene.emoji} ${scene.label}`, () => {
        ui.view = "scenes";
        ctx.rerender({ scrollTop: true });
      }),
      scene.info && infoCard(scene.info),
      h(
        "div",
        { class: "chips-fill mb-4" },
        FILTERS.map((f) =>
          chip(f.label, ui.filter === f.key, () => {
            ui.filter = f.key;
            ctx.rerender();
          })
        )
      ),
      h("div", { class: "stack" }, shown.map((p) => phraseCard(p, ctx)))
    );
  }

  // ctx: { settings, state, flags, favs, onToggleFlag, onToggleFav, onBack, rerender }
  function render(ctx) {
    if (ui.view === "scene" && ui.scene) return scenePage(ctx);
    if (ui.view === "list" && ui.list) return listPage(ctx);
    ui.view = "scenes";
    return sceneList(ctx);
  }

  // One sentence card (日文、假名、拼音、意思、🔊 🐢 🚩, ⭐ when ctx.onToggleFav) — reused by 今日新句子.
  // `search` / `norm` are exposed for the automated tests.
  window.App.Phrases = { render, reset, open, countOf, locate, sentenceCard: (p, ctx) => sentence(p, ctx, false), search, norm };
})();
