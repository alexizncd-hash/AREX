/* ═══════════════════════════════════════════════════════════════
   AREX ORB MARK IV — Neural Mesh
   Canvas 2D · Fibonacci sphere · K-nearest edges · Particle cloud
   States: default / speaking / thinking / listening / searching
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─── State configs ──────────────────────────────────────── */
  const CFG = {
    default:   { speed:0.004, rgb:[0,210,255],   alpha:0.78, sparks:55,  sSpeed:0.9, bAmp:0.04, cAlpha:0.28 },
    speaking:  { speed:0.022, rgb:[180,240,255], alpha:1.00, sparks:140, sSpeed:2.4, bAmp:0.13, cAlpha:0.58 },
    thinking:  { speed:0.012, rgb:[0,160,255],   alpha:0.88, sparks:100, sSpeed:1.6, bAmp:0.08, cAlpha:0.42 },
    listening: { speed:0.005, rgb:[0,255,160],   alpha:0.82, sparks:65,  sSpeed:1.1, bAmp:0.05, cAlpha:0.34 },
    searching: { speed:0.018, rgb:[255,140,0],   alpha:0.90, sparks:115, sSpeed:2.0, bAmp:0.10, cAlpha:0.46 },
  };

  const NODES = 100;         // mesh vertices
  const K_NEAR = 5;          // nearest-neighbor edges per node
  const PHI = (1 + Math.sqrt(5)) / 2;
  const MAX_SPARKS = 160;
  const lerp = (a, b, k) => a + (b - a) * k;

  /* ─── Build Fibonacci sphere ─────────────────────────────── */
  function buildSphere() {
    const nodes = [];
    for (let i = 0; i < NODES; i++) {
      const theta = Math.acos(1 - 2 * (i + 0.5) / NODES);
      const phi   = 2 * Math.PI * i / PHI;
      nodes.push({
        x:  Math.sin(theta) * Math.cos(phi),
        y:  Math.sin(theta) * Math.sin(phi),
        z:  Math.cos(theta),
        ph: Math.random() * Math.PI * 2,   // breath phase
        sz: 0.6 + Math.random() * 0.9,     // dot size
      });
    }

    // K-nearest edges
    const edges = [], seen = new Set();
    for (let i = 0; i < NODES; i++) {
      const dists = nodes.map((q, j) => {
        if (i === j) return { j, d: 99 };
        const dx = nodes[i].x - q.x, dy = nodes[i].y - q.y, dz = nodes[i].z - q.z;
        return { j, d: Math.sqrt(dx*dx + dy*dy + dz*dz) };
      }).sort((a, b) => a.d - b.d);

      for (let k = 0; k < K_NEAR; k++) {
        const key = Math.min(i, dists[k].j) + '_' + Math.max(i, dists[k].j);
        if (!seen.has(key)) { seen.add(key); edges.push([i, dists[k].j]); }
      }
    }
    return { nodes, edges };
  }

  /* ─── 3D rotation helpers ────────────────────────────────── */
  const rY = (p, a) => { const c=Math.cos(a), s=Math.sin(a); return {x:p.x*c+p.z*s, y:p.y,    z:-p.x*s+p.z*c}; };
  const rX = (p, a) => { const c=Math.cos(a), s=Math.sin(a); return {x:p.x,         y:p.y*c-p.z*s, z:p.y*s+p.z*c}; };

  function proj(p, W, H, R) {
    const fov = 3.5, sc = fov / (fov + p.z);
    return { sx: W/2 + p.x*sc*R, sy: H/2 + p.y*sc*R, depth: (p.z + 1) / 2 };
  }

  /* ─── Spark factory ──────────────────────────────────────── */
  function mkSpark() {
    const t = Math.acos(2 * Math.random() - 1);
    const p = Math.random() * Math.PI * 2;
    const r = 0.78 + Math.random() * 0.35;
    const x = Math.sin(t) * Math.cos(p) * r;
    const y = Math.sin(t) * Math.sin(p) * r;
    const z = Math.cos(t) * r;
    const spd = 0.0018 + Math.random() * 0.005;
    return {
      x, y, z,
      vx: x * spd,
      vy: y * spd - 0.0014,   // slight upward drift
      vz: z * spd,
      life: 0,
      maxLife: 65 + Math.random() * 95,
      sz: 0.35 + Math.random() * 1.4,
    };
  }

  /* ─── Main init ──────────────────────────────────────────── */
  function init() {
    const el = document.getElementById('orb');
    if (!el) return;

    // Remove legacy inner elements
    el.querySelector('.orb-core')?.remove();
    el.querySelector('canvas')?.remove();

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);pointer-events:none;';
    el.style.overflow = 'visible';
    el.appendChild(cv);

    const ctx = cv.getContext('2d');
    const { nodes, edges } = buildSphere();
    const sparks = Array.from({ length: MAX_SPARKS }, mkSpark);

    let aY = 0, aX = 0.35, tick = 0, state = 'default';
    let cRGB = [0, 210, 255], tRGB = [0, 210, 255];

    // Watch orb element class for state changes
    new MutationObserver(() => {
      const cl = el.classList;
      state = cl.contains('speaking')  ? 'speaking'  :
              cl.contains('thinking')  ? 'thinking'  :
              cl.contains('listening') ? 'listening' :
              cl.contains('searching') ? 'searching' : 'default';
      tRGB = [...(CFG[state] || CFG.default).rgb];
    }).observe(el, { attributes: true, attributeFilter: ['class'] });

    function resize() {
      const dpr = devicePixelRatio || 1;
      const w   = el.offsetWidth  || 120;
      const h   = el.offsetHeight || 120;
      // Canvas is 2.8× the orb element — particle cloud overflows
      const cw = w * 2.8, ch = h * 2.8;
      cv.width  = cw * dpr;
      cv.height = ch * dpr;
      cv.style.width  = cw + 'px';
      cv.style.height = ch + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.ResizeObserver && new ResizeObserver(resize).observe(el);

    function loop() {
      requestAnimationFrame(loop);
      if (document.hidden || window._orbPaused || window._arexVisionOpen || !el.offsetWidth) return;
      tick++;

      const cfg = CFG[state] || CFG.default;
      for (let i = 0; i < 3; i++) cRGB[i] = lerp(cRGB[i], tRGB[i], 0.04);
      const [cr, cg, cb] = cRGB.map(v => v | 0);

      aY += cfg.speed;
      if (state === 'thinking' || state === 'searching')
        aX = 0.35 + 0.12 * Math.sin(tick * 0.018);
      else
        aX += (0.35 - aX) * 0.015;

      const dpr = devicePixelRatio || 1;
      const W = cv.width / dpr, H = cv.height / dpr;
      const R = Math.min(W, H) * 0.215;   // sphere radius in px

      ctx.clearRect(0, 0, W, H);

      /* ── Project nodes with breathing ─────────────────── */
      const pp = nodes.map(n => {
        const b = cfg.bAmp * Math.sin(tick * 0.03 + n.ph);
        let p = { x: n.x * (1 + b), y: n.y * (1 + b), z: n.z * (1 + b) };
        p = rY(p, aY);
        p = rX(p, aX);
        return proj(p, W, H, R);
      });

      /* ── Edges (back → front) ──────────────────────────── */
      [...edges]
        .sort((a, b) => (pp[a[0]].depth + pp[a[1]].depth) - (pp[b[0]].depth + pp[b[1]].depth))
        .forEach(([i, j]) => {
          const pi = pp[i], pj = pp[j];
          const d  = (pi.depth + pj.depth) * 0.5;
          const al = cfg.alpha * (0.05 + 0.26 * d * d);
          ctx.beginPath();
          ctx.moveTo(pi.sx, pi.sy);
          ctx.lineTo(pj.sx, pj.sy);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${al.toFixed(3)})`;
          ctx.lineWidth   = 0.3 + 0.65 * d;
          ctx.stroke();
        });

      /* ── Nodes (back → front) ──────────────────────────── */
      [...pp.keys()]
        .sort((a, b) => pp[a].depth - pp[b].depth)
        .forEach(i => {
          const { sx, sy, depth } = pp[i];
          const n = nodes[i];
          const a = cfg.alpha * (0.1 + 0.9 * depth * depth);
          const r = Math.max(n.sz * 0.5 + 1.4 * depth, 0.4);

          // Soft glow halo
          if (depth > 0.4) {
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 5);
            g.addColorStop(0, `rgba(${cr},${cg},${cb},${(a * 0.28).toFixed(3)})`);
            g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
            ctx.beginPath();
            ctx.arc(sx, sy, r * 5, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }

          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${cr},${cg},${cb},${Math.min(a, 1).toFixed(3)})`;
          ctx.fill();
        });

      /* ── Sparks — world-space particle cloud ───────────── */
      for (let i = 0; i < MAX_SPARKS; i++) {
        const s = sparks[i];
        if (i >= cfg.sparks) { s.life = s.maxLife; continue; }

        s.life++;
        s.x += s.vx * cfg.sSpeed;
        s.y += s.vy * cfg.sSpeed;
        s.z += s.vz * cfg.sSpeed;

        if (s.life >= s.maxLife) { sparks[i] = mkSpark(); continue; }

        // Project spark without mesh rotation (world-space)
        const fov = 3.5, sc = fov / (fov + s.z * 0.5);
        const sx = W / 2 + s.x * sc * R;
        const sy = H / 2 + s.y * sc * R;

        const lr = s.life / s.maxLife;
        const al = Math.sin(lr * Math.PI) * cfg.alpha * 0.62;
        if (al < 0.02) continue;

        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(s.sz * (0.4 + 0.6 * lr), 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${al.toFixed(3)})`;
        ctx.fill();
      }

      /* ── Core glow ─────────────────────────────────────── */
      const cX = W / 2, cY = H / 2;
      const cA = cfg.cAlpha + 0.06 * Math.sin(tick * 0.09);
      const cR = R * 0.52;
      const gc = ctx.createRadialGradient(cX, cY, 0, cX, cY, cR * 1.8);
      gc.addColorStop(0,   `rgba(${cr},${cg},${cb},${cA.toFixed(3)})`);
      gc.addColorStop(0.4, `rgba(${cr},${cg},${cb},${(cA * 0.38).toFixed(3)})`);
      gc.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath();
      ctx.arc(cX, cY, cR * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = gc;
      ctx.fill();
    }

    loop();
  }

  document.addEventListener('visibilitychange', () => { window._orbPaused = document.hidden; });
  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();
})();
