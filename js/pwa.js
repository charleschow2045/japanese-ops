// PWA glue (stage 3): registers sw.js (scope limited to this folder),
// shows 「有新版本，撳一下更新」 when a new release has been downloaded,
// and keeps the 📴 離線 badge in the header in sync.
// Loaded last, after app.js.
window.App = window.App || {};

(function () {
  const banner = document.getElementById("update-banner");
  const badge = document.getElementById("offline-badge");

  // ── 📴 離線 badge ──
  function syncOnline() {
    const offline = !navigator.onLine;
    badge.hidden = !offline;
    window.App.isOffline = offline;
    // Speech notices depend on online state (some voices need internet).
    if (window.App.render) window.App.render();
  }
  window.addEventListener("online", syncOnline);
  window.addEventListener("offline", syncOnline);
  window.App.isOffline = !navigator.onLine;
  badge.hidden = navigator.onLine;

  if (!("serviceWorker" in navigator)) return;

  let reg = null;
  let reloading = false;

  // ── 有新版本 banner ──
  function showUpdate(worker) {
    banner.hidden = false;
    banner.querySelector("button").onclick = () => {
      banner.querySelector("button").disabled = true;
      reloading = true;
      worker.postMessage("SKIP_WAITING");
    };
  }

  // The new version took over (only after the user tapped 更新) → reload.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) return;
    window.location.reload();
  });

  // A worker counts as an "update" only if a previous version is already
  // controlling the page (the very first install is not an update).
  function watch(worker) {
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
    });
  }

  // Ask the active worker which release is cached (shown in 設定).
  function fetchVersion() {
    const ctl = navigator.serviceWorker.controller;
    if (!ctl) return;
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      window.App.appVersion = e.data;
      if (window.App.render) window.App.render();
    };
    ctl.postMessage("GET_VERSION", [ch.port2]);
  }

  window.addEventListener("load", () => {
    // scope "./" = this app's folder only (e.g. /japanese-ops/).
    // updateViaCache "none": always fetch sw.js fresh when checking for
    // updates, ignoring GitHub Pages' 10-minute HTTP cache.
    navigator.serviceWorker
      .register("./sw.js", { scope: "./", updateViaCache: "none" })
      .then((r) => {
        reg = r;
        if (r.waiting && navigator.serviceWorker.controller) showUpdate(r.waiting);
        if (r.installing) watch(r.installing);
        r.addEventListener("updatefound", () => watch(r.installing));
        fetchVersion();
      })
      .catch(() => {
        // Offline support unavailable (e.g. private mode) — app still works online.
      });
    navigator.serviceWorker.addEventListener("controllerchange", fetchVersion);
  });

  // Check for a new release whenever the app comes back to the screen.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && reg) reg.update().catch(() => {});
  });
})();
