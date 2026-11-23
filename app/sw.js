/* MoneyCode Offline-First Service Worker (moneycode-ios-pwa-d37fe6a766) */
var CACHE_NAME = 'moneycode-ios-pwa-d37fe6a766';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './styles.css',
  './riyal-font.js',
  './sql-asm.js',
  './trained.js',
  './vocab-seeds.js',
  './engine.js',
  './ai.js',
  './jsQR.js',
  './qr.js',
  './pairing-engine.js',
  './app.js',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Strip query string (?v=...) when matching cached core assets
  var cleanPath = './' + url.pathname.split('/').pop();
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      if (hit) return hit;
      return caches.match(cleanPath).then(function (cleanHit) {
        return cleanHit || fetch(event.request).then(function (res) {
          if (res && res.status === 200) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return res;
        });
      });
    }).catch(function () {
      return caches.match('./index.html');
    })
  );
});
