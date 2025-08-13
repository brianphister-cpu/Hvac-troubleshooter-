// service-worker.js — cache-first PWA for HVAC Troubleshooter Pro
const CACHE = 'hvac-pro-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (evt) => {
  evt.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evt) => {
  if (evt.request.method !== 'GET') return;
  evt.respondWith(
    caches.match(evt.request).then(resp => {
      return resp || fetch(evt.request).then(networkResp => {
        return caches.open(CACHE).then(cache => {
          if (evt.request.url.startsWith(self.location.origin)) {
            cache.put(evt.request, networkResp.clone());
          }
          return networkResp;
        });
      }).catch(() => caches.match('./index.html'));
    })
  );
});
