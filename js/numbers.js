// 數字・價錢・時間讀音表 (stage 8, step 2-A): a read-only reference inside
// the 聽力練習 module. Tap a row to hear it. No quiz yet (step 2-B).
// Content: NUMBER_TOPICS in js/content/numbers.js. Speech is given the kana
// reading, not the digits, so every voice says the same thing.
window.App = window.App || {};

(function () {
  const { h, jp, modHeader } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;

  function row(r, settings, tts) {
    return h(
      "button",
      { class: "ex-card", onclick: () => speak(r.kana, settings), "aria-label": `${r.show} ${r.kana}` },
      h(
        "span",
        { class: "grow" },
        h("span", { lang: "ja", class: "jp ex-word" }, r.show),
        jp(r.kana, "ex-kana"),
        settings.showRomaji && h("span", { class: "ex-rom" }, r.romaji)
      ),
      h(
        "span",
        { class: "row-sm", style: { flexShrink: 0 } },
        r.note && h("span", { class: "xs muted", style: { textAlign: "right", maxWidth: "9em" } }, r.note),
        tts && h("span", { style: { fontSize: "1.25rem" } }, "🔊")
      )
    );
  }

  function topicCard(t, settings, tts) {
    return h(
      "div",
      { class: "card accent mb-4" },
      h("p", { class: "h-heading accent-text", style: { fontWeight: 700 } }, t.title),
      h("ul", { class: "rules" }, t.intro.map((line) => h("li", null, line))),
      t.sequence &&
        tts &&
        h(
          "button",
          { class: "btn-soft w-full mt-3", onclick: () => speakSequence(t.rows.map((r) => r.kana), settings) },
          "🔊 連續聽：",
          jp(t.rows.map((r) => r.show).join(" "))
        ),
      h("div", { class: "stack-sm mt-3" }, t.rows.map((r) => row(r, settings, tts)))
    );
  }

  function render(ctx, back) {
    const { settings } = ctx;
    const tts = isTTSSupported();
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader("數字・價錢・時間", back),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "價錢、車站月台、時間都是用數字說的。按一下每一行聆聽；顯示的是招牌、價錢牌上的寫法，下面是讀音。"),
      window.App.Content.NUMBER_TOPICS.map((t) => topicCard(t, settings, tts))
    );
  }

  window.App.Numbers = { render };
})();
