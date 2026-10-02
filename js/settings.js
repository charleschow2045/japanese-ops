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
                ? "標有「📴 離線可用」嘅語音係裝喺手機入面，冇網絡都可以發音。去旅行前建議揀返呢類語音。"
                : "呢部裝置嘅日文語音冇標明離線可用，冇網絡時可能冇聲。可以開飛行模式試一試。"
            ),
          h("p", { class: "small muted mb-1 mt-3" }, "⏱️ 速度"),
          h("div", { class: "chips-fill" }, RATES.map((r) => chip(r.label, settings.rate === r.rate, () => ctx.onChange({ rate: r.rate })))),
          inkButton(["🔊 試聽：", h("span", { lang: "ja", class: "jp" }, "あいうえお")], () => speak("あいうえお", settings), { class: "w-full mt-4" }),
        ]
      ),

      installSection(),

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

      h(
        "p",
        { class: "xs muted center", style: { paddingBottom: "8px" } },
        `Japanese Ops · 階段 3${window.App.appVersion ? ` · 版本 ${window.App.appVersion}` : ""}`
      )
    );
  }

  // 加入主畫面 guide (stage 3). Standalone = opened from the home screen.
  function installSection() {
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    return section(
      "加入主畫面",
      standalone
        ? h("p", { class: "small mb-2", style: { color: "var(--good)" } }, "✅ 你而家用緊主畫面版本，冇網絡都用得。")
        : h("p", { class: "small muted mb-2" }, "加入主畫面之後，好似獨立 App 咁打開，冇網絡都用得。"),
      h(
        "ul",
        { class: "rules" },
        h("li", null, "iPhone：用 Safari 打開 → 撳底部「分享」⬆️ → 「加入主畫面」"),
        h("li", null, "Android：用 Chrome 打開 → 撳右上角 ⋮ → 「安裝應用程式」或者「加到主畫面」")
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
