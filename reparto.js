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
let _repSucMarkers = [];

/* ── Render principal ────────────────────────────────── */
function renderRepartoModule() {
  const wrap = document.getElementById('rep-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="rep-header">
      <div class="rep-title-bar">
        <span class="rep-title">▸ RUTAS DE REPARTO</span>
        <div class="rep-btns">
          <button class="rep-btn" onclick="repGeolocate()">◎ MI UBICACIÓN</button>
          <button class="rep-btn" onclick="repRouteSucursales()">⊕ RUTA COMPLETA</button>
          <button class="rep-btn" onclick="repSaveRoute()">⊡ GUARDAR</button>
          <button class="rep-btn rep-btn-del" onclick="repClearRoute()">✕ LIMPIAR</button>
        </div>
      </div>
      <div class="rep-info-strip">
        <div class="rep-info-chip"><span class="rep-ic-lbl">CLIMA</span><span class="rep-ic-val" id="rep-weather">—</span></div>
        <div class="rep-info-chip"><span class="rep-ic-lbl">REGIÓN</span><span class="rep-ic-val" id="rep-region">—</span></div>
        <div class="rep-info-chip"><span class="rep-ic-lbl">COORDS</span><span class="rep-ic-val" id="rep-coords">—</span></div>
        <div class="rep-info-chip"><span class="rep-ic-lbl">PUNTOS RUTA</span><span class="rep-ic-val" id="rep-wp-count">0</span></div>
      </div>
    </div>

    <div class="rep-body">
      <div class="rep-map-wrap">
        <div id="rep-map-el" class="rep-map-el"></div>
        <div class="rep-hud-tl"></div><div class="rep-hud-tr"></div>
        <div class="rep-hud-bl"></div><div class="rep-hud-br"></div>
        <div class="rep-map-msg" id="rep-map-msg">⟳ CARGANDO SISTEMA DE MAPAS...</div>
      </div>
      <div class="rep-sidebar">
        <div class="rep-sb-section">
          <div class="rep-sb-hdr">◈ SUCURSALES</div>
          <div id="rep-suc-list" class="rep-list"></div>
        </div>
        <div class="rep-sb-section">
          <div class="rep-sb-hdr">◈ RUTA ACTIVA</div>
          <div class="rep-list-hint">Toca el mapa para añadir puntos de entrega</div>
          <div id="rep-wp-list" class="rep-list"></div>
        </div>
        <div class="rep-sb-section">
          <div class="rep-sb-hdr">◈ RUTAS GUARDADAS</div>
          <div id="rep-saved-list" class="rep-list"></div>
        </div>
      </div>
    </div>`;

  _renderSucList();
  _renderSavedList();
  setTimeout(_initRepMap, 80);
  logBitacora?.('reparto', 'Módulo Rutas abierto');
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
    const m = document.getElementById('rep-map-msg');
    if (m) m.textContent = '✕ ERROR AL CARGAR MAPA — VERIFICA TU CONEXIÓN';
  };
  document.head.appendChild(s);
}

function _createRepMap(container) {
  const msgEl = document.getElementById('rep-map-msg');

  _repMap = new maplibregl.Map({
    container,
    style: {
      version: 8,
      sources: {
        base: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com">CARTO</a>',
          maxzoom: 19,
        }
      },
      layers: [{
        id: 'base', type: 'raster', source: 'base',
        paint: {
          'raster-opacity': 0.90,
          'raster-hue-rotate': 160,
          'raster-saturation': -0.55,
          'raster-brightness-max': 0.52,
          'raster-contrast': 0.15,
        }
      }]
    },
    center:    [-102.5, 23.6],
    zoom:      5,
    pitch:     48,
    bearing:   -15,
    antialias: true,
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
  _repMap.addSource('rep-route', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Glow line
  _repMap.addLayer({
    id: 'rep-glow', type: 'line', source: 'rep-route',
    filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#ff6a00', 'line-width': 12, 'line-opacity': 0.18, 'line-blur': 6 }
  });
  // Main route line
  _repMap.addLayer({
    id: 'rep-line', type: 'line', source: 'rep-route',
    filter: ['==', '$type', 'LineString'],
    paint: { 'line-color': '#ff8c00', 'line-width': 3, 'line-opacity': 0.92, 'line-dasharray': [4, 2] }
  });
  // Waypoint halos
  _repMap.addLayer({
    id: 'rep-wp-halo', type: 'circle', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    paint: { 'circle-radius': 16, 'circle-color': '#f5a623', 'circle-opacity': 0.14 }
  });
  // Waypoint dots
  _repMap.addLayer({
    id: 'rep-wp-dot', type: 'circle', source: 'rep-route',
    filter: ['all', ['==', '$type', 'Point'], ['==', ['get', 'type'], 'wp']],
    paint: { 'circle-radius': 7, 'circle-color': '#f5a623', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff8', 'circle-opacity': 0.96 }
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
    properties: { type: 'wp', index: i + 1 }
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
      properties: { type: 'wp', index: i + 1 }
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
  logBitacora?.('reparto', `Punto ${_repWaypoints.length} añadido a ruta`);
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
    el.innerHTML = `<div class="rep-suc-pin"></div><div class="rep-suc-tag">${escHTML(suc.nombre)}</div>`;

    const popup = new maplibregl.Popup({ offset: 28, className: 'rep-popup' }).setHTML(`
      <div class="rep-popup-body">
        <div class="rep-popup-name">${escHTML(suc.nombre)}</div>
        <div class="rep-popup-coords">${Number(suc.lat).toFixed(5)}, ${Number(suc.lng).toFixed(5)}</div>
        <div class="rep-popup-state">${suc.activa !== false ? '● ACTIVA' : '○ PAUSADA'}</div>
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
    logBitacora?.('reparto', `Geolocalizado: ${lat.toFixed(4)}, ${lng.toFixed(4)} ±${Math.round(accuracy)}m`);
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
    return `<div class="rep-suc-row">
      <div class="rep-suc-dot ${ok ? 'ok' : 'warn'}"></div>
      <div class="rep-suc-info">
        <div class="rep-suc-name">${escHTML(s.nombre)}</div>
        <div class="rep-suc-coord">${ok ? `${Number(s.lat).toFixed(4)}, ${Number(s.lng).toFixed(4)}` : 'Sin coordenadas'}</div>
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
  el.innerHTML = _repWaypoints.map((wp, i) => `
    <div class="rep-wp-row">
      <div class="rep-wp-idx">${i + 1}</div>
      <div class="rep-wp-coords">${wp[1].toFixed(4)}° ${wp[0].toFixed(4)}°</div>
      <button class="rep-icon-btn rep-icon-del" onclick="repDelWp(${i})">✕</button>
    </div>`).join('');
}

function _renderSavedList() {
  const el = document.getElementById('rep-saved-list');
  if (!el) return;
  const rutas = _getSavedRutas();
  if (!rutas.length) { el.innerHTML = '<div class="rep-empty">Sin rutas guardadas</div>'; return; }
  el.innerHTML = rutas.map((r, i) => `
    <div class="rep-saved-row">
      <div class="rep-saved-info">
        <div class="rep-saved-name">${escHTML(r.nombre)}</div>
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

function _getSavedRutas() {
  try { return JSON.parse(localStorage.getItem(REPARTO_KEY) || '[]'); } catch { return []; }
}

/* ── Acciones públicas ───────────────────────────────── */
window.repAddWpSuc = function (lat, lng, nombre) {
  _repWaypoints.push([lng, lat]);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 14, duration: 900 });
  logBitacora?.('reparto', `Sucursal "${nombre}" añadida a ruta`);
};

window.repDelWp = function (i) {
  _repWaypoints.splice(i, 1);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
};

window.repClearRoute = function () {
  _repWaypoints = [];
  clearTimeout(_osrmDebounce);
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
};

window.repFlyToSuc = function (lat, lng) {
  if (_repMap) _repMap.flyTo({ center: [lng, lat], zoom: 16, pitch: 55, duration: 1200 });
};

window.repSaveRoute = function () {
  if (!_repWaypoints.length) { alert('Agrega puntos a la ruta antes de guardar.'); return; }
  const nombre = prompt('Nombre de la ruta:', `Ruta ${new Date().toLocaleDateString('es-MX')}`);
  if (!nombre?.trim()) return;
  const rutas = _getSavedRutas();
  rutas.unshift({ nombre: nombre.trim(), waypoints: [..._repWaypoints], ts: Date.now() });
  localStorage.setItem(REPARTO_KEY, JSON.stringify(rutas));
  _renderSavedList();
  logBitacora?.('reparto', `Ruta guardada: "${nombre.trim()}"`);
};

window.repLoadRuta = function (i) {
  const r = _getSavedRutas()[i];
  if (!r) return;
  _repWaypoints = [...r.waypoints];
  _syncRepRoute();
  _renderWpList();
  _updateWpCount();
  if (_repMap && _repWaypoints.length) {
    const bounds = _repWaypoints.reduce(
      (b, wp) => { b.extend(wp); return b; },
      new maplibregl.LngLatBounds(_repWaypoints[0], _repWaypoints[0])
    );
    _repMap.fitBounds(bounds, { padding: 60, pitch: 45, duration: 1400 });
  }
};

window.repDelRuta = function (i) {
  if (!confirm('¿Eliminar esta ruta guardada?')) return;
  const rutas = _getSavedRutas();
  rutas.splice(i, 1);
  localStorage.setItem(REPARTO_KEY, JSON.stringify(rutas));
  _renderSavedList();
};

window.repRouteSucursales = function () {
  const withCoords = (getNegocioData().sucursales || []).filter(s => s.lat && s.lng && s.activa !== false);
  if (!withCoords.length) {
    alert('Ninguna sucursal activa tiene coordenadas.\nUsa el botón 📍 junto a cada sucursal para fijar su ubicación.');
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
  logBitacora?.('reparto', `Ruta de ${withCoords.length} sucursales creada`);
};

// Fijar coordenadas de una sucursal con la ubicación actual del dispositivo
window.repSetSucCoords = function (sucIdx) {
  if (!navigator.geolocation) { alert('Geolocalización no disponible.'); return; }
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
    logBitacora?.('reparto', `Coords fijadas para "${data.sucursales[sucIdx].nombre}"`);
  }, () => alert('No se pudo obtener la ubicación.'), { enableHighAccuracy: true, timeout: 8000 });
};

window.renderRepartoModule = renderRepartoModule;
