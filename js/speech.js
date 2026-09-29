// Text-to-speech (SpeechSynthesis, ja-JP). Voices differ per OS/browser
// and load asynchronously, so nothing is hardcoded.
window.App = window.App || {};

(function () {
  function isTTSSupported() {
    return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
  }

  function getJaVoices() {
    if (!isTTSSupported()) return [];
    return window.speechSynthesis
      .getVoices()
      .filter((v) => v.lang && v.lang.replace("_", "-").toLowerCase().startsWith("ja"));
  }

  // `settings` is state.settings ({ voiceURI, rate }). Falls back to the
  // first Japanese voice, and always sets lang so browsers without a
  // listed voice still try a Japanese one. Call from a tap handler —
  // iOS Safari only lets speech start from a user gesture.
  function speak(text, settings = {}) {
    if (!isTTSSupported() || !text) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = settings.rate || 0.8;
    const voices = getJaVoices();
    const chosen = (settings.voiceURI && voices.find((v) => v.voiceURI === settings.voiceURI)) || voices[0];
    if (chosen) utter.voice = chosen;
    synth.speak(utter);
    return true;
  }

  // Reads several texts one after another (e.g. か…が for 清濁對比). All
  // utterances are queued inside the same tap, which iOS allows; the
  // browser plays its queue in order. Same voice/rate rules as speak().
  function speakSequence(texts, settings = {}) {
    if (!isTTSSupported() || !texts.length) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voices = getJaVoices();
    const chosen = (settings.voiceURI && voices.find((v) => v.voiceURI === settings.voiceURI)) || voices[0];
    texts.forEach((text) => {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = "ja-JP";
      utter.rate = settings.rate || 0.8;
      if (chosen) utter.voice = chosen;
      synth.speak(utter);
    });
    return true;
  }

  // Calls `cb` when the voice list changes (it often arrives after page
  // load). Some browsers never fire voiceschanged, so also check once
  // after a second.
  function onVoicesChanged(cb) {
    if (!isTTSSupported()) return;
    let lastCount = getJaVoices().length;
    const check = () => {
      const n = getJaVoices().length;
      if (n !== lastCount) {
        lastCount = n;
        cb();
      }
    };
    window.speechSynthesis.addEventListener("voiceschanged", check);
    setTimeout(check, 1000);
  }

  // Clear notice shown wherever audio matters; null when a Japanese
  // voice is available.
  function speechNotice() {
    const { h } = window.App.UI;
    const supported = isTTSSupported();
    if (supported && getJaVoices().length > 0) return null;
    return h(
      "div",
      { class: "notice" },
      supported
        ? "🔈 搵唔到日文語音：發音可能唔準或者冇聲。可以喺手機設定加入「日文」語音，或者試下用 Chrome／Safari。其他功能照常用得。"
        : "🔇 呢個瀏覽器唔支援發音功能。其他功能照常用得；想聽發音請用 Chrome 或 Safari。"
    );
  }

  window.App.Speech = { isTTSSupported, getJaVoices, speak, speakSequence, onVoicesChanged, speechNotice };
})();
