const CACHE_VERSION = '0.1.0';
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
  '/pyodide/prysm-0.21.1-py2.py3-none-any.whl',
  '/pyodide/higher_order_aberration_visualizer_utils-0.1.0-py3-none-any.whl'
].map(resolveAssetPath);
const PRECACHE_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', (event) => {
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
