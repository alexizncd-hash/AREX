// AREX — Gesture Engine · MARK 3
// Cursor · Swipe · Pinch · Progress Ring · Haptic feedback (no particles, no audio)

const _GE_CDN        = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';
const _GE_COOL       = 2500;   // ms cooldown tras disparar gesto
const _GE_HOLD       = 10;     // frames estables requeridos (10×66ms ≈ 0.65s)
const _GE_SWIPE_THR  = 0.18;   // desplazamiento mínimo para swipe
const _GE_SWIPE_WIN  = 9;
const _GE_SWIPE_COOL = 2000;   // ms entre swipes
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

  // Show loading state on canvas
  window._geLoadingStatus = 'loading';
  const ctx = _ge.ctx;
  const cw = canvasEl.width || 320, ch = canvasEl.height || 240;
  ctx.clearRect(0, 0, cw, ch);
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#00d4ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('CARGANDO GESTOS...', cw * 0.5, ch * 0.5);

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
    // Resize canvas to 320x240 for faster MediaPipe processing
    _ge.canvas.width = 320;
    _ge.canvas.height = 240;
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
  const ix = lm[8].y  < lm[6].y;
  const mx = lm[12].y < lm[10].y;
  const rx = lm[16].y < lm[14].y;
  const px = lm[20].y < lm[18].y;
  const tx = lm[4].y  < lm[3].y;
  const n = [ix, mx, rx, px].filter(Boolean).length;
  if (n >= 3 && tx) return 'open_hand';
  if (n === 0 && !tx) return 'fist';
  return null;
}

/* ─── Canvas Drawing ──────────────────────────────────── */
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

function _drawProgressRing(ctx, lm, w, h, progress, g) {
  const cx = lm[8].x * w, cy = lm[8].y * h;
  const R = 22;
  // Background ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = g.color + '22';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  // Progress arc
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = g.color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.stroke();
  // Label when >50%
  if (progress > 0.5) {
    ctx.font = 'bold 9px monospace';
    ctx.fillStyle = g.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(g.label, cx, cy + R + 4);
  }
}

function _drawSwipeAnim(ctx, w, h) {
  if (!_ge.swipeAnim) return;
  const s = _ge.swipeAnim;
  s.life *= 0.83;
  if (s.life < 0.05) { _ge.swipeAnim = null; return; }
  const arrows = { swipe_left: '←', swipe_right: '→' };
  ctx.save();
  ctx.globalAlpha = s.life;
  ctx.font = `bold ${26 + Math.round((1 - s.life) * 18)}px monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#00d4ff'; ctx.shadowColor = '#00d4ff'; ctx.shadowBlur = 22;
  ctx.fillText(arrows[s.dir] || '→', s.x, s.y);
  ctx.restore();
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
window.stopGestureEngine = stopGestureEngine;
window.GESTURES          = GESTURES;
// window._geLoadingStatus is set at top (idle) and updated by initGestureEngine
