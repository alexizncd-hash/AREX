const CACHE   = 'arex-v243';
const VERSION = 'v243';
const SHELL = [
  './index.html',
  './rescate.html',
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
  // reparto.js, vision.js, vision-orb.js, gesture.js
  // (v239: orb.js, holo.js, parallax.js y neural-orb.js retirados del sistema)
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
    /* v235 · PRIMERO LA COPIA, LUEGO LA RED.

       ANTES era al revés: cada uno de los ~50 archivos del arranque esperaba
       a la red, y solo si fallaba se usaba la copia guardada. Con cobertura
       buena no se nota. Con cobertura de móvil —o con una red que no falla
       pero tarda, que es lo peor— el arranque se queda esperando a que
       contesten cincuenta peticiones que ya tenía guardadas en el teléfono.
       Ésa es la razón de "le cuesta iniciar, tarda".

       Y era incoherente: el HTML llegaba nuevo mientras el service worker
       seguía siendo el viejo, porque el nuevo espera a que toques el banner.
       Media versión nueva y media vieja a la vez.

       AHORA: si hay copia, se sirve YA —arranque instantáneo, igual con
       internet que sin él— y por detrás se pide la versión nueva para la
       próxima vez. La versión nueva sigue llegando por el camino de siempre:
       el service worker se actualiza aparte y avisa con el banner. */
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const guardada = await c.match(e.request);

      const red = fetch(e.request).then(res => {
        // v211: solo cachear respuestas BUENAS. Antes se guardaba cualquier
        // cosa: una página 404 de GitHub Pages podía sobrescribir la copia
        // buena de un archivo y quedarse congelada ahí para el modo offline.
        if (res.ok) c.put(e.request, res.clone());
        return res;
      });

      if (guardada) {
        e.waitUntil(red.catch(() => {}));   // se actualiza sola, por detrás
        return guardada;
      }
      return red;                            // primera vez: no hay más remedio
    })());
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
