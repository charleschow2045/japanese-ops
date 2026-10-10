// 指給店員看 (stage 8 item 3): cards of big Japanese text to hold up to staff.
// List page (groups → cards, plus 過敏／不吃 builders and 我的酒店資料) and a
// full-screen viewer that auto-fits the text to the screen. Content:
// SHOW_GROUPS / SHOW_ALLERGENS / SHOW_AVOID in js/content/showcards.js.
// What the user ticked/typed lives in state.show (see js/storage.js).
window.App = window.App || {};

(function () {
  const { h, jp, modHeader, chip } = window.App.UI;
  const { speak, isTTSSupported, speechNotice } = window.App.Speech;

  // ui.open = { group, id } while the full-screen viewer is showing.
  const ui = { open: null };
  let wakeLock = null;

  // Keep the screen on while a card is held up (where the browser supports it).
  function holdLock() {
    try {
      if (!navigator.wakeLock || wakeLock) return;
      navigator.wakeLock
        .request("screen")
        .then((lock) => {
          if (!ui.open) return lock.release();
          wakeLock = lock;
          lock.addEventListener("release", () => {
            if (wakeLock === lock) wakeLock = null;
          });
        })
        .catch(() => {});
    } catch (e) {}
  }
  function releaseLock() {
    try {
      if (wakeLock) wakeLock.release();
    } catch (e) {}
    wakeLock = null;
  }
  function reset() {
    ui.open = null;
    releaseLock();
  }

  const groups = () => window.App.Content.SHOW_GROUPS;
  const allergens = () => window.App.Content.SHOW_ALLERGENS;
  const avoids = () => window.App.Content.SHOW_AVOID;

  let phraseIndex = null;
  function phraseById(id) {
    if (!phraseIndex) {
      phraseIndex = {};
      window.App.Content.PHRASE_SCENES.forEach((s) => s.phrases.forEach((p) => [p, ...(p.replies || [])].forEach((x) => (phraseIndex[x.id] = x))));
    }
    return phraseIndex[id] || null;
  }

  // ── what a card shows ────────────────────────────────────────────────
  // → { ja, kana, romaji, yue, en, say, lead?, body? } or null when it cannot be
  // shown yet (nothing ticked / nothing typed). `lead` + `body` = a phrase with
  // the user's own text under it (hotel address…); `say` is what 🔊 reads.

  const pickItems = (list, ids) => list.filter((x) => ids.includes(x.id));
  const joinKey = (items, key, sep) => items.map((x) => x[key]).join(sep);

  function composeAllergy(items) {
    if (!items.length) return null;
    const one = items.length === 1;
    const a = items[0];
    const ja = joinKey(items, "ja", "、");
    const kana = joinKey(items, "kana", "、");
    return {
      ja: one ? `私は${ja}のアレルギーがあります。${ja}が入っていない料理はありますか。` : `私は${ja}のアレルギーがあります。これらが入っていない料理はありますか。`,
      say: one ? `私は${kana}のアレルギーがあります。${kana}が入っていない料理はありますか。` : `私は${kana}のアレルギーがあります。これらが入っていない料理はありますか。`,
      kana: one ? `わたしは${kana}のアレルギーがあります。${kana}がはいっていないりょうりはありますか` : `わたしは${kana}のアレルギーがあります。これらがはいっていないりょうりはありますか`,
      romaji: one
        ? `watashi wa ${a.romaji} no arerugii ga arimasu. ${a.romaji} ga haitte inai ryouri wa arimasu ka`
        : `watashi wa ${joinKey(items, "romaji", ", ")} no arerugii ga arimasu. korera ga haitte inai ryouri wa arimasu ka`,
      yue: one ? `我對${a.yue}過敏，有沒有不含${a.yue}的菜？` : `我對${joinKey(items, "yue", "、")}過敏，有沒有不含這些的菜？`,
      en: one ? `I'm allergic to ${a.en}. Do you have dishes without ${a.en}?` : `I'm allergic to ${joinKey(items, "en", ", ")}. Do you have dishes without them?`,
    };
  }

  function composeAvoid(items) {
    if (!items.length) return null;
    const ja = joinKey(items, "ja", "、");
    const kana = joinKey(items, "kana", "、");
    return {
      ja: `${ja}は食べられません。`,
      say: `${kana}は食べられません。`,
      kana: `${kana}はたべられません`,
      romaji: `${joinKey(items, "romaji", ", ")} wa taberaremasen`,
      yue: `我不能吃${joinKey(items, "yue", "、")}`,
      en: `I can't eat ${joinKey(items, "en", ", ")}.`,
    };
  }

  function resolve(card, show) {
    if (card.ref) {
      const p = phraseById(card.ref);
      return p && { ja: p.ja, kana: p.kana, romaji: p.romaji, yue: p.yue, en: card.en, say: p.say || p.ja };
    }
    if (card.type === "allergy") return composeAllergy(pickItems(allergens(), show.allergens));
    if (card.type === "avoid") return composeAvoid(pickItems(avoids(), show.avoid));
    if (card.type === "saved") {
      const v = (show.saved[card.field] || "").trim();
      if (!v) return null;
      return { ja: card.ja, kana: card.kana, romaji: card.romaji, yue: card.yue, en: card.en, say: card.ja, lead: card.ja, body: v };
    }
    return { ja: card.ja, kana: card.kana, romaji: card.romaji, yue: card.yue, en: card.en, say: card.say || card.ja };
  }

  const SAVED_FIELDS = [
    { key: "hotelName", label: "酒店名稱", placeholder: "例：ホテル〇〇 東京", multiline: false },
    { key: "hotelAddress", label: "酒店住所（地址）", placeholder: "例：〒160-0022 東京都新宿区新宿1-1-1", multiline: true },
    { key: "hotelTel", label: "酒店電話", placeholder: "例：03-1234-5678", multiline: false },
  ];

  // ── viewer ───────────────────────────────────────────────────────────

  // Largest font size at which the text still fits the stage.
  function fit(el) {
    const stage = el.parentElement;
    if (!stage) return;
    const maxH = stage.clientHeight;
    const maxW = stage.clientWidth;
    if (!maxH || !maxW) return;
    let lo = 14;
    let hi = Math.min(maxH, 220);
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      el.style.fontSize = `${mid}px`;
      if (el.scrollHeight <= maxH && el.scrollWidth <= maxW) lo = mid;
      else hi = mid;
    }
    el.style.fontSize = `${lo}px`;
  }
  window.addEventListener("resize", () => {
    const el = document.querySelector(".show-text");
    if (el) fit(el);
  });

  function viewer(ctx) {
    const { state, settings } = ctx;
    const group = groups().find((g) => g.key === ui.open.group);
    const shown = group ? group.cards.map((c) => ({ c, r: resolve(c, state.show) })).filter((x) => x.r) : [];
    const idx = shown.findIndex((x) => x.c.id === ui.open.id);
    if (idx < 0) {
      reset();
      return null;
    }
    const { r } = shown[idx];
    const prefs = state.show.prefs;
    const setPref = (patch) => ctx.onUpdate((s) => ({ ...s, show: { ...s.show, prefs: { ...s.show.prefs, ...patch } } }));
    const go = (d) => {
      const n = shown[(idx + d + shown.length) % shown.length];
      ui.open = { group: ui.open.group, id: n.c.id };
      ctx.rerender();
    };
    const close = () => {
      reset();
      ctx.rerender();
    };

    let touchX = null;
    const stage = h(
      "div",
      {
        class: "show-stage",
        ontouchstart: (e) => (touchX = e.touches[0].clientX),
        ontouchend: (e) => {
          if (touchX === null || shown.length < 2) return;
          const dx = e.changedTouches[0].clientX - touchX;
          touchX = null;
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
        },
      },
      h(
        "div",
        { class: "jp show-text", lang: "ja", ref: (el) => requestAnimationFrame(() => fit(el)) },
        r.lead && h("div", { class: "show-lead" }, r.lead),
        h("div", { class: r.body ? "show-body" : "show-main" }, r.body || r.ja)
      )
    );

    return h(
      "div",
      { class: "show-viewer", role: "dialog", "aria-label": "給店員看" },
      h(
        "div",
        { class: "show-top" },
        h("button", { class: "btn-soft", onclick: close }, "✕ 關閉"),
        h("span", { class: "show-count" }, `${group.emoji} ${group.label}　${idx + 1} / ${shown.length}`),
        shown.length > 1
          ? h(
              "span",
              { class: "row-sm" },
              h("button", { class: "btn-soft show-arrow", onclick: () => go(-1), "aria-label": "上一張" }, "‹"),
              h("button", { class: "btn-soft show-arrow", onclick: () => go(1), "aria-label": "下一張" }, "›")
            )
          : h("span", null)
      ),
      stage,
      h(
        "div",
        { class: "show-foot" },
        prefs.yue && h("p", { class: "show-yue" }, r.yue),
        prefs.en && h("p", { class: "show-en", lang: "en" }, r.en),
        prefs.reading && h("p", { class: "show-reading", lang: "ja" }, r.kana, settings.showRomaji && h("span", { class: "show-rom" }, r.romaji)),
        h(
          "div",
          { class: "row-sm show-tools" },
          isTTSSupported() && h("button", { class: "btn-ink accent show-say", onclick: () => speak(r.say, settings) }, "🔊 唸給對方聽"),
          chip("中文", prefs.yue, () => setPref({ yue: !prefs.yue })),
          chip("English", prefs.en, () => setPref({ en: !prefs.en })),
          chip("讀音", prefs.reading, () => setPref({ reading: !prefs.reading }))
        )
      )
    );
  }

  // ── list page ────────────────────────────────────────────────────────

  function openCard(ctx, groupKey, id) {
    ui.open = { group: groupKey, id };
    holdLock();
    ctx.rerender();
  }

  // The line under a card row: its 中文 意思, or what is still missing.
  function rowSub(card, show) {
    if (resolve(card, show)) return card.yue;
    const field = SAVED_FIELDS.find((f) => f.key === card.field);
    return `請先在上面輸入「${field ? field.label : ""}」`;
  }

  // A card that needs the user's own text stays a button either way; whether it
  // is usable is read from the live state, because typing into 我的酒店資料 does
  // not redraw the page (see hotelCard).
  function cardRow(ctx, group, card) {
    const show = ctx.state.show;
    const ready = !!resolve(card, show);
    const r = ready ? resolve(card, show) : card;
    return h(
      "button",
      {
        class: `ex-card show-row${ready ? "" : " disabled"}`,
        "data-show-card": card.type === "saved" ? card.id : null,
        onclick: () => {
          if (resolve(card, ctx.getState().show)) openCard(ctx, group.key, card.id);
        },
      },
      h("span", { class: "grow" }, jp(r.ja, "show-row-ja"), h("span", { class: `small${ready ? "" : " muted"}` }, rowSub(card, show))),
      h("span", { class: "chev" }, "›")
    );
  }

  // Typing in 我的酒店資料 changes which saved-text cards are usable: update those rows in place.
  function refreshSavedRows(show) {
    groups().forEach((g) =>
      g.cards.forEach((card) => {
        if (card.type !== "saved") return;
        const row = document.querySelector(`[data-show-card="${card.id}"]`);
        if (!row) return;
        const ready = !!resolve(card, show);
        row.classList.toggle("disabled", !ready);
        const sub = row.querySelector(".small");
        if (sub) {
          sub.textContent = rowSub(card, show);
          sub.classList.toggle("muted", !ready);
        }
      })
    );
  }

  // 過敏卡／不吃卡: tick items, then show the card built from them.
  function builderCard(ctx, group, card) {
    const isAllergy = card.type === "allergy";
    const items = isAllergy ? allergens() : avoids();
    const key = isAllergy ? "allergens" : "avoid";
    const chosen = ctx.state.show[key];
    const toggle = (id) =>
      ctx.onUpdate((s) => ({ ...s, show: { ...s.show, [key]: s.show[key].includes(id) ? s.show[key].filter((x) => x !== id) : [...s.show[key], id] } }));
    const r = resolve(card, ctx.state.show);
    return h(
      "div",
      { class: "card accent" },
      h("p", { class: "h-heading accent-text" }, isAllergy ? "🥜 過敏卡" : "🚫 不吃卡"),
      h("p", { class: "xs muted mb-3" }, isAllergy ? "勾選你過敏的食物（可多選），自動生成要給店員看的句子。" : "勾選你不能吃的東西（可多選）。"),
      h("div", { class: "wrap mb-3" }, items.map((it) => chip(`${it.ja}　${it.yue}`, chosen.includes(it.id), () => toggle(it.id), { lang: "ja" }))),
      r && jp(r.ja, "show-preview"),
      r && h("p", { class: "small mt-1" }, r.yue),
      h(
        "button",
        { class: "btn-ink accent w-full mt-3", disabled: !r, onclick: () => openCard(ctx, group.key, card.id) },
        r ? "📱 給店員看" : "請先勾選"
      )
    );
  }

  function hotelCard(ctx) {
    const saved = ctx.state.show.saved;
    // Saved without redrawing the page: a redraw while the user moves from one field
    // to the next would drop the focus (and the tap). The cards below are updated in place.
    const save = (key, value) => {
      const clean = value.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").slice(0, 300);
      const next = ctx.onSilentUpdate((s) => ({ ...s, show: { ...s.show, saved: { ...s.show.saved, [key]: clean } } }));
      refreshSavedRows(next.show);
    };
    return h(
      "div",
      { class: "card accent mb-4" },
      h("p", { class: "h-heading accent-text" }, "📍 我的酒店資料"),
      h("p", { class: "xs muted mb-3" }, "輸入後，「交通」裡的住所、酒店名稱、酒店電話卡就能用。建議將 Google 地圖設為日文介面，複製日文的名稱、地址、電話貼上。資料只存在這部手機（備份檔也會包含）。"),
      SAVED_FIELDS.map((f) =>
        h(
          "label",
          { class: "show-field" },
          h("span", { class: "small" }, f.label),
          f.multiline
            ? h("textarea", { class: "show-input", lang: "ja", rows: 2, maxlength: 300, placeholder: f.placeholder, onchange: (e) => save(f.key, e.target.value) }, saved[f.key] || "")
            : h("input", { class: "show-input", type: "text", lang: "ja", maxlength: 300, placeholder: f.placeholder, value: saved[f.key] || "", onchange: (e) => save(f.key, e.target.value) })
        )
      ),
      h("p", { class: "xs muted" }, "輸入後點一下空白處，就會自動儲存。")
    );
  }

  function listPage(ctx) {
    const notice = speechNotice();
    return h(
      "div",
      null,
      modHeader("指給店員看", ctx.onBack),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-4" }, "把手機拿給店員看：每張卡都是全螢幕的大字日文，不用開口。也可以按 🔊 唸給對方聽。"),
      h(
        "div",
        { class: "wrap mb-4" },
        groups().map((g) =>
          chip(`${g.emoji} ${g.label}`, false, () => {
            const el = document.getElementById(`show-g-${g.key}`);
            if (el) el.scrollIntoView({ block: "start", behavior: "smooth" });
          })
        )
      ),
      hotelCard(ctx),
      groups().map((g) =>
        h(
          "section",
          { class: "mb-4", id: `show-g-${g.key}` },
          h("p", { class: "h-heading mb-2" }, `${g.emoji} ${g.label}`),
          h("div", { class: "stack-sm" }, g.cards.map((c) => (c.type === "allergy" || c.type === "avoid" ? builderCard(ctx, g, c) : cardRow(ctx, g, c))))
        )
      )
    );
  }

  // ctx: { state, getState(), settings, onUpdate(fn) (saves + redraws), onSilentUpdate(fn) (saves, returns the new state), onBack, rerender }
  // → { main, overlay } (the viewer sits in #overlay so it covers the tab bar)
  function render(ctx) {
    const overlay = ui.open ? viewer(ctx) : null;
    return { main: listPage(ctx), overlay };
  }

  window.App.Show = { render, reset, resolve };
})();
