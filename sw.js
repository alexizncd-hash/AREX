const CACHE = 'arex-v9';
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
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('groq.com') || url.includes('tavily') ||
      url.includes('firebase') || url.includes('gstatic') ||
      url.includes('cdnjs') || url.includes('jsdelivr') ||
      url.includes('openweathermap.org')) return;

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
