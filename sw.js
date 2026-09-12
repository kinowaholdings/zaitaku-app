// 在宅訪問薬剤管理システム — サービスワーカー
// 方針：アプリ本体（HTML/アイコン等）はキャッシュしてオフラインでも起動可能にする。
//       ただし GAS（script.google.com）へのデータ同期は必ずネットワークを使う（古いデータを返さないため）。

const CACHE_NAME = "zaitaku-v5";
const APP_SHELL = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

// インストール時：アプリ本体をキャッシュ
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// 有効化時：古いキャッシュを掃除
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// フェッチ時
self.addEventListener("fetch", (e) => {
  const url = e.request.url;

  // GAS・地図タイル・外部API等はキャッシュしない（常にネットワーク）
  if (
    url.includes("script.google.com") ||
    url.includes("script.googleusercontent.com") ||
    url.includes("nominatim.openstreetmap.org") ||
    url.includes("tile.openstreetmap.org") ||
    url.includes("unpkg.com")
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response("", { status: 503 })));
    return;
  }

  // それ以外（アプリ本体）：キャッシュ優先、なければネット取得してキャッシュ
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        // 成功した同一オリジンGET、またはGoogle FontsのGETをキャッシュに追加
        const isFont = url.includes("fonts.googleapis.com") || url.includes("fonts.gstatic.com");
        if (res && (res.status === 200 || res.type === "opaque") && e.request.method === "GET" && (url.startsWith(self.location.origin) || isFont)) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
