// DOM helpers + shared UI pieces (the plain-JS stand-in for React
// components). Styles live in css/app.css; colours mirror english-ops.
window.App = window.App || {};

(function () {
  // h("div", { class: "card", onclick: fn, style: {...} }, child, [children], "text")
  // - attrs starting with "on" become event listeners
  // - style may be an object (incl. CSS variables like "--a-solid") or a string
  // - null / false / undefined children are skipped
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "class") el.className = v;
        else if (k === "style" && typeof v === "object")
          Object.keys(v).forEach((p) => (p.startsWith("--") ? el.style.setProperty(p, v[p]) : (el.style[p] = v[p])));
        else if (k === "ref") v(el);
        else if (v === true) el.setAttribute(k, "");
        else el.setAttribute(k, v);
      });
    }
    appendChildren(el, children);
    return el;
  }

  function appendChildren(el, children) {
    children.forEach((c) => {
      if (c === null || c === undefined || c === false || c === true) return;
      if (Array.isArray(c)) appendChildren(el, c);
      else if (c instanceof Node) el.appendChild(c);
      else el.appendChild(document.createTextNode(String(c)));
    });
  }

  // One colour per module (tokens --mod-<key>-* in css/app.css, light + dark). `dark` is the
  // text colour on the module's tint/card (the deep main colour in light mode, a light one in dark).
  const MODULE_COLOR = {
    kana: "kana",
    phrases: "phrases",
    listening: "listening",
    speaking: "speaking",
    dialogue: "dialogue",
    numbers: "numbers",
    show: "show",
    daily: "daily",
    reading: "phrases", // 看得懂 shares the 句子庫 colour
  };
  const MODULE_ACCENTS = {};
  Object.keys(MODULE_COLOR).forEach((k) => {
    const c = MODULE_COLOR[k];
    MODULE_ACCENTS[k] = {
      solid: `var(--mod-${c}-main)`,
      dark: `var(--mod-${c}-main)`,
      edge: `var(--mod-${c}-edge)`,
      tint: `var(--mod-${c}-tint)`,
      border: `var(--mod-${c}-border)`,
      on: `var(--mod-${c}-on)`,
    };
  });

  // Style object that sets a module's accent CSS variables on an element;
  // everything inside (chips, .btn-ink.accent, .card.accent…) picks them up.
  function accentVars(key) {
    const a = MODULE_ACCENTS[key];
    return { "--a-solid": a.solid, "--a-dark": a.dark, "--a-edge": a.edge, "--a-tint": a.tint, "--a-border": a.border, "--a-on": a.on };
  }

  // Japanese text: correct font + lang so kanji get Japanese glyph shapes.
  function jp(text, cls = "") {
    return h("span", { lang: "ja", class: `jp ${cls}`.trim() }, text);
  }

  function inkButton(label, onclick, opts = {}) {
    return h(
      "button",
      { class: `btn-ink ${opts.accent ? "accent" : ""} ${opts.class || ""}`.trim(), onclick, disabled: !!opts.disabled },
      label
    );
  }

  function backButton(onclick, label = "← 返回") {
    return h("button", { class: "btn-back", onclick }, label);
  }

  function modHeader(title, onBack) {
    return h("div", { class: "mod-header" }, backButton(onBack), h("h2", null, title));
  }

  function chip(label, active, onclick, opts = {}) {
    return h(
      "button",
      { class: `chip ${active ? "active" : ""} ${opts.class || ""}`.trim(), onclick, lang: opts.lang, "aria-pressed": active ? "true" : "false" },
      label
    );
  }

  function toggle(label, hint, checked, onchange) {
    return h(
      "button",
      { class: "toggle", role: "switch", "aria-checked": checked ? "true" : "false", onclick: () => onchange(!checked) },
      h("span", null, h("span", { class: "toggle-label" }, label), hint && h("span", { class: "toggle-hint" }, hint)),
      h("span", { class: "switch" })
    );
  }

  // 口訣 (js/content/kana.js KANA_MNEMONIC) for one character; null when the character has none.
  //   full    → the detail sheet: a block with the kind label, emoji + text (+ the 形似漢字 reminder)
  //   compact → a lesson card: one small line (the kind label is dropped)
  const KANJI_NOTE = "只幫助記字形，讀音以日文為準";
  function mnemonic(char, opts = {}) {
    const m = window.App.Content && window.App.Content.KANA_MNEMONIC && window.App.Content.KANA_MNEMONIC[char];
    if (!m) return null;
    const label = window.App.Content.MNEMONIC_KINDS[m.kind];
    if (opts.compact) {
      return h("span", { class: "lesson-mnemo" }, `🧠 ${m.emoji} ${m.text}`, m.kind === "kanji" && h("span", { class: "lesson-mnemo-sub" }, `（${KANJI_NOTE}）`));
    }
    return h(
      "div",
      { class: "mnemo", "data-kind": m.kind },
      h("p", { class: "mnemo-head" }, h("span", { "aria-hidden": "true" }, "🧠"), " 口訣", h("span", { class: "mnemo-kind" }, label)),
      h("p", { class: "mnemo-body" }, h("span", { class: "mnemo-emoji", "aria-hidden": "true" }, m.emoji), h("span", null, m.text)),
      m.kind === "kanji" && h("p", { class: "mnemo-sub" }, KANJI_NOTE)
    );
  }

  window.App.UI = { h, MODULE_ACCENTS, accentVars, jp, inkButton, backButton, modHeader, chip, toggle, mnemonic };
})();
