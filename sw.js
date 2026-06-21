const CACHE   = 'arex-v125';
const VERSION = 'v125';
const SHELL = [
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './jarvis.js',
  './orb.js',
  './finanzas-data.js',
  './finanzas.js',
  './finanzas.css',
  './search.js',
  './search.css',
  './reactor3d.js',
  './reactor3d.css',
  './manifest.json',
  './icon.svg',
  // Module JS + CSS — lazy-loaded by jarvis.js, but pre-cached so offline works:
  './negocio.js',   './negocio.css',
  './gastos.js',    './gastos.css',
  './metas.js',     './metas.css',
  './proyectos.js', './proyectos.css',
  './evidencias.js','./evidencias.css',
  './control.js',   './control.css',
  './reparto.js',   './reparto.css',
  './agenda.js',    './agenda.css',
  './habitos.js',   './habitos.css',
  // On-demand only (not pre-cached):
  // vision.js, vision-orb.js, holo.js, parallax.js, gesture.js, webxr.js
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
      url.includes('frankfurter') || url.includes('er-api.com') ||
      url.includes('openweathermap.org') || url.includes('googleapis.com')) return;

  const isShell = SHELL.some(f => url.endsWith(f.replace('./', '/'))) ||
                  url.endsWith('/') || url.endsWith('/AREX/') || url.includes('index.html');

  if (isShell) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  const notif = data.notification || data;
  e.waitUntil(self.registration.showNotification(notif.title || 'AREX', {
    body:      notif.body || '',
    icon:      './icon.svg',
    badge:     './icon.svg',
    vibrate:   [200, 100, 200],
    data:      data.data || {},
    tag:       'arex-push',
    renotify:  true,
  }));
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
