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

  // The voice speak() will actually use: the user's pick, else the first
  // Japanese voice, else undefined (browser default).
  function chosenVoice(settings = {}) {
    const voices = getJaVoices();
    return (settings.voiceURI && voices.find((v) => v.voiceURI === settings.voiceURI)) || voices[0];
  }

  // Short message at the bottom of the screen (stage 3: speech failures).
  let toastTimer = null;
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4000);
  }

  function makeUtterance(text, settings, voice) {
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = settings.rate || 0.8;
    if (voice) utter.voice = voice;
    // "interrupted"/"canceled" just mean we started another sound.
    utter.onerror = (e) => {
      if (e.error === "interrupted" || e.error === "canceled") return;
      toast(
        window.App.isOffline
          ? "📴 發音失敗：此語音可能需要網絡。請到「設定」選擇標有「📴 離線可用」的語音。"
          : "🔈 發音失敗，請再試一次，或到「設定」選擇其他語音。"
      );
    };
    return utter;
  }

  // `settings` is state.settings ({ voiceURI, rate }). Falls back to the
  // first Japanese voice, and always sets lang so browsers without a
  // listed voice still try a Japanese one. Call from a tap handler —
  // iOS Safari only lets speech start from a user gesture.
  function speak(text, settings = {}) {
    if (!isTTSSupported() || !text) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    synth.speak(makeUtterance(text, settings, chosenVoice(settings)));
    return true;
  }

  // Reads several texts one after another (e.g. か…が for 清濁對比). All
  // utterances are queued inside the same tap, which iOS allows; the
  // browser plays its queue in order. Same voice/rate rules as speak().
  function speakSequence(texts, settings = {}) {
    if (!isTTSSupported() || !texts.length) return false;
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = chosenVoice(settings);
    texts.forEach((text) => synth.speak(makeUtterance(text, settings, voice)));
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
  // voice is available (and, when offline, usable without internet).
  // `localService === false` means the browser says the voice runs on a
  // server — not every phone reports this accurately, so the wording is
  // "may".
  function speechNotice() {
    const { h } = window.App.UI;
    const supported = isTTSSupported();
    const voices = getJaVoices();
    if (supported && voices.length > 0) {
      if (!window.App.isOffline) return null;
      const settings = (window.App.currentSettings && window.App.currentSettings()) || {};
      const voice = chosenVoice(settings);
      if (!voice || voice.localService !== false) return null;
      const hasLocal = voices.some((v) => v.localService);
      return h(
        "div",
        { class: "notice" },
        hasLocal
          ? `📴 目前沒有網絡，而你選用的語音（${voice.name}）需要網絡才能使用，可能沒有聲音。請到「設定」選擇標有「📴 離線可用」的語音。`
          : "📴 目前沒有網絡，此裝置的日文語音需要網絡才能使用，發音可能沒有聲音。其他功能照常使用。"
      );
    }
    return h(
      "div",
      { class: "notice" },
      supported
        ? "🔈 找不到日文語音：發音可能不準確或沒有聲音。可以在手機設定中加入「日文」語音，或試用 Chrome／Safari。其他功能照常使用。"
        : "🔇 此瀏覽器不支援發音功能。其他功能照常使用；想聽發音請使用 Chrome 或 Safari。"
    );
  }

  window.App.Speech = { isTTSSupported, getJaVoices, chosenVoice, speak, speakSequence, onVoicesChanged, speechNotice, toast };
})();
