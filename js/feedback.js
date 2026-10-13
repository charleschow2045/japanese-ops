// Answer feedback + result hero (stage 9 版本二). Tabi cheers on a right answer and encourages on
// a wrong one; a big ✓ / ✕ mark; simple confetti on right answers and perfect scores.
// All motion lives in css/app.css under (prefers-reduced-motion: no-preference), so with the
// system's 「減少動態效果」 on, everything is static. Text colours come from tokens (≥ 4.5:1).
// App.Feedback.banner(ok, { title, sub })  → used at the top of the feedback card (keeps `.fb-title`)
// App.Feedback.hero(score, total)          → Tabi (+ confetti when perfect) at the top of a result card
// App.Feedback.note(text)                  → small Tabi + a hint line (wrong choice inside a dialogue)
window.App = window.App || {};

(function () {
  const { h } = window.App.UI;

  // 14 confetti pieces; position and colour come from CSS (nth-child), so the dark theme works.
  function confetti() {
    const el = h("div", { class: "confetti", "aria-hidden": "true" });
    for (let i = 0; i < 14; i++) el.appendChild(document.createElement("i"));
    return el;
  }

  function banner(ok, opts = {}) {
    const title = opts.title || (ok ? "答對了！" : "答錯了");
    const sub = opts.sub === undefined ? (ok ? "太棒了，再接再厲" : "沒關係，下次就會了") : opts.sub;
    return h(
      "div",
      { class: `fb-banner ${ok ? "ok" : "no"}` },
      ok && confetti(),
      window.App.Mascot.node(ok ? "cheer" : "sorry", "fb-mascot"),
      h(
        "div",
        { class: "fb-text" },
        h("div", { class: "fb-big" }, h("span", { class: "fb-mark", "aria-hidden": "true" }, ok ? "✓" : "✕"), h("p", { class: `fb-title ${ok ? "ok" : "no"}` }, title)),
        sub && h("p", { class: "fb-sub" }, sub)
      )
    );
  }

  function hero(score, total) {
    const ratio = total > 0 ? score / total : 1;
    const perfect = total > 0 && score === total;
    return h("div", { class: `result-hero${perfect ? " perfect" : ""}` }, perfect && confetti(), window.App.Mascot.node(ratio >= 0.7 ? "cheer" : "sorry", "hero-mascot"));
  }

  function note(text) {
    return h("div", { class: "fb-note", role: "status" }, window.App.Mascot.node("sorry", "note-mascot"), h("p", null, text));
  }

  window.App.Feedback = { banner, hero, note };
})();
