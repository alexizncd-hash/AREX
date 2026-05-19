const CACHE   = 'arex-v12';
const VERSION = 'v12';
const SHELL = [
  './index.html',
  './style.css',
  './app.js',
  './jarvis.js',
  './finanzas.js',
  './finanzas.css',
  './finanzas-data.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // Notificar a todos los clientes que hay nueva versión
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(client => client.postMessage({ type: 'SW_UPDATED', version: VERSION }));
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('groq.com') || url.includes('tavily') ||
      url.includes('firebase') || url.includes('gstatic') ||
      url.includes('cdnjs') || url.includes('jsdelivr') ||
      url.includes('frankfurter') ||
      url.includes('openweathermap.org')) return;

  // Network-first para el shell principal (garantiza versión fresca)
  if (url.includes('index.html') || url.endsWith('/') || url.endsWith('/AREX/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para el resto del shell
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
