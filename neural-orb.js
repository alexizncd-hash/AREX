/* ═══════════════════════════════════════════════════════════════
   AREX — Neural Orb Engine
   Canvas 2D neural network sphere — Ultron/JARVIS brain style
   Interconnected nodes · Pulsing synapses · Reactive states
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
    this.alive  = true;
    this._rgb   = this._parseHex(color);
    this._build();
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
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  }

  _build() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.cx = w / 2;
    this.cy = h / 2;
    this.R  = Math.min(w, h) * 0.37;

    // Fibonacci spiral — even node distribution on sphere
    const N      = 26;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const tilt   = 0.38; // axis tilt (radians)

    for (let i = 0; i < N; i++) {
      const y3  = 1 - (i / (N - 1)) * 2;
      const r3  = Math.sqrt(Math.max(0, 1 - y3 * y3));
      const phi = i * golden;
      const x3  = Math.cos(phi) * r3;
      const z3  = Math.sin(phi) * r3;

      // Rotate around X by tilt angle
      const yT = y3 * Math.cos(tilt) - z3 * Math.sin(tilt);
      const zT = y3 * Math.sin(tilt) + z3 * Math.cos(tilt);

      this.nodes.push({
        x:     this.cx + x3 * this.R,
        y:     this.cy + yT * this.R * 0.85,
        z:     zT,                          // depth: -1 back, +1 front
        size:  1.6 + Math.random() * 1.8,
        phase: Math.random() * Math.PI * 2, // individual pulse phase
      });
    }

    // Connect nodes within radius threshold
    const thresh = this.R * 0.74;
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

  _spawnPulse() {
    if (!this.edges.length) return;
    const e    = this.edges[Math.floor(Math.random() * this.edges.length)];
    const rev  = Math.random() > 0.5;
    const base = { idle: 0.011, active: 0.018, thinking: 0.028, speaking: 0.038 };
    this.pulses.push({
      from:  rev ? e.b : e.a,
      to:    rev ? e.a : e.b,
      t:     0,
      speed: (base[this.state] || 0.013) * (0.65 + Math.random() * 0.7),
      size:  3.5 + Math.random() * 2.5,
    });
  }

  draw() {
    if (!this.alive) return;
    const { ctx, cx, cy, R, time } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // ── Breathing multiplier ─────────────────────────
    const breathRate = this.state === 'thinking' ? 0.065
                     : this.state === 'speaking'  ? 0.12
                     : 0.022;
    const breathe = 0.80 + 0.20 * Math.sin(time * breathRate);

    // ── Outer atmosphere glow ────────────────────────
    const atmGrad = ctx.createRadialGradient(cx, cy, R * 0.5, cx, cy, R * 1.4);
    atmGrad.addColorStop(0,   this._c(0.12 * breathe));
    atmGrad.addColorStop(0.5, this._c(0.055 * breathe));
    atmGrad.addColorStop(1,   this._c(0));
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.4, 0, Math.PI * 2);
    ctx.fillStyle = atmGrad;
    ctx.fill();

    // ── Sphere rim ───────────────────────────────────
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = this._c(0.32 * breathe);
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Inner dim fill to give sphere volume
    const fillGrad = ctx.createRadialGradient(cx - R * 0.2, cy - R * 0.2, 0, cx, cy, R);
    fillGrad.addColorStop(0,   this._c(0.09 * breathe));
    fillGrad.addColorStop(0.6, this._c(0.04 * breathe));
    fillGrad.addColorStop(1,   this._c(0.01));
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // ── Clip to sphere boundary ──────────────────────
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
    ctx.clip();

    // ── Sort edges by average depth ──────────────────
    const sortedEdges = this.edges
      .map(e => ({ ...e, z: (this.nodes[e.a].z + this.nodes[e.b].z) / 2 }))
      .sort((a, b) => a.z - b.z);

    // ── Draw edges (neural connections) ─────────────
    for (const e of sortedEdges) {
      const na = this.nodes[e.a];
      const nb = this.nodes[e.b];
      const depth = (e.z + 1) / 2;           // 0=back, 1=front
      const alpha = 0.035 + depth * 0.13;
      ctx.beginPath();
      ctx.moveTo(na.x, na.y);
      ctx.lineTo(nb.x, nb.y);
      ctx.strokeStyle = this._c(alpha);
      ctx.lineWidth = 0.55;
      ctx.stroke();
    }

    // ── Draw synapse pulses ──────────────────────────
    for (const p of this.pulses) {
      const na = this.nodes[p.from];
      const nb = this.nodes[p.to];
      const px = na.x + (nb.x - na.x) * p.t;
      const py = na.y + (nb.y - na.y) * p.t;
      const avgZ = (na.z + nb.z) / 2;
      const zAlpha = 0.45 + ((avgZ + 1) / 2) * 0.5;

      // Trail gradient from t0 to current
      const trailFrac = 0.22;
      const t0  = Math.max(0, p.t - trailFrac);
      const tx0 = na.x + (nb.x - na.x) * t0;
      const ty0 = na.y + (nb.y - na.y) * t0;

      const tGrad = ctx.createLinearGradient(tx0, ty0, px, py);
      tGrad.addColorStop(0, this._c(0));
      tGrad.addColorStop(1, this._c(zAlpha * 0.9));
      ctx.beginPath();
      ctx.moveTo(tx0, ty0);
      ctx.lineTo(px, py);
      ctx.strokeStyle = tGrad;
      ctx.lineWidth = 1.4;
      ctx.stroke();

      // Head glow
      const hGlow = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.2);
      hGlow.addColorStop(0, this._c(zAlpha));
      hGlow.addColorStop(0.45, this._c(zAlpha * 0.35));
      hGlow.addColorStop(1, this._c(0));
      ctx.beginPath();
      ctx.arc(px, py, p.size * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = hGlow;
      ctx.fill();

      // Head dot
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.55, 0, Math.PI * 2);
      ctx.fillStyle = this._c(zAlpha);
      ctx.fill();

      p.t += p.speed;
    }
    this.pulses = this.pulses.filter(p => p.t < 1);

    // ── Sort nodes back→front then draw ─────────────
    const sortedNodes = this.nodes
      .map((n, i) => ({ ...n, i }))
      .sort((a, b) => a.z - b.z);

    for (const n of sortedNodes) {
      const depth = (n.z + 1) / 2;
      const pulse = 0.80 + 0.20 * Math.sin(time * 0.04 + n.phase);
      const size  = n.size * pulse * (0.45 + depth * 0.55);
      const alpha = 0.25 + depth * 0.65;

      // Node ambient halo
      const nHalo = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, size * 4.5);
      nHalo.addColorStop(0, this._c(alpha * 0.55));
      nHalo.addColorStop(0.5, this._c(alpha * 0.12));
      nHalo.addColorStop(1, this._c(0));
      ctx.beginPath();
      ctx.arc(n.x, n.y, size * 4.5, 0, Math.PI * 2);
      ctx.fillStyle = nHalo;
      ctx.fill();

      // Node core
      ctx.beginPath();
      ctx.arc(n.x, n.y, size, 0, Math.PI * 2);
      ctx.fillStyle = this._c(alpha);
      ctx.fill();
    }

    ctx.restore(); // end sphere clip

    // ── Specular highlight (glass sphere look) ───────
    const shineX = cx - R * 0.28;
    const shineY = cy - R * 0.30;
    const shine  = ctx.createRadialGradient(shineX, shineY, 0, shineX, shineY, R * 0.54);
    shine.addColorStop(0, 'rgba(255,255,255,0.24)');
    shine.addColorStop(0.4, 'rgba(255,255,255,0.07)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // ── Activity burst ring (thinking / speaking) ────
    if (this.state === 'thinking' || this.state === 'speaking') {
      const bSpeed = this.state === 'speaking' ? 0.22 : 0.10;
      const bPhase = (time * bSpeed) % 1;
      const bR     = R * 0.9 * bPhase;
      const bA     = 0.4 * (1 - bPhase) * breathe;
      ctx.beginPath();
      ctx.arc(cx, cy, bR, 0, Math.PI * 2);
      ctx.strokeStyle = this._c(bA);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // ── Tick ─────────────────────────────────────────
    this.time++;

    const spawnRate = { idle: 0.038, active: 0.09, thinking: 0.26, speaking: 0.38 };
    if (Math.random() < (spawnRate[this.state] || 0.04)) this._spawnPulse();
  }

  setState(s) {
    this.state = s;
    // Burst of pulses for visual feedback
    const burst = { thinking: 8, speaking: 10, active: 5, idle: 2 };
    for (let i = 0; i < (burst[s] || 3); i++) this._spawnPulse();
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
  // Destroy existing orbs before re-init
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
