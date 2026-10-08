// Home screen: module list (only 五十音 is live in stage 1a).
window.App = window.App || {};

(function () {
  const { h, accentVars } = window.App.UI;

  function moduleRow(mod, onOpen) {
    const isKana = mod.key === "kana";
    return h(
      "button",
      { class: `mod-row ${mod.implemented ? "live" : ""}`, style: accentVars(mod.key), disabled: !mod.implemented, onclick: mod.implemented ? onOpen : null },
      h("span", { class: `mod-icon ${mod.implemented ? "solid" : ""} ${isKana ? "jp" : ""}`, lang: isKana ? "ja" : null, style: isKana ? { fontWeight: 700 } : null }, mod.emoji),
      h("span", { class: "grow" }, h("span", { class: "mod-title" }, mod.label), h("span", { class: "mod-sub" }, mod.implemented ? mod.sub : "即將推出")),
      mod.implemented && h("span", { class: "chev" }, "›")
    );
  }

  function render(state, onOpenModule) {
    const learnt = Object.values(state.kana.stats).filter((s) => s.c > 0).length;
    const total = window.App.Content.KANA_TOTAL;
    return h(
      "div",
      { class: "stack-lg" },
      h(
        "div",
        { class: "card" },
        h("p", { class: "h-heading", style: { fontSize: "1.25rem" } }, "每天學一點，前往日本時就用得上 ✈️"),
        h("p", { class: "small muted mt-1" }, "第一步：先認識平假名和片假名。"),
        h(
          "div",
          { class: "mt-3" },
          h("div", { class: "row-between xs muted mb-1" }, h("span", null, "五十音答對過"), h("span", { style: { color: "var(--gold-dark)" } }, `${learnt} / ${total}`)),
          h("div", { class: "bar" }, h("div", { style: { width: `${(learnt / total) * 100}%` } }))
        )
      ),
      h(
        "div",
        { class: "stack-sm" },
        window.App.Storage.MODULES.map((m) => {
          // 聽力練習 row shows today's 錯題重溫 count when there is any.
          const due =
            m.key === "listening" ? window.App.Listening.dueCount(state) : m.key === "speaking" ? window.App.Speaking.dueCount(state) : 0;
          return moduleRow(due > 0 ? { ...m, sub: `📝 今天需重溫 ${due} 句` } : m, () => onOpenModule(m.key));
        })
      )
    );
  }

  window.App.Home = { render };
})();
