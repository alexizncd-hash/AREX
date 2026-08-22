const CACHE   = 'arex-v228';
const VERSION = 'v228';
const SHELL = [
  './index.html',
  './style.css',
  './diseno.css',
  './app.js',
  './firebase-config.js',
  './nucleo.js',
  './jarvis.js',
  './tareas.js',
  './notas.js',
  './viernes.js',
  './memoria.js',
  './widgets.js',
  './finanzas.js',
  './finanzas.css',
  './finanzas-data.js',
  './negocio.js',
  './negocio.css',
  './gastos.js',
  './gastos.css',
  './metas.js',
  './metas.css',
  './webxr.js',
  './proyectos.js',
  './proyectos.css',
  './evidencias.js',
  './evidencias.css',
  './control.js',
  './control.css',
  './vision.css',
  './reparto.js',
  './reparto.css',
  './agenda.js',
  './agenda.css',
  './habitos.js',
  './habitos.css',
  './search.js',
  './search.css',
  './orb.js',
  './vendor/fuentes/fuentes.css',
  './vendor/fuentes/rajdhani-latin-300-normal.woff2',
  './vendor/fuentes/rajdhani-latin-400-normal.woff2',
  './vendor/fuentes/rajdhani-latin-500-normal.woff2',
  './vendor/fuentes/rajdhani-latin-600-normal.woff2',
  './vendor/fuentes/rajdhani-latin-700-normal.woff2',
  './vendor/fuentes/share-tech-mono-latin-400-normal.woff2',
  './vendor/marked.min.js',
  './vendor/purify.min.js',
  './manifest.json',
  './icon.svg',
  // Lazy-loaded on demand (not in initial shell):
  // reparto.js, vision.js, vision-orb.js, holo.js, parallax.js, gesture.js, neural-orb.js
];

/* v211 · INSTALACIÓN RESILIENTE
   ANTES: cache.addAll(SHELL) es ATÓMICO sobre ~40 recursos. Si UNO fallaba
   (404, red intermitente, CDN lento), la promesa se rechazaba, el SW nuevo
   nunca instalaba, pasaba a 'redundant' y el dispositivo se quedaba en la
   versión vieja INDEFINIDAMENTE — y sin llegar a 'installed' tampoco salía
   el banner de actualización. Cero señal. Ésa era la causa raíz de
   "se me quedó en una versión vieja".
   AHORA: cada recurso se guarda por separado; uno que falle no impide
   instalar el resto, y se registra cuál falló. */
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const res = await Promise.allSettled(SHELL.map(async ruta => {
      const r = await fetch(ruta, { cache: 'reload' });
      if (!r.ok) throw new Error(`${r.status} ${ruta}`);   // no cachear páginas de error
      await c.put(ruta, r);
      return ruta;
    }));
    const fallidos = res.filter(x => x.status === 'rejected').map(x => String(x.reason?.message || x.reason));
    if (fallidos.length) {
      console.warn(`[SW ${VERSION}] instalado con ${fallidos.length}/${SHELL.length} recursos fallidos:`, fallidos);
      self.__swFallidos = fallidos;
    }
  })());
  // v211: NO se llama skipWaiting() aquí. El usuario decide cuándo aplicar
  // (mensaje APLICAR_ACTUALIZACION desde el banner). Antes se aplicaba sola.
});

// El banner de la app pide aplicar la actualización cuando el usuario lo toca
self.addEventListener('message', e => {
  if (e.data?.type === 'APLICAR_ACTUALIZACION') self.skipWaiting();
  if (e.data?.type === 'QUE_VERSION') {
    e.source?.postMessage({ type: 'SW_VERSION', version: VERSION, fallidos: self.__swFallidos || [] });
  }
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => {
      // v211: se RETORNA para que waitUntil espere de verdad al aviso
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        list.forEach(client => client.postMessage({
          type: 'SW_UPDATED', version: VERSION, fallidos: self.__swFallidos || [],
        }));
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

  // Network-first para todo el shell — siempre archivos frescos cuando hay internet
  const isShell = SHELL.some(f => url.endsWith(f.replace('./', '/'))) ||
                  url.endsWith('/') || url.endsWith('/AREX/') || url.includes('index.html');

  if (isShell) {
    e.respondWith(
      fetch(e.request).then(res => {
        // v211: solo cachear respuestas BUENAS. Antes se guardaba cualquier
        // cosa: una página 404 de GitHub Pages podía sobrescribir la copia
        // buena de un archivo y quedarse congelada ahí para el modo offline.
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first para recursos externos (highlight.js, fuentes, etc.)
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  const notif = data.notification || data;
  const title = notif.title || 'AREX';
  const opts = {
    body: notif.body || '',
    icon: './icon.svg',
    badge: './icon.svg',
    vibrate: [200, 100, 200],
    data: data.data || {},
    tag: 'arex-push',
    renotify: true,
  };
  e.waitUntil(self.registration.showNotification(title, opts));
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
