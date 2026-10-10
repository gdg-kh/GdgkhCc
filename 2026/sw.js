const CACHE_VERSION = 'gk-2026-v5';
const STATIC_CACHE = `gk-static-${CACHE_VERSION}`;
const IMAGE_CACHE = `gk-images-${CACHE_VERSION}`;
const DATA_CACHE = `gk-data-${CACHE_VERSION}`;

const PRECACHE_STATIC = [
  './',
  'index.html',
  'favicon.svg',
  'assets/css/tokens.css',
  'assets/css/base.css',
  'assets/css/components.css',
  'assets/css/layout.css',
  'assets/js/main.js',
  'assets/js/core/dom.js',
  'assets/js/core/store.js',
  'assets/js/core/i18n.js',
  'assets/js/core/analytics.js',
  'assets/js/ui/nav.js',
  'assets/js/ui/card.js',
  'assets/js/ui/ballot-card.js',
  'assets/js/ui/calendar.js',
  'assets/js/ui/detail-modal.js',
  'assets/js/ui/detail-payload.js',
  'assets/js/ui/image-viewer.js',
  'assets/js/sections/about.js',
  'assets/js/sections/sponsor-marquee.js',
  'assets/js/sections/home-cards.js',
  'assets/js/sections/speakers.js',
  'assets/js/sections/agenda.js',
  'assets/js/sections/virtual-space.js',
  'assets/js/sections/staff.js',
  'assets/js/sections/logo-grid.js',
];

const PRECACHE_DATA = ['data/config.json', 'data/content.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_STATIC)),
      caches.open(DATA_CACHE).then((cache) => cache.addAll(PRECACHE_DATA)),
    ])
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('[sw] Precache error:', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  const currentCaches = new Set([STATIC_CACHE, IMAGE_CACHE, DATA_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key.startsWith('gk-') && !currentCaches.has(key)).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 判斷是否為明確要求跳過快取（例如條件式 no-cache、編輯器 no-store、時間戳標記、瀏覽器重新整理 reload）
  const isExplicitBypass =
    request.cache === 'reload' ||
    request.cache === 'no-store' ||
    request.cache === 'no-cache' ||
    url.searchParams.has('_t') ||
    url.searchParams.has('nocache');

  // 1. 靜態圖片：採用 Network-First 策略，連線時保證取得最新圖檔並寫入快取，離線時自動降級讀取快取；
  // 優先精確匹配 URL 查詢參數（如 ?v=... 版號參數），離線時才退回 ignoreSearch: true 降級。
  const isImage = request.destination === 'image' || /\.(png|jpe?g|webp|svg|ico)$/i.test(url.pathname);

  if (isImage) {
    if (isExplicitBypass) {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(IMAGE_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            return (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
          })
      );
      return;
    }

    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // 網路請求失敗（離線），先精確比對，再使用 ignoreSearch 降級
          const cachedResponse = await cache.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          const fallback = await cache.match(request, { ignoreSearch: true });
          if (fallback) {
            return fallback;
          }
          throw new Error('[sw] Image fetch failed and no cache available');
        }
      })
    );
    return;
  }

  // 2. 資料檔案 (JSON)：採用 Network-First 策略，連線時保證取得最新資料，離線時自動降級至快取
  const isData = url.pathname.endsWith('.json') || url.pathname.includes('/data/');

  if (isData) {
    if (isExplicitBypass) {
      event.respondWith(
        fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(async () => {
            return (await caches.match(request)) || (await caches.match(request, { ignoreSearch: true }));
          })
      );
      return;
    }

    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          // 網路請求失敗（離線），讀取快取
          const cachedResponse = (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
          if (cachedResponse) {
            return cachedResponse;
          }
          throw new Error('[sw] Data fetch failed and no cache available');
        }
      })
    );
    return;
  }

  // 3. 頁面導航（HTML）：採用 Network-First 策略，連線時確保載入最新 HTML，離線時使用快取外殼
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        if (isExplicitBypass) {
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(async () => {
              return (
                (await cache.match(request)) ||
                (await cache.match('index.html')) ||
                (await cache.match('./')) ||
                (await cache.match('index.html', { ignoreSearch: true })) ||
                (await cache.match('./', { ignoreSearch: true }))
              );
            });
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const fallbackNav =
            (await cache.match(request)) ||
            (await cache.match('index.html')) ||
            (await cache.match('./')) ||
            (await cache.match('index.html', { ignoreSearch: true })) ||
            (await cache.match('./', { ignoreSearch: true }));
          if (fallbackNav) {
            return fallbackNav;
          }
          throw new Error('[sw] Navigation failed and no offline shell available');
        }
      })
    );
    return;
  }

  // 4. 其餘靜態資源 (CSS / JS / Fonts)：Stale-While-Revalidate，且不盲目 ignoreSearch
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        if (isExplicitBypass) {
          return fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(async () => {
              return (await cache.match(request)) || (await cache.match(request, { ignoreSearch: true }));
            });
        }

        const cachedResponse = await cache.match(request);
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(async (err) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            const fallback = await cache.match(request, { ignoreSearch: true });
            if (fallback) {
              return fallback;
            }
            throw err;
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});
