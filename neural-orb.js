/* ═══════════════════════════════════════════════════════════════
   AREX — Neural Orb Engine  v2
   Photorealistic holographic brain sphere — Iron Man / JARVIS style
   Layered sphere lighting · Rim glow · Volumetric pulses · Deep chromatics
   ═══════════════════════════════════════════════════════════════ */

class NeuralOrb {
  constructor(canvas, color, state = 'idle') {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.color  = color;
    this.state  = state;
    this.time   = Math.random() * 1000;
    this.nodes  = [];
    this.edges  = [];
    this.pulses = [];
    this.rings  = [];
    this.alive  = true;
    this.angleY    = Math.random() * Math.PI * 2;
    this.angleX    = 0.28;
    this._rotSpeed = 0.006 + Math.random() * 0.004;
    this._rgb   = this._parseHex(color);
    this._build();
    this._spawnInitialPulses();
  }

  _parseHex(hex) {
    hex = hex.replace('#', '');
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }

  _c(a) {
    const [r, g, b] = this._rgb;
    return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a)).toFixed(3)})`;
  }

  _cw(a) {
    return `rgba(255,255,255,${Math.min(1, Math.max(0, a)).toFixed(3)})`;
  }

  _build() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.cx = w / 2;
    this.cy = h / 2;
    this.R  = Math.min(w, h) * 0.38;

    const N      = 40;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const tilt   = 0.36;

    for (let i = 0; i < N; i++) {
      const y3  = 1 - (i / (N - 1)) * 2;
      const r3  = Math.sqrt(Math.max(0, 1 - y3 * y3));
      const phi = i * golden;
      const x3  = Math.cos(phi) * r3;
      const z3  = Math.sin(phi) * r3;

      const yT = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
      const zT = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);

      this.nodes.push({
        x:     this.cx + x3 * this.R,
        y:     this.cy + yT * this.R * 0.88,
        z:     zT,
        ox:    x3, oy: yT, oz: zT,
        size:  1.4 + Math.random() * 2.0,
        phase: Math.random() * Math.PI * 2,
      });
    }

    const thresh = this.R * 0.68;
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const dx = this.nodes[i].x - this.nodes[j].x;
        const dy = this.nodes[i].y - this.nodes[j].y;
        if (Math.sqrt(dx * dx + dy * dy) < thresh) {
          this.edges.push({ a: i, b: j });
        }
      }
    }
  }

  _spawnInitialPulses() {
    for (let i = 0; i < 4; i++) this._spawnPulse();
  }

  _spawnPulse() {
    if (!this.edges.length) return;
    const e    = this.edges[Math.floor(Math.random() * this.edges.length)];
    const rev  = Math.random() > 0.5;
    const base = { idle: 0.010, active: 0.016, thinking: 0.026, speaking: 0.036, scanning: 0.022 };
    this.pulses.push({
      from:  rev ? e.b : e.a,
      to:    rev ? e.a : e.b,
      t:     0,
      speed: (base[this.state] || 0.012) * (0.60 + Math.random() * 0.80),
      size:  3.0 + Math.random() * 3.0,
    });
  }

  _spawnRing() {
    const base = { idle: 0.003, active: 0.007, thinking: 0.016, speaking: 0.022, scanning: 0.012 };
    if (Math.random() < (base[this.state] || 0.004)) {
      this.rings.push({ r: this.R * 0.2, maxR: this.R * (0.88 + Math.random() * 0.25), a: 0.55, speed: 0.013 + Math.random() * 0.012 });
    }
  }

  _updatePositions() {
    const speedMult = { thinking: 2.4, speaking: 3.2, active: 1.6 }[this.state] || 1.0;
    this.angleY += this._rotSpeed * speedMult;
    // Gentle tilt wobble
    this.angleX = 0.28 + 0.08 * Math.sin(this.time * 0.008);

    const cY = Math.cos(this.angleY), sY = Math.sin(this.angleY);
    const cX = Math.cos(this.angleX), sX = Math.sin(this.angleX);
    const fov = 3.5;

    for (const n of this.nodes) {
      // Rotate around Y axis
      const xR = n.ox * cY + n.oz * sY;
      const zR = -n.ox * sY + n.oz * cY;
      // Rotate around X axis (tilt)
      const yR = n.oy * cX - zR * sX;
      const zF = n.oy * sX + zR * cX;
      // Perspective projection
      const sc = fov / (fov + zF + 1.2);
      n.x = this.cx + xR * sc * this.R;
      n.y = this.cy + yR * sc * this.R * 0.9;
      n.z = zF;
    }
  }

  draw() {
    if (!this.alive) return;
    this._updatePositions();
    const { ctx, cx, cy, R, time } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const breathRate = this.state === 'thinking' ? 0.058
                     : this.state === 'speaking'  ? 0.11
                     : 0.020;
    const breathe = 0.82 + 0.18 * Math.sin(time * breathRate);

    // ── Deep space ambient fog ────────────────────────
    const fogGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.9);
    fogGrad.addColorStop(0,   this._c(0.08 * breathe));
    fogGrad.addColorStop(0.4, this._c(0.038 * breathe));
    fogGrad.addColorStop(1,   this._c(0));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.9, 0, Math.PI * 2);
    ctx.fillStyle = fogGrad;
    ctx.fill();

    // ── Outer atmosphere — dual layer ────────────────
    const atm1 = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.42);
    atm1.addColorStop(0,   this._c(0.18 * breathe));
    atm1.addColorStop(0.55, this._c(0.065 * breathe));
    atm1.addColorStop(1,   this._c(0));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.42, 0, Math.PI * 2);
    ctx.fillStyle = atm1;
    ctx.fill();

    // ── Sphere body fill (volumetric) ─────────────────
    const bodyGrad = ctx.createRadialGradient(
      cx - R * 0.22, cy - R * 0.22, 0,
      cx, cy, R
    );
    bodyGrad.addColorStop(0,   this._c(0.16 * breathe));
    bodyGrad.addColorStop(0.45, this._c(0.07 * breathe));
    bodyGrad.addColorStop(0.8,  this._c(0.022 * breathe));
    bodyGrad.addColorStop(1,    this._c(0.005));
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // ── Sphere rim stroke ─────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = this._c(0.42 * breathe);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // ── Inner caustic ring (adds glass depth) ─────────
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2);
    ctx.strokeStyle = this._c(0.07 * breathe);
    ctx.lineWidth = 0.7;
    ctx.stroke();

    // ── Expanding activity rings ──────────────────────
    this._spawnRing();
    this.rings = this.rings.filter(ring => ring.r < ring.maxR);
    for (const ring of this.rings) {
      const progress = ring.r / ring.maxR;
      ctx.beginPath();
      ctx.arc(cx, cy, ring.r, 0, Math.PI * 2);
      ctx.strokeStyle = this._c(ring.a * (1 - progress) * breathe);
      ctx.lineWidth = 0.9;
      ctx.stroke();
      ring.r += (ring.maxR - R * 0.2) * ring.speed;
      ring.a *= 0.975;
    }

    // ── Clip to sphere ────────────────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.8, 0, Math.PI * 2);
    ctx.clip();

    // ── z-sorted edges ────────────────────────────────
    const sortedEdges = this.edges
      .map(e => ({ ...e, z: (this.nodes[e.a].z + this.nodes[e.b].z) / 2 }))
      .sort((a, b) => a.z - b.z);

    for (const e of sortedEdges) {
      const na = this.nodes[e.a];
      const nb = this.nodes[e.b];
      const depth = (e.z + 1) / 2;
      const alpha = 0.028 + depth * 0.14;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = this._c(alpha);
      ctx.lineWidth = 0.5 + depth * 0.4;
      ctx.stroke();
    }

    // ── Synapse pulses ────────────────────────────────
    for (const p of this.pulses) {
      const na = this.nodes[p.from];
      const nb = this.nodes[p.to];
      const px = na.x + (nb.x - na.x) * p.t;
      const py = na.y + (nb.y - na.y) * p.t;
      const avgZ = (na.z + nb.z) / 2;
      const zAlpha = 0.4 + ((avgZ + 1) / 2) * 0.55;

      const trailFrac = 0.28;
      const t0  = Math.max(0, p.t - trailFrac);
      const tx0 = na.x + (nb.x - na.x) * t0;
      const ty0 = na.y + (nb.y - na.y) * t0;

      // Trail
      const tGrad = ctx.createLinearGradient(tx0, ty0, px, py);
      tGrad.addColorStop(0, this._c(0));
      tGrad.addColorStop(0.5, this._c(zAlpha * 0.4));
      tGrad.addColorStop(1, this._c(zAlpha * 0.95));
      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(px, py);
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Outer halo
      const outerHalo = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.5);
      outerHalo.addColorStop(0, this._c(zAlpha * 0.7));
      outerHalo.addColorStop(0.35, this._c(zAlpha * 0.28));
      outerHalo.addColorStop(0.7, this._c(zAlpha * 0.08));
      outerHalo.addColorStop(1, this._c(0));
      ctx.beginPath();
      ctx.arc(px, py, p.size * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = outerHalo;
      ctx.fill();

      // Inner white-hot core
      const coreGrad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 0.7);
      coreGrad.addColorStop(0, this._cw(zAlpha * 0.9));
      coreGrad.addColorStop(1, this._c(zAlpha * 0.5));
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      p.t += p.speed;
    }
    this.pulses = this.pulses.filter(p => p.t < 1);

    // ── z-sorted nodes ────────────────────────────────
    const sortedNodes = this.nodes
      .map((n, i) => ({ ...n, i }))
      .sort((a, b) => a.z - b.z);

    for (const n of sortedNodes) {
      const depth = (n.z + 1) / 2;
      const pulse = 0.78 + 0.22 * Math.sin(time * 0.038 + n.phase);
      const size  = n.size * pulse * (0.4 + depth * 0.6);
      const alpha = 0.22 + depth * 0.72;

      // Node ambient halo (wide, soft)
      const nHalo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, size * 5.5);
      nHalo.addColorStop(0, this._c(alpha * 0.5));
      nHalo.addColorStop(0.35, this._c(alpha * 0.14));
      nHalo.addColorStop(1, this._c(0));
      ctx.beginPath();
      ctx.arc(n.x, n.y, size * 5.5, 0, Math.PI * 2);
      ctx.fillStyle = nHalo;
      ctx.fill();

      // Node core with white highlight center
      const nCore = ctx.createRadialGradient(n.x - size * 0.3, n.y - size * 0.3, 0, n.x, n.y, size);
      nCore.addColorStop(0, this._cw(Math.min(1, alpha * 0.85)));
      nCore.addColorStop(0.4, this._c(alpha));
      nCore.addColorStop(1, this._c(alpha * 0.5));
      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
      ctx.fillStyle = nCore;
      ctx.fill();
    }

    ctx.restore();

    // ── Rim lighting — edge glow on back side ─────────
    const rimX = cx + R * 0.38;
    const rimY = cy - R * 0.38;
    const rimGrad = ctx.createRadialGradient(rimX, rimY, R * 0.52, cx, cy, R * 1.06);
    rimGrad.addColorStop(0, this._c(0));
    rimGrad.addColorStop(0.72, this._c(0.18 * breathe));
    rimGrad.addColorStop(0.88, this._c(0.32 * breathe));
    rimGrad.addColorStop(1, this._c(0));
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.06, 0, Math.PI * 2);
    ctx.fillStyle = rimGrad;
    ctx.fill();
    ctx.restore();

    // ── Specular highlight (glossy glass sphere) ──────
    const shX = cx - R * 0.30;
    const shY = cy - R * 0.32;
    const shine1 = ctx.createRadialGradient(shX, shY, 0, shX, shY, R * 0.46);
    shine1.addColorStop(0, 'rgba(255,255,255,0.32)');
    shine1.addColorStop(0.38, 'rgba(255,255,255,0.10)');
    shine1.addColorStop(0.7, 'rgba(255,255,255,0.02)');
    shine1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = shine1;
    ctx.fillRect(0, 0, w, h);

    // Secondary micro-highlight
    const shX2 = cx + R * 0.22;
    const shY2 = cy + R * 0.30;
    const shine2 = ctx.createRadialGradient(shX2, shY2, 0, shX2, shY2, R * 0.18);
    shine2.addColorStop(0, 'rgba(255,255,255,0.09)');
    shine2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine2;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // ── Thinking / speaking burst rings ──────────────
    if (this.state === 'thinking' || this.state === 'speaking') {
      const bSpeed = this.state === 'speaking' ? 0.21 : 0.09;
      const bPhase = (time * bSpeed) % 1;
      const bR     = R * 0.95 * bPhase;
      const bA     = 0.45 * (1 - bPhase) * breathe;
      ctx.beginPath();
      ctx.arc(cx, cy, bR, 0, Math.PI * 2);
      ctx.strokeStyle = this._c(bA);
      ctx.lineWidth = 1.4;
      ctx.stroke();

      const bPhase2 = ((time * bSpeed) + 0.45) % 1;
      const bR2 = R * 0.95 * bPhase2;
      const bA2 = 0.28 * (1 - bPhase2) * breathe;
      ctx.beginPath();
      ctx.arc(cx, cy, bR2, 0, Math.PI * 2);
      ctx.strokeStyle = this._c(bA2);
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }

    // ── Tick ─────────────────────────────────────────
    this.time++;

    const spawnRate = { idle: 0.042, active: 0.10, thinking: 0.28, speaking: 0.40, scanning: 0.22 };
    if (Math.random() < (spawnRate[this.state] || 0.045)) this._spawnPulse();
  }

  setState(s) {
    this.state = s;
    const burst = { thinking: 10, speaking: 14, active: 6, idle: 2, scanning: 8 };
    for (let i = 0; i < (burst[s] || 3); i++) this._spawnPulse();
    for (let i = 0; i < 3; i++) this._spawnRing();
  }

  start() {
    const tick = () => {
      if (!this.alive) return;
      this.draw();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  destroy() {
    this.alive = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

/* ─── Global registry ───────────────────────────────── */
window._neuralOrbs = window._neuralOrbs || {};

window.initNeuralOrbs = function () {
  Object.values(window._neuralOrbs).forEach(o => o.destroy());
  window._neuralOrbs = {};

  document.querySelectorAll('canvas[data-neural-orb]').forEach(canvas => {
    const id    = canvas.dataset.neuralOrb;
    const color = canvas.dataset.color || '#00d4ff';
    const state = canvas.dataset.state  || 'idle';
    const orb   = new NeuralOrb(canvas, color, state);
    window._neuralOrbs[id] = orb;
    orb.start();
  });
};

window.setNeuralOrbState = function (id, state) {
  const orb = window._neuralOrbs[id];
  if (orb) orb.setState(state);
};
