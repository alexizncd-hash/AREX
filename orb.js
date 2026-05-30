/* ═══════════════════════════════════════════════════════════════
   AREX ORB — JARVIS-style 3D particle sphere
   Global script, no imports/exports needed.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const N          = 80;   // particle count
  const PHI        = (1 + Math.sqrt(5)) / 2;  // golden ratio
  const K_NEAR     = 5;    // K-nearest connections per particle
  const BASE_R_PCT = 0.42; // sphere radius as fraction of min(W,H)

  /* ── State configs ─────────────────────────────────────── */
  const CFG = {
    default:   { speed:0.004, rgb:[0,212,255],   alpha:0.70, sphereAmp:0,     sphereFreq:0,  pulseCore:0.06, coreAlpha:0.30 },
    speaking:  { speed:0.022, rgb:[200,240,255],  alpha:1.00, sphereAmp:0.05,  sphereFreq:18, pulseCore:0.18, coreAlpha:0.55 },
    thinking:  { speed:0.012, rgb:[0,160,255],    alpha:0.85, sphereAmp:0.02,  sphereFreq:6,  pulseCore:0.10, coreAlpha:0.40 },
    listening: { speed:0.005, rgb:[0,255,160],    alpha:0.80, sphereAmp:0.025, sphereFreq:4,  pulseCore:0.08, coreAlpha:0.35 },
    searching: { speed:0.018, rgb:[255,140,0],    alpha:0.90, sphereAmp:0.04,  sphereFreq:12, pulseCore:0.14, coreAlpha:0.45 },
  };

  let canvas, ctx;
  let points = [];      // {x,y,z} unit-sphere positions
  let edges  = [];      // [[i,j], ...]
  let angleY = 0, angleX = 0.35, angleZ = 0;
  let stateName = 'default';
  let t = 0;
  let curRGB = [0, 212, 255];
  let tgtRGB = [0, 212, 255];

  /* ── Geometry helpers ──────────────────────────────────── */
  function rotY(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x*c + p.z*s, y: p.y, z: -p.x*s + p.z*c };
  }
  function rotX(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x, y: p.y*c - p.z*s, z: p.y*s + p.z*c };
  }
  function rotZ(p, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return { x: p.x*c - p.y*s, y: p.x*s + p.y*c, z: p.z };
  }

  function project(p, W, H, sphereR) {
    const fov   = 3.5;
    const scale = fov / (fov + p.z);
    return {
      sx:    W/2 + p.x * scale * sphereR,
      sy:    H/2 + p.y * scale * sphereR,
      depth: (p.z + 1) / 2,   // 0 = back, 1 = front
    };
  }

  function lerp(a, b, k) { return a + (b - a) * k; }

  /* ── Initialise ────────────────────────────────────────── */
  function init() {
    const orbEl = document.getElementById('orb');
    if (!orbEl) return;

    // Replace .orb-core with canvas
    const core = orbEl.querySelector('.orb-core');
    if (core) core.remove();

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;border-radius:50%;';
    orbEl.style.overflow = 'hidden';
    orbEl.appendChild(canvas);
    ctx = canvas.getContext('2d');

    resizeCanvas();

    // Fibonacci sphere distribution
    for (let i = 0; i < N; i++) {
      const theta = Math.acos(1 - 2*(i + 0.5)/N);
      const phi   = 2*Math.PI * i / PHI;
      points.push({
        x: Math.sin(theta) * Math.cos(phi),
        y: Math.sin(theta) * Math.sin(phi),
        z: Math.cos(theta),
      });
    }

    // K-nearest-neighbor edges
    const edgeSet = new Set();
    for (let i = 0; i < N; i++) {
      const dists = points.map((q, j) => {
        if (i === j) return { j, d: 99 };
        const dx = points[i].x - q.x, dy = points[i].y - q.y, dz = points[i].z - q.z;
        return { j, d: Math.sqrt(dx*dx + dy*dy + dz*dz) };
      });
      dists.sort((a, b) => a.d - b.d);
      for (let k = 0; k < K_NEAR; k++) {
        const { j } = dists[k];
        const key = i < j ? `${i}_${j}` : `${j}_${i}`;
        edgeSet.add(key);
      }
    }
    edges = [...edgeSet].map(k => k.split('_').map(Number));

    // Watch state changes on #orb
    new MutationObserver(() => {
      const cl = orbEl.classList;
      if      (cl.contains('speaking'))  applyState('speaking');
      else if (cl.contains('thinking'))  applyState('thinking');
      else if (cl.contains('listening')) applyState('listening');
      else if (cl.contains('searching')) applyState('searching');
      else                               applyState('default');
    }).observe(orbEl, { attributes:true, attributeFilter:['class'] });

    // Resize when orb changes size (desktop ↔ mobile, orientation)
    if (window.ResizeObserver) {
      new ResizeObserver(resizeCanvas).observe(orbEl);
    }

    requestAnimationFrame(loop);
  }

  function applyState(s) {
    stateName = s;
    tgtRGB = [...(CFG[s] || CFG.default).rgb];
  }

  function resizeCanvas() {
    const orbEl = document.getElementById('orb');
    if (!orbEl || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w   = orbEl.offsetWidth;
    const h   = orbEl.offsetHeight;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ── Animation loop ────────────────────────────────────── */
  function loop() {
    requestAnimationFrame(loop);
    if (document.hidden) return; // pause when tab not visible
    t++;

    const cfg = CFG[stateName] || CFG.default;

    // Smooth RGB interpolation
    for (let i = 0; i < 3; i++) curRGB[i] = lerp(curRGB[i], tgtRGB[i], 0.04);
    const [cr, cg, cb] = curRGB.map(v => v | 0);

    const dpr = window.devicePixelRatio || 1;
    const W   = canvas.width  / dpr;
    const H   = canvas.height / dpr;
    const minD = Math.min(W, H);

    // Sphere radius — breathes with state
    const spherePulse = cfg.sphereAmp > 0
      ? cfg.sphereAmp * Math.sin(t * (cfg.sphereFreq / 60) * Math.PI * 2)
      : 0;
    const sphereR = minD * (BASE_R_PCT + spherePulse);

    // Rotation angles
    angleY += cfg.speed;
    if (stateName === 'thinking' || stateName === 'searching') {
      angleZ += cfg.speed * 0.5;           // slow Z swirl
      angleX  = 0.35 + 0.12 * Math.sin(t * 0.018);
    } else {
      angleZ = 0;
      angleX += (0.35 - angleX) * 0.015;  // return to default tilt
    }

    ctx.clearRect(0, 0, W, H);

    // Project all points after rotation
    const proj = points.map(p => {
      let q = rotY(p, angleY);
      q     = rotX(q, angleX);
      if (angleZ !== 0) q = rotZ(q, angleZ);
      return { ...project(q, W, H, sphereR) };
    });

    /* ── Draw edges (back to front) ────────────────────── */
    const sortedEdges = [...edges].sort((a, b) =>
      (proj[a[0]].depth + proj[a[1]].depth) - (proj[b[0]].depth + proj[b[1]].depth)
    );

    for (const [i, j] of sortedEdges) {
      const pi = proj[i], pj = proj[j];
      const d  = (pi.depth + pj.depth) * 0.5;
      const la = cfg.alpha * (0.06 + 0.22 * d * d);
      ctx.beginPath();
      ctx.moveTo(pi.sx, pi.sy);
      ctx.lineTo(pj.sx, pj.sy);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${la.toFixed(3)})`;
      ctx.lineWidth   = 0.4 + 0.5 * d;
      ctx.stroke();
    }

    /* ── Draw particles (back to front) ────────────────── */
    const order = [...proj.keys()].sort((a, b) => proj[a].depth - proj[b].depth);

    for (const i of order) {
      const { sx, sy, depth } = proj[i];
      const a      = cfg.alpha * (0.12 + 0.88 * depth * depth);
      const radius = (0.8 + 1.6 * depth) * (1 + spherePulse * 0.5);

      // Soft glow halo on front-facing particles
      if (depth > 0.6) {
        const glowR = radius * 4;
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${(a * 0.35).toFixed(3)})`);
        g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI*2);
        ctx.fillStyle = g;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(sx, sy, Math.max(radius, 0.4), 0, Math.PI*2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(a, 1).toFixed(3)})`;
      ctx.fill();
    }

    /* ── Central core glow ──────────────────────────────── */
    const cx     = W/2, cy = H/2;
    const pulse  = cfg.pulseCore * Math.sin(t * 0.09);
    const cAlpha = cfg.coreAlpha + pulse;
    const cR     = minD * (0.13 + Math.abs(spherePulse) * 0.5);

    const gCore = ctx.createRadialGradient(cx, cy, 0, cx, cy, cR);
    gCore.addColorStop(0,   `rgba(${cr},${cg},${cb},${cAlpha.toFixed(3)})`);
    gCore.addColorStop(0.35,`rgba(${cr},${cg},${cb},${(cAlpha * 0.4).toFixed(3)})`);
    gCore.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, cR, 0, Math.PI*2);
    ctx.fillStyle = gCore;
    ctx.fill();
  }

  /* ── Boot ───────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
