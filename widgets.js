/* ═══════════════════════════════════════════════════════════════
   AREX · WIDGETS  (v219)

   Extraído de app.js, que tenía 5.585 líneas y doce responsabilidades
   mezcladas. Este bloque salió entero porque NO depende de nada del
   ámbito de app.js: se midió antes de cortar, cero identificadores
   compartidos. Lo único que app.js necesita de aquí es
   renderWeatherWidget, que ya viajaba por window.

   Contiene: el widget del clima con su caché, el globo terráqueo
   animado, las insignias de urgencia, el pomodoro y el tipo de cambio
   MXN/USD.

   Nota sobre el globo: son ~370 de estas líneas y solo aparece si
   configuras una clave de OpenWeatherMap. Si nunca la vas a poner, este
   archivo entero se puede pasar a carga diferida — o borrar el globo.
   ═══════════════════════════════════════════════════════════════ */

// ── CLIMA ─────────────────────────────────────────────────────────────────
const WEATHER_CACHE_KEY = 'arex_weather_cache';
const WEATHER_TTL       = 30 * 60 * 1000;

function _windDir(deg) {
  if (deg == null) return '';
  const dirs = ['N','NE','E','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function _weatherIcon(id) {
  if (id >= 200 && id < 300) return '⛈';
  if (id >= 300 && id < 400) return '🌦';
  if (id >= 500 && id < 511) return '🌧';
  if (id === 511)             return '🌨';
  if (id >= 512 && id < 600) return '🌧';
  if (id >= 600 && id < 700) return '❄';
  if (id >= 700 && id < 800) return '🌫';
  if (id === 800)             return '☀';
  if (id === 801)             return '🌤';
  if (id === 802)             return '⛅';
  return '☁';
}

function _condLabel(id) {
  if (id >= 200 && id < 300) return 'TORMENTA ELÉCTRICA';
  if (id >= 300 && id < 400) return 'LLOVIZNA';
  if (id >= 500 && id < 511) return 'LLUVIA';
  if (id === 511)             return 'LLUVIA HELADA';
  if (id >= 512 && id < 600) return 'LLUVIA INTENSA';
  if (id >= 600 && id < 611) return 'NIEVE';
  if (id >= 611 && id < 620) return 'AGUANIEVE';
  if (id >= 620 && id < 700) return 'NEVADA INTENSA';
  if (id >= 700 && id < 800) return 'NEBLINA / POLVO';
  if (id === 800)             return 'DESPEJADO';
  return 'NUBLADO';
}

// ── Globe canvas — animated rotating Earth ───────────
const _WGL = { lat:0, lon:0, rotY:0, paused:false, animId:null, drag:null, dragRotY:0 };
let _wglH = null; // event handler refs for cleanup

// Simplified continent outlines [lon, lat] — traced clockwise
const _GEO = [
  // North America
  [[-165,71],[-140,70],[-120,72],[-100,73],[-85,73],[-78,72],[-68,64],
   [-55,47],[-65,44],[-70,43],[-75,35],[-80,32],[-88,30],[-97,26],
   [-104,19],[-90,14],[-86,10],[-78,8],[-82,10],[-90,22],[-97,26],
   [-110,23],[-118,34],[-124,49],[-130,54],[-140,58],[-148,60],
   [-155,55],[-165,65],[-165,71]],
  // South America
  [[-78,8],[-62,11],[-52,4],[-50,0],[-35,-5],[-35,-12],[-38,-16],
   [-43,-23],[-48,-28],[-52,-33],[-55,-35],[-58,-38],[-65,-45],
   [-68,-54],[-72,-50],[-70,-30],[-70,-18],[-75,-10],[-78,-2],[-78,8]],
  // Europe
  [[-10,36],[-9,44],[0,43],[8,44],[14,41],[18,40],[22,38],[26,38],
   [28,41],[28,48],[22,55],[18,57],[14,57],[18,65],[24,70],[22,68],
   [16,58],[10,57],[5,58],[2,52],[0,50],[-2,49],[-5,44],[-5,36],[-10,36]],
  // Africa
  [[-17,15],[-17,25],[-12,30],[-8,35],[0,37],[10,37],[15,38],[22,37],
   [30,31],[35,22],[37,15],[43,12],[36,5],[34,-1],[35,-11],[40,-20],
   [35,-26],[27,-30],[25,-34],[18,-34],[12,-34],[18,-28],[22,-20],
   [18,-16],[12,-12],[9,-5],[9,4],[2,6],[-5,5],[-15,5],[-17,9],[-17,15]],
  // Asia
  [[26,48],[30,42],[36,22],[43,12],[55,23],[72,22],[78,8],[82,8],
   [88,22],[97,22],[100,13],[103,1],[108,-7],[115,4],[120,15],
   [121,25],[122,38],[128,38],[135,35],[140,42],[142,52],[140,60],
   [135,68],[140,72],[130,74],[110,73],[90,73],[72,68],[58,70],
   [52,68],[50,65],[55,62],[58,52],[50,54],[40,62],[32,62],[26,52],[26,48]],
  // Australia
  [[114,-26],[118,-20],[122,-18],[128,-15],[131,-12],[136,-12],
   [140,-17],[142,-18],[145,-15],[148,-20],[152,-24],[152,-28],
   [148,-38],[144,-38],[138,-36],[132,-34],[116,-34],[114,-26]],
  // Greenland
  [[-50,60],[-38,68],[-25,72],[-22,76],[-28,80],[-38,83],
   [-50,83],[-58,75],[-58,70],[-55,65],[-50,60]],
];

function _wp(lat, lon, rotY) {
  const lr = lat * Math.PI / 180;
  const vl = (lon + rotY) * Math.PI / 180;
  return { x: Math.cos(lr) * Math.sin(vl), y: -Math.sin(lr), v: Math.cos(vl) > -0.04 };
}

function _drawGlobe() {
  const cv = document.getElementById('wx-globe');
  if (!cv) { cancelAnimationFrame(_WGL.animId); return; }
  const ctx = cv.getContext('2d');
  const W = cv.width, R = W * 0.43, cx = W / 2, cy = W / 2;

  if (!_WGL.paused && _WGL.drag === null) _WGL.rotY -= 0.13;
  ctx.clearRect(0, 0, W, W);

  // Base
  const bg = ctx.createRadialGradient(cx - R*.28, cy - R*.32, 0, cx, cy, R);
  bg.addColorStop(0, '#103a52'); bg.addColorStop(.55, '#071d2e'); bg.addColorStop(1, '#020d1a');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = bg; ctx.fill();

  // Clip all interior drawing to globe circle
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

  // Grid helper
  const seg = (pts) => {
    ctx.beginPath(); let f = true;
    for (const [px, py, v] of pts) {
      if (!v) { f = true; continue; }
      f ? ctx.moveTo(cx + R*px, cy + R*py) : ctx.lineTo(cx + R*px, cy + R*py);
      f = false;
    }
    ctx.stroke();
  };

  // Meridians
  ctx.strokeStyle = 'rgba(0,212,255,0.11)'; ctx.lineWidth = 0.5;
  for (let ln = 0; ln < 360; ln += 30) {
    seg(Array.from({length:61}, (_,i) => { const p=_wp(-90+i*3,ln,_WGL.rotY); return[p.x,p.y,p.v]; }));
  }
  // Parallels
  for (let la = -60; la <= 60; la += 30) {
    ctx.strokeStyle = la===0 ? 'rgba(0,212,255,0.32)' : 'rgba(0,212,255,0.12)';
    ctx.lineWidth   = la===0 ? 0.9 : 0.45;
    seg(Array.from({length:181}, (_,i) => { const p=_wp(la,-180+i*2,_WGL.rotY); return[p.x,p.y,p.v]; }));
  }

  // Tropics
  ctx.strokeStyle = 'rgba(0,212,255,0.07)'; ctx.lineWidth = 0.3;
  for (const la of [-66.5, -23.5, 23.5, 66.5]) {
    seg(Array.from({length:181}, (_,i) => { const p=_wp(la,-180+i*2,_WGL.rotY); return[p.x,p.y,p.v]; }));
  }

  // Continents
  for (const poly of _GEO) {
    ctx.beginPath();
    let f = true, pv = false;
    for (const [ln, la] of poly) {
      const p = _wp(la, ln, _WGL.rotY);
      const px = cx + R*p.x, py = cy + R*p.y;
      if (p.v) { (!f && pv) ? ctx.lineTo(px, py) : ctx.moveTo(px, py); f = false; }
      pv = p.v;
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,212,255,0.17)'; ctx.fill();
    ctx.strokeStyle = 'rgba(0,212,255,0.65)'; ctx.lineWidth = 0.9; ctx.stroke();
  }

  // Location marker
  const up = _wp(_WGL.lat, _WGL.lon, _WGL.rotY);
  if (up.v) {
    const px = cx + R*up.x, py = cy + R*up.y;
    const t  = (Date.now() % 2000) / 2000;
    const t2 = ((Date.now() + 900) % 2600) / 2600;
    // Crosshair lines
    ctx.strokeStyle = 'rgba(0,212,255,0.35)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(px-14,py); ctx.lineTo(px-5,py);
    ctx.moveTo(px+5,py); ctx.lineTo(px+14,py);
    ctx.moveTo(px,py-14); ctx.lineTo(px,py-5);
    ctx.moveTo(px,py+5); ctx.lineTo(px,py+14); ctx.stroke();
    // Core dot
    ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI*2);
    ctx.fillStyle = '#22d3ee'; ctx.fill();
    // Bright center
    ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    // Pulse rings
    ctx.beginPath(); ctx.arc(px, py, 3.5 + t*15, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(0,212,255,${0.85*(1-t)})`; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.beginPath(); ctx.arc(px, py, 3.5 + t2*22, 0, Math.PI*2);
    ctx.strokeStyle = `rgba(0,212,255,${0.4*(1-t2)})`; ctx.lineWidth = 0.9; ctx.stroke();
  }

  ctx.restore(); // end globe clip

  // Globe border
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.strokeStyle = 'rgba(0,212,255,0.75)'; ctx.lineWidth = 1.5; ctx.stroke();

  // Atmosphere
  const atmo = ctx.createRadialGradient(cx, cy, R*.82, cx, cy, R*1.22);
  atmo.addColorStop(0,   'rgba(0,212,255,0)');
  atmo.addColorStop(0.35,'rgba(0,212,255,0.12)');
  atmo.addColorStop(0.7, 'rgba(0,100,200,0.05)');
  atmo.addColorStop(1,   'rgba(0,212,255,0)');
  ctx.beginPath(); ctx.arc(cx, cy, R*1.2, 0, Math.PI*2);
  ctx.fillStyle = atmo; ctx.fill();

  // Specular highlight
  const spec = ctx.createRadialGradient(cx-R*.3, cy-R*.34, 0, cx-R*.22, cy-R*.28, R*.55);
  spec.addColorStop(0, 'rgba(200,240,255,0.12)');
  spec.addColorStop(1, 'rgba(200,240,255,0)');
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI*2);
  ctx.fillStyle = spec; ctx.fill();

  // HUD corner brackets
  const m=8, s=15, x0=cx-R-m, y0=cy-R-m, x1=cx+R+m, y1=cy+R+m;
  ctx.strokeStyle = 'rgba(0,212,255,0.5)'; ctx.lineWidth = 1.5;
  for (const [bx,by,dx,dy] of [[x0,y0,1,1],[x1,y0,-1,1],[x0,y1,1,-1],[x1,y1,-1,-1]]) {
    ctx.beginPath(); ctx.moveTo(bx, by+dy*s); ctx.lineTo(bx, by); ctx.lineTo(bx+dx*s, by);
    ctx.stroke();
  }

  // Pause indicator
  if (_WGL.paused) {
    ctx.fillStyle = 'rgba(0,212,255,0.5)';
    ctx.font = `${W*.11}px monospace`; ctx.textAlign = 'center';
    ctx.fillText('⏸', cx, cy + R + W*.13);
  }

  _WGL.animId = requestAnimationFrame(_drawGlobe);
}

function _initWxGlobe(lat, lon) {
  const cv = document.getElementById('wx-globe');
  if (!cv) return;
  cancelAnimationFrame(_WGL.animId);
  if (_wglH) {
    document.removeEventListener('mousemove', _wglH.mv);
    document.removeEventListener('touchmove', _wglH.mt);
    document.removeEventListener('mouseup',   _wglH.up);
    document.removeEventListener('touchend',  _wglH.up);
  }
  Object.assign(_WGL, { lat, lon, rotY: -lon, paused: false, drag: null });
  const up = () => { _WGL.drag = null; };
  const mv = e => { if (_WGL.drag === null) return; _WGL.rotY = _WGL.dragRotY - (e.clientX - _WGL.drag) * 0.5; };
  const mt = e => { if (_WGL.drag === null) return; _WGL.rotY = _WGL.dragRotY - (e.touches[0].clientX - _WGL.drag) * 0.5; };
  _wglH = { mv, mt, up };
  cv.onmousedown  = e => { _WGL.drag = e.clientX; _WGL.dragRotY = _WGL.rotY; cv.style.cursor='grabbing'; };
  cv.onmouseup    = () => { cv.style.cursor='grab'; };
  cv.ontouchstart = e => { _WGL.drag = e.touches[0].clientX; _WGL.dragRotY = _WGL.rotY; e.preventDefault(); };
  document.addEventListener('mousemove', mv);
  document.addEventListener('touchmove', mt, { passive: true });
  document.addEventListener('mouseup',  up);
  document.addEventListener('touchend', up);
  _drawGlobe();
}
window._wglToggle = () => { _WGL.paused = !_WGL.paused; };

function _makeGlobeHTML() {
  return `<canvas id="wx-globe" width="220" height="220"
    onclick="window._wglToggle()"
    style="width:110px;height:110px;cursor:grab;display:block;"
    title="Arrastra para rotar · Toca para pausar"></canvas>`;
}

async function _getCoords() {
  return new Promise(resolve => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: WEATHER_TTL }
    );
  });
}

async function fetchWeather() {
  const key = AREX_CONFIG?.owmKey;
  if (!key) return null;

  const cached = (() => { try { return JSON.parse(localStorage.getItem(WEATHER_CACHE_KEY)); } catch { return null; } })();
  const coords = await _getCoords();
  const lat = coords?.lat ?? cached?.lat ?? 29.0729;
  const lon = coords?.lon ?? cached?.lon ?? -110.9559;

  if (cached?.current && Date.now() - cached.ts < WEATHER_TTL) {
    const dl = Math.abs((cached.lat||0) - lat), dlo = Math.abs((cached.lon||0) - lon);
    if (dl < 0.1 && dlo < 0.1) return cached;
  }

  try {
    const base = `appid=${encodeURIComponent(key)}&units=metric&lang=es`;
    const [rW, rF] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&${base}`),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&${base}&cnt=8`)
    ]);
    if (!rW.ok) return null;
    const current  = await rW.json();
    const forecast = rF.ok ? await rF.json() : null;
    const result   = { current, forecast, lat, lon, ts: Date.now() };
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(result));
    return result;
  } catch { return cached || null; }
}

function renderWeatherWidget() {
  const el = document.getElementById('dash-weather');
  if (!el) return;
  const key = AREX_CONFIG?.owmKey;

  if (!key) {
    el.innerHTML = `
      <div class="dash-w-header">
        <span class="dash-w-title">CLIMA</span>
        <button class="dash-w-link" onclick="document.getElementById('modal-config').classList.remove('hidden')">CONFIGURAR →</button>
      </div>
      <div class="dash-empty">Agrega tu OpenWeatherMap API Key en /config para ver el clima</div>`;
    return;
  }

  el.innerHTML = `<div class="wx-loading">Obteniendo ubicación y clima...</div>`;

  fetchWeather().then(result => {
    if (!result?.current) {
      el.innerHTML = `<div class="dash-empty">Sin datos — verifica tu OpenWeatherMap API Key</div>`;
      return;
    }
    const { current: d, forecast: fc, lat, lon } = result;
    const wid   = d.weather[0].id;
    const icon  = _weatherIcon(wid);
    const desc  = d.weather[0].description.replace(/^\w/, c => c.toUpperCase());
    const temp  = Math.round(d.main.temp);
    const feels = Math.round(d.main.feels_like);
    const hum   = d.main.humidity;
    const wind  = Math.round(d.wind.speed * 3.6);
    const gust  = d.wind.gust ? Math.round(d.wind.gust * 3.6) : null;
    const tmax  = Math.round(d.main.temp_max);
    const tmin  = Math.round(d.main.temp_min);
    const pres  = d.main.pressure;
    const vis   = d.visibility != null ? (d.visibility / 1000).toFixed(0) + ' km' : '—';
    const cld   = d.clouds?.all ?? '—';
    const wdir  = _windDir(d.wind.deg);
    const city  = d.name || '';
    const ctry  = d.sys?.country || '';
    const rain  = d.rain?.['1h'] || 0;
    const snow  = d.snow?.['1h'] || 0;

    const tempClr = temp >= 40 ? '#ff3333' : temp >= 35 ? '#ff7700' : temp >= 30 ? '#ffaa00' : temp <= 2 ? '#88ccff' : '#22d3ee';

    const minsAgo = Math.round((Date.now() - result.ts) / 60000);
    const fresh   = minsAgo === 0 ? 'ahora' : `hace ${minsAgo} min`;

    const maxPop = fc ? Math.max(...fc.list.slice(0,4).map(x => x.pop||0)) : null;
    const popPct = maxPop != null ? Math.round(maxPop * 100) : null;
    const precipType = snow > 0 ? '❄ NIEVE' : rain > 0 ? '🌧 LLUVIA' : '💧';
    const precipAmt  = rain > 0 ? `${rain.toFixed(1)} mm` : snow > 0 ? `${snow.toFixed(1)} mm` : '';

    const precipHtml = popPct != null ? `
      <div class="wx-precip">
        <span class="wx-precip-lbl">PRECIP ${precipType}</span>
        <div class="wx-pop-row">
          <div class="wx-pop-bar"><div class="wx-pop-fill" style="width:${popPct}%"></div></div>
          <span class="wx-pop-pct">${popPct}%</span>
          ${precipAmt ? `<span class="wx-pop-amt">${precipAmt}</span>` : ''}
        </div>
      </div>` : '';

    let fcHtml = '';
    if (fc?.list?.length) {
      const slots = fc.list.slice(0, 4).map(f => {
        const fi   = _weatherIcon(f.weather[0].id);
        const ft   = Math.round(f.main.temp);
        const fp   = f.pop > 0.09 ? `<span class="wfc-pop">${Math.round(f.pop*100)}%</span>` : '';
        const fh   = new Date(f.dt * 1000).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
        return `<div class="wfc-item"><span class="wfc-time">${fh}</span><span class="wfc-icon">${fi}</span><span class="wfc-temp">${ft}°</span>${fp}</div>`;
      }).join('');
      fcHtml = `<div class="wx-fc-title">PRÓXIMAS 12H</div><div class="wx-fc-strip">${slots}</div>`;
    }

    // Alerta de condiciones severas
    let alertHtml = '';
    if (fc?.list) {
      const nextSlots = fc.list.slice(0, 4);
      const severeSlot = nextSlots.find(f => (f.pop > 0.65) || (f.weather[0].id >= 200 && f.weather[0].id < 700));
      if (severeSlot) {
        const wDesc = severeSlot.weather[0].description.replace(/^\w/, c => c.toUpperCase());
        const wHr   = new Date(severeSlot.dt * 1000).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'});
        alertHtml = `<div class="wx-alert">⚠ ${wDesc} esperado alrededor de las ${wHr}</div>`;
      }
    }

    el.innerHTML = `
      <div class="wx-card">
        <div class="wx-globe-row">
          <div class="wx-globe-wrap">${_makeGlobeHTML()}</div>
          <div class="wx-loc">
            <div class="wx-city">${city}${ctry ? ', '+ctry : ''}</div>
            <div class="wx-coords">${Math.abs(lat).toFixed(4)}° ${lat>=0?'N':'S'} &nbsp; ${Math.abs(lon).toFixed(4)}° ${lon>=0?'E':'O'}</div>
            <div class="wx-fresh">Actualizado ${fresh} <button class="wx-refresh" onclick="refreshWeather()" title="Actualizar">↺</button></div>
          </div>
        </div>
        <div class="wx-main-row">
          <span class="wx-big-icon">${icon}</span>
          <span class="wx-big-temp" style="color:${tempClr}">${temp}°<span class="wx-unit">C</span></span>
          <div class="wx-cond">
            <div class="wx-desc">${desc}</div>
            <div class="wx-sub">Sensación ${feels}°C &nbsp;·&nbsp; ${tmax}° / ${tmin}°</div>
          </div>
          <div class="wx-cond-badge">${_condLabel(wid)}</div>
        </div>
        <div class="wx-stats">
          <div class="wx-s"><span class="wxs-l">HUMEDAD</span><span class="wxs-v">${hum}%</span></div>
          <div class="wx-s"><span class="wxs-l">VIENTO</span><span class="wxs-v">${wind} <small>${wdir}</small></span>${gust?`<span class="wxs-sub">ráf. ${gust} km/h</span>`:''}</div>
          <div class="wx-s"><span class="wxs-l">PRESIÓN</span><span class="wxs-v">${pres}<small> hPa</small></span></div>
          <div class="wx-s"><span class="wxs-l">VISIBILIDAD</span><span class="wxs-v">${vis}</span></div>
          <div class="wx-s"><span class="wxs-l">NUBES</span><span class="wxs-v">${cld}%</span></div>
          <div class="wx-s"><span class="wxs-l">CONDICIÓN</span><span class="wxs-v wxs-cond">${_condLabel(wid)}</span></div>
        </div>
        ${alertHtml}
        ${precipHtml}
        ${fcHtml}
      </div>`;
    _initWxGlobe(lat, lon);
  });
}

function refreshWeather() {
  cancelAnimationFrame(_WGL.animId);
  localStorage.removeItem(WEATHER_CACHE_KEY);
  renderWeatherWidget();
}
window.refreshWeather = refreshWeather;


// ── URGENCY BADGES ────────────────────────────────────────────────────────────
function _updateUrgencyBadges() {
  try {
    const tasks = typeof getTareas === 'function' ? getTareas() : [];
    const now = new Date();
    const venc = tasks.filter(t => !t.done && t.fecha && new Date(t.fecha) < now).length;
    // Badge on tareas nav button
    const navTareas = document.querySelector('.nav-btn[data-module="tareas"]');
    if (navTareas) {
      let badge = navTareas.querySelector('.nav-urg-badge');
      if (venc > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'nav-urg-badge'; navTareas.appendChild(badge); }
        badge.textContent = venc;
      } else {
        badge?.remove();
      }
    }
  } catch (_) {}
}
window._updateUrgencyBadges = _updateUrgencyBadges;


// ── POMODORO ──────────────────────────────────────────────────────────────────
const POMO_TIMES = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let _pom = { running: false, mode: 'work', elapsed: 0, total: 25 * 60, interval: null };

function _pomRender() {
  const el = document.getElementById('pomo-widget');
  if (!el || el.classList.contains('hidden')) return;
  const remaining = _pom.total - _pom.elapsed;
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  const pct = _pom.total > 0 ? (_pom.elapsed / _pom.total) : 0;
  const modeLabel = _pom.mode === 'work' ? 'FOCO' : _pom.mode === 'short' ? 'DESCANSO' : 'DESCANSO LARGO';
  const r = 38, circ = 2 * Math.PI * r;
  const dash = circ - pct * circ;

  el.querySelector('.pomo-time').textContent = `${m}:${s}`;
  el.querySelector('.pomo-mode').textContent = modeLabel;
  el.querySelector('.pomo-circle-progress').setAttribute('stroke-dashoffset', dash.toFixed(1));
  el.querySelector('.pomo-btn-main').textContent = _pom.running ? '⏸' : '▶';
}

function _pomDone() {
  clearInterval(_pom.interval);
  _pom.running = false; _pom.interval = null;
  const wasWork = _pom.mode === 'work';
  const msg = wasWork ? '⏱ Pomodoro completado. ¡Tómate un descanso merecido!' : '⏱ Descanso terminado. ¡A trabajar!';
  if (Notification.permission === 'granted') new Notification('AREX — Pomodoro', { body: msg, icon: 'icon.svg' });
  addMsg('arex', msg);
  _pom.mode = wasWork ? 'short' : 'work';
  _pom.elapsed = 0;
  _pom.total = POMO_TIMES[_pom.mode];
  _pomRender();
}

function togglePomodoro() {
  if (_pom.running) {
    clearInterval(_pom.interval); _pom.running = false; _pom.interval = null;
  } else {
    _pom.interval = setInterval(() => { _pom.elapsed++; if (_pom.elapsed >= _pom.total) { _pomDone(); } else { _pomRender(); } }, 1000);
    _pom.running = true;
  }
  _pomRender();
}

function resetPomodoro(mode) {
  clearInterval(_pom.interval);
  _pom.running = false; _pom.interval = null;
  _pom.mode = mode || 'work';
  _pom.elapsed = 0;
  _pom.total = POMO_TIMES[_pom.mode];
  _pomRender();
}

function togglePomodoroWidget() {
  const el = document.getElementById('pomo-widget');
  if (!el) return;
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) _pomRender();
}
window.togglePomodoro       = togglePomodoro;
window.resetPomodoro        = resetPomodoro;
window.togglePomodoroWidget = togglePomodoroWidget;

// ── TIPO DE CAMBIO MXN/USD ────────────────────────────────────────────────────
const FX_CACHE_KEY = 'arex_fx_cache';
const FX_TTL       = 60 * 60 * 1000;

async function fetchExchangeRate() {
  const cached = _safeJSON(localStorage.getItem(FX_CACHE_KEY), null);
  if (cached?.ts && Date.now() - cached.ts < FX_TTL) return cached.rate;
  const apis = [
    async () => {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN');
      if (!r.ok) return null;
      const d = await r.json();
      return d.rates?.MXN || null;
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) return null;
      const d = await r.json();
      return d.rates?.MXN || null;
    }
  ];
  for (const api of apis) {
    try {
      const rate = await api();
      if (rate) {
        localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
        return rate;
      }
    } catch { /* intenta siguiente */ }
  }
  return null;
}

async function renderExchangeWidget() {
  const el = document.getElementById('dash-fx-widget');
  if (!el) return;
  el.innerHTML = '<div style="font-size:0.62rem;color:var(--text-muted);letter-spacing:1px">Cargando...</div>';
  const rate = await fetchExchangeRate();
  if (!rate) { el.innerHTML = '<div style="font-size:0.62rem;color:var(--text-muted)">Sin datos · sin conexión</div>'; return; }
  const cached = _safeJSON(localStorage.getItem(FX_CACHE_KEY), {});
  const upd = cached.ts ? new Date(cached.ts).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) : '';
  el.innerHTML = `
    <div class="fx-main">
      <span class="fx-pair">1 USD</span>
      <span class="fx-arrow">→</span>
      <span class="fx-rate">$${rate.toFixed(2)} <span class="fx-unit">MXN</span></span>
    </div>
    <div class="fx-upd">Actualizado ${upd} · frankfurter.app</div>`;
}
window.renderExchangeWidget = renderExchangeWidget;

// Fix keyboard/viewport jump on mobile
(function fixMobileVH() {
  const update = () => {
    const h = (window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--real-vh', h + 'px');
  };
  window.visualViewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  update();
})();


/* v219 · Superficie pública. Antes, la línea
   `window.renderWeatherWidget = renderWeatherWidget;` vivía en app.js, no
   junto a la función. Al separar los archivos se quedó huérfana y app.js
   la habría llamado sin que existiera. Aquí queda todo lo que sale de este
   archivo, junto y en un solo sitio. */
window.renderWeatherWidget = renderWeatherWidget;
