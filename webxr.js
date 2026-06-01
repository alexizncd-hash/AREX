// AREX — WebXR AR Panels (Fase 3)
// Three.js panels flotantes en passthrough del Meta Quest 3S
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* ─── Layout ──────────────────────────────────────────── */
const PW = 0.52, PH = 0.36;      // panel metros
const CW = 512,  CH = 352;       // canvas px
const EH = 1.42;                  // altura de ojo (local-floor)
const FD = 1.85;                  // distancia frontal

// 2×2 grid centrado frente al usuario
const PANEL_DEFS = [
  { id:'finanzas', label:'FINANZAS',  x:-0.30, y: 0.22 },
  { id:'tareas',   label:'TAREAS',    x: 0.30, y: 0.22 },
  { id:'metas',    label:'METAS',     x:-0.30, y:-0.20 },
  { id:'chat',     label:'AREX',      x: 0.30, y:-0.20 },
];

/* ─── State ───────────────────────────────────────────── */
let _renderer, _scene, _camera, _session;
let _panels      = [];
let _timer       = null;
let _grabbed     = null;
let _ctrls       = [];
let _panelHashes = {};  // smart cache: solo redibuja si los datos cambian

/* ─── Public ──────────────────────────────────────────── */
export async function enterAR() {
  if (!navigator.xr) {
    _activateArexCAM();
    return;
  }

  const ok = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false);
  if (!ok) {
    _activateArexCAM();
    return;
  }

  try {
    _session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['local-floor'],
      optionalFeatures: ['hand-tracking', 'anchors'],
    });
  } catch (e) {
    return _fb('No se pudo iniciar AR: ' + e.message);
  }

  await _initThree(_session);
  _buildPanels();
  _buildControllers();
  _session.addEventListener('end', _onEnd);
  _renderer.setAnimationLoop(_tick);
  _timer = setInterval(_refreshAll, 2500);
  _refreshAll();
  document.getElementById('btn-enter-ar')?.setAttribute('data-active', 'true');
}

export function exitAR() {
  _session?.end().catch(() => {});
}

window.enterAR = enterAR;
window.exitAR  = exitAR;

/* ─── Three.js Setup ──────────────────────────────────── */
async function _initThree(session) {
  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.xr.enabled = true;

  // Canvas overlay
  const wrap = document.createElement('div');
  wrap.id = 'ar-canvas-wrap';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;';
  wrap.appendChild(_renderer.domElement);
  document.body.appendChild(wrap);

  await _renderer.xr.setSession(session);

  _scene  = new THREE.Scene();
  _camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
  _scene.add(_camera);
  _scene.add(new THREE.AmbientLight(0x00d4ff, 0.06));
}

/* ─── Panels ──────────────────────────────────────────── */
function _buildPanels() {
  PANEL_DEFS.forEach(def => {
    const cvs      = document.createElement('canvas');
    cvs.width = CW; cvs.height = CH;
    const tex      = new THREE.CanvasTexture(cvs);
    const geo      = new THREE.PlaneGeometry(PW, PH);
    const mat      = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, depthWrite: false });
    const mesh     = new THREE.Mesh(geo, mat);
    mesh.position.set(def.x, EH + def.y, -FD);
    mesh.rotation.y = -def.x * 0.16;   // ligero ángulo hacia usuario

    // Borde luminoso (líneas)
    const bGeo = new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW + 0.01, PH + 0.01));
    const bMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.5 });
    const border = new THREE.LineSegments(bGeo, bMat);
    mesh.add(border);

    _scene.add(mesh);
    _panels.push({ def, mesh, canvas: cvs, texture: tex });
    _drawPanel({ def, canvas: cvs, texture: tex }, [['iniciando', '']]);
  });
}

/* ─── Controllers ─────────────────────────────────────── */
function _buildControllers() {
  for (let i = 0; i < 2; i++) {
    const ctrl = _renderer.xr.getController(i);
    ctrl.addEventListener('selectstart', () => _grabStart(ctrl));
    ctrl.addEventListener('selectend',   _grabEnd);
    _scene.add(ctrl);

    // Dot visual
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.007, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0x00d4ff })
    );
    ctrl.add(dot);
    _ctrls.push(ctrl);
  }
}

function _grabStart(ctrl) {
  for (const p of _panels) {
    if (ctrl.position.distanceTo(p.mesh.position) < 0.40) {
      _grabbed = { panel: p, ctrl, offset: p.mesh.position.clone().sub(ctrl.position) };
      return;
    }
  }
}
function _grabEnd() { _grabbed = null; }

/* ─── Render Loop ─────────────────────────────────────── */
function _tick() {
  if (_grabbed) {
    _grabbed.panel.mesh.position.copy(_grabbed.ctrl.position.clone().add(_grabbed.offset));
    _grabbed.panel.mesh.lookAt(_camera.position);
  }
  _renderer.render(_scene, _camera);
}

/* ─── Session End ─────────────────────────────────────── */
function _onEnd() {
  clearInterval(_timer); _timer = null;
  _renderer.setAnimationLoop(null);
  _renderer.dispose();
  document.getElementById('ar-canvas-wrap')?.remove();
  _session = null; _renderer = null; _scene = null;
  _panels = []; _ctrls = []; _grabbed = null; _panelHashes = {};
  document.getElementById('btn-enter-ar')?.removeAttribute('data-active');
}

/* ─── Data Refresh ────────────────────────────────────── */
function _refreshAll() {
  _panels.forEach(p => {
    const rows = _getData(p.def.id);
    const hash = JSON.stringify(rows);
    if (_panelHashes[p.def.id] === hash) return;  // sin cambios, no redibujar
    _panelHashes[p.def.id] = hash;
    _drawPanel(p, rows);
  });
}

const _fmt = n => `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

function _getData(id) {
  try {
    if (id === 'finanzas') {
      const rows = [];
      if (typeof window.getFinanzasData === 'function') {
        const d = window.getFinanzasData();
        rows.push(['Ingreso mensual',  _fmt(d.config?.ingresoMensual || 0)]);
        if (typeof window.calcularDeudaTotal === 'function') rows.push(['Deuda total',   _fmt(window.calcularDeudaTotal())]);
        if (typeof window.calcularMargen     === 'function') rows.push(['Margen libre',  _fmt(window.calcularMargen())]);
        if (typeof window.obtenerProximosPagos === 'function') {
          const p = window.obtenerProximosPagos(7);
          if (p.length) rows.push(['Próximo pago', `${p[0].tarjeta} — ${p[0].diasRestantes}d`]);
        }
      }
      return rows.length ? rows : [['Sin datos', 'Configura Finanzas']];
    }

    if (id === 'tareas') {
      if (typeof window.getTareas !== 'function') return [['Sin datos', '']];
      const hoy  = new Date().toISOString().slice(0, 10);
      const pend = window.getTareas().filter(t => !t.done);
      const urg  = pend.filter(t => t.fecha && t.fecha <= hoy);
      const src  = urg.length ? urg : pend;
      if (!src.length) return [['Estado', 'Todo al día ✓']];
      return src.slice(0, 5).map(t => [urg.includes(t) ? '⚠ URGENTE' : (t.fecha || 'pendiente'), t.text.slice(0, 30)]);
    }

    if (id === 'metas') {
      if (typeof window.getMetas !== 'function') return [['Sin datos', '']];
      const activas = window.getMetas().filter(m => !m.completada);
      if (!activas.length) return [['Sin metas activas', '']];
      return activas.slice(0, 5).map(m => [
        m.progreso != null ? `${m.progreso}%` : 'meta',
        m.titulo.slice(0, 30)
      ]);
    }

    if (id === 'chat') {
      const hist = typeof window._arexHistory === 'function' ? window._arexHistory() : [];
      if (!hist.length) return [['Listo', 'Di "AREX" + comando'], ['Tip', 'Modo AR activo en sidebar']];
      return hist.slice(-4).reverse().map(m => [
        m.role === 'user' ? 'TÚ' : 'AREX',
        m.content.replace(/\*\*/g, '').slice(0, 34)
      ]);
    }
  } catch (e) { console.warn('AREX WebXR _getData:', e); }
  return [['Error', 'Sin datos']];
}

/* ─── Canvas Drawing ──────────────────────────────────── */
const C = {
  bg:      'rgba(0,12,22,0.93)',
  border:  'rgba(0,212,255,0.72)',
  border2: 'rgba(0,212,255,0.16)',
  titleBg: 'rgba(0,212,255,0.09)',
  cyan:    '#00d4ff',
  white:   '#e0f4ff',
  muted:   '#4a7a96',
  green:   '#00ffaa',
  font:    '"Courier New", monospace',
};

function _drawPanel(panel, rows) {
  const { canvas, texture, def } = panel;
  const ctx = canvas.getContext('2d');
  const W = CW, H = CH;

  // Background
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = C.bg;
  _rr(ctx, 0, 0, W, H, 14); ctx.fill();

  // Outer border + glow
  ctx.save();
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 20;
  ctx.strokeStyle = C.border; ctx.lineWidth = 2;
  _rr(ctx, 1, 1, W-2, H-2, 14); ctx.stroke();
  ctx.restore();

  // Inner subtle border
  ctx.strokeStyle = C.border2; ctx.lineWidth = 1;
  _rr(ctx, 6, 6, W-12, H-12, 11); ctx.stroke();

  // Title bar bg
  ctx.fillStyle = C.titleBg;
  _rr(ctx, 2, 2, W-4, 44, 12, true); ctx.fill();

  // Title
  ctx.save();
  ctx.shadowColor = C.cyan; ctx.shadowBlur = 14;
  ctx.fillStyle = C.cyan;
  ctx.font = `bold 15px ${C.font}`;
  ctx.fillText(def.label, 18, 29);
  ctx.restore();

  // Live dot
  ctx.save();
  ctx.shadowColor = C.green; ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.arc(W - 22, 22, 5, 0, Math.PI * 2);
  ctx.fillStyle = C.green; ctx.fill();
  ctx.restore();

  // Corner accent lines
  const ac = 20;
  ctx.strokeStyle = 'rgba(0,212,255,0.35)'; ctx.lineWidth = 1.5;
  [[2, 2], [W-2, 2], [2, H-2], [W-2, H-2]].forEach(([cx, cy]) => {
    const sx = cx === 2 ? 1 : -1, sy = cy === 2 ? 1 : -1;
    ctx.beginPath(); ctx.moveTo(cx + sx*ac, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy*ac); ctx.stroke();
  });

  // Data rows
  const rowH    = Math.min(46, Math.floor((H - 58) / Math.max(rows.length, 1)));
  let y = 62;
  for (const [label, value] of rows) {
    // Divider
    ctx.strokeStyle = 'rgba(0,212,255,0.09)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(16, y - 4); ctx.lineTo(W - 16, y - 4); ctx.stroke();

    // Label
    ctx.fillStyle = C.muted;
    ctx.font = `9px ${C.font}`;
    ctx.fillText(label.toUpperCase().slice(0, 36), 16, y + 8);

    // Value
    ctx.save();
    ctx.shadowColor = 'rgba(224,244,255,0.35)'; ctx.shadowBlur = 4;
    ctx.fillStyle = C.white;
    ctx.font = `bold 13px ${C.font}`;
    ctx.fillText(value.slice(0, 36), 16, y + 26);
    ctx.restore();

    y += rowH;
    if (y > H - 14) break;
  }

  texture.needsUpdate = true;
}

// Rounded rect path
function _rr(ctx, x, y, w, h, r, topOnly = false) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
  if (!topOnly) {
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);     ctx.arcTo(x, y + h, x, y + h - r, r);
  } else {
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h);
  }
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ─── AREX Modo CAM AR (fallback para dispositivos no-Quest) ── */
async function _activateArexCAM() {
  if (typeof window.openVision === 'function') await window.openVision();

  setTimeout(() => {
    // Activar voz continua con wake word "AREX"
    if (typeof window.toggleContinuousMode === 'function' && !window._arexContModeActive) {
      window.toggleContinuousMode();
    }
    // Notificar al panel de visión que está en modo AR
    if (typeof window._setVisionArMode === 'function') window._setVisionArMode(true);

    _fb('**AREX Modo AR activado.**\n\n🎙 Voz activa — di **"AREX"** seguido de tu comando:\n\n**Cámara:**\n- *"AREX, qué ves"* — describe la escena\n- *"AREX, identifica esto"* — analiza objeto\n- *"AREX, lee esto"* — transcribe texto\n- *"AREX, analiza la escena"*\n- *"AREX, cierra la cámara"*\n\n**Sistema:**\n- *"AREX, mis tareas"* / *"mis finanzas"* / *"mis metas"*\n- *"AREX, silencio"* — detener voz\n\nCualquier otra frase se envía al chat como consulta.');
  }, 900);
}

/* ─── Fallback ────────────────────────────────────────── */
function _fb(msg) {
  if (typeof window.addMsg === 'function') window.addMsg('arex', `**Modo AR:** ${msg}`);
  else console.warn('AREX WebXR:', msg);
}
