// service-worker.js — v7.2.0
const CACHE = 'hvac-pro-v7.2.0';
const ROOT = '/Hvac-troubleshooter-/';
const CORE = [ROOT, ROOT+'index.html', ROOT+'manifest.json', ROOT+'icon-192.png', ROOT+'icon-512.png', ROOT+'pt/index.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (!url.pathname.startsWith(ROOT)) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cached) => {
      const fetchPromise = fetch(e.request).then((network) => {
        if(network && network.status === 200 && network.type === 'basic') {
          caches.open(CACHE).then(c => c.put(e.request, network.clone()));
        }
        return network;
      }).catch(()=>cached);
      return cached || fetchPromise;
    })
  );
});
// Listen for skipWaiting messages
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
