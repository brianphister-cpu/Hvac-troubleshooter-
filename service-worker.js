// service-worker.js — v7
const CACHE = 'hvac-pro-v7';
const ROOT = '/Hvac-troubleshooter-/';
const CORE = [ROOT, ROOT+'index.html', ROOT+'manifest.json', ROOT+'icon-192.png', ROOT+'icon-512.png', ROOT+'pt/R410A-PT.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (!url.pathname.startsWith(ROOT)) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { caches.open(CACHE).then(c=>c.put(url.pathname, r.clone())); return r; })
      .catch(()=>caches.match(ROOT+'index.html',{ignoreSearch:true})));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(c=>c||fetch(e.request).then(r=>{ caches.open(CACHE).then(cc=>cc.put(e.request,r.clone())); return r; })));
});
