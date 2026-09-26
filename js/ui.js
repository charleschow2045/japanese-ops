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

  // Same colours as english-ops' MODULE_ACCENTS, two families:
  //   mapBlue     — core skills: 五十音, 聽力, 口語
  //   forestGreen — real-life use: 句子庫, 看得明, 對話, 每日任務
  const MODULE_ACCENTS = {
    kana: { solid: "#2F6B7A", dark: "#1D4750", tint: "#E3EDEF", border: "#C3D9DD" },
    listening: { solid: "#3A7D8C", dark: "#24525C", tint: "#E5EEF0", border: "#C6DBDE" },
    speaking: { solid: "#245566", dark: "#163944", tint: "#DFE8EA", border: "#BED2D5" },
    phrases: { solid: "#3F6B4A", dark: "#294736", tint: "#E6ECE3", border: "#C9D8C0" },
    reading: { solid: "#4F8259", dark: "#36573B", tint: "#E9EEE5", border: "#CFDCC7" },
    dialogue: { solid: "#2E5238", dark: "#1D3524", tint: "#E2E8DE", border: "#C0D0B7" },
    daily: { solid: "#4A7A56", dark: "#315240", tint: "#E8EDE4", border: "#CCDAC3" },
  };

  // Style object that sets a module's accent CSS variables on an element;
  // everything inside (chips, .btn-ink.accent, .card.accent…) picks them up.
  function accentVars(key) {
    const a = MODULE_ACCENTS[key];
    return { "--a-solid": a.solid, "--a-dark": a.dark, "--a-tint": a.tint, "--a-border": a.border, "--a-on": "#EFE6D3" };
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

  window.App.UI = { h, MODULE_ACCENTS, accentVars, jp, inkButton, backButton, modHeader, chip, toggle };
})();
