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
        toggle("顯示羅馬拼音", "熟咗之後可以關，逐步靠假名去讀", settings.showRomaji, (v) => ctx.onChange({ showRomaji: v })),
        toggle("顯示廣東話近似讀音", "只係近似，以發音為準", settings.showYue, (v) => ctx.onChange({ showYue: v }))
      ),

      section(
        "發音",
        notice && h("div", { class: "mb-3" }, notice),
        tts && [
          h("p", { class: "small muted mb-1 mt-1" }, "🔊 日文語音"),
          voices.length === 0
            ? h("p", { class: "small muted mb-2" }, "用緊裝置預設語音")
            : h(
                "div",
                { class: "wrap mb-2", style: { gap: "8px" } },
                voices.map((v) =>
                  chip(cleanVoiceName(v.name), currentVoice === v.voiceURI, () => {
                    ctx.onChange({ voiceURI: v.voiceURI });
                    speak("こんにちは", { ...settings, voiceURI: v.voiceURI });
                  })
                )
              ),
          h("p", { class: "small muted mb-1 mt-3" }, "⏱️ 速度"),
          h("div", { class: "chips-fill" }, RATES.map((r) => chip(r.label, settings.rate === r.rate, () => ctx.onChange({ rate: r.rate })))),
          inkButton(["🔊 試聽：", h("span", { lang: "ja", class: "jp" }, "あいうえお")], () => speak("あいうえお", settings), { class: "w-full mt-4" }),
        ]
      ),

      section(
        "進度",
        h("p", { class: "small muted mb-3" }, "進度同設定只儲存喺呢部裝置嘅瀏覽器入面。"),
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
              h("p", { class: "mb-3" }, "確定清除？答題紀錄同設定會全部刪除，冇得復原。"),
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

      h("p", { class: "xs muted center", style: { paddingBottom: "8px" } }, "Japanese Ops · 階段 1a")
    );
  }

  // Leaving the tab cancels a half-finished reset confirmation.
  function reset() {
    confirmReset = false;
  }

  window.App.Settings = { render, reset };
})();
