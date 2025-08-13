// service-worker.js — robust for GitHub Pages subpath (v5.2)
const CACHE = 'hvac-pro-v5-2';
const ROOT = '/Hvac-troubleshooter-/';
const CORE = [
  ROOT,
  ROOT + 'index.html',
  ROOT + 'manifest.json',
  ROOT + 'icon-192.png',
  ROOT + 'icon-512.png'
];
self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (evt) => {
  const url = new URL(evt.request.url);
  if (!url.pathname.startsWith(ROOT)) return;
  if (evt.request.mode === 'navigate') {
    evt.respondWith(fetch(evt.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(url.pathname, copy));
      return resp;
    }).catch(() => caches.match(ROOT + 'index.html', { ignoreSearch: true })));
    return;
  }
  evt.respondWith(
    caches.match(evt.request, { ignoreSearch: true }).then(cached => cached || fetch(evt.request).then(net => {
      const copy = net.clone();
      caches.open(CACHE).then(c => c.put(evt.request, copy));
      return net;
    }))
  );
});
