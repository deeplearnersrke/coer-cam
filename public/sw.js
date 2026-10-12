
const CACHE_NAME = 'geo-camera-v2';

const APP_BASE = new URL(self.registration.scope);

const APP_SHELL_URL = new URL('index.html', APP_BASE).href;

self.addEventListener('install', (event) => {
  // Activate the new worker without requiring the old worker to be removed manually.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();

      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith('geo-camera-') && name !== CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);

  // Do not intercept cross-origin requests.
  if (requestUrl.origin !== self.location.origin) return;

  // Navigation: prefer fresh HTML; fall back to the cached app shell offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(APP_SHELL_URL, response.clone());
          }

          return response;
        } catch (error) {
          const cache = await caches.open(CACHE_NAME);

          const cachedPage =
            (await cache.match(request)) ||
            (await cache.match(APP_SHELL_URL));

          if (cachedPage) return cachedPage;

          return new Response(
            'D-Cam is unavailable offline. Connect to the internet and reload.',
            {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            }
          );
        }
      })()
    );

    return;
  }

  // Other assets: use cached content when available and refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(request);

      const networkRequest = fetch(request)
        .then(async (response) => {
          if (response.ok && response.type !== 'opaque') {
            await cache.put(request, response.clone());
          }

          return response;
        });

      if (cachedResponse) {
        // Refresh the cache without delaying the current page.
        event.waitUntil(networkRequest.catch(() => {}));
        return cachedResponse;
      }

      try {
        return await networkRequest;
      } catch {
        return Response.error();
      }
    })()
  );
});
