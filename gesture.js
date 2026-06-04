// AREX — Gesture Engine · MARK 2
// Cursor · Swipe · Pinch · Particles · Haptic · Audio feedback

const _GE_CDN        = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';
const _GE_COOL       = 2500;   // ms cooldown tras disparar gesto
const _GE_HOLD       = 22;     // frames estables requeridos (22×66ms ≈ 1.45s)
const _GE_SWIPE_THR  = 0.18;   // desplazamiento mínimo para swipe
const _GE_SWIPE_WIN  = 9;
const _GE_SWIPE_COOL = 2000;   // ms entre swipes
const _GE_PINCH_THR  = 0.06;
const _GE_PINCH_COOL = 1100;
const _GE_TRAIL_LEN  = 14;

let _ge = {
  active: false, hands: null, af: null, pending: false,
  canvas: null, ctx: null, video: null, cb: null,
  lastTs: 0, lastType: null, hold: 0,
  palmHist: [], swipeTs: 0,
  pinching: false, pinchTs: 0,
  trail: [], particles: [],
  audioCtx: null, swipeAnim: null,
};

const GESTURES = {
  open_hand:   { icon: '✋', label: 'ANALIZAR',    color: '#00d4ff', action: 'analyze' },
  fist:        { icon: '✊', label: 'DETENER',     color: '#ff4455', action: 'stop' },
  index_up:    { icon: '☝',  label: 'MÓDULOS',     color: '#00ffaa', action: 'modules' },
  peace:       { icon: '✌',  label: 'AUTO',        color: '#8B5CF6', action: 'toggle_auto' },
  thumb_up:    { icon: '👍', label: 'OK / VOZ',    color: '#ff9900', action: 'voice' },
  swipe_left:  { icon: '◀',  label: 'ANTERIOR',    color: '#00d4ff', action: 'prev_module' },
  swipe_right: { icon: '▶',  label: 'SIGUIENTE',   color: '#00d4ff', action: 'next_module' },
  swipe_up:    { icon: '▲',  label: 'CERRAR',      color: '#ff4455', action: 'close' },
  swipe_down:  { icon: '▼',  label: 'MÓDULOS',     color: '#00ffaa', action: 'modules_grid' },
  pinch:       { icon: '🤏', label: 'SELECCIONAR', color: '#00ffaa', action: 'pinch_click' },
};

/* ─── Public API ──────────────────────────────────────── */
async function initGestureEngine(videoEl, canvasEl, callback) {
  if (_ge.active) stopGestureEngine();
  Object.assign(_ge, {
    video: videoEl, canvas: canvasEl, ctx: canvasEl.getContext('2d'),
    cb: callback, active: true, lastTs: 0, lastType: null, hold: 0,
    pending: false, palmHist: [], trail: [], particles: [],
    pinching: false, swipeTs: 0, pinchTs: 0, swipeAnim: null,
  });
  try {
    await _loadScript(_GE_CDN);
    if (!window.Hands) throw new Error('Hands class not found after CDN load');
    _ge.hands = new window.Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
    });
    _ge.hands.setOptions({
      maxNumHands: 1, modelComplexity: 1,
      minDetectionConfidence: 0.80, minTrackingConfidence: 0.72,
    });
    _ge.hands.onResults(_onResults);
    await _ge.hands.initialize();
    _geLoop();
    return true;
  } catch (e) {
    console.warn('AREX Gesture Engine failed:', e.message);
    _ge.active = false;
    return false;
  }
}

function stopGestureEngine() {
  _ge.active = false; _ge.pending = false;
  if (_ge.af) { clearTimeout(_ge.af); _ge.af = null; }
  if (_ge.ctx && _ge.canvas) _ge.ctx.clearRect(0, 0, _ge.canvas.width, _ge.canvas.height);
}

/* ─── Frame Loop ──────────────────────────────────────── */
async function _geLoop() {
  if (!_ge.active) return;
  if (!_ge.pending && _ge.video?.readyState >= 2 && _ge.hands) {
    const vw = _ge.video.clientWidth  || 320;
    const vh = _ge.video.clientHeight || 480;
    if (_ge.canvas.width !== vw || _ge.canvas.height !== vh) {
      _ge.canvas.width = vw; _ge.canvas.height = vh;
    }
    _ge.pending = true;
    try { await _ge.hands.send({ image: _ge.video }); }
    catch (_) {}
    finally { _ge.pending = false; }
  }
  if (_ge.active) _ge.af = setTimeout(_geLoop, 66);
}

/* ─── Results Handler ─────────────────────────────────── */
function _onResults(results) {
  if (!_ge.active) return;
  const ctx = _ge.ctx, w = _ge.canvas.width, h = _ge.canvas.height;
  ctx.clearRect(0, 0, w, h);
  _updateParticles(ctx);
  _drawSwipeAnim(ctx, w, h);

  if (!results.multiHandLandmarks?.length) {
    _ge.hold = 0; _ge.lastType = null;
    _ge.palmHist = []; _ge.trail = [];
    return;
  }

  const lm = results.multiHandLandmarks[0];

  _ge.trail.push({ x: lm[8].x * w, y: lm[8].y * h });
  if (_ge.trail.length > _GE_TRAIL_LEN) _ge.trail.shift();

  _ge.palmHist.push({ x: lm[9].x, y: lm[9].y });
  if (_ge.palmHist.length > _GE_SWIPE_WIN) _ge.palmHist.shift();

  _drawTrail(ctx);
  _drawSkeleton(ctx, lm, w, h);
  _drawCursor(ctx, lm, w, h);

  _checkSwipe();
  _checkPinch(lm, w, h);

  const type = _detectGesture(lm);
  if (!type) { _ge.hold = 0; return; }

  // Filtro de intencionalidad: la mano debe estar quieta, no en movimiento
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
  if (g) _drawGestureIndicator(ctx, g, w, h, Math.max(0.08, progress));

  if (_ge.hold >= _GE_HOLD) {
    const now = Date.now();
    if (now - _ge.lastTs > _GE_COOL) {
      _ge.lastTs = now; _ge.hold = 0;
      _spawnBurst(w * 0.5, h * 0.5, g?.color || '#00d4ff', 16);
      _haptic(60); _beep(880, 1760, 0.18);
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
  if (adx > _GE_SWIPE_THR && adx > ady * 1.7)     type = dx > 0 ? 'swipe_right' : 'swipe_left';
  else if (ady > _GE_SWIPE_THR && ady > adx * 1.7) type = dy > 0 ? 'swipe_down'  : 'swipe_up';
  if (!type) return;

  const w = _ge.canvas.width, h = _ge.canvas.height;
  _ge.swipeTs = Date.now(); _ge.palmHist = [];
  const ax = dx > 0.05 ? w * 0.75 : dx < -0.05 ? w * 0.25 : w * 0.5;
  const ay = dy > 0.05 ? h * 0.75 : dy < -0.05 ? h * 0.25 : h * 0.5;
  _ge.swipeAnim = { dir: type, x: ax, y: ay, life: 1 };
  _spawnBurst(ax, ay, '#00d4ff', 10);
  _haptic(50); _beep(660, 1320, 0.12);
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
    const cx = (lm[4].x + lm[8].x) * 0.5 * w;
    const cy = (lm[4].y + lm[8].y) * 0.5 * h;
    _spawnBurst(cx, cy, '#00ffaa', 10);
    _haptic(30); _beep(1320, 2640, 0.10);
    _ge.cb?.('pinch', { x: lm[8].x, y: lm[8].y });
  } else if (!isPinching) {
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
  const ix = lm[8].y  < lm[6].y  && lm[6].y  < lm[5].y;
  const mx = lm[12].y < lm[10].y && lm[10].y < lm[9].y;
  const rx = lm[16].y < lm[14].y && lm[14].y < lm[13].y;
  const px = lm[20].y < lm[18].y && lm[18].y < lm[17].y;
  const tx = lm[4].y  < lm[3].y;
  const n = [ix, mx, rx, px].filter(Boolean).length;
  if (n === 4 && tx)                  return 'open_hand';
  if (n === 0 && !tx)                 return 'fist';
  if (ix && !mx && !rx && !px)        return 'index_up';
  if (ix && mx && !rx && !px)         return 'peace';
  if (!ix && !mx && !rx && !px && tx) return 'thumb_up';
  return null;
}

/* ─── Canvas Drawing ──────────────────────────────────── */
// [5,9] [9,13] [13,17] are included within each finger chain row — [0,17] closes the palm arc.
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
  ctx.strokeStyle = 'rgba(0,212,255,0.50)'; ctx.lineWidth = 1.5;
  for (const [a, b] of _CONNS) {
    ctx.beginPath();
    ctx.moveTo(lm[a].x * w, lm[a].y * h);
    ctx.lineTo(lm[b].x * w, lm[b].y * h);
    ctx.stroke();
  }
  for (let i = 0; i < lm.length; i++) {
    const tip = _TIPS.has(i);
    ctx.beginPath();
    ctx.arc(lm[i].x * w, lm[i].y * h, tip ? 5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = tip ? 'rgba(0,255,170,0.92)' : 'rgba(0,212,255,0.70)';
    ctx.fill();
  }
}

function _drawTrail(ctx) {
  const t = _ge.trail;
  if (t.length < 2) return;
  for (let i = 1; i < t.length; i++) {
    const alpha = (i / t.length) * 0.55;
    const r = 1.5 + (i / t.length) * 3.5;
    ctx.beginPath();
    ctx.arc(t[i].x, t[i].y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(0,255,170,${alpha.toFixed(2)})`;
    ctx.fill();
  }
}

function _drawCursor(ctx, lm, w, h) {
  const cx = lm[8].x * w, cy = lm[8].y * h;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,255,170,0.20)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,255,170,0.95)'; ctx.fill();
  ctx.strokeStyle = 'rgba(0,255,170,0.45)'; ctx.lineWidth = 1;
  const arms = [
    [cx-12,cy,cx-7,cy], [cx+7,cy,cx+12,cy],
    [cx,cy-12,cx,cy-7], [cx,cy+7,cx,cy+12],
  ];
  for (const [x1,y1,x2,y2] of arms) {
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
}

function _drawGestureIndicator(ctx, g, w, h, progress) {
  const cx = w * 0.5, cy = 52, R = 24;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R + 14);
  grad.addColorStop(0, g.color + '33'); grad.addColorStop(1, 'transparent');
  ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, Math.PI * 2); ctx.fillStyle = grad; ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = g.color; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.stroke();

  ctx.beginPath(); ctx.arc(cx, cy, R - 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,5,16,0.72)'; ctx.fill();

  ctx.font = '20px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(g.icon, cx, cy);

  if (progress > 0.3) {
    ctx.font = 'bold 8px monospace'; ctx.fillStyle = g.color;
    ctx.textBaseline = 'top'; ctx.fillText(g.label, cx, cy + R + 4);
  }
}

function _drawSwipeAnim(ctx, w, h) {
  if (!_ge.swipeAnim) return;
  const s = _ge.swipeAnim;
  s.life *= 0.83;
  if (s.life < 0.05) { _ge.swipeAnim = null; return; }
  const arrows = { swipe_left: '←', swipe_right: '→', swipe_up: '↑', swipe_down: '↓' };
  ctx.save();
  ctx.globalAlpha = s.life;
  ctx.font = `bold ${26 + Math.round((1 - s.life) * 18)}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00d4ff'; ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 22;
  ctx.fillText(arrows[s.dir] || '→', s.x, s.y);
  ctx.restore();
}

/* ─── Particles ───────────────────────────────────────── */
function _spawnBurst(cx, cy, color, n = 16) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n + Math.random() * 0.4;
    const speed = 2 + Math.random() * 5;
    _ge.particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1,
      life: 1, color, r: 1.5 + Math.random() * 2.5,
    });
  }
}

function _updateParticles(ctx) {
  _ge.particles = _ge.particles.filter(p => p.life > 0.04);
  for (const p of _ge.particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life *= 0.87;
    const hex = Math.round(p.life * 255).toString(16).padStart(2, '0');
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color + hex; ctx.fill();
  }
}

/* ─── Feedback ────────────────────────────────────────── */
function _haptic(ms = 60) { try { navigator.vibrate?.(ms); } catch (_) {} }

function _beep(f1 = 880, f2 = 1760, dur = 0.18) {
  try {
    if (!_ge.audioCtx) _ge.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const o = _ge.audioCtx.createOscillator();
    const g = _ge.audioCtx.createGain();
    o.connect(g); g.connect(_ge.audioCtx.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(f1, _ge.audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(f2, _ge.audioCtx.currentTime + dur * 0.5);
    g.gain.setValueAtTime(0.12, _ge.audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, _ge.audioCtx.currentTime + dur);
    o.start(); o.stop(_ge.audioCtx.currentTime + dur);
  } catch (_) {}
}

/* ─── Script Loader ───────────────────────────────────── */
function _loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src = src; s.crossOrigin = 'anonymous';
    s.onload = res;
    s.onerror = () => rej(new Error(`CDN load failed: ${src}`));
    document.head.appendChild(s);
  });
}

window.initGestureEngine = initGestureEngine;
window.stopGestureEngine  = stopGestureEngine;
window.GESTURES           = GESTURES;
