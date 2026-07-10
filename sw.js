/* PantryChef service worker — offline app shell + books cache */
var CACHE = 'pantrychef-v5';
/* Files to pre-cache. "./" covers the app itself (index.html on GitHub Pages). */
var CORE = ['./', 'manifest.json', 'books.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      /* addAll fails the whole install if one file 404s; add individually instead. */
      return Promise.all(CORE.map(function (u) {
        return c.add(u).catch(function () { /* ignore missing optional files */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  /* Never cache API/AI calls or cross-origin requests — always go to network. */
  if (url.origin !== self.location.origin) return;

  /* books.json: network-first so edits show up, fall back to cache offline. */
  if (url.pathname.endsWith('books.json')) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  /* Everything else same-origin: cache-first, then network, and cache the result. */
  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        /* Offline navigation fallback to the app shell. */
        if (req.mode === 'navigate') return caches.match('./');
      });
    })
  );
});
