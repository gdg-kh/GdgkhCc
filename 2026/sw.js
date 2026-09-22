const CACHE_VERSION = 'gk-2026-v2';
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

const PRECACHE_DATA = [
  'data/config.json',
  'data/content.json',
];

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
          keys
            .filter((key) => key.startsWith('gk-') && !currentCaches.has(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 1. 靜態圖片：Cache-First
  const isImage =
    request.destination === 'image' ||
    /\.(png|jpe?g|webp|svg|ico)(\?.*)?$/i.test(url.pathname);

  if (isImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request, { ignoreSearch: true });
        if (cachedResponse) {
          return cachedResponse;
        }
        try {
          const networkResponse = await fetch(request);
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch (err) {
          const fallback = await caches.match(request, { ignoreSearch: true });
          if (fallback) {
            return fallback;
          }
          throw err;
        }
      })
    );
    return;
  }

  // 2. 資料檔案 (JSON)：Stale-While-Revalidate
  const isData =
    url.pathname.endsWith('.json') ||
    url.pathname.includes('/data/');

  if (isData) {
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request, { ignoreSearch: true });
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch((err) => {
            console.warn('[sw] Data revalidation failed:', err.message);
            if (cachedResponse) {
              return cachedResponse;
            }
            throw err;
          });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

  // 3. 靜態資源 (HTML / CSS / JS)：Stale-While-Revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(request, { ignoreSearch: true });
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
            if (request.mode === 'navigate') {
              const fallbackNav =
                (await cache.match('index.html', { ignoreSearch: true })) ||
                (await cache.match('./', { ignoreSearch: true }));
              if (fallbackNav) {
                return fallbackNav;
              }
            }
            throw err;
          });

        return cachedResponse || fetchPromise;
      })
    );
  }
});
