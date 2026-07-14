// AREX — Gesture Engine · MARK 3
// Cursor · Swipe · Pinch · Progress Ring · Haptic feedback (no particles, no audio)

const _GE_CDN        = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';
const _GE_COOL       = 1600;   // ms cooldown tras disparar gesto (2500 se sentía lento)
const _GE_HOLD       = 6;      // frames estables requeridos (6×100ms ≈ 0.6s)
const _GE_SWIPE_THR  = 0.18;   // desplazamiento mínimo para swipe
const _GE_SWIPE_WIN  = 6;      // ventana de swipe (6×100ms ≈ 0.6s)
const _GE_SWIPE_COOL = 1400;   // ms entre swipes
const _GE_PINCH_THR  = 0.06;
const _GE_PINCH_COOL = 1100;

window._geLoadingStatus = 'idle';

let _ge = {
  active: false, hands: null, af: null, pending: false,
  canvas: null, ctx: null, video: null, cb: null,
  lastTs: 0, lastType: null, hold: 0,
  palmHist: [], swipeTs: 0,
  pinching: false, pinchTs: 0,
  swipeAnim: null,
};

const GESTURES = {
  open_hand:   { icon: '✋', label: 'ANALIZAR',    color: '#00d4ff', action: 'analyze' },
  fist:        { icon: '✊', label: 'DETENER',     color: '#ff4455', action: 'stop' },
  index_up:    { icon: '☝',  label: 'MÓDULOS',     color: '#f5a623', action: 'modules' },
  peace:       { icon: '✌',  label: 'AUTO',        color: '#00ffaa', action: 'toggle_auto' },
  thumb_up:    { icon: '👍', label: 'VOZ',         color: '#00d4ff', action: 'voice' },
  pinch:       { icon: '🤏', label: 'SELECCIONAR', color: '#00ffaa', action: 'pinch_click' },
  swipe_left:  { icon: '◀',  label: 'ANTERIOR',    color: '#00d4ff', action: 'prev_module' },
  swipe_right: { icon: '▶',  label: 'SIGUIENTE',   color: '#00d4ff', action: 'next_module' },
};

/* ─── Public API ──────────────────────────────────────── */
async function initGestureEngine(videoEl, canvasEl, callback) {
  if (_ge.active) stopGestureEngine();
  Object.assign(_ge, {
    video: videoEl, canvas: canvasEl, ctx: canvasEl.getContext('2d'),
    cb: callback, active: true, lastTs: 0, lastType: null, hold: 0,
    pending: false, palmHist: [],
    pinching: false, swipeTs: 0, pinchTs: 0, swipeAnim: null,
  });

  // Estado de carga: lo muestra el badge de estado del HUD de Visión
  // (vision.js) — nada de texto dibujado sobre el video
  window._geLoadingStatus = 'loading';
  _ge.ctx.clearRect(0, 0, canvasEl.width || 320, canvasEl.height || 240);

  try {
    await _loadScript(_GE_CDN);
    if (!window.Hands) throw new Error('Hands class not found after CDN load');
    _ge.hands = new window.Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
    });
    _ge.hands.setOptions({
      maxNumHands: 1, modelComplexity: 0,
      minDetectionConfidence: 0.7, minTrackingConfidence: 0.6,
    });
    _ge.hands.onResults(_onResults);
    await _ge.hands.initialize();
    window._geLoadingStatus = 'ready';
    _geLoop();
    return true;
  } catch (e) {
    console.warn('AREX Gesture Engine failed:', e.message);
    window._geLoadingStatus = 'error';
    _ge.active = false;
    // Cerrar la instancia a medio inicializar — misma fuga que en stop
    if (_ge.hands) {
      try { _ge.hands.close(); } catch (_) {}
      _ge.hands = null;
    }
    return false;
  }
}

function stopGestureEngine() {
  _ge.active = false; _ge.pending = false;
  if (_ge.af) { clearTimeout(_ge.af); _ge.af = null; }
  if (_ge.ctx && _ge.canvas) _ge.ctx.clearRect(0, 0, _ge.canvas.width, _ge.canvas.height);
  // Liberar MediaPipe: sin esto cada toggle crea una instancia nueva (WASM +
  // contexto WebGL) y las viejas quedan vivas → en móvil acaba tirando la pestaña
  if (_ge.hands) {
    try { _ge.hands.close(); } catch (_) {}
    _ge.hands = null;
  }
  window._geLoadingStatus = 'idle';
}

/* ─── Frame Loop ──────────────────────────────────────── */
async function _geLoop() {
  if (!_ge.active) return;
  if (!_ge.pending && _ge.video?.readyState >= 2 && _ge.hands) {
    // Solo redimensionar si cambió: asignar canvas.width SIEMPRE realoja el
    // backing store aunque el valor sea igual — 15 realojos/s en iOS = churn
    // de memoria constante que empuja la pestaña al jetsam
    if (_ge.canvas.width !== 320 || _ge.canvas.height !== 240) {
      _ge.canvas.width = 320;
      _ge.canvas.height = 240;
    }
    // Alimentar a MediaPipe con una MINIATURA del video, nunca el stream
    // completo: a 1080p cada frame sube ~8MB a su contexto WebGL 15 veces
    // por segundo → presión de memoria → iOS mata la pestaña (pantalla
    // blanca). A 256px detecta manos igual de bien.
    const vw = _ge.video.videoWidth || 640, vh = _ge.video.videoHeight || 480;
    const scale = 256 / Math.max(vw, vh);
    const fw = Math.max(2, Math.round(vw * scale)), fh = Math.max(2, Math.round(vh * scale));
    if (!_ge.feed) {
      _ge.feed = document.createElement('canvas');
      _ge.fctx = _ge.feed.getContext('2d');
    }
    if (_ge.feed.width !== fw || _ge.feed.height !== fh) {
      _ge.feed.width = fw; _ge.feed.height = fh;
    }
    _ge.fctx.drawImage(_ge.video, 0, 0, fw, fh);
    _ge.pending = true;
    try { await _ge.hands.send({ image: _ge.feed }); }
    catch (_) {}
    finally { _ge.pending = false; }
  }
  // 100ms (10fps): las manos no necesitan 15fps de detección y el GPU
  // respira — menos calor, menos memoria, misma sensación de respuesta
  if (_ge.active) _ge.af = setTimeout(_geLoop, 100);
}

/* ─── Results Handler ─────────────────────────────────── */
function _onResults(results) {
  if (!_ge.active) return;
  const ctx = _ge.ctx, w = _ge.canvas.width, h = _ge.canvas.height;
  ctx.clearRect(0, 0, w, h);
  _drawSwipeAnim(ctx, w, h);

  if (!results.multiHandLandmarks?.length) {
    _ge.hold = 0; _ge.lastType = null;
    _ge.palmHist = [];
    return;
  }

  const lm = results.multiHandLandmarks[0];

  // Anti-confusion jump check: if palm jumped sharply (MediaPipe switched hand),
  // reset state and skip this frame
  if (_ge.palmHist.length > 0) {
    const prev = _ge.palmHist[_ge.palmHist.length - 1];
    const jump = Math.abs(lm[9].x - prev.x) + Math.abs(lm[9].y - prev.y);
    if (jump > 0.28) {
      _ge.palmHist = []; _ge.hold = 0; _ge.lastType = null;
      return;
    }
  }

  _ge.palmHist.push({ x: lm[9].x, y: lm[9].y });
  if (_ge.palmHist.length > _GE_SWIPE_WIN) _ge.palmHist.shift();

  _drawSkeleton(ctx, lm, w, h);
  _drawCursor(ctx, lm, w, h);

  _checkSwipe();
  _checkPinch(lm, w, h);

  const type = _detectGesture(lm);
  if (!type) { _ge.hold = 0; return; }

  // Intentionality filter: hand must be still, not moving
  const hist = _ge.palmHist;
  const palmVel = hist.length >= 3
    ? Math.abs(hist[hist.length-1].x - hist[hist.length-3].x)
    + Math.abs(hist[hist.length-1].y - hist[hist.length-3].y)
    : 1;
  if (palmVel > 0.022) { _ge.hold = 0; _ge.lastType = type; return; }

  if (type === _ge.lastType) _ge.hold++;
  else { _ge.hold = 1; _ge.lastType = type; }

  const g = GESTURES[type];
  const progress = Math.min(1, _ge.hold / _GE_HOLD);
  if (g) _drawProgressRing(ctx, lm, w, h, Math.max(0.08, progress), g);

  if (_ge.hold >= _GE_HOLD) {
    const now = Date.now();
    if (now - _ge.lastTs > _GE_COOL) {
      _ge.lastTs = now; _ge.hold = 0;
      navigator.vibrate?.([40]);
      _ge.cb?.(type, null);
    }
  }
}

/* ─── Swipe Detection ─────────────────────────────────── */
function _checkSwipe() {
  const hist = _ge.palmHist;
  if (hist.length < _GE_SWIPE_WIN) return;
  if (Date.now() - _ge.swipeTs < _GE_SWIPE_COOL) return;

  const dx = hist[hist.length - 1].x - hist[0].x;
  const dy = hist[hist.length - 1].y - hist[0].y;
  const adx = Math.abs(dx), ady = Math.abs(dy);

  let type = null;
  if (adx > _GE_SWIPE_THR && adx > ady * 1.7) type = dx > 0 ? 'swipe_right' : 'swipe_left';
  if (!type) return;

  const w = _ge.canvas.width, h = _ge.canvas.height;
  _ge.swipeTs = Date.now(); _ge.palmHist = [];
  const ax = dx > 0.05 ? w * 0.75 : w * 0.25;
  _ge.swipeAnim = { dir: type, x: ax, y: h * 0.5, life: 1 };
  navigator.vibrate?.([40]);
  _ge.cb?.(type, null);
}

/* ─── Pinch Detection ─────────────────────────────────── */
function _checkPinch(lm, w, h) {
  const dx = lm[4].x - lm[8].x, dy = lm[4].y - lm[8].y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const isPinching = dist < _GE_PINCH_THR;
  const now = Date.now();

  if (isPinching && !_ge.pinching && now - _ge.pinchTs > _GE_PINCH_COOL) {
    _ge.pinching = true; _ge.pinchTs = now;
    navigator.vibrate?.([40]);
    _ge.cb?.('pinch', { x: lm[8].x, y: lm[8].y });
  } else if (isPinching && _ge.pinching) {
    // Pellizco sostenido: posición continua (FORJA lo usa para arrastrar hologramas)
    _ge.cb?.('pinch_move', { x: lm[8].x, y: lm[8].y });
  } else if (!isPinching) {
    if (_ge.pinching) _ge.cb?.('pinch_end', null);
    _ge.pinching = false;
  }

  // Visual: dashed connection when approaching pinch
  if (dist < 0.15) {
    const alpha = Math.pow((0.15 - dist) / 0.15, 1.5) * 0.7;
    const ctx = _ge.ctx;
    ctx.beginPath();
    ctx.moveTo(lm[4].x * w, lm[4].y * h);
    ctx.lineTo(lm[8].x * w, lm[8].y * h);
    ctx.strokeStyle = `rgba(0,255,170,${alpha.toFixed(2)})`;
    ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

/* ─── Gesture Detection ───────────────────────────────── */
function _detectGesture(lm) {
  const ix = lm[8].y  < lm[6].y;   // índice extendido
  const mx = lm[12].y < lm[10].y;  // medio extendido
  const rx = lm[16].y < lm[14].y;  // anular extendido
  const px = lm[20].y < lm[18].y;  // meñique extendido
  const tx = lm[4].y  < lm[3].y;   // pulgar extendido hacia arriba
  const n = [ix, mx, rx, px].filter(Boolean).length;
  // Orden: de más dedos a menos — los específicos antes que los genéricos.
  // ☝✌👍 estaban en la guía y el config pero NADIE los detectaba (por eso
  // configurarlos nunca hacía nada) — ahora los 5 gestos son reales.
  if (n >= 3 && tx)              return 'open_hand';
  if (ix && mx && !rx && !px)    return 'peace';
  if (ix && !mx && !rx && !px)   return 'index_up';
  if (n === 0 && tx)             return 'thumb_up';
  if (n === 0 && !tx)            return 'fist';
  return null;
}

/* ─── Canvas Drawing ──────────────────────────────────── */
// El canvas de gestos se voltea en espejo (CSS scaleX(-1)) con la cámara
// frontal para que la mano coincida — pero eso voltea también todo TEXTO
// dibujado. Este helper lo dibuja siempre legible.
function _mirrored() {
  return (_ge.canvas?.style.transform || '').includes('-1');
}
function _textUpright(ctx, text, x, y) {
  if (!_mirrored()) { ctx.fillText(text, x, y); return; }
  const w = _ge.canvas.width;
  ctx.save();
  ctx.translate(w, 0);
  ctx.scale(-1, 1);
  ctx.fillText(text, w - x, y);
  ctx.restore();
}

const _CONNS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],
];
const _TIPS = new Set([4, 8, 12, 16, 20]);

function _drawSkeleton(ctx, lm, w, h) {
  // Malla técnica sutil — líneas finas, articulaciones discretas
  ctx.strokeStyle = 'rgba(0,212,255,0.32)'; ctx.lineWidth = 1;
  for (const [a, b] of _CONNS) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
  for (let i = 0; i < lm.length; i++) {
    const tip = _TIPS.has(i);
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, tip ? 3 : 1.6, 0, Math.PI * 2);
    if (tip) { ctx.save(); ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 7; }
    ctx.fillStyle = tip ? 'rgba(190,245,255,0.95)' : 'rgba(0,212,255,0.55)';
    ctx.fill();
    if (tip) ctx.restore();
  }
}

function _drawCursor(ctx, lm, w, h) {
  // Retícula Stark: dos arcos que orbitan el índice + cruz de precisión
  const cx = lm[8].x * w, cy = lm[8].y * h;
  const t  = Date.now() * 0.0022;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,212,255,0.75)'; ctx.lineWidth = 1.4;
  ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 6;
  for (const off of [0, Math.PI]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 15, t + off, t + off + Math.PI * 0.55);
    ctx.stroke();
  }
  ctx.restore();
  // Núcleo
  ctx.beginPath(); ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(220,250,255,0.95)'; ctx.fill();
  // Cruz de precisión
  ctx.strokeStyle = 'rgba(0,212,255,0.45)'; ctx.lineWidth = 1;
  const arms = [
    [cx-11,cy,cx-6,cy], [cx+6,cy,cx+11,cy],
    [cx,cy-11,cx,cy-6], [cx,cy+6,cx,cy+11],
  ];
  for (const [x1,y1,x2,y2] of arms) {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
}

function _drawProgressRing(ctx, lm, w, h, progress, g) {
  const cx = lm[8].x * w, cy = lm[8].y * h;
  const R = 21;
  // Marcas técnicas alrededor del anillo (estilo HUD)
  ctx.strokeStyle = g.color + '30'; ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 3), cy + Math.sin(a) * (R + 3));
    ctx.lineTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    ctx.stroke();
  }
  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = g.color + '22';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Progress arc con glow
  ctx.save();
  ctx.shadowColor = g.color; ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = g.color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
  // Etiqueta + porcentaje (siempre legibles, aunque el canvas esté en espejo)
  if (progress > 0.35) {
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = g.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    _textUpright(ctx, `${g.label} · ${Math.round(progress * 100)}%`, cx, cy + R + 8);
  }
}

function _drawSwipeAnim(ctx, w, h) {
  if (!_ge.swipeAnim) return;
  const s = _ge.swipeAnim;
  s.life *= 0.85;
  if (s.life < 0.05) { _ge.swipeAnim = null; return; }
  // Triple chevron vectorial deslizante (nada de flechas emoji).
  // Dirección corregida por espejo: debe apuntar hacia donde el usuario movió la mano
  let dir = s.dir === 'swipe_right' ? 1 : -1;
  if (_mirrored()) dir = -dir;
  const drift = (1 - s.life) * 34 * dir;
  ctx.save();
  ctx.strokeStyle = '#00d4ff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 12;
  for (let i = 0; i < 3; i++) {
    const alpha = s.life * (1 - i * 0.28);
    if (alpha <= 0) continue;
    ctx.globalAlpha = alpha;
    const x = s.x + drift + i * 13 * dir;
    ctx.beginPath();
    ctx.moveTo(x - 6 * dir, s.y - 11);
    ctx.lineTo(x + 6 * dir, s.y);
    ctx.lineTo(x - 6 * dir, s.y + 11);
    ctx.stroke();
  }
  ctx.restore();
}

/* ─── Script Loader ───────────────────────────────────── */
function _loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = res;
    // Quitar el tag muerto: si queda en el DOM, el próximo intento lo encuentra,
    // resuelve al instante sin cargar nada y los gestos quedan rotos hasta recargar
    s.onerror = () => { s.remove(); rej(new Error(`CDN load failed: ${src}`)); };
    document.head.appendChild(s);
  });
}

window.initGestureEngine = initGestureEngine;
window.stopGestureEngine = stopGestureEngine;
window.GESTURES          = GESTURES;
// window._geLoadingStatus is set at top (idle) and updated by initGestureEngine
