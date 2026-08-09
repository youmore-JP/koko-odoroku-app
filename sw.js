var CACHE = "koko-cache-v8";
var ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(ASSETS); })
      .then(function() { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    }).then(function() { return self.clients.claim(); })
  );
});

// キャッシュ優先（stale-while-revalidate）：
// 一度読み込んだ端末では、サーバーに届かなくてもキャッシュから即座に表示する。
// オンライン時は裏で最新版を取得しキャッシュを更新する。
self.addEventListener("fetch", function(e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  e.respondWith(
    caches.match(e.request).then(function(hit) {
      var fetchPromise = fetch(e.request).then(function(res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function(c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function() {
        return hit; // オフライン・サーバー停止時はキャッシュを返す
      });
      return hit || fetchPromise;
    })
  );
});
