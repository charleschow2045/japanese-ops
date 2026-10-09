// 進度備份／還原 (stage 8). Reached from 設定 → 💾 進度備份／還原.
// All progress lives in this browser's localStorage, so a backup file is the
// only defence against cleared site data or a new phone.
//   匯出: iPhone → share sheet (儲存到「檔案」、AirDrop…), elsewhere → download;
//         進階: copy the backup as text.
//   匯入: pick a file (or paste text) → checked by Storage.parseBackup → a
//         confirmation screen (file vs current numbers) → only then replaced.
//         The old progress is kept for one 撤銷 (Storage.saveUndo).
// File format and validation: js/storage.js (buildBackup / parseBackup).
window.App = window.App || {};

(function () {
  const { h, inkButton, modHeader } = window.App.UI;
  const { Storage } = window.App;

  const ERROR_TEXT = {
    too_big: "檔案太大，不像是 Japanese Ops 的備份，所以沒有匯入。",
    not_json: "這個檔案打不開，可能已損壞，或者不是備份檔，所以沒有匯入。",
    wrong_app: "這不是 Japanese Ops 的備份檔（可能是其他 App 的檔案），所以沒有匯入。",
    too_new: "這個備份由較新版本的 App 製作，請先更新 App 再匯入。",
    invalid: "備份檔內的資料不完整或格式有問題，所以沒有匯入。",
  };

  // pending: parsed backup waiting for 確認覆蓋; adv: 進階 section open
  const ui = { pending: null, error: "", msg: "", adv: false, paste: "", confirmUndo: false };
  function reset() {
    ui.pending = null;
    ui.error = "";
    ui.msg = "";
    ui.adv = false;
    ui.paste = "";
    ui.confirmUndo = false;
  }

  // ── "上次備份" text and the weekly reminder (also used by 設定／進度頁) ──

  function daysSinceBackup(state) {
    const last = state.backup && state.backup.lastExportAt;
    if (!last || Number.isNaN(Date.parse(last))) return null;
    return Storage.daysBetween(Storage.localDateOf(last), Storage.todayLocal());
  }

  function lastBackupText(state) {
    const n = daysSinceBackup(state);
    if (n === null) return "從未備份";
    return n <= 0 ? "今天" : `${n} 天前`;
  }

  // A one-line nudge once there is something worth protecting: 7+ days since
  // the last backup (or since the first practice day if never backed up).
  function reminder(state) {
    const days = Object.keys(state.daily.activity).sort();
    if (!days.length) return null;
    const since = daysSinceBackup(state);
    if (since !== null) return since >= 7 ? `已超過 ${since} 天沒有備份進度，建議匯出一份。` : null;
    const n = Storage.daysBetween(days[0], Storage.todayLocal());
    return n >= 7 ? `已經練習了 ${n} 天，但還沒有備份過進度，建議匯出一份。` : null;
  }

  // ── helpers ──────────────────────────────────────────────────────────

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function formatDate(iso) {
    if (!iso) return "未知";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "未知";
    return d.toLocaleString("zh-HK", { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function copyText(text, ok) {
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let done = false;
      try {
        done = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
      if (done) ok();
      else window.App.Speech.toast("無法複製，請改用「匯出備份」");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback);
    else fallback();
  }

  // ── export ───────────────────────────────────────────────────────────

  function exportFile(ctx) {
    ui.error = "";
    ui.msg = "";
    const iso = new Date().toISOString();
    const text = JSON.stringify(Storage.buildBackup(Storage.markExported(ctx.state, iso), iso), null, 2);
    const name = Storage.backupFileName();
    const done = (what) => {
      ui.msg = `✅ ${what}：${name}`;
      ctx.onUpdate((s) => Storage.markExported(s, iso));
    };
    const download = () => {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      done("已匯出");
    };
    // iPhone: the share sheet is the reliable way out (a blob download from a
    // home-screen app is not).  Cancelling the sheet is not an export.
    if (isIOS() && navigator.share && navigator.canShare) {
      try {
        const file = new File([text], name, { type: "application/json" });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: name }).then(
            () => done("已匯出"),
            (e) => {
              if (!e || e.name !== "AbortError") download();
            }
          );
          return;
        }
      } catch (e) {}
    }
    download();
  }

  function copyBackup(ctx) {
    ui.error = "";
    ui.msg = "";
    const iso = new Date().toISOString();
    const text = JSON.stringify(Storage.buildBackup(Storage.markExported(ctx.state, iso), iso));
    copyText(text, () => {
      ui.msg = "✅ 已複製備份文字。請貼到「備忘錄」或電郵等地方妥善保存。";
      ctx.onUpdate((s) => Storage.markExported(s, iso));
    });
  }

  // ── import ───────────────────────────────────────────────────────────

  function checkText(ctx, text) {
    ui.error = "";
    ui.msg = "";
    const result = Storage.parseBackup(text);
    if (result.ok) ui.pending = result;
    else ui.error = ERROR_TEXT[result.reason] || ERROR_TEXT.invalid;
    ctx.rerender({ scrollTop: true });
  }

  function pickFile(ctx, e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // lets the same file be picked again
    if (!file) return;
    ui.error = "";
    ui.msg = "";
    if (file.size > Storage.MAX_BACKUP_BYTES) {
      ui.error = ERROR_TEXT.too_big;
      ctx.rerender();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => checkText(ctx, typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => {
      ui.error = ERROR_TEXT.not_json;
      ctx.rerender();
    };
    reader.readAsText(file);
  }

  function confirmRestore(ctx) {
    const ok = ctx.onRestore(ui.pending.state);
    ui.pending = null;
    ui.paste = "";
    if (ok) ui.msg = "✅ 已還原備份。返回主頁就會看到還原後的進度。如果還原錯了，可以在下方撤銷。";
    else ui.error = "無法在還原前保留現有進度（手機儲存空間可能不足），所以已取消還原，現有進度沒有改動。";
    ctx.rerender({ scrollTop: true });
  }

  function summaryTable(fileState, currentState) {
    const total = window.App.Content.DIALOGUES.length;
    const rows = [
      ["連續天數", (s) => `${s.streak} 天（最長 ${s.best}）`],
      ["累計答題", (s) => `${s.answers} 題`],
      ["句子熟練", (s) => `${s.mastered} / ${s.sentences}`],
      ["五十音掌握", (s) => `${s.kanaDone} / ${s.kanaTotal}`],
      ["已玩對話", (s) => `${s.dialogues} / ${total}`],
      ["重溫中", (s) => `${s.reviewActive} 項`],
    ];
    const f = window.App.Progress.summary(fileState);
    const c = window.App.Progress.summary(currentState);
    return h(
      "div",
      { class: "sum-table" },
      h("div", { class: "sum-row head" }, h("span", null), h("span", null, "備份檔"), h("span", null, "現在")),
      rows.map(([label, fmt]) => h("div", { class: "sum-row" }, h("span", { class: "muted" }, label), h("b", null, fmt(f)), h("span", null, fmt(c))))
    );
  }

  // ── screens ──────────────────────────────────────────────────────────

  function confirmScreen(ctx) {
    const f = window.App.Progress.summary(ui.pending.state);
    const c = window.App.Progress.summary(ctx.state);
    return h(
      "div",
      { class: "stack-lg" },
      h(
        "div",
        { class: "card" },
        h("h2", { class: "h-heading mb-1", style: { color: "var(--stamp)" } }, "⚠️ 確定要還原這個備份？"),
        h("p", { class: "small muted mb-3" }, `備份檔日期：${formatDate(ui.pending.exportedAt)}`),
        summaryTable(ui.pending.state, ctx.state),
        f.answers < c.answers && h("p", { class: "notice mt-3" }, "⚠️ 這個備份的累計答題比現在少，表示現在的進度可能比備份新。"),
        h("p", { class: "small mt-3" }, "還原會覆蓋這部手機現有的所有進度和設定（語音選擇除外）。如果現在的進度比備份新，請先取消，再匯出一份備份。"),
        h("p", { class: "xs muted mt-2" }, "還原前會自動保留現有進度，之後可以撤銷一次。")
      ),
      inkButton("確認覆蓋", () => confirmRestore(ctx), { class: "w-full" }),
      h("button", { class: "btn-soft w-full", onclick: () => ((ui.pending = null), ctx.rerender({ scrollTop: true })) }, "取消")
    );
  }

  function undoCard(ctx) {
    const undo = Storage.loadUndo();
    if (!undo) return null;
    return h(
      "div",
      { class: "card" },
      h("p", { class: "h-heading mb-1" }, "↩️ 撤銷上一次還原"),
      h(
        "p",
        { class: "small muted mb-3" },
        `還原前的進度已保留${undo.savedAt ? `（${formatDate(undo.savedAt)}）` : ""}。撤銷會回到那個狀態，並覆蓋你在還原之後的所有練習紀錄。只能撤銷一次。`
      ),
      !ui.confirmUndo
        ? h("button", { class: "btn-soft w-full", onclick: () => ((ui.confirmUndo = true), ctx.rerender()) }, "撤銷還原")
        : h(
            "div",
            { class: "confirm" },
            h("p", { class: "mb-3" }, "確定撤銷？現在的進度會被還原前的進度取代，無法復原。"),
            h(
              "div",
              { class: "row-sm" },
              h("button", { class: "btn-plain grow", onclick: () => ((ui.confirmUndo = false), ctx.rerender()) }, "取消"),
              inkButton(
                "確定撤銷",
                () => {
                  ui.confirmUndo = false;
                  ui.error = "";
                  ui.msg = ctx.onUndo() ? "✅ 已撤銷，回到還原前的進度。" : "";
                  if (!ui.msg) ui.error = "找不到還原前的進度，無法撤銷。";
                  ctx.rerender({ scrollTop: true });
                },
                { class: "grow" }
              )
            )
          )
    );
  }

  function advanced(ctx) {
    return h(
      "div",
      { class: "card" },
      h(
        "button",
        { class: "row-between w-full", style: { textAlign: "left", minHeight: "44px" }, "aria-expanded": ui.adv ? "true" : "false", onclick: () => ((ui.adv = !ui.adv), ctx.rerender()) },
        h("span", { class: "small" }, "進階：文字備份"),
        h("span", { class: "chev" }, ui.adv ? "▾" : "›")
      ),
      ui.adv && [
        h("p", { class: "xs muted mt-2 mb-3" }, "如果這部手機無法儲存或選取備份檔，可以改為複製備份文字，貼到「備忘錄」等地方保存；還原時再貼回這裏。"),
        h("button", { class: "btn-soft w-full", onclick: () => copyBackup(ctx) }, "📋 複製備份文字"),
        h("p", { class: "small mt-4 mb-1" }, "貼上備份文字還原"),
        h(
          "textarea",
          {
          class: "paste-box",
          rows: "4",
          placeholder: "在此貼上備份文字…",
          autocomplete: "off",
          autocapitalize: "off",
          spellcheck: "false",
          "aria-label": "貼上備份文字",
          oninput: (e) => (ui.paste = e.target.value), // no rerender: keeps the keyboard open
          },
          ui.paste
        ),
        h(
          "button",
          {
            class: "btn-soft w-full mt-2",
            onclick: () => (ui.paste.trim() ? checkText(ctx, ui.paste.trim()) : ((ui.error = "請先貼上備份文字。"), ctx.rerender())),
          },
          "檢查並還原"
        ),
      ]
    );
  }

  // ctx: { state, onBack, onUpdate(fn), onRestore(importedState) → bool, onUndo() → bool, rerender }
  function render(ctx) {
    if (ui.pending) return confirmScreen(ctx);
    return h(
      "div",
      { class: "stack-lg" },
      modHeader("進度備份", ctx.onBack),
      h(
        "div",
        { class: "card accent" },
        h("h2", { class: "h-heading mb-1" }, "💾 進度備份／還原"),
        h("p", { class: "small muted mb-3" }, "所有進度（答題紀錄、每日任務、錯題重溫、設定等）只儲存在這部手機的瀏覽器裏。清除瀏覽器資料或更換手機，進度就會消失，所以請定期備份。"),
        h("p", { class: "small mb-3" }, "📅 建議每星期備份一次。"),
        h("p", { class: "small mb-3" }, `上次備份：${lastBackupText(ctx.state)}`),
        h(
          "p",
          { class: "xs muted" },
          "📱 iPhone：主畫面版本和 Safari 的進度是分開的。如果之前一直用 Safari，要先在 Safari 匯出，加入主畫面之後，再在主畫面版本匯入。"
        )
      ),
      inkButton("⬇️ 匯出備份", () => exportFile(ctx), { accent: true, class: "w-full" }),
      h(
        "label",
        { class: "btn-soft file-btn w-full" },
        "⬆️ 匯入備份",
        h("input", { type: "file", accept: "application/json,.json", style: { display: "none" }, onchange: (e) => pickFile(ctx, e) })
      ),
      ui.msg && h("p", { class: "small", style: { color: "var(--good)" } }, ui.msg),
      ui.error && h("p", { class: "small", style: { color: "var(--stamp)" } }, `❌ ${ui.error}`),
      undoCard(ctx),
      advanced(ctx)
    );
  }

  window.App.Backup = { render, reset, reminder, lastBackupText };
})();
