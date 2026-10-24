// 錄音測試 (stage 10 ⑩ 版本一 — 可行性試驗): finds out whether THIS phone / THIS way of opening the
// app (Safari tab vs 主畫面 App) can record from the microphone, before the real 錄音對比 feature
// (版本二) is built. A sub-screen of 設定 (Settings.open("rectest")).
//
// Nothing is saved or uploaded: no state, no backup, no localStorage, no IndexedDB. A recording only
// lives in memory (an object URL) until you leave this screen. Every step is written to a log that
// can be copied and sent back.
window.App = window.App || {};

(function () {
  const { h, modHeader, inkButton } = window.App.UI;
  const { speak, isTTSSupported } = window.App.Speech;

  const SECONDS = 3; // length of the test recording
  // Formats worth knowing about; the first one the browser supports is used for the test recording.
  const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4;codecs=mp4a.40.2"];

  // → the first supported mime type, or "" (let the browser choose)
  function pickMime(isSupported) {
    for (const m of MIME_CANDIDATES) {
      try {
        if (isSupported(m)) return m;
      } catch (e) {}
    }
    return "";
  }

  // time-domain bytes (0–255, silence = 128) → loudest sample as a percentage (0–100)
  function peakPercent(bytes) {
    let peak = 0;
    for (let i = 0; i < bytes.length; i++) peak = Math.max(peak, Math.abs(bytes[i] - 128));
    return Math.round((peak / 128) * 100);
  }

  const yn = (b) => (b === null || b === undefined ? "不明" : b ? "有" : "沒有");

  // The copyable diagnostics text.
  function buildReport(env, log) {
    const types = env.types.map((t) => `${t.mime} ${t.ok ? "✓" : "✕"}`).join("｜");
    return [
      "Japanese Ops 錄音測試",
      `開啟方式：${env.ios ? "iPhone／iPad" : "其他裝置"}｜${env.standalone ? "主畫面 App（獨立視窗）" : "瀏覽器分頁"}`,
      `安全連線（https）：${env.secure ? "是" : "否"}`,
      `getUserMedia：${yn(env.hasGUM)}`,
      `MediaRecorder：${yn(env.hasMR)}`,
      `錄音格式：${types || "（無法檢查）"}`,
      `麥克風權限狀態：${env.perm || "不明"}`,
      `日文朗讀：${yn(env.tts)}`,
      `瀏覽器：${env.ua}`,
      "--- 紀錄 ---",
      ...(log.length ? log : ["（還沒有測試）"]),
    ].join("\n");
  }

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches);

  function env() {
    const md = navigator.mediaDevices;
    const hasMR = typeof window.MediaRecorder === "function";
    return {
      ios: isIOS(),
      standalone: isStandalone(),
      secure: window.isSecureContext !== false,
      hasGUM: !!(md && typeof md.getUserMedia === "function"),
      hasMR,
      types: MIME_CANDIDATES.map((mime) => {
        let ok = false;
        try {
          ok = hasMR && typeof MediaRecorder.isTypeSupported === "function" && MediaRecorder.isTypeSupported(mime);
        } catch (e) {}
        return { mime, ok };
      }),
      perm: ui.perm,
      tts: isTTSSupported(),
      ua: navigator.userAgent,
    };
  }

  // ── screen state (in memory only) ────────────────────────────────────
  const ui = {
    active: false,
    token: 0, // bumped on reset so a late callback from an old test is ignored
    busy: false,
    log: [],
    t0: 0,
    perm: undefined, // undefined = not asked yet, string = state / reason
    url: null, // object URL of the test recording
    fileUrl: null, // object URL of a file picked through 備用方法
    stream: null,
    recorder: null,
    audioCtx: null,
    timers: [],
    countText: "",
  };

  function log(msg) {
    const t = ui.t0 ? ((Date.now() - ui.t0) / 1000).toFixed(1) : "0.0";
    ui.log.push(`[${t}s] ${msg}`);
  }

  function releaseMedia() {
    ui.timers.forEach((t) => {
      clearInterval(t);
      clearTimeout(t);
    });
    ui.timers = [];
    try {
      if (ui.recorder && ui.recorder.state !== "inactive") ui.recorder.stop();
    } catch (e) {}
    ui.recorder = null;
    try {
      if (ui.stream) ui.stream.getTracks().forEach((t) => t.stop());
    } catch (e) {}
    ui.stream = null;
    try {
      if (ui.audioCtx) ui.audioCtx.close();
    } catch (e) {}
    ui.audioCtx = null;
  }

  function reset() {
    ui.active = false;
    ui.token += 1;
    ui.busy = false;
    releaseMedia();
    if (ui.url) URL.revokeObjectURL(ui.url);
    if (ui.fileUrl) URL.revokeObjectURL(ui.fileUrl);
    ui.url = null;
    ui.fileUrl = null;
    ui.log = [];
    ui.t0 = 0;
    ui.perm = undefined;
    ui.countText = "";
  }

  // The permission state is only a hint (Safari may not support the query).
  function askPermission(ctx) {
    const NO = "這個瀏覽器不能查詢";
    ui.perm = "查詢中…";
    const token = ui.token;
    const later = (v) => {
      if (token !== ui.token || !ui.active) return;
      ui.perm = v;
      ctx.rerender();
    };
    try {
      if (!navigator.permissions || !navigator.permissions.query) {
        ui.perm = NO; // no redraw here: this runs while the screen is being drawn
        return;
      }
      navigator.permissions
        .query({ name: "microphone" })
        .then((r) => later(r.state))
        .catch(() => later(NO));
    } catch (e) {
      ui.perm = NO;
    }
  }

  // log lines added without redrawing the screen (a redraw would restart the <audio> player)
  function refreshReport() {
    const ta = document.querySelector(".rec-report");
    if (ta) ta.value = buildReport(env(), ui.log);
  }

  // ── the recording test ───────────────────────────────────────────────

  async function record(ctx) {
    if (ui.busy) return;
    const token = ui.token;
    releaseMedia();
    if (ui.url) URL.revokeObjectURL(ui.url);
    ui.url = null;
    ui.busy = true;
    ui.t0 = Date.now();
    ui.log = [];
    ui.countText = "";
    log("按下「錄音」，要求麥克風…");
    ctx.rerender();

    const fail = (msg) => {
      log(msg);
      ui.busy = false;
      releaseMedia();
      if (ui.active && token === ui.token) ctx.rerender();
    };

    const md = navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== "function") return fail("失敗：這個環境沒有 navigator.mediaDevices.getUserMedia");
    if (typeof window.MediaRecorder !== "function") return fail("失敗：這個環境沒有 MediaRecorder");

    let stream;
    try {
      stream = await md.getUserMedia({ audio: true });
    } catch (e) {
      return fail(`取得麥克風失敗：${e && e.name}：${e && e.message}`);
    }
    if (token !== ui.token) {
      stream.getTracks().forEach((t) => t.stop()); // left the screen while the permission box was open
      return;
    }
    ui.stream = stream;
    const tracks = stream.getAudioTracks();
    log(`取得麥克風：${tracks.length} 條音軌${tracks[0] ? `（${tracks[0].readyState}${tracks[0].muted ? "，muted" : ""}）` : ""}`);

    // loudest level seen while recording (tells a silent recording from a real one)
    let peak = 0;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ac = new AC();
        ui.audioCtx = ac;
        if (ac.state === "suspended" && ac.resume) ac.resume().catch(() => {});
        const an = ac.createAnalyser();
        an.fftSize = 1024;
        ac.createMediaStreamSource(stream).connect(an);
        const buf = new Uint8Array(an.fftSize);
        ui.timers.push(
          setInterval(() => {
            an.getByteTimeDomainData(buf);
            peak = Math.max(peak, peakPercent(buf));
          }, 100)
        );
      } else log("（沒有 AudioContext，不能量度音量）");
    } catch (e) {
      log(`（量度音量失敗：${e && e.message}）`);
    }

    const mime = pickMime((m) => MediaRecorder.isTypeSupported(m));
    let rec;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      return fail(`建立 MediaRecorder 失敗：${e && e.name}：${e && e.message}`);
    }
    ui.recorder = rec;
    const chunks = [];
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onerror = (e) => log(`錄音出錯：${(e && e.error && e.error.name) || "不明"}`);
    rec.onstop = () => {
      if (token !== ui.token) return;
      const type = rec.mimeType || mime || "（不明）";
      // release the microphone straight away (iOS keeps the audio session in "recording" mode — and
      // 朗讀 quiet — until every track is stopped)
      try {
        stream.getTracks().forEach((t) => t.stop());
      } catch (e) {}
      log(`已停止麥克風（音軌狀態：${tracks[0] ? tracks[0].readyState : "—"}）`);
      releaseMedia();
      const blob = new Blob(chunks, { type });
      log(`錄音完成：格式 ${type}，${blob.size} bytes，${chunks.length} 段資料`);
      if (!blob.size) log("⚠️ 沒有錄到任何資料");
      log(`最大音量：${peak}%${peak < 2 ? "（⚠️ 幾乎是靜音：麥克風可能沒有真正收音）" : ""}`);
      if (blob.size) ui.url = URL.createObjectURL(blob);
      ui.busy = false;
      ui.countText = "";
      if (ui.active) ctx.rerender();
    };

    try {
      rec.start();
    } catch (e) {
      return fail(`開始錄音失敗：${e && e.name}：${e && e.message}`);
    }
    log(`開始錄音（${mime || "瀏覽器預設格式"}），${SECONDS} 秒`);
    ctx.rerender();
    const t0 = Date.now();
    const tick = setInterval(() => {
      const left = Math.max(0, SECONDS - (Date.now() - t0) / 1000);
      const el = document.getElementById("rec-count");
      if (el) el.textContent = `🔴 錄音中…還有 ${Math.ceil(left)} 秒`;
    }, 200);
    ui.timers.push(tick);
    ui.timers.push(
      setTimeout(() => {
        try {
          rec.stop();
        } catch (e) {
          log(`停止錄音失敗：${e && e.message}`);
        }
        // if onstop never comes, say so instead of hanging
        ui.timers.push(
          setTimeout(() => {
            if (ui.busy && token === ui.token) {
              log("⚠️ 停止後 3 秒仍沒有收到結果");
              ui.busy = false;
              releaseMedia();
              if (ui.active) ctx.rerender();
            }
          }, 3000)
        );
      }, SECONDS * 1000)
    );
  }

  // 備用方法: let the phone's own recorder / file picker produce the file
  function picked(ctx, label, input) {
    const f = input.files && input.files[0];
    if (!f) return;
    ui.t0 = ui.t0 || Date.now();
    log(`${label}：${f.name || "（無名稱）"}，${f.type || "（不明格式）"}，${f.size} bytes`);
    if (ui.fileUrl) URL.revokeObjectURL(ui.fileUrl);
    ui.fileUrl = URL.createObjectURL(f);
    ctx.rerender();
  }

  // ── screen ───────────────────────────────────────────────────────────

  function copyReport(text) {
    const toast = (m) => window.App.Speech.toast && window.App.Speech.toast(m);
    const fallback = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (e) {}
      document.body.removeChild(ta);
      toast(ok ? "✅ 已複製診斷結果" : "無法複製，請長按下面的文字自行複製");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => toast("✅ 已複製診斷結果"), fallback);
    else fallback();
  }

  const mark = (ok) => h("span", { class: "rec-mark", "aria-hidden": "true" }, ok === null ? "？" : ok ? "✓" : "✕");
  const row = (ok, label, value) => h("li", null, mark(ok), h("span", { class: "grow" }, label, value ? h("span", { class: "small muted" }, `　${value}`) : null));

  // ctx: { settings, rerender(opts), onBack }
  function render(ctx) {
    ui.active = true;
    if (ui.perm === undefined) askPermission(ctx);
    const e = env();
    const report = buildReport(e, ui.log);
    const say = () => {
      log("按下「朗讀」測試（錄音後聲音是否正常）");
      speak("あいうえお", ctx.settings);
      refreshReport();
    };
    return h(
      "div",
      { class: "stack-lg" },
      modHeader("錄音測試", ctx.onBack),
      h("p", { class: "small muted" }, "這是試驗頁，用來確認這部手機能不能錄音。不會儲存任何錄音，也不會上傳；離開這一頁錄音就消失。請照下面步驟試，再把「診斷結果」交給 Claude。"),

      h(
        "div",
        { class: "card accent" },
        h("p", { class: "h-heading accent-text mb-2" }, "① 這部手機的環境"),
        h(
          "ul",
          { class: "rec-env" },
          row(null, "開啟方式", `${e.ios ? "iPhone／iPad" : "其他裝置"}・${e.standalone ? "主畫面 App" : "瀏覽器分頁"}`),
          row(e.secure, "安全連線（https）"),
          row(e.hasGUM, "麥克風 API（getUserMedia）"),
          row(e.hasMR, "錄音 API（MediaRecorder）"),
          h("li", null, mark(e.types.some((t) => t.ok)), h("span", { class: "grow" }, "可用的錄音格式", h("span", { class: "small muted rec-types" }, e.types.map((t) => `${t.mime} ${t.ok ? "✓" : "✕"}`).join("\n")))),
          row(null, "麥克風權限狀態", e.perm),
          row(e.tts, "日文朗讀")
        )
      ),

      h(
        "div",
        { class: "card accent" },
        h("p", { class: "h-heading accent-text mb-2" }, "② 錄音測試"),
        h("p", { class: "small muted mb-3" }, `按「錄音」，允許麥克風後說一句話（例如「こんにちは」），錄 ${SECONDS} 秒。`),
        inkButton(ui.busy ? "錄音中…" : "🎙️ 錄音 3 秒", () => record(ctx), { accent: true, class: "w-full", disabled: ui.busy }),
        h("p", { class: "small mt-2", id: "rec-count", "aria-live": "polite" }, ui.busy ? "要求麥克風…" : ""),
        ui.url &&
          h(
            "div",
            { class: "mt-3" },
            h("p", { class: "small muted" }, "錄好了。按播放聽聽看："),
            h("audio", { class: "rec-audio", controls: true, preload: "auto", src: ui.url, onerror: () => (log("播放出錯：這個格式不能播放"), refreshReport()), onplay: () => (log("播放錄音：開始"), refreshReport()) })
          ),
        ui.url && isTTSSupported() && h("button", { class: "btn-soft w-full mt-3", onclick: say }, [h("span", null, "🔊 朗讀 "), h("span", { lang: "ja", class: "jp" }, "あいうえお"), h("span", null, "（錄音後的聲音有沒有變小？）")]),
        ui.url && h("p", { class: "xs muted mt-2" }, "請留意：錄音有沒有聲音、播放正不正常、按朗讀後聲音是否和平時一樣大。")
      ),

      h(
        "div",
        { class: "card accent" },
        h("p", { class: "h-heading accent-text mb-2" }, "③ 備用方法：用手機的錄音功能"),
        h("p", { class: "small muted mb-3" }, "如果上面的錄音不能用，試試下面兩個，看手機會不會開出錄音或選檔案畫面，並把結果告訴我。"),
        h("label", { class: "btn-soft rec-file w-full" }, "🎤 方法 A（要求直接錄音）", h("input", { type: "file", accept: "audio/*", capture: true, onchange: (ev) => picked(ctx, "備用方法 A", ev.target) })),
        h("label", { class: "btn-soft rec-file w-full mt-2" }, "📁 方法 B（選擇音檔）", h("input", { type: "file", accept: "audio/*", onchange: (ev) => picked(ctx, "備用方法 B", ev.target) })),
        ui.fileUrl && h("audio", { class: "rec-audio", controls: true, preload: "auto", src: ui.fileUrl })
      ),

      h(
        "div",
        { class: "card accent" },
        h("p", { class: "h-heading accent-text mb-2" }, "④ 診斷結果"),
        h("p", { class: "small muted mb-3" }, "試完後按「複製」，貼給 Claude（或長按下面的文字自行複製）。"),
        h("textarea", { class: "paste-box rec-report", readonly: true, rows: 12, "aria-label": "診斷結果" }, report),
        h("button", { class: "btn-soft w-full mt-3", onclick: () => copyReport(report) }, "📋 複製診斷結果")
      )
    );
  }

  window.App.RecTest = { render, reset, pickMime, peakPercent, buildReport, MIME_CANDIDATES, SECONDS };
})();
