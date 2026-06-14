/**
 * Service Worker — オピオイド計算 PWA v3
 * 戦略: HTML → ネットワーク優先（常に最新版を取得）
 *       その他 → キャッシュ優先（オフライン対応）
 */

const CACHE_NAME = 'opioid-calc-v3';

// インストール時：index.htmlをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(['index.html', 'manifest.json']))
      .then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュ（v1, v2）を全削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// フェッチ：HTMLはネットワーク優先、それ以外はキャッシュ優先
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isHTML = event.request.headers.get('accept')?.includes('text/html')
    || url.pathname === '/'
    || url.pathname.endsWith('.html');

  if (isHTML) {
    // ネットワーク優先：オンラインなら必ず最新版を取得してキャッシュ更新
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match('index.html')))
    );
  } else {
    // キャッシュ優先：CDNリソース等はキャッシュから返し、バックグラウンドで更新
    event.respondWith(
      caches.match(event.request).then(cached => {
        const networkFetch = fetch(event.request).then(response => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
  }
});
