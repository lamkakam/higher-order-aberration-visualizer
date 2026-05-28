const CACHE_VERSION = '0.2.0';
const CACHE_NAME = `hoa-visualizer-public-assets-${CACHE_VERSION}`;
const scopePathname = new URL(self.registration.scope).pathname;
const BASE_PATH = scopePathname.endsWith('/')
  ? scopePathname.slice(0, -1)
  : scopePathname;
const resolveAssetPath = (assetPath) => `${BASE_PATH}${assetPath}`;
const PRECACHE_URLS = [
  '/locales/en/translation.json',
  '/locales/zh-Hant/translation.json',
  '/locales/zh-Hans/translation.json',
  '/pyodide/prysm-0.21.1-py2.py3-none-any.whl'
].map(resolveAssetPath);
const PRECACHE_PATHS = new Set(PRECACHE_URLS);
const LOCALE_PATHS = new Set([
  '/locales/en/translation.json',
  '/locales/zh-Hant/translation.json',
  '/locales/zh-Hans/translation.json'
].map(resolveAssetPath));

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith('hoa-visualizer-public-assets-') && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  const url = new URL(event.request.url);

  if (url.origin !== self.location.origin || !PRECACHE_PATHS.has(url.pathname)) {
    return;
  }

  if (LOCALE_PATHS.has(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        fetch(event.request)
          .then((response) => {
            cache.put(url.pathname, response.clone());
            return response;
          })
          .catch(() => cache.match(url.pathname))
      )
    );
    return;
  }

  event.respondWith(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.match(url.pathname).then((cachedResponse) => {
        if (cachedResponse !== undefined) {
          return cachedResponse;
        }

        return fetch(event.request).then((response) => {
          cache.put(url.pathname, response.clone());
          return response;
        });
      }))
  );
});
