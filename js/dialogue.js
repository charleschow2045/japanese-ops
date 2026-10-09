// 情境對話 (stage 7a). Content: js/content/dialogues.js (graphs of 句子庫
// sentence ids). Flow: 對方說（自動播放）→ 你從 2–4 個回應中選一個 →
// 對方依你的選擇回應 … 有些對方回答是隨機的，並可附「❓理解題」。
//
// Scoring: every 你選回應 and every 理解題 is one turn; a turn counts as
// correct only on the FIRST pick. A wrong pick shows why and lets you try
// again (the wrong option greys out). On a first wrong pick:
//   你選回應  → 口語重溫 "s:<the correct sentence you should have said>"
//   理解題    → 聽力重溫 "p:<the staff line you misunderstood>"
// Results are saved when the dialogue ends (recordDialogue).
window.App = window.App || {};

(function () {
  const { h, jp, inkButton, modHeader, toggle, accentVars } = window.App.UI;
  const { speak, speakSequence, isTTSSupported, speechNotice } = window.App.Speech;

  const SLOW_RATE = 0.6;
  const WHO = { me: "🗣️ 你說", staff: "👂 對方說" };

  // ── sentence lookup ──
  let byIdCache = null;
  function sentenceById(id) {
    if (!byIdCache) {
      byIdCache = {};
      window.App.Content.PHRASE_SCENES.forEach((s) =>
        s.phrases.forEach((p) => [p, ...(p.replies || [])].forEach((x) => (byIdCache[x.id] = x)))
      );
    }
    return byIdCache[id] || null;
  }
  const say = (id) => {
    const p = sentenceById(id);
    return p ? p.say || p.ja : "";
  };
  const dialogues = () => window.App.Content.DIALOGUES;
  const sceneLabel = (key) => (window.App.Content.PHRASE_SCENES.find((s) => s.key === key) || {}).label || "";

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── session state ──
  let ui = null; // null = list view
  function reset() {
    ui = null;
  }

  function begin(ctx, dlg) {
    ui = { dlg, log: [], pending: null, revealed: {}, total: 0, correct: 0, mistakes: [], done: false, queue: [], scroll: true, saved: false };
    enter(ctx, dlg.start);
    flush(ctx);
    ctx.rerender({ scrollTop: true });
  }

  // Everything spoken during one tap is queued, then played in one go
  // (iOS only allows speech started inside the user's tap).
  function flush(ctx) {
    if (ui.queue.length && isTTSSupported()) speakSequence(ui.queue, ctx.state.settings);
    ui.queue = [];
  }

  function enter(ctx, id) {
    const node = ui.dlg.nodes[id];
    if (!node) throw new Error(`dialogue ${ui.dlg.id}: missing node ${id}`);
    if (node.t === "end") {
      ui.done = true;
      ui.pending = null;
      if (!ui.saved) {
        ui.saved = true;
        ctx.onFinish(ui.dlg.id, ui.correct, ui.total);
      }
      return;
    }
    if (node.t === "menu") {
      ui.pending = { type: "menu", node };
      return;
    }
    if (node.t === "s") {
      const pick = node.pick ? node.pick[Math.floor(Math.random() * node.pick.length)] : node;
      const lines = pick.lines;
      ui.log.push({ k: "staff", lines });
      ui.queue.push(...lines.map(say));
      if (pick.check) {
        ui.total += 1;
        const c = pick.check;
        ui.pending = { type: "check", check: c, options: shuffle([c.answer, ...c.others]), wrong: {}, firstWrong: false, next: pick.next, entry: ui.log.length - 1 };
      } else {
        enter(ctx, pick.next);
      }
      return;
    }
    if (node.t === "u") {
      ui.total += 1;
      const oks = shuffle(node.options.filter((o) => o.ok));
      const bads = shuffle(node.options.filter((o) => !o.ok));
      const nOk = Math.min(oks.length, 3);
      const nBad = Math.min(bads.length, 4 - nOk);
      ui.pending = { type: "u", node, options: shuffle([...oks.slice(0, nOk), ...bads.slice(0, nBad)]), wrong: {}, firstWrong: false, why: null };
      return;
    }
    throw new Error(`dialogue ${ui.dlg.id}: bad node type at ${id}`);
  }

  function chooseUser(ctx, opt) {
    const p = ui.pending;
    if (opt.ok) {
      if (!p.firstWrong) ui.correct += 1;
      ui.log.push({ k: "user", line: opt.l });
      ui.queue.push(say(opt.l));
      enter(ctx, opt.next);
      flush(ctx);
    } else {
      p.wrong[opt.l] = true;
      p.why = opt.why || "這句在這裡不合適，請再選一次。";
      if (!p.firstWrong) {
        p.firstWrong = true;
        const shownOk = p.options.find((o) => o.ok);
        if (shownOk) {
          ui.mistakes.push({ kind: "speak", id: shownOk.l });
          ctx.onMistake("speak", shownOk.l);
        }
      }
    }
    ui.scroll = true;
    ctx.rerender();
  }

  function chooseCheck(ctx, text) {
    const p = ui.pending;
    if (text === p.check.answer) {
      if (!p.firstWrong) ui.correct += 1;
      ui.revealed[p.entry] = true;
      ui.log.push({ k: "check", ask: p.check.ask, answer: p.check.answer });
      enter(ctx, p.next);
      flush(ctx);
    } else {
      p.wrong[text] = true;
      if (!p.firstWrong) {
        p.firstWrong = true;
        const lineId = ui.log[p.entry].lines[0];
        ui.mistakes.push({ kind: "listen", id: lineId });
        ctx.onMistake("listen", lineId);
      }
    }
    ui.scroll = true;
    ctx.rerender();
  }

  function chooseMenu(ctx, opt) {
    ui.log.push({ k: "menu", label: opt.label });
    enter(ctx, opt.next);
    flush(ctx);
    ui.scroll = true;
    ctx.rerender();
  }

  // ── rendering ──

  function lineBlock(id, settings, withMeaning) {
    const p = sentenceById(id);
    if (!p) return h("p", { class: "muted" }, `（找不到句子 ${id}）`);
    return h(
      "div",
      { class: "dlg-line" },
      h("p", { lang: "ja", class: "jp dlg-ja" }, p.ja),
      settings.showRomaji && h("p", { class: "phrase-rom" }, p.romaji),
      withMeaning && h("p", { class: "dlg-zh" }, p.yue)
    );
  }

  function staffBubble(ctx, entry, idx) {
    const settings = ctx.state.settings;
    const tts = isTTSSupported();
    const visible = !tts || ctx.state.dialogue.prefs.showText || ui.revealed[idx];
    return h(
      "div",
      { class: "bubble staff" },
      h("span", { class: "who-tag staff" }, WHO.staff),
      visible
        ? entry.lines.map((id) => lineBlock(id, settings, true))
        : h("p", { class: "dlg-hidden" }, "🎧 先聽聽看對方說了什麼"),
      tts &&
        h(
          "div",
          { class: "row-sm mt-2" },
          h("button", { class: "btn-soft grow", onclick: () => speakSequence(entry.lines.map(say), settings) }, "🔊 再聽"),
          h("button", { class: "btn-soft grow", onclick: () => speakSequence(entry.lines.map(say), { ...settings, rate: SLOW_RATE }) }, "🐢 慢慢聽"),
          !visible &&
            h(
              "button",
              {
                class: "btn-soft grow",
                onclick: () => {
                  ui.revealed[idx] = true;
                  ui.scroll = false;
                  ctx.rerender();
                },
              },
              "顯示文字"
            )
        )
    );
  }

  function userBubble(ctx, entry) {
    return h("div", { class: "bubble me" }, h("span", { class: "who-tag me" }, WHO.me), lineBlock(entry.line, ctx.state.settings, true));
  }

  function transcript(ctx) {
    return ui.log.map((e, i) => {
      if (e.k === "staff") return staffBubble(ctx, e, i);
      if (e.k === "user") return userBubble(ctx, e);
      if (e.k === "menu") return h("p", { class: "dlg-note" }, `📌 ${e.label}`);
      return h("p", { class: "dlg-note" }, `❓ ${e.ask}　✅ ${e.answer}`);
    });
  }

  function pendingArea(ctx) {
    const p = ui.pending;
    if (!p) return null;
    const scrollAttr = ui.scroll ? "end" : null;
    ui.scroll = false;
    if (p.type === "menu") {
      return h(
        "div",
        { class: "card accent pending", "data-autoscroll": scrollAttr },
        h("p", { class: "h-heading mb-2" }, p.node.prompt),
        h("div", { class: "stack-sm" }, p.node.options.map((o) => h("button", { class: "dlg-opt", onclick: () => chooseMenu(ctx, o) }, h("span", { class: "dlg-zh" }, o.label))))
      );
    }
    if (p.type === "check") {
      return h(
        "div",
        { class: "card accent pending", "data-autoscroll": scrollAttr },
        h("p", { class: "h-heading mb-2" }, `❓ ${p.check.ask}`),
        h(
          "div",
          { class: "stack-sm" },
          p.options.map((t) =>
            h("button", { class: `dlg-opt ${p.wrong[t] ? "wrong" : ""}`.trim(), disabled: !!p.wrong[t], onclick: () => chooseCheck(ctx, t) }, h("span", { class: "dlg-zh" }, t))
          )
        ),
        p.firstWrong && h("p", { class: "xs mt-2", style: { color: "var(--stamp)" } }, "不是這個，請再聽一次對方的話（🔊 再聽）後再選。")
      );
    }
    // user turn
    const showMeaning = ctx.state.dialogue.prefs.showMeaning;
    return h(
      "div",
      { class: "card accent pending", "data-autoscroll": scrollAttr },
      h("p", { class: "h-heading mb-2" }, "你會怎樣回應？"),
      h(
        "div",
        { class: "stack-sm" },
        p.options.map((o) => {
          const s = sentenceById(o.l);
          return h(
            "button",
            { class: `dlg-opt ${p.wrong[o.l] ? "wrong" : ""}`.trim(), disabled: !!p.wrong[o.l], onclick: () => chooseUser(ctx, o) },
            h("span", { lang: "ja", class: "jp dlg-ja" }, s.ja),
            showMeaning && h("span", { class: "dlg-zh" }, s.yue)
          );
        })
      ),
      p.why && h("p", { class: "small mt-2", style: { color: "var(--stamp)" } }, `❌ ${p.why}`)
    );
  }

  function summary(ctx) {
    const rate = ui.total ? Math.round((ui.correct / ui.total) * 100) : 100;
    const perfect = ui.correct === ui.total;
    const dlg = ui.dlg;
    return h(
      "div",
      { class: "card accent center pending", "data-autoscroll": ui.scroll ? "end" : null },
      h("p", { style: { fontSize: "3rem", marginBottom: "8px" } }, perfect ? "🎉" : rate >= 70 ? "👍" : "💪"),
      h("p", { class: "score" }, `${ui.correct} / ${ui.total}`),
      h("p", { class: "muted mt-1", style: { fontWeight: 700 } }, perfect ? "一次過全對！" : "第一次答對的題數。答錯的已加入重溫。"),
      ui.mistakes.length > 0 &&
        h(
          "div",
          { class: "mt-4", style: { textAlign: "left" } },
          h("p", { class: "caption mb-2" }, "答錯的內容（按一下可聽）"),
          h(
            "div",
            { class: "stack-sm" },
            ui.mistakes.map((m) => {
              const p = sentenceById(m.id);
              return h(
                "button",
                { class: "ex-card", onclick: () => speak(say(m.id), ctx.state.settings) },
                h(
                  "span",
                  { class: "grow" },
                  h("span", { lang: "ja", class: "jp ex-word", style: { fontSize: "1.1rem" } }, p.ja),
                  h("span", { class: "small" }, `${m.kind === "speak" ? "你要說：" : "對方說："}${p.yue}`)
                ),
                h("span", null, "🔊")
              );
            })
          )
        ),
      h(
        "div",
        { class: "stack mt-4" },
        inkButton("再玩一次", () => begin(ctx, dlg), { class: "w-full" }),
        inkButton("返回對話列表", () => {
          reset();
          ctx.rerender({ scrollTop: true });
        }, { accent: true, class: "w-full" })
      )
    );
  }

  function playScreen(ctx) {
    const dlg = ui.dlg;
    const body = ui.done ? summary(ctx) : pendingArea(ctx);
    ui.scroll = false;
    return h(
      "div",
      null,
      modHeader(`${dlg.emoji} ${dlg.title}`, () => {
        reset();
        ctx.rerender({ scrollTop: true });
      }),
      h("p", { class: "dlg-intro" }, `📍 ${dlg.intro}`),
      h("div", { class: "dlg-log" }, transcript(ctx)),
      body
    );
  }

  function listScreen(ctx) {
    const tts = isTTSSupported();
    const prefs = ctx.state.dialogue.prefs;
    const notice = speechNotice();
    const done = Object.values(ctx.state.dialogue.stats).filter((s) => s.plays > 0).length;
    return h(
      "div",
      null,
      modHeader("情境對話", ctx.onBack),
      notice && h("div", { class: "mb-4" }, notice),
      h("p", { class: "small muted mb-3" }, `扮演旅客，和店員、司機、職員一問一答。已完成 ${done} / ${dialogues().length} 個。`),
      h(
        "div",
        { class: "card accent mb-4" },
        tts && toggle("先聽後看", "對方的話預設不顯示文字，聽完再按「顯示文字」", !prefs.showText, (v) => ctx.onPrefsChange({ showText: !v })),
        toggle("選項顯示中文意思", "關閉後只看日文，難度較高", prefs.showMeaning, (v) => ctx.onPrefsChange({ showMeaning: v }))
      ),
      h(
        "div",
        { class: "stack" },
        dialogues().map((d) => {
          const st = ctx.state.dialogue.stats[d.id];
          return h(
            "button",
            { class: "mod-row live", onclick: () => begin(ctx, d) },
            h("span", { class: "mod-icon" }, d.emoji),
            h(
              "span",
              { class: "grow" },
              h("span", { class: "mod-title" }, d.title),
              h("span", { class: "mod-sub" }, `${sceneLabel(d.scene)}・${st && st.plays ? `玩過 ${st.plays} 次・最佳 ${st.best}%${st.perfect ? "・一次過全對 ✓" : ""}` : "未玩過"}`)
            ),
            h("span", { class: "chev" }, "›")
          );
        })
      )
    );
  }

  // ctx: { state, onPrefsChange, onMistake(kind, id), onFinish(id, correct, total), onBack, rerender }
  function render(ctx) {
    return ui ? playScreen(ctx) : listScreen(ctx);
  }

  // Dev/test helper: structural check of every dialogue. Returns a list of problems.
  function validate() {
    const problems = [];
    dialogues().forEach((d) => {
      const nodes = d.nodes;
      const ids = (list) => (list || []).forEach((id) => { if (!sentenceById(id)) problems.push(`${d.id}: unknown sentence ${id}`); });
      if (!nodes[d.start]) problems.push(`${d.id}: start node missing`);
      const target = (from, to) => {
        if (!nodes[to]) problems.push(`${d.id}: ${from} -> missing node ${to}`);
        return nodes[to];
      };
      Object.entries(nodes).forEach(([nid, n]) => {
        if (n.t === "s") {
          (n.pick || [n]).forEach((p) => {
            ids(p.lines);
            if (!p.lines || !p.lines.length) problems.push(`${d.id}:${nid} staff node without lines`);
            const t = target(nid, p.next);
            if (t && t.t === "s") problems.push(`${d.id}:${nid} staff -> staff (${p.next}); merge into one node`);
            if (p.check) {
              if (p.check.others.includes(p.check.answer)) problems.push(`${d.id}:${nid} check answer repeated in others`);
              if (new Set([p.check.answer, ...p.check.others]).size < 3) problems.push(`${d.id}:${nid} check needs 3 distinct options`);
            }
          });
        } else if (n.t === "u") {
          ids(n.options.map((o) => o.l));
          if (!n.options.some((o) => o.ok)) problems.push(`${d.id}:${nid} no correct option`);
          if (!n.options.some((o) => !o.ok)) { /* a node with only valid options is allowed */ }
          n.options.forEach((o) => {
            if (o.ok) target(nid, o.next);
            else if (!o.why) problems.push(`${d.id}:${nid} distractor ${o.l} has no reason`);
            const s = sentenceById(o.l);
            if (s && s.who === "staff") problems.push(`${d.id}:${nid} user option ${o.l} is a staff-only sentence`);
          });
        } else if (n.t === "menu") {
          n.options.forEach((o) => target(nid, o.next));
        } else if (n.t !== "end") problems.push(`${d.id}:${nid} unknown type ${n.t}`);
      });
      // every node reachable; END reachable
      const seen = new Set();
      const stack = [d.start];
      while (stack.length) {
        const id = stack.pop();
        if (seen.has(id) || !nodes[id]) continue;
        seen.add(id);
        const n = nodes[id];
        if (n.t === "s") (n.pick || [n]).forEach((p) => stack.push(p.next));
        else if (n.t === "u") n.options.filter((o) => o.ok).forEach((o) => stack.push(o.next));
        else if (n.t === "menu") n.options.forEach((o) => stack.push(o.next));
      }
      Object.keys(nodes).forEach((nid) => { if (!seen.has(nid)) problems.push(`${d.id}: node ${nid} unreachable`); });
    });
    return problems;
  }

  // Test helper: what is the player being asked right now?
  function peek() {
    const p = ui && ui.pending;
    if (!p) return ui ? { type: ui.done ? "done" : "none" } : { type: "list" };
    if (p.type === "u") return { type: "u", options: p.options.map((o) => ({ l: o.l, ok: o.ok })) };
    if (p.type === "check") return { type: "check", answer: p.check.answer, options: p.options };
    return { type: "menu", options: p.node.options.map((o) => o.label) };
  }

  window.App.Dialogue = { render, reset, validate, sentenceById, peek };
})();
