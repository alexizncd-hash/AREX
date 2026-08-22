/* ═══════════════════════════════════════════════════════
   AREX — Módulo Rutas de Reparto
   Mapa 3D interactivo · Planificación de entregas
   Integración completa con Módulo Negocio (sucursales)
   ═══════════════════════════════════════════════════════ */

const REPARTO_KEY  = 'arex_reparto_rutas';
const MAPLIBRE_VER = '4.7.1';

let _repMap        = null;
let _repGeoMarker  = null;
let _repWaypoints  = [];

/* v222 · NOMBRES DE PARADA.
   repAddWpSuc(lat, lng, nombre) recibía el nombre de la sucursal y lo TIRABA:
   guardaba solo [lng, lat], así que la lista de la ruta mostraba
   "19.4326° -99.1332°". Con tres sucursales se aguanta; con quince clientes
   es ilegible — y ése es justo el escenario para el que sirve el módulo.

   El nombre NO puede ir dentro del array: [lng, lat] se pasa tal cual a
   MapLibre, a GeoJSON y a OSRM, y un tercer elemento se interpreta como
   ALTITUD. Un texto ahí rompería la geometría. Por eso va aparte, indexado
   por coordenada: así sobrevive a reordenar la ruta (optimizar cambia el
   orden pero no las coordenadas) sin tocar ninguno de los doce sitios que
   usan la geometría. */
let _repNombres = {};
const _wpClave = (lng, lat) => `${(+lng).toFixed(5)},${(+lat).toFixed(5)}`;
const _wpNombre = wp => _repNombres[_wpClave(wp[0], wp[1])] || '';
let _repSucMarkers = [];

/* ── Render principal ────────────────────────────────── */
function renderRepartoModule() {
  const wrap = document.getElementById('rep-wrap');
  if (!wrap) return;

  /* v223 · MAPA A PANTALLA COMPLETA.
     Antes esto era una pantalla partida: el mapa a la izquierda y una barra
     lateral de 230 px con las sucursales, la ruta y las rutas guardadas. En
     un teléfono de 390 px eso deja el mapa en menos de 160 px de ancho —
     inservible para ver una ruta.

     Ahora el mapa ocupa TODO y los datos flotan encima, como en cualquier
     app de mapas: buscador arriba, acciones a la derecha y una hoja
     deslizable abajo. Los bordes respetan env(safe-area-inset-*) para no
     quedar debajo de la muesca ni de la barra de gestos del iPhone. */
  wrap.innerHTML = `
    <div class="rep-mapa-full">
      <div id="rep-map-el" class="rep-map-el"></div>
      <div class="rep-map-msg" id="rep-map-msg">⟳ CARGANDO MAPA…</div>

      <!-- ── arriba: buscar dirección + resumen de la ruta ── -->
      <div class="rep-cap-sup">
        <div class="rep-buscar dx-sup">
          <input id="rep-buscar-inp" class="rep-buscar-inp"
                 placeholder="Buscar dirección o lugar…" autocomplete="off"
                 enterkeyhint="search">
          <button class="rep-buscar-btn" onclick="repBuscarLugar()" aria-label="Buscar">⌕</button>
        </div>
        <div id="rep-buscar-res" class="rep-buscar-res"></div>
        <div class="rep-resumen" id="rep-resumen">
          <span class="rep-res-chip"><b id="rep-wp-count">0</b> paradas</span>
          <span class="rep-res-chip" id="rep-res-km">— km</span>
          <span class="rep-res-chip" id="rep-res-min">— min</span>
          <span class="rep-res-chip" id="rep-weather">—</span>
        </div>
      </div>

      <!-- ── derecha: acciones, sobre el mapa ── -->
      <div class="rep-cap-acciones">
        <button class="rep-fab" onclick="repGeolocate()"        title="Mi ubicación">◎</button>
        <button class="rep-fab" onclick="repCapaMapa()"          title="Cambiar mapa" id="rep-fab-capa">◱</button>
        <button class="rep-fab" onclick="repRouteSucursales()"   title="Ruta con todas las sucursales">⊕</button>
        <button class="rep-fab rep-fab-hot" onclick="repRouteSucursales(true)" title="Solo las que hay que resurtir">🔥</button>
        <button class="rep-fab rep-fab-opt" onclick="repOptimizarRuta()" title="Optimizar el orden">⚡</button>
        ${_repTraficoDisponible()
          ? '<button class="rep-fab" id="rep-fab-trafico" onclick="repTrafico()" title="Tráfico en tiempo real">◔</button>'
          : ''}
      </div>

      <!-- ── abajo: hoja deslizable con las paradas ── -->
      <div class="rep-hoja" id="rep-hoja">
        <button class="rep-hoja-tirador" onclick="repHoja()" aria-label="Desplegar">
          <span class="rep-hoja-linea"></span>
        </button>
        <div class="rep-hoja-barra">
          <button class="rep-btn rep-btn-nav" onclick="repNavegar('google')">▶ NAVEGAR</button>
          <button class="rep-btn" onclick="repNavegar('waze')">◈ WAZE</button>
          <button class="rep-btn" onclick="repCompartir()">⇪ COMPARTIR</button>
          <button class="rep-btn" onclick="repSaveRoute()">⊡ GUARDAR</button>
          <button class="rep-btn rep-btn-del" onclick="repClearRoute()">✕</button>
        </div>
        <div class="rep-hoja-cuerpo">
          <div class="rep-sec">
            <div class="rep-sec-hdr">RUTA ACTIVA<span class="rep-sec-hint">toca el mapa para añadir</span></div>
            <div id="rep-wp-list" class="rep-list"></div>
          </div>
          <div class="rep-sec">
            <div class="rep-sec-hdr">SUCURSALES</div>
            <div id="rep-suc-list" class="rep-list"></div>
          </div>
          <div class="rep-sec">
            <div class="rep-sec-hdr">RUTAS GUARDADAS</div>
            <div id="rep-saved-list" class="rep-list"></div>
          </div>
        </div>
      </div>
    </div>`;

  _renderSucList();
  _renderSavedList();
  document.getElementById('rep-hoja')?.classList.add('rep-hoja-recogida');
  const bInp = document.getElementById('rep-buscar-inp');
  if (bInp) {
    bInp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); repBuscarLugar(); } });
    // Nominatim pide máximo 1 petición por segundo: se espera a que pares
    bInp.addEventListener('input', () => {
      clearTimeout(_repBuscaT);
      if (bInp.value.trim().length < 4) {
        const c = document.getElementById('rep-buscar-res');
        if (c) { c.innerHTML = ''; c.classList.remove('abierto'); }
        return;
      }
      _repBuscaT = setTimeout(repBuscarLugar, 900);
    });
  }
  setTimeout(_initRepMap, 80);
  window.logBitacora?.('reparto', 'Módulo Rutas abierto');
}

/* ── MapLibre GL init ────────────────────────────────── */
function _initRepMap() {
  const el = document.getElementById('rep-map-el');
  if (!el) return;
  if (_repMap) { _repMap.remove(); _repMap = null; }

  if (window.maplibregl) {
    _createRepMap(el);
  } else {
    _loadMapLibreGL(() => _createRepMap(el));
  }
}

function _loadMapLibreGL(cb) {
  if (!document.getElementById('mlgl-css')) {
    const lnk = document.createElement('link');
    lnk.id = 'mlgl-css'; lnk.rel = 'stylesheet';
    lnk.href = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.css`;
    document.head.appendChild(lnk);
  }
  const s = document.createElement('script');
  s.src = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VER}/dist/maplibre-gl.js`;
  s.onload = cb;
  s.onerror = () => {
    // v223: degradar, no reventar. Se dice qué falló y qué SÍ se puede hacer.
    const m = document.getElementById('rep-map-msg');
    if (m) m.innerHTML = 'No se pudo cargar el mapa.<br>'
      + '<small>Necesita internet la primera vez. Tus paradas y rutas '
      + 'guardadas siguen abajo: puedes consultarlas, navegar y compartirlas '
      + 'sin el mapa.</small>';
    document.getElementById('rep-hoja')?.classList.replace('rep-hoja-recogida', 'rep-hoja-media');
  };
  document.head.appendChild(s);
}

function _createRepMap(container) {
  const msgEl = document.getElementById('rep-map-msg');

  /* v224 · VECTORES EN VEZ DE IMÁGENES.
     Antes el mapa eran mosaicos raster —imágenes ya dibujadas— pasados por
     filtros para que combinaran con el cian:

         raster-brightness-max: 0.52   ← corta el brillo A LA MITAD
         raster-saturation:    -0.55   ← deslava el color
         raster-hue-rotate:     160    ← gira el tono

     Ésa era la causa de que se viera turbio y no se leyeran las calles: los
     filtros aplastaban una imagen que ya venía dibujada, y encima al hacer
     zoom entre niveles la imagen se interpolaba y salía borrosa.

     CARTO publica sus estilos en VECTORES, gratis y sin clave. Con vectores
     las etiquetas se dibujan como texto de verdad —nítido a cualquier zoom y
     en cualquier densidad de pantalla— y los colores vienen ya pensados para
     fondo oscuro, así que no hace falta ningún filtro que los destruya. */
  _repMap = new maplibregl.Map({
    container,
    style:     REP_CAPAS[_repCapa].estilo,
    center:    [-102.5, 23.6],
    zoom:      5,
    pitch:     48,
    bearing:   -15,
    antialias: true,
    maxPitch:  70,
    // el teléfono ya reporta su densidad; forzarla a 1 era lo que hacía
    // que en pantallas retina se viera pixelado
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
  });

  _repMap.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
  _repMap.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');
  _repMap.doubleClickZoom.disable();

  _repMap.on('load', () => {
    if (msgEl) msgEl.style.display = 'none';
    _addRepRouteLayer();
    _addRepSucursalesMarkers();
    _repMap.on('click', _onRepMapClick);
    repGeolocate();
  });

  _repMap.on('move', () => {
    const c = _repMap.getCenter();
    const el = document.getElementById('rep-coords');
    if (el) el.textContent = `${c.lat.toFixed(4)}° ${c.lng.toFixed(4)}°`;
  });
}

/* ── Layers: route + waypoints ───────────────────────── */
function _addRepRouteLayer() {
  if (_repMap.getSource('rep-route')) return;
  _repMap.addSource('rep-route', {
    type: 'geojson', lineMetrics: true,   // hace falta para el degradado
    data: { type: 'FeatureCollection', features: [] }
  });

  /* v224 · La ruta se lee de un vistazo, no se adivina.
     Antes era una línea naranja punteada de 3 px con un halo difuso: sobre
     calles se perdía y no se sabía en qué sentido iba. Ahora:
       · un CONTORNO oscuro debajo para que despegue del mapa
       · la línea con DEGRADADO del inicio (claro) al final (oscuro), que es
         lo que indica el sentido sin necesidad de flechas
       · flechas encima, por si el degradado no basta */

  // contorno: es lo que hace que la línea se vea sobre cualquier fondo
  _repMap.addLayer({
    id: 'rep-casing', type: 'line', source: 'rep-route',
    filter: ['==', '$type', 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: { 'line-color': '#00121c', 'line-width': 11, 'line-opacity': 0.85 }
  });

  _repMap.addLayer({
    id: 'rep-line', type: 'line', source: 'rep-route',
    filter: ['==', '$type', 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-width': 6,
      'line-gradient': ['interpolate', ['linear'], ['line-progress'],
        0,   '#6fe9ff',     // arrancas aquí
        0.5, '#22d3ee',
        1,   '#0b6d86'],    // terminas aquí
    }
  });

  // flechas de sentido, repetidas a lo largo de la línea
  _repMap.addLayer({
    id: 'rep-flechas', type: 'symbol', source: 'rep-route',
    filter: ['==', '$type', 'LineString'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 70,
      'text-field': '▶',
      'text-size': 11,
      'text-keep-upright': false,
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: { 'text-color': '#00121c', 'text-halo-color': '#8ff0ff', 'text-halo-width': 1.2 }
  });

  /* Las paradas van NUMERADAS. Un punto sin número no dice nada cuando
     tienes quince: lo que necesitas saber es el ORDEN. */
  _repMap.addLayer({
    id: 'rep-wp-halo', type: 'circle', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    paint: { 'circle-radius': 19, 'circle-color': '#22d3ee', 'circle-opacity': 0.13 }
  });
  _repMap.addLayer({
    id: 'rep-wp-dot', type: 'circle', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    paint: {
      'circle-radius': 13,
      'circle-color': '#041c26',
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#3fdcf5',
    }
  });
  _repMap.addLayer({
    id: 'rep-wp-num', type: 'symbol', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    layout: {
      'text-field': ['to-string', ['+', ['get', 'i'], 1]],
      'text-size': 13,
      'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#d9f7ff' }
  });
  // el nombre de la parada, debajo del número
  _repMap.addLayer({
    id: 'rep-wp-nom', type: 'symbol', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    layout: {
      'text-field': ['get', 'nombre'],
      'text-size': 11,
      'text-offset': [0, 1.6],
      'text-anchor': 'top',
      'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
      'text-optional': true,          // si no cabe, se omite en vez de amontonarse
    },
    paint: { 'text-color': '#e8fbff', 'text-halo-color': '#001018', 'text-halo-width': 1.6 }
  });
}

let _osrmDebounce = null;

function _syncRepRoute() {
  const src = _repMap?.getSource('rep-route');
  if (!src) return;

  // Draw waypoint dots immediately
  const feats = _repWaypoints.map((wp, i) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: wp },
    // v224: el número de orden y el nombre viajan con el punto, para que el
    // mapa pueda dibujarlos encima sin volver a consultar nada
    properties: { type: 'wp', i, index: i + 1, nombre: _wpNombre(wp) }
  }));

  // Show straight placeholder while waiting for OSRM
  if (_repWaypoints.length >= 2) {
    feats.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: _repWaypoints }, properties: {} });
  }
  src.setData({ type: 'FeatureCollection', features: feats });

  // Debounce OSRM road-snap
  clearTimeout(_osrmDebounce);
  if (_repWaypoints.length >= 2) {
    _osrmDebounce = setTimeout(() => _fetchOSRMRoute(src), 800);
  }
}

async function _fetchOSRMRoute(src) {
  if (_repWaypoints.length < 2) return;
  try {
    const coords = _repWaypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?geometries=geojson&overview=full`;
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return;
    const d = await r.json();
    const geometry = d.routes?.[0]?.geometry;
    if (!geometry) return;

    // Replace straight line with road-snapped route
    const currentSrc = _repMap?.getSource('rep-route');
    if (!currentSrc) return;
    const feats = _repWaypoints.map((wp, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: wp },
      // v224: el número de orden y el nombre viajan con el punto, para que el
    // mapa pueda dibujarlos encima sin volver a consultar nada
    properties: { type: 'wp', i, index: i + 1, nombre: _wpNombre(wp) }
    }));
    feats.push({ type: 'Feature', geometry, properties: {} });
    currentSrc.setData({ type: 'FeatureCollection', features: feats });

    // Update distance in info strip if element exists
    const dist = d.routes[0]?.distance;
    const dur  = d.routes[0]?.duration;
    const wpEl = document.getElementById('rep-wp-count');
    if (wpEl && dist) {
      const km = (dist / 1000).toFixed(1);
      const min = Math.round(dur / 60);
      wpEl.textContent = `${_repWaypoints.length} · ${km}km · ~${min}min`;
    }
  } catch { /* OSRM unavailable — straight-line placeholder remains */ }
}

function _onRepMapClick(e) {
  _repWaypoints.push([e.lngLat.lng, e.lngLat.lat]);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  window.logBitacora?.('reparto', `Punto ${_repWaypoints.length} añadido a ruta`);
}

/* ── Sucursal markers ────────────────────────────────── */
function _addRepSucursalesMarkers() {
  _repSucMarkers.forEach(m => m.remove());
  _repSucMarkers = [];

  const d = getNegocioData();
  (d.sucursales || []).forEach((suc, idx) => {
    if (!suc.lat || !suc.lng) return;
    const el = document.createElement('div');
    el.className = 'rep-suc-marker';
    el.innerHTML = `<div class="rep-suc-pin"></div><div class="rep-suc-tag">${_h(suc.nombre)}</div>`;

    const st     = typeof negTiendaStats === 'function' ? negTiendaStats(suc.id, d) : null;
    const consig = st?.modo === 'consignacion';
    const popup = new maplibregl.Popup({ offset: 28, className: 'rep-popup' }).setHTML(`
      <div class="rep-popup-body">
        <div class="rep-popup-name">${_h(suc.nombre)}</div>
        <div class="rep-popup-coords">${Number(suc.lat).toFixed(5)}, ${Number(suc.lng).toFixed(5)}</div>
        <div class="rep-popup-state">${suc.activa !== false ? '● ACTIVA' : '○ PAUSADA'} · ${consig ? 'CONSIGNACIÓN' : 'CONTADO'}</div>
        ${st ? `
        <div class="rep-popup-stats">
          ${consig ? `<div class="rep-pop-row"><span>EN TIENDA</span><b class="${st.resurtir ? 'rp-warn' : 'rp-ok'}">${st.existencia} ML${st.resurtir ? ' ⚠ RESURTIR' : ''}</b></div>` : ''}
          <div class="rep-pop-row"><span>VENDIDO MES</span><b>$${st.vendidoMes.toLocaleString('es-MX')} · ${st.mlMes} ML</b></div>
          ${consig && st.ultimaEntrega ? `<div class="rep-pop-row"><span>ÚLT. ENTREGA</span><b>${new Date(st.ultimaEntrega.fecha).toLocaleDateString('es-MX', { day:'numeric', month:'short' })} · ${st.ultimaEntrega.cantidadML} ML</b></div>` : ''}
        </div>` : ''}
        ${consig ? `<button class="rep-popup-btn" onclick="repEntregaSuc('${suc.id}')">📦 + REGISTRAR ENTREGA</button>` : ''}
        <button class="rep-popup-btn" onclick="repAddWpSuc(${suc.lat},${suc.lng},'${escAttr(suc.nombre)}')">+ AGREGAR A RUTA</button>
      </div>`);

    const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([suc.lng, suc.lat])
      .setPopup(popup)
      .addTo(_repMap);
    _repSucMarkers.push(marker);
  });
}

/* ── Geolocalización ─────────────────────────────────── */
window.repGeolocate = async function () {
  const msgEl = document.getElementById('rep-map-msg');
  if (!navigator.geolocation) {
    if (msgEl) { msgEl.textContent = '✕ GEOLOCALIZACIÓN NO DISPONIBLE'; msgEl.style.display = 'block'; }
    return;
  }
  if (msgEl) { msgEl.textContent = '⟳ OBTENIENDO UBICACIÓN...'; msgEl.style.display = 'block'; }

  navigator.geolocation.getCurrentPosition(async pos => {
    const { latitude: lat, longitude: lng, accuracy } = pos.coords;
    if (msgEl) msgEl.style.display = 'none';

    if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 13, pitch: 50, bearing: -15, duration: 2000, essential: true });

    if (_repGeoMarker) _repGeoMarker.remove();
    const el = document.createElement('div');
    el.className = 'rep-geo-marker';
    el.innerHTML = '<div class="rep-geo-ring"></div><div class="rep-geo-dot"></div>';
    _repGeoMarker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(_repMap);

    const cEl = document.getElementById('rep-coords');
    if (cEl) cEl.textContent = `${lat.toFixed(4)}° ${lng.toFixed(4)}°`;

    await Promise.all([_fetchRepWeather(lat, lng), _fetchRepRegion(lat, lng)]);
    window.logBitacora?.('reparto', `Geolocalizado: ${lat.toFixed(4)}, ${lng.toFixed(4)} ±${Math.round(accuracy)}m`);
  }, () => {
    if (msgEl) { msgEl.textContent = '✕ ACCESO A UBICACIÓN DENEGADO'; setTimeout(() => { if (msgEl) msgEl.style.display = 'none'; }, 3500); }
  }, { enableHighAccuracy: true, timeout: 12000 });
};

async function _fetchRepWeather(lat, lng) {
  const key = window.AREX_CONFIG?.owmKey;
  const el  = document.getElementById('rep-weather');
  if (!key) { if (el) el.textContent = 'SIN KEY OWM'; return; }
  try {
    const r = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${key}&units=metric&lang=es`);
    const d = await r.json();
    const ICO = { Clear:'☀', Clouds:'☁', Rain:'🌧', Drizzle:'🌦', Thunderstorm:'⛈', Snow:'🌨', Mist:'🌫', Fog:'🌫', Haze:'🌫' };
    const ic = ICO[d.weather?.[0]?.main] || '🌡';
    if (el) el.textContent = `${ic} ${Math.round(d.main?.temp)}°C · ${d.weather?.[0]?.description || ''} · 💨${Math.round(d.wind?.speed)}m/s · 💧${d.main?.humidity}%`;
  } catch { if (el) el.textContent = 'ERROR CLIMA'; }
}

async function _fetchRepRegion(lat, lng) {
  const el = document.getElementById('rep-region');
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=es&zoom=10`);
    const d = await r.json();
    const a = d.address || {};
    const parts = [a.city || a.town || a.village || a.county || '', a.state || '', a.country || ''].filter(Boolean);
    if (el) el.textContent = parts.slice(0, 3).join(', ') || d.display_name?.split(',').slice(0, 2).join(',') || '—';
  } catch { if (el) el.textContent = '—'; }
}

/* ── Sidebar renders ─────────────────────────────────── */
function _renderSucList() {
  const el = document.getElementById('rep-suc-list');
  if (!el) return;
  const suc = getNegocioData().sucursales || [];
  if (!suc.length) { el.innerHTML = '<div class="rep-empty">Sin sucursales en el módulo Negocio</div>'; return; }

  el.innerHTML = suc.map((s, i) => {
    const ok = !!(s.lat && s.lng);
    const st = (s.modo === 'consignacion' && typeof negTiendaStats === 'function') ? negTiendaStats(s.id) : null;
    return `<div class="rep-suc-row">
      <div class="rep-suc-dot ${st?.resurtir ? 'warn' : ok ? 'ok' : 'warn'}"></div>
      <div class="rep-suc-info">
        <div class="rep-suc-name">${_h(s.nombre)}</div>
        <div class="rep-suc-coord">${ok ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : 'Sin coordenadas'}</div>
        ${st ? `<div class="rep-suc-coord" style="${st.resurtir ? 'color:#ff9900' : 'color:#34ffc3'}">${st.existencia} ML en tienda${st.resurtir ? ' · ⚠ RESURTIR' : ''}</div>` : ''}
      </div>
      <div class="rep-suc-acts">${ok
        ? `<button class="rep-icon-btn" title="Ver en mapa" onclick="repFlyToSuc(${s.lat},${s.lng})">◎</button>
           <button class="rep-icon-btn" title="Agregar a ruta" onclick="repAddWpSuc(${s.lat},${s.lng},'${escAttr(s.nombre)}')">+</button>`
        : `<button class="rep-icon-btn rep-icon-set" title="Fijar mi ubicación actual aquí" onclick="repSetSucCoords(${i})">📍</button>`
      }</div>
    </div>`;
  }).join('');
}

function _renderWpList() {
  const el = document.getElementById('rep-wp-list');
  if (!el) return;
  el.innerHTML = _repWaypoints.map((wp, i) => {
    const n = _wpNombre(wp);
    return `
    <div class="rep-wp-row">
      <div class="rep-wp-idx">${i + 1}</div>
      <div class="rep-wp-coords">${n ? _h(n) : `${wp[1].toFixed(4)}° ${wp[0].toFixed(4)}°`}</div>
      <button class="rep-icon-btn" title="Nombrar esta parada" onclick="repNombrarWp(${i})">✎</button>
      <button class="rep-icon-btn rep-icon-del" onclick="repDelWp(${i})">✕</button>
    </div>`; }).join('');
}

function _renderSavedList() {
  const el = document.getElementById('rep-saved-list');
  if (!el) return;
  const rutas = _getSavedRutas();
  if (!rutas.length) { el.innerHTML = '<div class="rep-empty">Sin rutas guardadas</div>'; return; }
  el.innerHTML = rutas.map((r, i) => `
    <div class="rep-saved-row">
      <div class="rep-saved-info">
        <div class="rep-saved-name">${_h(r.nombre)}</div>
        <div class="rep-saved-meta">${r.waypoints.length} puntos · ${new Date(r.ts).toLocaleDateString('es-MX')}</div>
      </div>
      <div class="rep-suc-acts">
        <button class="rep-icon-btn" title="Cargar ruta" onclick="repLoadRuta(${i})">▶</button>
        <button class="rep-icon-btn rep-icon-del" title="Eliminar" onclick="repDelRuta(${i})">✕</button>
      </div>
    </div>`).join('');
}

function _updateWpCount() {
  const el = document.getElementById('rep-wp-count');
  if (el) el.textContent = _repWaypoints.length;
}

/* Guardar rutas + SINCRONIZAR (v205): antes solo vivían en este dispositivo */
function _saveRutas(rutas) { guardar(REPARTO_KEY, rutas); }

function _getSavedRutas() {
  return leer(REPARTO_KEY, []);
}

/* ── Acciones públicas ───────────────────────────────── */
window.repAddWpSuc = function (lat, lng, nombre) {
  if (nombre) _repNombres[_wpClave(lng, lat)] = nombre;
  _repWaypoints.push([lng, lat]);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 14, duration: 900 });
  window.logBitacora?.('reparto', `Sucursal "${nombre}" añadida a ruta`);
};

/* v222 · Ponerle nombre a una parada marcada en el mapa. Sin esto, un punto
   añadido tocando el mapa se queda como coordenadas para siempre. */
window.repNombrarWp = function (i) {
  const wp = _repWaypoints[i];
  if (!wp) return;
  repDialogo({
    titulo: `Nombre de la parada ${i + 1}`,
    valor: _wpNombre(wp),
    placeholder: 'Tienda de doña Mari, bodega, cliente…',
    okLabel: 'GUARDAR',
    onOk: n => {
      const k = _wpClave(wp[0], wp[1]);
      if (n && n.trim()) _repNombres[k] = n.trim(); else delete _repNombres[k];
      _renderWpList();
    },
  });
};

window.repDelWp = function (i) {
  _repWaypoints.splice(i, 1);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
};

window.repClearRoute = function () {
  _repWaypoints = [];
  _repNombres = {};
  clearTimeout(_osrmDebounce);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
};

window.repFlyToSuc = function (lat, lng) {
  if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 16, pitch: 55, duration: 1200 });
};

/* ── Diálogo integrado (v205) ─────────────────────────
   prompt()/alert()/confirm() están ROTOS en PWAs instaladas de iOS:
   congelan el hilo y suelen devolver vacío. En la calle eso significaba
   no poder registrar una entrega. Nada de diálogos del navegador aquí. */
function repDialogo({ titulo, valor = '', tipo = 'text', placeholder = '', onOk, okLabel = 'ACEPTAR', html = '' }) {
  document.getElementById('rep-dlg')?.remove();
  const d = document.createElement('div');
  d.id = 'rep-dlg';
  d.innerHTML = `
    <div class="rep-dlg-card">
      <div class="rep-dlg-title">${titulo}</div>
      ${html || ''}
      ${onOk ? `<input class="rep-dlg-inp" id="rep-dlg-inp" type="${tipo}" value="${valor}" placeholder="${placeholder}" inputmode="${tipo === 'number' ? 'numeric' : 'text'}" autocomplete="off">` : ''}
      <div class="rep-dlg-btns">
        <button class="rep-dlg-btn rep-dlg-cancel" id="rep-dlg-no">${onOk ? 'CANCELAR' : 'CERRAR'}</button>
        ${onOk ? `<button class="rep-dlg-btn rep-dlg-ok" id="rep-dlg-si">${okLabel}</button>` : ''}
      </div>
    </div>`;
  document.getElementById('module-reparto')?.appendChild(d) || document.body.appendChild(d);
  const cerrar = () => d.remove();
  d.querySelector('#rep-dlg-no').onclick = cerrar;
  const inp = d.querySelector('#rep-dlg-inp');
  if (onOk) {
    const ok = () => { const v = inp?.value?.trim(); cerrar(); onOk(v); };
    d.querySelector('#rep-dlg-si').onclick = ok;
    if (inp) { inp.addEventListener('keydown', e => { if (e.key === 'Enter') ok(); }); setTimeout(() => inp.focus(), 60); }
  }
}
function repAviso(msg) { repDialogo({ titulo: msg }); }

// Registrar entrega de consignación directo desde el popup del mapa
window.repEntregaSuc = function (sucId) {
  const suc = (getNegocioData().sucursales || []).find(s => s.id === sucId);
  repDialogo({
    titulo: `Entrega en ${suc?.nombre || 'la tienda'}<br><small>¿Cuántos medio litros dejaste?</small>`,
    tipo: 'number', placeholder: 'ej. 20', okLabel: 'REGISTRAR',
    onOk: c => {
      if (!c) return;
      if (typeof negRegistrarEntrega === 'function' && negRegistrarEntrega(sucId, c)) {
        _addRepSucursalesMarkers();   // refresca popups con la nueva existencia
        _renderSucList();
        window.logBitacora?.('reparto', `Entrega registrada desde el mapa: ${c} ML → ${suc?.nombre || sucId}`);
      }
    },
  });
};

window.repSaveRoute = function () {
  if (!_repWaypoints.length) { repAviso('Agrega puntos a la ruta antes de guardar.'); return; }
  repDialogo({
    titulo: 'Nombre de la ruta', valor: `Ruta ${new Date().toLocaleDateString('es-MX')}`,
    okLabel: 'GUARDAR',
    onOk: nombre => {
      if (!nombre) return;
      const rutas = _getSavedRutas();
      // v222: los nombres viajan con la ruta; si no, al recargarla se
      // volvían coordenadas otra vez.
      const nombres = {};
      _repWaypoints.forEach(wp => { const k = _wpClave(wp[0], wp[1]);
        if (_repNombres[k]) nombres[k] = _repNombres[k]; });
      rutas.unshift({ nombre, waypoints: [..._repWaypoints], nombres, ts: Date.now() });
      _saveRutas(rutas);
      _renderSavedList();
      window.logBitacora?.('reparto', `Ruta guardada: "${nombre}"`);
    },
  });
};

window.repLoadRuta = function (i) {
  const r = _getSavedRutas()[i];
  if (!r) return;
  _repWaypoints = [...r.waypoints];
  Object.assign(_repNombres, r.nombres || {});   // v222: recuperar los nombres
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  if (_repMap && _repWaypoints.length) {
    try {
      const bounds = _repWaypoints.reduce(
        (b, wp) => { b.extend(wp); return b; },
        new maplibregl.LngLatBounds(_repWaypoints[0], _repWaypoints[0])
      );
      _repMap.fitBounds(bounds, { padding: 60, pitch: 45, duration: 1400 });
    } catch (_) {}
  }
};

window.repDelRuta = function (i) {
  const r = _getSavedRutas()[i];
  repDialogo({
    titulo: `¿Eliminar la ruta "${(r?.nombre || '').slice(0, 30)}"?`,
    okLabel: 'ELIMINAR', valor: '', tipo: 'hidden',
    onOk: () => {
      const rutas = _getSavedRutas();
      rutas.splice(i, 1);
      _saveRutas(rutas);
      _renderSavedList();
      window.logBitacora?.('reparto', `Ruta eliminada: "${r?.nombre || i}"`);
    },
  });
};

/* ── Optimizar el ORDEN de las paradas (v205) ─────────
   OSRM /route/ respeta el orden en que tocaste el mapa. /trip/ resuelve el
   problema del viajante: mismo conjunto de paradas, orden más corto.
   source=first mantiene tu punto de partida; roundtrip=false no te obliga
   a regresar al inicio. */
window.repOptimizarRuta = async function () {
  if (_repWaypoints.length < 3) {
    repAviso('Necesitas al menos 3 paradas para optimizar el orden.');
    return;
  }
  const el = document.getElementById('rep-wp-count');
  const prev = el?.textContent;
  if (el) el.textContent = 'optimizando…';
  try {
    const coords = _repWaypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
    const url = `https://router.project-osrm.org/trip/v1/driving/${coords}`
              + '?source=first&roundtrip=false&geometries=geojson&overview=full';
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw new Error('OSRM ' + r.status);
    const d = await r.json();
    const wps = d.waypoints;
    if (!wps?.length || !d.trips?.[0]) throw new Error('sin solución');

    // waypoint_index = posición en la ruta óptima
    const ordenados = new Array(wps.length);
    wps.forEach((w, i) => { ordenados[w.waypoint_index] = _repWaypoints[i]; });
    const antesKm = await _distanciaRuta(_repWaypoints);
    _repWaypoints = ordenados.filter(Boolean);
    _syncRepRoute();
    _renderWpList();
    const km = (d.trips[0].distance / 1000).toFixed(1);
    const min = Math.round(d.trips[0].duration / 60);
    if (el) el.textContent = `${_repWaypoints.length} · ${km}km · ~${min}min`;
    const ahorro = antesKm ? (antesKm - d.trips[0].distance / 1000) : 0;
    repAviso(ahorro > 0.3
      ? `Ruta optimizada ⚡<br><small>${km} km · ~${min} min — te ahorra ${ahorro.toFixed(1)} km contra el orden anterior.</small>`
      : `Ruta optimizada ⚡<br><small>${km} km · ~${min} min. Tu orden ya era prácticamente el mejor.</small>`);
    window.logBitacora?.('reparto', `Ruta optimizada: ${_repWaypoints.length} paradas, ${km} km`);
  } catch (e) {
    if (el && prev) el.textContent = prev;
    repAviso('No pude optimizar la ruta ahora.<br><small>El servicio de rutas no respondió. Intenta de nuevo.</small>');
  }
};

/* Distancia de la ruta en el orden actual (para comparar el ahorro) */
async function _distanciaRuta(wps) {
  try {
    const coords = wps.map(w => `${w[0]},${w[1]}`).join(';');
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=false`,
                          { signal: AbortSignal.timeout(8000) });
    if (!r.ok) return 0;
    const d = await r.json();
    return (d.routes?.[0]?.distance || 0) / 1000;
  } catch { return 0; }
}

/* soloResurtir=true → arma la ruta SOLO con las tiendas que ya necesitan
   producto (cruce con negocio: existencia bajo umbral) */
window.repRouteSucursales = function (soloResurtir = false) {
  const data = getNegocioData();
  let withCoords = (data.sucursales || []).filter(s => s.lat && s.lng && s.activa !== false);
  if (soloResurtir && typeof negTiendaStats === 'function') {
    const necesitan = withCoords.filter(s => {
      try { const st = negTiendaStats(s.id, data); return st?.resurtir || st?.existencia <= 0; }
      catch { return false; }
    });
    if (!necesitan.length) {
      repAviso('Ninguna tienda necesita resurtido ahora mismo. ✓');
      return;
    }
    withCoords = necesitan;
  }
  if (!withCoords.length) {
    repAviso('Ninguna sucursal activa tiene coordenadas.<br><small>Usa el botón 📍 junto a cada sucursal para fijar su ubicación.</small>');
    return;
  }
  _repWaypoints = withCoords.map(s => [s.lng, s.lat]);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  if (_repMap) {
    const bounds = _repWaypoints.reduce(
      (b, wp) => { b.extend(wp); return b; },
      new maplibregl.LngLatBounds(_repWaypoints[0], _repWaypoints[0])
    );
    _repMap.fitBounds(bounds, { padding: 80, pitch: 45, duration: 1600 });
  }
  window.logBitacora?.('reparto', `Ruta de ${withCoords.length} sucursales creada${soloResurtir ? ' (solo resurtido)' : ''}`);
  if (soloResurtir) repAviso(`Ruta de resurtido: ${withCoords.length} tienda${withCoords.length>1?'s':''} que ya necesitan producto.`);
};

// Fijar coordenadas de una sucursal con la ubicación actual del dispositivo
window.repSetSucCoords = function (sucIdx) {
  if (!navigator.geolocation) { repAviso('Geolocalización no disponible.'); return; }
  navigator.geolocation.getCurrentPosition(pos => {
    const { latitude: lat, longitude: lng } = pos.coords;
    const data = getNegocioData();
    if (!data.sucursales[sucIdx]) return;
    data.sucursales[sucIdx].lat = lat;
    data.sucursales[sucIdx].lng = lng;
    saveNegocioData(data);
    _renderSucList();
    _addRepSucursalesMarkers();
    if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 15, pitch: 50, duration: 1000 });
    window.logBitacora?.('reparto', `Coords fijadas para "${data.sucursales[sucIdx].nombre}"`);
  }, () => repAviso('No se pudo obtener la ubicación.'), { enableHighAccuracy: true, timeout: 8000 });
};

/* ── Navegar de verdad (v205) ─────────────────────────
   Abre la ruta en la app de mapas del teléfono para manejar con
   indicaciones por voz. Google Maps acepta múltiples paradas; Waze solo
   un destino, así que ahí mandamos la SIGUIENTE parada. */
/* ── Pasar la ruta al navegador del teléfono ─────────────────────────────
   AREX arma y optimiza la ruta, pero no da indicaciones giro a giro: eso lo
   hace bien Google Maps y no tiene sentido reimplementarlo. Aquí se entrega.

   v222 · EL LÍMITE DE 11 PARADAS, RESUELTO.
   La URL de direcciones de Google acepta origen + destino + 9 puntos
   intermedios: once paradas como mucho. Antes, con doce o más, las
   sobrantes SE DESCARTABAN — solo salía un aviso. Con tres sucursales daba
   igual; con quince clientes significaba salir a repartir con media ruta.
   Ahora se parte en TRAMOS de once, encadenados: el último punto de un
   tramo es el primero del siguiente, así no queda hueco entre ellos. */

const REP_MAX_GMAPS = 11;          // origen + 9 intermedios + destino

function _repTramos(wps) {
  if (wps.length <= REP_MAX_GMAPS) return [wps];
  const out = [];
  let i = 0;
  while (i < wps.length - 1) {
    const fin = Math.min(i + REP_MAX_GMAPS, wps.length);
    out.push(wps.slice(i, fin));
    i = fin - 1;                   // encadenar: el final es el inicio del siguiente
  }
  return out;
}

function _repUrlGoogle(tramo) {
  const fmt = w => `${w[1]},${w[0]}`;
  const medios = tramo.slice(1, -1).map(fmt).join('|');
  let url = 'https://www.google.com/maps/dir/?api=1'
          + `&origin=${fmt(tramo[0])}`
          + `&destination=${fmt(tramo[tramo.length - 1])}`
          + '&travelmode=driving';
  if (medios) url += `&waypoints=${medios}`;
  return url;
}

window.repNavegar = function (app = 'google') {
  if (!_repWaypoints.length) { repAviso('Arma una ruta primero.'); return; }
  const wps = _repWaypoints;

  if (app === 'waze') {
    // Waze solo navega a UN destino: se manda la siguiente parada.
    const idx = wps.length > 1 ? 1 : 0;
    const [lng, lat] = wps[idx];
    const n = _wpNombre(wps[idx]);
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
    window.logBitacora?.('reparto', `Waze: siguiente parada${n ? ' — ' + n : ''}`);
    return;
  }

  const tramos = _repTramos(wps);
  if (tramos.length === 1) {
    window.open(_repUrlGoogle(tramos[0]), '_blank');
    window.logBitacora?.('reparto', `Google Maps: ${wps.length} paradas`);
    return;
  }

  // Más de 11 paradas: se ofrecen los tramos, en orden.
  const filas = tramos.map((t, i) => {
    const a = _wpNombre(t[0]) || `parada ${wps.indexOf(t[0]) + 1}`;
    const z = _wpNombre(t[t.length - 1]) || `parada ${wps.indexOf(t[t.length - 1]) + 1}`;
    return `<button class="rep-btn rep-btn-nav" style="width:100%;margin-bottom:6px"
              onclick="window.open('${_repUrlGoogle(t)}','_blank')">
              ▶ TRAMO ${i + 1} · ${t.length} paradas · ${_h(a)} → ${_h(z)}
            </button>`;
  }).join('');
  repDialogo({
    titulo: `${wps.length} paradas — Google Maps admite 11 por ruta`,
    html: `<p style="font-size:12px;line-height:1.5;margin-bottom:10px">
             Se partió en ${tramos.length} tramos encadenados: el final de cada uno
             es el arranque del siguiente, así no queda ningún hueco.
           </p>${filas}`,
    okLabel: 'CERRAR',
  });
  window.logBitacora?.('reparto', `Google Maps: ${wps.length} paradas en ${tramos.length} tramos`);
};

/* v222 · Compartir la ruta. Cuando tengas quien reparta por ti, esto le
   manda el enlace por WhatsApp o donde sea, sin instalar nada. */
window.repCompartir = async function () {
  if (!_repWaypoints.length) { repAviso('Arma una ruta primero.'); return; }
  const tramos = _repTramos(_repWaypoints);
  const texto = _repWaypoints.map((wp, i) =>
    `${i + 1}. ${_wpNombre(wp) || `${wp[1].toFixed(5)}, ${wp[0].toFixed(5)}`}`).join('\n');
  const cuerpo = `Ruta de reparto — ${_repWaypoints.length} paradas\n\n${texto}\n\n`
               + tramos.map((t, i) => `${tramos.length > 1 ? `Tramo ${i+1}: ` : ''}${_repUrlGoogle(t)}`).join('\n');
  try {
    if (navigator.share) { await navigator.share({ title: 'Ruta de reparto', text: cuerpo }); }
    else { await navigator.clipboard.writeText(cuerpo); repAviso('Ruta copiada al portapapeles.'); }
    window.logBitacora?.('reparto', `Ruta compartida (${_repWaypoints.length} paradas)`);
  } catch (e) {
    if (e?.name !== 'AbortError') repAviso('No se pudo compartir: ' + (e?.message || e));
  }
};

/* ── v223 · BUSCAR UNA DIRECCIÓN ─────────────────────────────────────────
   Hasta ahora solo se podían añadir paradas tocando el mapa o eligiendo una
   sucursal. Para repartir a clientes hace falta escribir la dirección.
   Nominatim (OpenStreetMap) lo hace gratis y sin clave; a cambio pide no
   pasar de una petición por segundo, así que se espera a que dejes de
   escribir en vez de buscar en cada tecla. */
let _repBuscaT = null;

window.repBuscarLugar = async function () {
  const inp = document.getElementById('rep-buscar-inp');
  const cont = document.getElementById('rep-buscar-res');
  const q = inp?.value.trim();
  if (!q || !cont) return;
  cont.innerHTML = '<div class="rep-busca-cargando">buscando…</div>';
  cont.classList.add('abierto');
  try {
    const c = _repMap?.getCenter();
    // viewbox: se prioriza lo que hay cerca del mapa, no un resultado en otro país
    const cerca = c ? `&viewbox=${c.lng-1},${c.lat+1},${c.lng+1},${c.lat-1}` : '';
    const r = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=6&accept-language=es`
      + `&countrycodes=mx&q=${encodeURIComponent(q)}${cerca}`,
      { signal: AbortSignal.timeout(9000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const d = await r.json();
    if (!d.length) { cont.innerHTML = '<div class="rep-busca-cargando">sin resultados</div>'; return; }
    cont.innerHTML = d.map(x => {
      const nom = (x.display_name || '').split(',').slice(0, 2).join(',');
      const resto = (x.display_name || '').split(',').slice(2, 4).join(',');
      return `<button class="rep-busca-item"
        onclick="repAgregarBusqueda(${x.lat},${x.lon},'${_h(nom).replace(/'/g, "\\'")}')">
        <span class="rep-busca-n">${_h(nom)}</span>
        <span class="rep-busca-d">${_h(resto)}</span>
      </button>`;
    }).join('');
  } catch (e) {
    cont.innerHTML = `<div class="rep-busca-cargando">no se pudo buscar (${e.message})</div>`;
  }
};

window.repAgregarBusqueda = function (lat, lng, nombre) {
  window.repAddWpSuc(+lat, +lng, nombre);
  const cont = document.getElementById('rep-buscar-res');
  const inp = document.getElementById('rep-buscar-inp');
  if (cont) { cont.innerHTML = ''; cont.classList.remove('abierto'); }
  if (inp) inp.value = '';
  window.logBitacora?.('reparto', `Parada añadida por búsqueda: ${nombre}`);
};

/* ── v223 · CAPAS DEL MAPA ───────────────────────────────────────────────
   Tres vistas, todas de mosaicos gratuitos y sin clave. El satélite de ESRI
   sirve para reconocer una bodega o un portón que en el mapa plano no se ve. */
/* Tres vistas. Las dos primeras son VECTORIALES (nítidas a cualquier zoom,
   etiquetas como texto real); la de satélite no puede serlo porque no existe
   imagen aérea en vectores — ahí sí son fotos. Todas gratuitas y sin clave. */
const REP_CAPAS = [
  { id: 'oscuro', nombre: 'OSCURO',
    estilo: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' },
  { id: 'calles', nombre: 'CALLES',
    estilo: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json' },
  { id: 'satelite', nombre: 'SATÉLITE',
    // Sin filtros: el satélite se lee por sus formas, y bajarle el brillo
    // era justo lo que impedía reconocer un portón o una bodega.
    estilo: { version: 8, sources: { sat: { type: 'raster', tileSize: 256, maxzoom: 19,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        attribution: '© Esri, Maxar, Earthstar Geographics' } },
      layers: [{ id: 'sat', type: 'raster', source: 'sat' }] } },
];

let _repCapa = 0;

window.repCapaMapa = function () {
  if (!_repMap) return;
  _repCapa = (_repCapa + 1) % REP_CAPAS.length;
  const c = REP_CAPAS[_repCapa];
  // setStyle reemplaza el estilo entero, así que las capas propias (ruta,
  // marcadores, tráfico) hay que volver a ponerlas cuando termine de cargar.
  _repMap.once('styledata', () => {
    try {
      _addRepRouteLayer();
      _syncRepRoute();
      _addRepSucursalesMarkers();
      _repTraficoAplicar();
    } catch (e) { console.warn('[reparto] recomponer capas:', e); }
  });
  _repMap.setStyle(c.estilo);
  const b = document.getElementById('rep-fab-capa');
  if (b) { b.title = `Mapa: ${c.nombre}`;
           b.classList.add('rep-fab-on'); setTimeout(() => b.classList.remove('rep-fab-on'), 800); }
  window.logBitacora?.('reparto', `Mapa: ${c.nombre}`);
};

/* ── v224 · TRÁFICO EN TIEMPO REAL ───────────────────────────────────────
   No existe ninguna fuente de tráfico gratuita y sin clave: ni Google, ni
   Apple, ni OpenStreetMap publican el flujo de tráfico abierto. Es dato
   comercial, se recoge de millones de teléfonos y nadie lo regala.

   Lo más barato que hay es TomTom: 2.500 peticiones al día gratis con una
   cuenta. Si algún día pones esa clave en /config como `tomtomKey`, el botón
   de tráfico aparece solo y se enciende. Sin clave, ni se muestra — mejor no
   tener el botón que tenerlo y que no haga nada.

   Los colores del flujo los pone TomTom (verde fluido → rojo detenido) y no
   se tocan: son el estándar que ya sabes leer de Google Maps. */
function _repTraficoDisponible() {
  return !!(window.AREX_CONFIG?.tomtomKey);
}

let _repTrafico = false;

function _repTraficoAplicar() {
  if (!_repMap || !_repTraficoDisponible()) return;
  const key = window.AREX_CONFIG.tomtomKey;
  try {
    if (_repMap.getLayer('trafico')) _repMap.removeLayer('trafico');
    if (_repMap.getSource('trafico')) _repMap.removeSource('trafico');
    if (!_repTrafico) return;
    _repMap.addSource('trafico', {
      type: 'raster', tileSize: 256, maxzoom: 22,
      tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=${key}`],
      attribution: '© TomTom',
    });
    // debajo de las etiquetas para que los nombres de calle sigan leyéndose
    const capas = _repMap.getStyle().layers || [];
    const etiqueta = capas.find(l => l.type === 'symbol')?.id;
    _repMap.addLayer({ id: 'trafico', type: 'raster', source: 'trafico',
                       paint: { 'raster-opacity': 0.75 } }, etiqueta);
  } catch (e) { console.warn('[reparto] tráfico:', e); }
}

window.repTrafico = function () {
  if (!_repTraficoDisponible()) {
    repAviso('El tráfico en tiempo real necesita una clave de TomTom.<br>'
           + '<small>Son 2.500 consultas al día gratis. Créala en developer.tomtom.com '
           + 'y añádela en /config como <b>tomtomKey</b>: el botón se enciende solo.</small>');
    return;
  }
  _repTrafico = !_repTrafico;
  _repTraficoAplicar();
  document.getElementById('rep-fab-trafico')?.classList.toggle('rep-fab-on', _repTrafico);
  window.logBitacora?.('reparto', `Tráfico ${_repTrafico ? 'encendido' : 'apagado'}`);
};

/* ── v223 · HOJA DESLIZABLE ──────────────────────────────────────────────
   Tres alturas, como en cualquier app de mapas: solo la barra de acciones,
   media pantalla, o completa. Empieza recogida para que el mapa se vea. */
window.repHoja = function (estado) {
  const h = document.getElementById('rep-hoja');
  if (!h) return;
  const orden = ['recogida', 'media', 'completa'];
  const actual = orden.findIndex(x => h.classList.contains('rep-hoja-' + x));
  const sig = estado || orden[(actual + 1) % orden.length];
  orden.forEach(x => h.classList.remove('rep-hoja-' + x));
  h.classList.add('rep-hoja-' + sig);
  setTimeout(() => _repMap?.resize(), 320);
};

window.renderRepartoModule = renderRepartoModule;
