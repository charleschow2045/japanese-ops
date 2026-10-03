// 情境句子庫 module (stage 2): scene list → scene page with 全部／🗣️ 我講／
// 👂 店員講 filter → sentence cards (日文、假名、拼音、廣東話意思、使用場合)
// with 🔊 聽, 🐢 慢慢聽 (0.6×) and, for 問答組合, 連續聽 question → answers.
// No learning progress is recorded in stage 2 (by decision).
// Content: js/content/phrases.js.
window.App = window.App || {};

(function () {
  const { h, jp, modHeader, chip } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;

  const SLOW_RATE = 0.6;
  const WHO = {
    me: "🗣️ 你講",
    staff: "👂 店員講",
    both: "🗣️👂 你同店員都會講",
  };
  const FILTERS = [
    { key: "all", label: "全部" },
    { key: "me", label: "🗣️ 我講" },
    { key: "staff", label: "👂 店員講" },
  ];

  // view: "scenes" | "scene"
  const ui = { view: "scenes", scene: null, filter: "all" };

  function reset() {
    ui.view = "scenes";
    ui.scene = null;
    ui.filter = "all";
  }

  const scenes = () => window.App.Content.PHRASE_SCENES;
  // Text for text-to-speech: the optional `say` fix, else the sentence.
  const sayText = (p) => p.say || p.ja;
  const countOf = (scene) => scene.phrases.reduce((n, p) => n + 1 + (p.replies ? p.replies.length : 0), 0);
  const stripPunct = (s) => s.replace(/[。、？！\s]/g, "");

  function matches(p, filter) {
    if (filter === "all") return true;
    return p.who === filter || p.who === "both";
  }

  // ── one sentence (used for questions and, smaller, for replies) ─────

  function sentence(p, settings, isReply) {
    const tts = isTTSSupported();
    const showKana = stripPunct(p.kana) !== stripPunct(p.ja);
    return h(
      "div",
      { class: isReply ? "phrase reply" : "phrase" },
      h("span", { class: `who-tag ${p.who}` }, WHO[p.who]),
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
          h("button", { class: "btn-soft grow", onclick: () => speak(sayText(p), { ...settings, rate: SLOW_RATE }) }, "🐢 慢慢聽")
        )
    );
  }

  function phraseCard(p, settings) {
    const replies = p.replies || [];
    return h(
      "div",
      { class: "card accent phrase-card" },
      sentence(p, settings, false),
      replies.length > 0 &&
        h(
          "div",
          { class: "replies" },
          h("p", { class: "caption mb-1" }, replies.length > 1 ? "可以咁答（揀一句）" : "可以咁答"),
          replies.map((r) => sentence(r, settings, true))
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

  function sceneList(ctx) {
    return h(
      "div",
      null,
      modHeader("情境句子庫", ctx.onBack),
      (() => {
        const n = speechNotice();
        return n && h("div", { class: "mb-4" }, n);
      })(),
      h("p", { class: "small muted mb-4" }, "旅行時最常用嘅句子。每句都有日文、假名、拼音同廣東話意思，撳 🔊 聽發音。"),
      h(
        "div",
        { class: "stack" },
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
      )
    );
  }

  function scenePage(ctx) {
    const { settings } = ctx;
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
      h("div", { class: "stack" }, shown.map((p) => phraseCard(p, settings)))
    );
  }

  // ctx: { settings, onBack, rerender }
  function render(ctx) {
    if (ui.view === "scene" && ui.scene) return scenePage(ctx);
    ui.view = "scenes";
    return sceneList(ctx);
  }

  window.App.Phrases = { render, reset, countOf };
})();
