// AREX — Gesture Engine · MARK 1
// Real-time hand tracking via MediaPipe Hands CDN
// Draws JARVIS skeleton overlay, fires gesture events

const _GE_CDN  = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/hands.js';
const _GE_COOL = 1500;  // ms between same-gesture fires
const _GE_HOLD = 10;    // frames to hold before trigger (~0.65s at 15fps)

let _ge = {
  active:   false,
  hands:    null,
  af:       null,
  pending:  false,
  canvas:   null,
  ctx:      null,
  video:    null,
  cb:       null,
  lastTs:   0,
  lastType: null,
  hold:     0,
};

const GESTURES = {
  open_hand: { icon: '✋', label: 'ANALIZAR',  color: '#00d4ff', action: 'analyze' },
  fist:      { icon: '✊', label: 'DETENER',   color: '#ff4455', action: 'stop' },
  index_up:  { icon: '☝',  label: 'MÓDULOS',   color: '#00ffaa', action: 'modules' },
  peace:     { icon: '✌',  label: 'AUTO',      color: '#8B5CF6', action: 'toggle_auto' },
  thumb_up:  { icon: '👍', label: 'OK / VOZ',  color: '#ff9900', action: 'voice' },
};

/* ─── Public API ──────────────────────────────────────── */
async function initGestureEngine(videoEl, canvasEl, callback) {
  if (_ge.active) stopGestureEngine();
  _ge.video    = videoEl;
  _ge.canvas   = canvasEl;
  _ge.ctx      = canvasEl.getContext('2d');
  _ge.cb       = callback;
  _ge.active   = true;
  _ge.lastTs   = 0;
  _ge.lastType = null;
  _ge.hold     = 0;
  _ge.pending  = false;

  try {
    await _loadScript(_GE_CDN);
    if (!window.Hands) throw new Error('Hands class not found after CDN load');

    _ge.hands = new window.Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1646424915/${f}`,
    });
    _ge.hands.setOptions({
      maxNumHands:            1,
      modelComplexity:        0,    // lite model — faster on mobile
      minDetectionConfidence: 0.72,
      minTrackingConfidence:  0.65,
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
  _ge.active  = false;
  _ge.pending = false;
  if (_ge.af) { clearTimeout(_ge.af); _ge.af = null; }
  if (_ge.ctx && _ge.canvas) {
    _ge.ctx.clearRect(0, 0, _ge.canvas.width, _ge.canvas.height);
  }
}

/* ─── Frame Loop ──────────────────────────────────────── */
async function _geLoop() {
  if (!_ge.active) return;
  if (!_ge.pending && _ge.video && _ge.video.readyState >= 2 && _ge.hands) {
    // Sync canvas size with displayed video on every frame
    const vw = _ge.video.clientWidth  || 320;
    const vh = _ge.video.clientHeight || 480;
    if (_ge.canvas.width !== vw || _ge.canvas.height !== vh) {
      _ge.canvas.width  = vw;
      _ge.canvas.height = vh;
    }
    _ge.pending = true;
    try { await _ge.hands.send({ image: _ge.video }); }
    catch (_) {}
    finally { _ge.pending = false; }
  }
  if (_ge.active) _ge.af = setTimeout(_geLoop, 66); // ~15 fps
}

/* ─── Results Handler ─────────────────────────────────── */
function _onResults(results) {
  if (!_ge.active) return;
  const ctx = _ge.ctx;
  const w   = _ge.canvas.width;
  const h   = _ge.canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!results.multiHandLandmarks?.length) {
    _ge.hold     = 0;
    _ge.lastType = null;
    return;
  }

  const lm = results.multiHandLandmarks[0];
  _drawSkeleton(ctx, lm, w, h);

  const type = _detectGesture(lm);
  if (!type) { _ge.hold = 0; return; }

  if (type === _ge.lastType) {
    _ge.hold++;
  } else {
    _ge.hold     = 1;
    _ge.lastType = type;
  }

  const g = GESTURES[type];
  if (g) _drawGestureIndicator(ctx, g, w, h, Math.min(1, _ge.hold / _GE_HOLD));

  if (_ge.hold >= _GE_HOLD) {
    const now = Date.now();
    if (now - _ge.lastTs > _GE_COOL) {
      _ge.lastTs = now;
      _ge.hold   = 0;
      _ge.cb?.(type);
    }
  }
}

/* ─── Gesture Detection ───────────────────────────────── */
function _detectGesture(lm) {
  // Extended: tip.y < pip.y (lower y = higher on screen)
  const ix = lm[8].y  < lm[6].y  && lm[6].y  < lm[5].y;
  const mx = lm[12].y < lm[10].y && lm[10].y < lm[9].y;
  const rx = lm[16].y < lm[14].y && lm[14].y < lm[13].y;
  const px = lm[20].y < lm[18].y && lm[18].y < lm[17].y;
  const tx = lm[4].y  < lm[3].y;

  const n = [ix, mx, rx, px].filter(Boolean).length;

  if (n === 4 && tx)               return 'open_hand';
  if (n === 0 && !tx)              return 'fist';
  if (ix && !mx && !rx && !px)    return 'index_up';
  if (ix && mx && !rx && !px)     return 'peace';
  if (!ix && !mx && !rx && !px && tx) return 'thumb_up';
  return null;
}

/* ─── Canvas Drawing ──────────────────────────────────── */
const _CONNS = [
  [0,1],[1,2],[2,3],[3,4],
  [0,5],[5,6],[6,7],[7,8],
  [5,9],[9,10],[10,11],[11,12],
  [9,13],[13,14],[14,15],[15,16],
  [13,17],[17,18],[18,19],[19,20],
  [0,17],[5,9],[9,13],[13,17],
];
const _TIPS = new Set([4, 8, 12, 16, 20]);

function _drawSkeleton(ctx, lm, w, h) {
  ctx.strokeStyle = 'rgba(0,212,255,0.55)';
  ctx.lineWidth   = 1.5;
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
    ctx.fillStyle = tip ? 'rgba(0,255,170,0.92)' : 'rgba(0,212,255,0.7)';
    ctx.fill();
    if (tip) {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, 9, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,255,170,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function _drawGestureIndicator(ctx, g, w, h, progress) {
  const cx = w * 0.5;
  const cy = 52;
  const R  = 24;

  // Glow halo
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R + 14);
  grad.addColorStop(0, g.color + '33');
  grad.addColorStop(1, 'transparent');
  ctx.beginPath();
  ctx.arc(cx, cy, R + 14, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  // Progress ring
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
  ctx.strokeStyle = g.color;
  ctx.lineWidth   = 3;
  ctx.lineCap     = 'round';
  ctx.stroke();

  // Background circle
  ctx.beginPath();
  ctx.arc(cx, cy, R - 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,5,16,0.72)';
  ctx.fill();

  // Emoji icon
  ctx.font         = '20px serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(g.icon, cx, cy);

  // Label
  ctx.font         = 'bold 8px monospace';
  ctx.fillStyle    = g.color;
  ctx.textBaseline = 'top';
  ctx.fillText(g.label, cx, cy + R + 4);
}

/* ─── Script Loader ───────────────────────────────────── */
function _loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) { res(); return; }
    const s = document.createElement('script');
    s.src         = src;
    s.crossOrigin = 'anonymous';
    s.onload  = res;
    s.onerror = () => rej(new Error(`CDN load failed: ${src}`));
    document.head.appendChild(s);
  });
}

window.initGestureEngine = initGestureEngine;
window.stopGestureEngine  = stopGestureEngine;
window.GESTURES           = GESTURES;
