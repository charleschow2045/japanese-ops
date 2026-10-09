// 設定 tab: display toggles, Japanese voice + speed, reset progress.
window.App = window.App || {};

(function () {
  const { h, inkButton, chip, toggle } = window.App.UI;
  const { speak, isTTSSupported, getJaVoices, speechNotice } = window.App.Speech;

  const RATES = [
    { label: "慢", rate: 0.6 },
    { label: "正常", rate: 0.8 },
    { label: "快", rate: 1.0 },
  ];

  let confirmReset = false; // screen-local: two-step reset

  function cleanVoiceName(name) {
    return name.replace(/^(Microsoft|Google)\s*/, "").replace(/\s*\(.*\)\s*$/, "").replace(/\s*-\s*Japanese.*$/i, "");
  }

  function section(title, ...children) {
    return h("div", { class: "card" }, h("p", { class: "h-heading mb-1" }, title), ...children);
  }

  // ctx: { settings, onChange(patch), onReset(), rerender }
  function render(ctx) {
    const { settings } = ctx;
    const voices = getJaVoices();
    const tts = isTTSSupported();
    const currentVoice =
      settings.voiceURI && voices.some((v) => v.voiceURI === settings.voiceURI) ? settings.voiceURI : voices[0] && voices[0].voiceURI;
    const notice = speechNotice();

    return h(
      "div",
      { class: "stack-lg" },
      h("h2", { class: "h-display" }, "設定"),

      section(
        "顯示",
        toggle("顯示羅馬拼音", "熟悉之後可以關閉，逐步改為憑假名閱讀", settings.showRomaji, (v) => ctx.onChange({ showRomaji: v })),
        toggle("顯示廣東話近似讀音", "僅為近似，請以發音為準", settings.showYue, (v) => ctx.onChange({ showYue: v }))
      ),

      section(
        "發音",
        notice && h("div", { class: "mb-3" }, notice),
        tts && [
          h("p", { class: "small muted mb-1 mt-1" }, "🔊 日文語音"),
          voices.length === 0
            ? h("p", { class: "small muted mb-2" }, "正在使用裝置的預設語音")
            : h(
                "div",
                { class: "wrap mb-2", style: { gap: "8px" } },
                voices.map((v) =>
                  chip(`${cleanVoiceName(v.name)}${v.localService ? "　📴 離線可用" : ""}`, currentVoice === v.voiceURI, () => {
                    ctx.onChange({ voiceURI: v.voiceURI });
                    speak("こんにちは", { ...settings, voiceURI: v.voiceURI });
                  })
                )
              ),
          voices.length > 0 &&
            h(
              "p",
              { class: "xs muted mb-2" },
              voices.some((v) => v.localService)
                ? "標有「📴 離線可用」的語音安裝在手機內，沒有網絡也能發音。出發旅行前建議選用這類語音。"
                : "此裝置的日文語音沒有標明可離線使用，沒有網絡時可能沒有聲音。可以開啟飛行模式測試。"
            ),
          h("p", { class: "small muted mb-1 mt-3" }, "⏱️ 速度"),
          h("div", { class: "chips-fill" }, RATES.map((r) => chip(r.label, settings.rate === r.rate, () => ctx.onChange({ rate: r.rate })))),
          inkButton(["🔊 試聽：", h("span", { lang: "ja", class: "jp" }, "あいうえお")], () => speak("あいうえお", settings), { class: "w-full mt-4" }),
        ]
      ),

      flagSection(ctx.flags || []),

      installSection(),

      section(
        "進度",
        h("p", { class: "small muted mb-3" }, "進度與設定只儲存在這部裝置的瀏覽器中。"),
        !confirmReset
          ? h(
              "button",
              {
                class: "btn-danger-soft w-full",
                onclick: () => {
                  confirmReset = true;
                  ctx.rerender();
                },
              },
              "清除所有進度"
            )
          : h(
              "div",
              { class: "confirm" },
              h("p", { class: "mb-3" }, "確定清除？答題紀錄與設定會全部刪除，無法復原。"),
              h(
                "div",
                { class: "row-sm" },
                h(
                  "button",
                  {
                    class: "btn-plain grow",
                    onclick: () => {
                      confirmReset = false;
                      ctx.rerender();
                    },
                  },
                  "取消"
                ),
                inkButton(
                  "確定清除",
                  () => {
                    confirmReset = false;
                    ctx.onReset();
                  },
                  { class: "grow" }
                )
              )
            )
      ),

      h(
        "p",
        { class: "xs muted center", style: { paddingBottom: "8px" } },
        `Japanese Ops · 階段 7a${window.App.appVersion ? ` · 版本 ${window.App.appVersion}` : ""}`
      )
    );
  }

  // 讀錯句子清單: sentences marked 🚩 in 句子庫, in scene order, with a
  // 複製清單 button producing text like 「餐廳 2：何名様ですか。」.
  function flagLines(flags) {
    const order = window.App.Content.PHRASE_SCENES.map((s) => s.key);
    return flags
      .map((id) => window.App.Phrases.locate(id))
      .filter(Boolean)
      .sort((a, b) => order.indexOf(a.scene.key) - order.indexOf(b.scene.key) || a.num - b.num)
      .map((l) => ({ id: l.phrase.id, text: `${l.scene.label} ${l.num}：${l.phrase.ja}` }));
  }

  function copyText(text) {
    const done = () => window.App.Speech.toast("✅ 已複製讀錯句子清單，可以貼給 Claude");
    const fallback = () => {
      // Older browsers / non-secure contexts: select a hidden textarea.
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
      if (ok) done();
      else window.App.Speech.toast("無法複製，請長按清單文字自行複製");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  }

  function flagSection(flags) {
    const lines = flagLines(flags);
    const text = ["讀錯句子：", ...lines.map((l) => l.text)].join("\n");
    return section(
      "讀錯句子清單",
      lines.length === 0
        ? h("p", { class: "small muted" }, "尚未有標記。在句子庫聽到發音有誤的句子時，按句子卡上的「🚩 讀錯」，就會列在這裡。")
        : [
            h("p", { class: "small muted mb-2" }, `共 ${lines.length} 句。在句子卡上再按一下「🚩 已標記」即可取消。`),
            h("ul", { class: "flag-list" }, lines.map((l) => h("li", null, l.text))),
            inkButton("📋 複製清單", () => copyText(text), { class: "w-full mt-3" }),
          ]
    );
  }

  // 加入主畫面 guide (stage 3). Standalone = opened from the home screen.
  function installSection() {
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    return section(
      "加入主畫面",
      standalone
        ? h("p", { class: "small mb-2", style: { color: "var(--good)" } }, "✅ 你現在使用的是主畫面版本，沒有網絡也能使用。")
        : h("p", { class: "small muted mb-2" }, "加入主畫面後，會像獨立 App 一樣開啟，沒有網絡也能使用。"),
      h(
        "ul",
        { class: "rules" },
        h("li", null, "iPhone：用 Safari 開啟 → 點按底部「分享」⬆️ →「加入主畫面」"),
        h("li", null, "Android：用 Chrome 開啟 → 點按右上角 ⋮ →「安裝應用程式」或「加到主畫面」")
      ),
      h("p", { class: "note gold mt-3" }, "💡 建議固定從主畫面打開，進度才不會分散，資料也較不易被系統清除。")
    );
  }

  // Leaving the tab cancels a half-finished reset confirmation.
  function reset() {
    confirmReset = false;
  }

  window.App.Settings = { render, reset };
})();
