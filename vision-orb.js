/* ═══════════════════════════════════════════════════════════════
   AREX — Vision Orb  (3-D particle sphere overlay)
   Renders a compact holographic orb on the Vision HUD.
   States: idle · scanning · analyzing · speaking · error
   ═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  /* ─── Config per state ─────────────────────────────────────── */
  const STATES = {
    idle:      { rgb:[0,212,255],   rotSpeed:0.008, pulseAmp:0.04, pulseFreq:0.022, N:55,  edgeFrac:0.55 },
    scanning:  { rgb:[0,212,255],   rotSpeed:0.032, pulseAmp:0.12, pulseFreq:0.065, N:55,  edgeFrac:0.55 },
    analyzing: { rgb:[200,240,255], rotSpeed:0.052, pulseAmp:0.20, pulseFreq:0.10,  N:55,  edgeFrac:0.42 },
    speaking:  { rgb:[0,255,170],   rotSpeed:0.028, pulseAmp:0.10, pulseFreq:0.055, N:55,  edgeFrac:0.55 },
    error:     { rgb:[255,68,85],   rotSpeed:0.018, pulseAmp:0.06, pulseFreq:0.030, N:55,  edgeFrac:0.55 },
  };

  /* ─── State ────────────────────────────────────────────────── */
  let _canvas  = null;
  let _ctx     = null;
  let _alive   = false;
  let _state   = 'idle';
  let _angleY  = 0;
  let _angleX  = 0.30;
  let _t       = 0;
  let _nodes   = [];
  let _edges   = [];
  let _pulses  = [];
  let _rings   = [];

  /* ─── Util ─────────────────────────────────────────────────── */
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ─── Build sphere ─────────────────────────────────────────── */
  function _build() {
    const N      = STATES[_state].N;
    const golden = Math.PI * (3 - Math.sqrt(5));
    _nodes = [];
    _edges = [];
    _pulses = [];
    _rings  = [];

    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const phi = i * golden;
      _nodes.push({
        ox: Math.cos(phi) * r,
        oy: y,
        oz: Math.sin(phi) * r,
        x: 0, y: 0, z: 0,
        size:  0.8 + Math.random() * 1.2,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const R = _getR();
    const thresh = R * STATES[_state].edgeFrac;
    for (let i = 0; i < _nodes.length; i++) {
      for (let j = i + 1; j < _nodes.length; j++) {
        const ni = _nodes[i], nj = _nodes[j];
        const dx = ni.ox - nj.ox, dy = ni.oy - nj.oy, dz = ni.oz - nj.oz;
        if (Math.sqrt(dx*dx + dy*dy + dz*dz) * R < thresh) _edges.push([i, j]);
      }
    }
  }

  function _getR() {
    if (!_canvas) return 30;
    return Math.min(_canvas.width, _canvas.height) * 0.34;
  }

  /* ─── Rotate nodes ─────────────────────────────────────────── */
  function _rotate() {
    const cfg = STATES[_state] || STATES.idle;
    _angleY += cfg.rotSpeed;
    _angleX = 0.30 + 0.06 * Math.sin(_t * 0.008);

    const cY = Math.cos(_angleY), sY = Math.sin(_angleY);
    const cX = Math.cos(_angleX), sX = Math.sin(_angleX);
    const fov = 3.5;
    const R   = _getR();
    const cx  = _canvas.width  / 2;
    const cy  = _canvas.height / 2;

    for (const n of _nodes) {
      const xR = n.ox * cY + n.oz * sY;
      const zR = -n.ox * sY + n.oz * cY;
      const yR = n.oy * cX - zR * sX;
      const zF = n.oy * sX + zR * cX;
      const sc = fov / (fov + zF + 1.2);
      n.x = cx + xR * sc * R;
      n.y = cy + yR * sc * R * 0.92;
      n.z = zF;
    }
  }

  /* ─── Color helper ─────────────────────────────────────────── */
  let _curRGB = [0, 212, 255];
  function _c(a) {
    const [r, g, b] = _curRGB.map(v => Math.round(v));
    return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
  }
  function _cw(a) { return `rgba(255,255,255,${Math.min(1, Math.max(0, a)).toFixed(3)})`; }

  /* ─── Pulse helpers ────────────────────────────────────────── */
  function _spawnPulse() {
    if (!_edges.length) return;
    const e = _edges[Math.floor(Math.random() * _edges.length)];
    const rev = Math.random() > 0.5;
    const speeds = { idle: 0.012, scanning: 0.022, analyzing: 0.035, speaking: 0.028, error: 0.018 };
    _pulses.push({
      from: rev ? e[1] : e[0], to: rev ? e[0] : e[1],
      t: 0, speed: (speeds[_state] || 0.015) * (0.6 + Math.random() * 0.8),
      size: 2.0 + Math.random() * 2.0,
    });
  }

  function _spawnRing() {
    const R = _getR();
    const chances = { idle: 0.004, scanning: 0.018, analyzing: 0.030, speaking: 0.020, error: 0.010 };
    if (Math.random() < (chances[_state] || 0.006)) {
      _rings.push({ r: R * 0.15, maxR: R * (0.85 + Math.random() * 0.25), a: 0.5, speed: 0.012 + Math.random() * 0.01 });
    }
  }

  /* ─── Main draw loop ───────────────────────────────────────── */
  function _draw() {
    if (!_alive || !_canvas || !_ctx) return;

    const cfg = STATES[_state] || STATES.idle;

    // Lerp color
    const tgt = cfg.rgb;
    _curRGB = _curRGB.map((v, i) => lerp(v, tgt[i], 0.05));

    _rotate();
    _t++;

    const ctx = _ctx;
    const W = _canvas.width, H = _canvas.height;
    const cx = W / 2, cy = H / 2;
    const R  = _getR();

    ctx.clearRect(0, 0, W, H);

    const breathe = 0.80 + cfg.pulseAmp * Math.sin(_t * cfg.pulseFreq);

    // ── Outer atmosphere
    const atm = ctx.createRadialGradient(cx, cy, R * 0.3, cx, cy, R * 1.5);
    atm.addColorStop(0,   _c(0.14 * breathe));
    atm.addColorStop(0.5, _c(0.055 * breathe));
    atm.addColorStop(1,   _c(0));
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = atm; ctx.fill();

    // ── Sphere body
    const body = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 0, cx, cy, R);
    body.addColorStop(0,   _c(0.18 * breathe));
    body.addColorStop(0.5, _c(0.07 * breathe));
    body.addColorStop(1,   _c(0.01));
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = body; ctx.fill();

    // ── Rim stroke
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = _c(0.40 * breathe); ctx.lineWidth = 1.4; ctx.stroke();

    // ── Expanding rings
    _spawnRing();
    _rings = _rings.filter(ring => ring.r < ring.maxR);
    for (const ring of _rings) {
      const progress = ring.r / ring.maxR;
      ctx.beginPath(); ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = _c(ring.a * (1 - progress) * breathe);
      ctx.lineWidth = 0.8; ctx.stroke();
      ring.r += (ring.maxR - R * 0.15) * ring.speed;
      ring.a *= 0.976;
    }

    // ── Clip to sphere
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.6, 0, Math.PI * 2); ctx.clip();

    // ── Edges (z-sorted)
    const sortedEdges = _edges
      .map(([a, b]) => ({ a, b, z: (_nodes[a].z + _nodes[b].z) / 2 }))
      .sort((a, b) => a.z - b.z);
    for (const { a, b, z } of sortedEdges) {
      const na = _nodes[a], nb = _nodes[b];
      const depth = (z + 1) / 2;
      ctx.beginPath(); ctx.moveTo(na.x, na.y); ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = _c(0.025 + depth * 0.12);
      ctx.lineWidth = 0.4 + depth * 0.35; ctx.stroke();
    }

    // ── Pulses
    const spawnRates = { idle: 0.04, scanning: 0.18, analyzing: 0.35, speaking: 0.28, error: 0.10 };
    if (Math.random() < (spawnRates[_state] || 0.05)) _spawnPulse();
    for (const p of _pulses) {
      const na = _nodes[p.from], nb = _nodes[p.to];
      const px = na.x + (nb.x - na.x) * p.t;
      const py = na.y + (nb.y - na.y) * p.t;
      const zA = 0.4 + ((na.z + nb.z) / 2 + 1) / 2 * 0.55;
      const t0 = Math.max(0, p.t - 0.26);
      const tx0 = na.x + (nb.x - na.x) * t0, ty0 = na.y + (nb.y - na.y) * t0;
      const tGrad = ctx.createLinearGradient(tx0, ty0, px, py);
      tGrad.addColorStop(0, _c(0)); tGrad.addColorStop(1, _c(zA * 0.90));
      ctx.beginPath(); ctx.moveTo(tx0, ty0); ctx.lineTo(px, py);
      ctx.strokeStyle = tGrad; ctx.lineWidth = 1.4; ctx.stroke();
      const halo = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
      halo.addColorStop(0, _c(zA * 0.65)); halo.addColorStop(1, _c(0));
      ctx.beginPath(); ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
      const core = ctx.createRadialGradient(px, py, 0, px, py, p.size * 0.65);
      core.addColorStop(0, _cw(zA * 0.85)); core.addColorStop(1, _c(zA * 0.45));
      ctx.beginPath(); ctx.arc(px, py, p.size * 0.65, 0, Math.PI * 2);
      ctx.fillStyle = core; ctx.fill();
      p.t += p.speed;
    }
    _pulses = _pulses.filter(p => p.t < 1);

    // ── Nodes (z-sorted)
    const sortedNodes = [..._nodes].map((n, i) => ({ ...n, i })).sort((a, b) => a.z - b.z);
    for (const n of sortedNodes) {
      const depth = (n.z + 1) / 2;
      const pulse = 0.80 + 0.20 * Math.sin(_t * 0.038 + n.phase);
      const sz    = n.size * pulse * (0.35 + depth * 0.65);
      const al    = 0.20 + depth * 0.74;
      const halo  = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, sz * 5);
      halo.addColorStop(0, _c(al * 0.45)); halo.addColorStop(1, _c(0));
      ctx.beginPath(); ctx.arc(n.x, n.y, sz * 5, 0, Math.PI * 2);
      ctx.fillStyle = halo; ctx.fill();
      const core = ctx.createRadialGradient(n.x - sz * 0.3, n.y - sz * 0.3, 0, n.x, n.y, sz);
      core.addColorStop(0, _cw(Math.min(1, al * 0.8)));
      core.addColorStop(0.4, _c(al)); core.addColorStop(1, _c(al * 0.4));
      ctx.beginPath(); ctx.arc(n.x, n.y, sz, 0, Math.PI * 2);
      ctx.fillStyle = core; ctx.fill();
    }
    ctx.restore();

    // ── Rim glow
    const rimX = cx + R * 0.36, rimY = cy - R * 0.36;
    const rim = ctx.createRadialGradient(rimX, rimY, R * 0.5, cx, cy, R * 1.05);
    rim.addColorStop(0, _c(0)); rim.addColorStop(0.72, _c(0.16 * breathe));
    rim.addColorStop(0.9, _c(0.28 * breathe)); rim.addColorStop(1, _c(0));
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R * 1.05, 0, Math.PI * 2);
    ctx.fillStyle = rim; ctx.fill(); ctx.restore();

    // ── Specular
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const sh = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.30, 0, cx - R * 0.28, cy - R * 0.30, R * 0.44);
    sh.addColorStop(0, 'rgba(255,255,255,0.30)'); sh.addColorStop(0.4, 'rgba(255,255,255,0.08)');
    sh.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sh; ctx.fillRect(0, 0, W, H); ctx.restore();

    // ── Scanning state: rotating sweep line
    if (_state === 'scanning') {
      const sweep = (_t * 0.04) % (Math.PI * 2);
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
      const sweepGrad = ctx.createConicalGradient
        ? ctx.createConicalGradient(cx, cy, sweep)
        : null;
      if (!sweepGrad) {
        // Fallback: line from center
        const lx = cx + Math.cos(sweep) * R, ly = cy + Math.sin(sweep) * R;
        const lg = ctx.createLinearGradient(cx, cy, lx, ly);
        lg.addColorStop(0, _c(0.45)); lg.addColorStop(1, _c(0));
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(lx, ly);
        ctx.strokeStyle = lg; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.restore();
    }

    // ── Analyzing state: burst rings
    if (_state === 'analyzing' || _state === 'scanning') {
      const phase  = (_t * 0.055) % 1;
      const phase2 = ((_t * 0.055) + 0.45) % 1;
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.95 * phase, 0, Math.PI * 2);
      ctx.strokeStyle = _c(0.4 * (1 - phase) * breathe); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.95 * phase2, 0, Math.PI * 2);
      ctx.strokeStyle = _c(0.25 * (1 - phase2) * breathe); ctx.lineWidth = 0.8; ctx.stroke();
    }

    requestAnimationFrame(_draw);
  }

  /* ─── Public API ───────────────────────────────────────────── */
  window.VisionOrb = {
    init(canvas) {
      _canvas = canvas;
      _ctx    = canvas.getContext('2d');
      _alive  = true;
      _build();
      // seed initial pulses
      for (let i = 0; i < 3; i++) _spawnPulse();
      requestAnimationFrame(_draw);
    },

    setState(state) {
      if (!STATES[state]) return;
      _state = state;
      _pulses = [];
      _rings  = [];
      const bursts = { analyzing: 12, scanning: 8, speaking: 10, idle: 2, error: 6 };
      for (let i = 0; i < (bursts[state] || 4); i++) _spawnPulse();
      for (let i = 0; i < 3; i++) _spawnRing();
    },

    destroy() {
      _alive = false;
      if (_ctx && _canvas) _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
      _canvas = null; _ctx = null;
    },
  };
})();
