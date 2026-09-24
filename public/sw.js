const CACHE_NAME = 'hmss-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) return caches.delete(cacheName);
          }),
        ),
      ),
    ]),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // 頁面本身與 version.json 一律繞過 HTTP 快取向伺服器取最新版（開啟即更新）。
  const url = new URL(request.url);
  const isVersionFile = url.pathname.endsWith('/version.json');
  const alwaysFresh = request.mode === 'navigate' || isVersionFile;

  // 網路優先；成功時存一份同源回應供離線使用，失敗才回退快取。
  event.respondWith(
    fetch(alwaysFresh ? new Request(request, { cache: 'no-store' }) : request)
      .then((response) => {
        if (response.ok && url.origin === self.location.origin && !isVersionFile) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});
