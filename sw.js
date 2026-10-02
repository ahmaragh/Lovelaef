// Offline cache — app shell only. Data lives in the browser storage, never here.
const CACHE = 'waraqat-hob-v8';
const ASSETS = ['./', './index.html', './app.js', './photos.js', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return; // fonts, Microsoft — always network
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});

// Push notifications (sent by the notification server at each order's scheduled times)
self.addEventListener('push', (e) => {
  let m = {}; try { m = e.data ? e.data.json() : {}; } catch (err) { m = { b: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(m.t || 'ورقة حُب', { body: m.b || '', tag: m.tag || undefined, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'ar', dir: 'rtl', data: { u: m.u || '#/today' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const u = (e.notification.data && e.notification.data.u) || '#/today';
  if (/^https?:/.test(u)) { e.waitUntil(self.clients.openWindow(u)); return; } // e.g. the delivery location on maps
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => new URL(x.url).origin === location.origin);
    if (c) { c.postMessage({ go: u }); return c.focus(); }
    return self.clients.openWindow(new URL('./' + u, self.registration.scope).href);
  }));
});
