// 促音・長音 (stage 1b, inside the 五十音 module): explanation + 聽對比
// pairs (きて／きって, おばさん／おばあさん …) + common words. Listening
// only — no quiz (per user decision). Content: SOUND_TOPICS in
// js/content/kana.js.
//
// pairList() is also used by the 字表's 拗音 card (びょういん／びよういん).
window.App = window.App || {};

(function () {
  const { h, jp, modHeader } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;

  // One word: tap to hear it.
  function wordButton(w, label, settings) {
    return h(
      "button",
      { class: "word-btn", onclick: () => speak(w.word, settings), "aria-label": `聽 ${w.word}` },
      label && h("span", { class: "caption" }, label),
      jp(w.word, "word-jp"),
      settings.showRomaji && h("span", { class: "ex-rom" }, w.romaji),
      h("span", { class: "small" }, w.meaning)
    );
  }

  // { labels: [a, b], pairs: [[w1, w2], …] } → pair cards, each with the
  // two words side by side and a 「連續聽」 button reading both in order.
  function pairList(contrast, settings) {
    const tts = isTTSSupported();
    return h(
      "div",
      { class: "stack" },
      contrast.pairs.map((pair) =>
        h(
          "div",
          { class: "pair-card" },
          h("div", { class: "pair-words" }, pair.map((w, i) => wordButton(w, contrast.labels[i], settings))),
          tts &&
            h(
              "button",
              { class: "btn-soft w-full mt-2", onclick: () => speakSequence(pair.map((w) => w.word), settings) },
              "🔊 連續聽：",
              jp(pair.map((w) => w.word).join(" → "))
            )
        )
      )
    );
  }

  function wordList(words, settings) {
    const tts = isTTSSupported();
    return h(
      "div",
      { class: "stack-sm" },
      words.map((w) =>
        h(
          "button",
          { class: "ex-card", onclick: () => speak(w.word, settings) },
          h(
            "span",
            { class: "grow" },
            h("span", { lang: "ja", class: "jp ex-word" }, w.word),
            settings.showRomaji && h("span", { class: "ex-rom" }, w.romaji)
          ),
          h(
            "span",
            { class: "row-sm", style: { flexShrink: 0 } },
            h("span", { class: "ex-mean" }, w.meaning),
            tts && h("span", { style: { fontSize: "1.25rem" } }, "🔊")
          )
        )
      )
    );
  }

  function render(ctx, back) {
    const { settings } = ctx;
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader("促音・長音", back),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "日文嘅停頓同拉長會改變意思。每組撳「連續聽」比較，或者逐個字撳嚟聽。"),
      window.App.Content.SOUND_TOPICS.map((t) =>
        h(
          "div",
          { class: "card accent mb-4" },
          h("p", { class: "h-heading accent-text jp", lang: "ja", style: { fontWeight: 700 } }, t.title),
          h("ul", { class: "rules" }, t.intro.map((line) => h("li", null, line))),
          h("p", { class: "caption mb-2 mt-3" }, "聽對比"),
          pairList(t, settings),
          h("p", { class: "caption mb-2 mt-4" }, "常見例子"),
          wordList(t.words, settings)
        )
      )
    );
  }

  window.App.Sounds = { render, pairList };
})();
