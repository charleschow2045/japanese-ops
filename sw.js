// Japanese Ops service worker — offline support (stage 3).
//
// ⚠️ EVERY RELEASE: change VERSION below (and keep FILES complete).
// Phones only pick up a new release when this file's bytes change; the
// app then shows 「有新版本，撳一下更新」 (js/pwa.js).
//
// Isolation: English Ops / Chinese Ops live on the same origin
// (charleschow2045.github.io). This file sits in /japanese-ops/, so the
// browser limits its scope to /japanese-ops/ — it never sees their
// requests. Cache Storage, however, is shared by the whole origin, so
// every cache name starts with CACHE_PREFIX and cleanup only ever
// deletes caches with that prefix.
const VERSION = "2026-10-03a";
const CACHE_PREFIX = "japanese-ops-";
const CACHE = CACHE_PREFIX + VERSION;

// Everything the app needs, relative to this file. Checked against the
// repo before each release (see CLAUDE.md).
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/storage.js",
  "./js/ui.js",
  "./js/speech.js",
  "./js/content/kana.js",
  "./js/kana.js",
  "./js/contrast.js",
  "./js/sounds.js",
  "./js/content/phrases.js",
  "./js/phrases.js",
  "./js/home.js",
  "./js/settings.js",
  "./js/app.js",
  "./js/pwa.js",
  "./fonts/Baloo2.woff2",
  "./fonts/SpecialElite.woff2",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/favicon-32.png",
];

// Install: download every file into the new versioned cache. `reload`
// bypasses the HTTP cache so a release never mixes in stale files.
// No skipWaiting here — a new version waits until the user taps 更新.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
  );
});

// Activate: remove OLD Japanese Ops caches only (never other apps').
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "GET_VERSION" && event.ports[0]) event.ports[0].postMessage(VERSION);
});

// Fetch: cache first (works offline); anything not pre-cached but inside
// our scope is fetched and stored for next time. Page navigations always
// get the cached index.html.
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || !req.url.startsWith(self.registration.scope)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html", { cacheName: CACHE }).then((hit) => hit || fetch(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req, { cacheName: CACHE, ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
    )
  );
});
