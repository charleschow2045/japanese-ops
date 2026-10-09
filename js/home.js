// Home screen: 今日任務 card (stage 7b) + the module list.
window.App = window.App || {};

(function () {
  const { h, accentVars, inkButton } = window.App.UI;

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

  // 今日任務 card: progress, streak, countdown and the one button that
  // opens the daily task page.
  function todayCard(state, onOpen) {
    const sum = window.App.Daily.summary(state);
    const all = sum.count === sum.total;
    return h(
      "div",
      { class: "card", style: accentVars("daily") },
      h("p", { class: "h-heading", style: { fontSize: "1.25rem" } }, "每天學一點，前往日本時就用得上 ✈️"),
      h(
        "div",
        { class: "mt-3" },
        h("div", { class: "row-between small mb-1" }, h("span", null, "📅 今日任務"), h("span", { style: { color: "var(--a-solid)" } }, `已完成 ${sum.count} / ${sum.total}`)),
        h("div", { class: "bar accent" }, h("div", { style: { width: `${(sum.count / sum.total) * 100}%` } }))
      ),
      h("p", { class: "small mt-3" }, sum.streak.current > 0 ? `🔥 連續 ${sum.streak.current} 天` : "🔥 今天開始累積連續天數", sum.countdown ? `　${sum.countdown}` : ""),
      inkButton(all ? "今天完成了 🎉　查看" : sum.count === 0 ? "開始今日任務" : `繼續：${sum.nextTitle}`, onOpen, { accent: true, class: "w-full mt-3" })
    );
  }

  function render(state, onOpenModule) {
    return h(
      "div",
      { class: "stack-lg" },
      todayCard(state, () => onOpenModule("daily")),
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
