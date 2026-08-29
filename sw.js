const CACHE_NAME = 'isp-crm-cache-v2';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first for the app shell (so edits/updates are picked up when online),
// falling back to cache when offline. Everything else (CDN scripts, Supabase
// calls) passes through to the network completely untouched by this worker.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Nunca intercepta nada fora do próprio site (Supabase, jsDelivr, etc.)
  if (url.origin !== self.location.origin) return;

  // Nunca intercepta métodos diferentes de GET (evita erro ao tentar cachear POST)
  if (event.request.method !== 'GET') return;

  const isShellRequest = event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    APP_SHELL.some((p) => {
      const clean = p.replace('./', '');
      return clean !== '' && url.pathname.endsWith(clean);
    });

  if (!isShellRequest) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
