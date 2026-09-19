const CACHE_NAME = 'workstack-shell-v1';

function isInScope(url) {
  const scope = new URL(self.registration.scope);
  return url.origin === scope.origin && url.pathname.startsWith(scope.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll([
          new URL('./', self.registration.scope).toString(),
          new URL('./manifest.webmanifest', self.registration.scope).toString(),
          new URL('./workstack-icon.svg', self.registration.scope).toString(),
        ]),
      ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('workstack-shell-') && key !== CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || !isInScope(new URL(request.url))) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match(new URL('./', self.registration.scope));
        }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          void caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
