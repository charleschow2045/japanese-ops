// Home screen: 今日任務 card (stage 7b) + the module tiles in two groups.
window.App = window.App || {};

(function () {
  const { h, accentVars, inkButton } = window.App.UI;

  // Two-column tile for one module. Unfinished modules (看得懂) show as a plain, non-button
  // 「規劃中」 tile.
  function moduleTile(mod, onOpen) {
    const isKana = mod.key === "kana";
    const icon = h("span", { class: `tile-icon ${mod.implemented ? "solid" : ""} ${isKana ? "jp" : ""}`, lang: isKana ? "ja" : null }, mod.emoji);
    const body = [icon, h("span", { class: "tile-title" }, mod.label), h("span", { class: "tile-sub" }, mod.implemented ? mod.sub : "規劃中")];
    return mod.implemented
      ? h("button", { class: "tile live", style: accentVars(mod.key), onclick: onOpen }, ...body)
      : h("div", { class: "tile planned", style: accentVars(mod.key) }, ...body);
  }

  // Home groups (2026-10-12): learning the language vs. using it while travelling.
  const GROUPS = [
    { title: "學日文", keys: ["kana", "listening", "speaking"] },
    { title: "旅行時用", keys: ["phrases", "dialogue", "show", "reading"] },
  ];

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
      GROUPS.map((g) =>
        h(
          "section",
          { class: "home-group" },
          h("h2", { class: "group-title" }, g.title),
          h(
            "div",
            { class: "tile-grid" },
            g.keys.map((key) => {
              const m = window.App.Storage.MODULES.find((x) => x.key === key);
              // 聽力／口語 tiles show today's 錯題重溫 count when there is any.
              const due = key === "listening" ? window.App.Listening.dueCount(state) : key === "speaking" ? window.App.Speaking.dueCount(state) : 0;
              return moduleTile(due > 0 ? { ...m, sub: `📝 今天需重溫 ${due} 句` } : m, () => onOpenModule(key));
            })
          )
        )
      )
    );
  }

  window.App.Home = { render };
})();
