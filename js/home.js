// Home screen (stage 9 版本一「糖果方塊」): Tabi greeting + 今日任務 card (progress ring, stars,
// streak) + the module tiles in two groups. All numbers come from existing data
// (Daily.summary): no new scoring rules.
window.App = window.App || {};

(function () {
  const { h, accentVars, inkButton } = window.App.UI;

  // Two-column tile for one module. Unfinished modules (看得懂) show as a plain, non-button
  // 「規劃中」 tile.
  function moduleTile(mod, onOpen) {
    const isKana = mod.key === "kana";
    const icon = h("span", { class: `tile-icon ${isKana ? "jp" : ""}`.trim(), lang: isKana ? "ja" : null, "aria-hidden": "true" }, mod.emoji);
    const body = [icon, h("span", { class: "tile-title" }, mod.label), h("span", { class: "tile-sub" }, mod.implemented ? mod.sub : "規劃中")];
    return mod.implemented
      ? h("button", { class: "tile live", style: accentVars(mod.key), onclick: onOpen }, ...body)
      : h("div", { class: "tile planned", style: accentVars(mod.key) }, ...body);
  }

  // Home groups: learning the language vs. using it while travelling.
  const GROUPS = [
    { title: "學日文", keys: ["kana", "listening", "speaking", "numbers"] },
    { title: "旅行時用", keys: ["phrases", "dialogue", "show", "reading"] },
  ];

  // Progress ring: `count` of `total` tasks done today (SVG, colours from --a-* so it follows
  // the 今日任務 colour in both themes).
  function ring(count, total) {
    const r = 34;
    const c = 2 * Math.PI * r;
    const ns = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs) => {
      const el = document.createElementNS(ns, tag);
      Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
      return el;
    };
    const svg = mk("svg", { viewBox: "0 0 84 84", "aria-hidden": "true" });
    svg.appendChild(mk("circle", { cx: 42, cy: 42, r, fill: "none", "stroke-width": 11, class: "ring-track" }));
    if (count > 0) {
      svg.appendChild(
        mk("circle", { cx: 42, cy: 42, r, fill: "none", "stroke-width": 11, "stroke-linecap": "round", class: "ring-arc", "stroke-dasharray": `${((count / total) * c).toFixed(1)} ${c.toFixed(1)}` })
      );
    }
    return h("div", { class: "ring", role: "img", "aria-label": `今日任務已完成 ${count} / ${total}` }, svg, h("div", { class: "ring-n" }, String(count), h("small", null, `/${total}`)));
  }

  function greeting(count, total) {
    const hour = new Date().getHours();
    const ja = hour < 11 ? "おはよう！" : hour < 18 ? "こんにちは！" : "こんばんは！";
    const line = count >= total ? "今天的任務全部完成了！" : count === 0 ? "今天也學一點吧" : `繼續加油，還差 ${total - count} 項`;
    return { ja, line };
  }

  // Tabi + speech bubble, then the 今日任務 card and its one big button.
  function todayBlock(state, onOpen) {
    const sum = window.App.Daily.summary(state);
    const all = sum.count === sum.total;
    const g = greeting(sum.count, sum.total);
    const stars = [];
    for (let i = 0; i < sum.total; i++) stars.push(h("span", { class: i < sum.count ? "on" : "off" }, i < sum.count ? "★" : "☆"));
    return h(
      "div",
      { class: "today-block", style: accentVars("daily") },
      h(
        "div",
        { class: "hello" },
        window.App.Mascot.node(all ? "cheer" : "hello", "hello-mascot"),
        h("div", { class: "hello-bubble" }, h("b", { class: "jp", lang: "ja" }, g.ja), h("span", null, g.line))
      ),
      h(
        "div",
        { class: "card today" },
        ring(sum.count, sum.total),
        h("div", { class: "today-info" }, h("p", { class: "today-title" }, "今日任務"), h("p", { class: "stars", "aria-hidden": "true" }, ...stars), h("p", { class: "today-count" }, `已完成 ${sum.count} / ${sum.total}`)),
        h("div", { class: "streak", role: "img", "aria-label": `連續 ${sum.streak.current} 天` }, h("span", { class: "streak-fire", "aria-hidden": "true" }, "🔥"), h("b", null, String(sum.streak.current)), h("span", null, "連續天數"))
      ),
      sum.countdown && h("p", { class: "countdown" }, sum.countdown),
      sum.routeText && h("p", { class: "countdown" }, sum.routeText),
      inkButton(all ? "今天完成了 🎉　查看" : sum.count === 0 ? "開始今日任務" : `繼續：${sum.nextTitle}`, onOpen, { accent: true, class: "w-full" })
    );
  }

  function render(state, onOpenModule) {
    return h(
      "div",
      { class: "stack-lg" },
      todayBlock(state, () => onOpenModule("daily")),
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
