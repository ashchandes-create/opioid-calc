/**
 * Service Worker — オピオイド計算 PWA
 * オフライン対応：初回アクセス後はネット接続なしで動作
 */

const CACHE_NAME = 'opioid-calc-v2';

// キャッシュするファイル一覧
const PRECACHE_URLS = [
  'opioid-calc.html',
  'manifest.json',
  // CDN（初回アクセス時にキャッシュ）
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/react@18.2.0/umd/react.production.min.js',
  'https://cdn.jsdelivr.net/npm/react-dom@18.2.0/umd/react-dom.production.min.js',
  'https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js',
];

// インストール時：必須リソースをキャッシュ
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // メインファイルは必ずキャッシュ
      return cache.addAll(['opioid-calc.html', 'manifest.json'])
        .then(() => {
          // CDNは失敗してもOK（後でキャッシュ）
          return Promise.allSettled(
            PRECACHE_URLS.filter(u => u.startsWith('http')).map(u =>
              cache.add(u).catch(() => {/* CDN失敗は無視 */})
            )
          );
        });
    }).then(() => self.skipWaiting())
  );
});

// アクティベート時：古いキャッシュを削除
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ：キャッシュ優先、なければネットワーク
self.addEventListener('fetch', event => {
  // POSTリクエストはスキップ
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // バックグラウンドで更新（Stale-While-Revalidate）
        event.waitUntil(
          fetch(event.request)
            .then(fresh => {
              if (fresh && fresh.status === 200) {
                return caches.open(CACHE_NAME).then(c => c.put(event.request, fresh));
              }
            })
            .catch(() => {/* オフラインは無視 */})
        );
        return cached;
      }
      // キャッシュになければネットワーク取得してキャッシュに保存
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        return response;
      }).catch(() => {
        // 完全オフライン時：メインHTMLを返す
        return caches.match('opioid-calc.html');
      });
    })
  );
});
