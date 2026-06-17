/* reactor3d.js — Neural Reactor 3D (Three.js)
   Estados: calm | processing | listening | speaking
   Expone: window.arexReactorSetState(state)
*/
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const IS_MOBILE = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 768;

// ── Config por dispositivo ──────────────────────────
const CFG = {
  nodes:     IS_MOBILE ? 40  : 60,
  pulses:    IS_MOBILE ? 14  : 24,
  particles: IS_MOBILE ? 900 : 1800,
  pixelRatio: Math.min(window.devicePixelRatio, IS_MOBILE ? 1.5 : 2),
};

// ── State ───────────────────────────────────────────
let state      = 'calm';
let targetFps  = 30;
let lastFrame  = 0;
let animActive = true;
let rafId      = null;
let moduleActive = true;

const COLORS = {
  calm:       { primary: 0x22d3ee, secondary: 0xa98bff, ring: 0x22d3ee, speed: 1 },
  processing: { primary: 0x22d3ee, secondary: 0xffb84d, ring: 0x22d3ee, speed: 3 },
  listening:  { primary: 0x34ffc3, secondary: 0x22d3ee, ring: 0x34ffc3, speed: 2 },
  speaking:   { primary: 0x22d3ee, secondary: 0x34ffc3, ring: 0x22d3ee, speed: 2.5 },
};

// ── Init ────────────────────────────────────────────
function init() {
  const wrap = document.getElementById('reactor3d-wrap');
  if (!wrap) return;

  // WebGL check
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) { wrap.classList.add('hidden'); return; }
  } catch(e) { wrap.classList.add('hidden'); return; }

  const canvas = document.getElementById('reactor3d-canvas');
  if (!canvas) return;

  // ── Renderer ──
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !IS_MOBILE,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(CFG.pixelRatio);
  renderer.setSize(wrap.clientWidth, wrap.clientHeight, false);
  renderer.setClearColor(0x000000, 0);

  // ── Scene + Camera ──
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x01060d, 0.18);

  const camera = new THREE.PerspectiveCamera(60, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
  camera.position.set(0, 0, 4.5);

  // ── NEBULOSA: partículas bicolor ──
  const pGeo = new THREE.BufferGeometry();
  const pPos = new Float32Array(CFG.particles * 3);
  const pCol = new Float32Array(CFG.particles * 3);
  for (let i = 0; i < CFG.particles; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 1.5 + Math.random() * 3;
    pPos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pPos[i*3+2] = r * Math.cos(phi);
    // bicolor: cyan → violeta
    const t = Math.random();
    pCol[i*3]   = t < .5 ? 0.13 : 0.67;
    pCol[i*3+1] = t < .5 ? 0.83 : 0.55;
    pCol[i*3+2] = t < .5 ? 0.93 : 1.0;
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color',    new THREE.BufferAttribute(pCol, 3));
  const pMat  = new THREE.PointsMaterial({ size: 0.018, vertexColors: true, transparent: true, opacity: 0.55 });
  scene.add(new THREE.Points(pGeo, pMat));

  // ── NODOS: distribución fibonacci ──
  const nodePositions = [];
  const phi = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < CFG.nodes; i++) {
    const y = 1 - (i / (CFG.nodes - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const theta = phi * i;
    nodePositions.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
  }

  // LineSegments para conexiones
  const lineVerts = [];
  const connThresh = 0.62;
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      if (nodePositions[i].distanceTo(nodePositions[j]) < connThresh) {
        lineVerts.push(nodePositions[i].x, nodePositions[i].y, nodePositions[i].z);
        lineVerts.push(nodePositions[j].x, nodePositions[j].y, nodePositions[j].z);
      }
    }
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lineVerts), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.18 });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  // Esferas de nodos
  const nodeGeo = new THREE.SphereGeometry(0.022, 6, 6);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
  const nodeGroup = new THREE.Group();
  const nodeMeshes = nodePositions.map(pos => {
    const m = new THREE.Mesh(nodeGeo, nodeMat.clone());
    m.position.copy(pos);
    nodeGroup.add(m);
    return m;
  });
  scene.add(nodeGroup);

  // Núcleo central
  const coreGeo  = new THREE.SphereGeometry(0.18, 24, 24);
  const coreMat  = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 });
  const coreMesh = new THREE.Mesh(coreGeo, coreMat);
  scene.add(coreMesh);

  // Halo layers
  const haloGroup = new THREE.Group();
  [0.28, 0.38, 0.50, 0.65].forEach((r, i) => {
    const geo = new THREE.SphereGeometry(r, 20, 20);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.06 - i * 0.01,
      wireframe: true,
    });
    haloGroup.add(new THREE.Mesh(geo, mat));
  });
  scene.add(haloGroup);

  // ── 4 ANILLOS ──
  const rings = [];
  const ringDefs = [
    { r:1.1, tube:0.012, rot:new THREE.Euler(0,0,0),          speed:0.4 },
    { r:1.3, tube:0.010, rot:new THREE.Euler(Math.PI/2,0,0),   speed:-0.3 },
    { r:1.5, tube:0.008, rot:new THREE.Euler(0,Math.PI/4,0),   speed:0.25 },
    { r:1.7, tube:0.006, rot:new THREE.Euler(Math.PI/3,0,Math.PI/6), speed:-0.2 },
  ];
  const ringGroup = new THREE.Group();
  ringDefs.forEach(def => {
    const geo = new THREE.TorusGeometry(def.r, def.tube, 8, 80);
    const mat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.55 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.copy(def.rot);
    ringGroup.add(mesh);
    rings.push({ mesh, speed: def.speed, mat });
  });
  // Anillo segmentado: 30 cubos
  const cubeRingGroup = new THREE.Group();
  const cubeGeo = new THREE.BoxGeometry(0.04, 0.015, 0.015);
  const cubeMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.6 });
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    const c = new THREE.Mesh(cubeGeo, cubeMat.clone());
    c.position.set(Math.cos(angle) * 1.9, 0, Math.sin(angle) * 1.9);
    c.lookAt(0, 0, 0);
    cubeRingGroup.add(c);
  }
  ringGroup.add(cubeRingGroup);
  scene.add(ringGroup);

  // ── PULSOS SINÁPTICOS ──
  const pulseGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const pulseMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 });
  const connections = [];
  for (let k = 0; k < lineVerts.length; k += 6) {
    connections.push({
      a: new THREE.Vector3(lineVerts[k],   lineVerts[k+1], lineVerts[k+2]),
      b: new THREE.Vector3(lineVerts[k+3], lineVerts[k+4], lineVerts[k+5]),
    });
  }
  const pulseGroup = new THREE.Group();
  const pulses = [];
  for (let i = 0; i < CFG.pulses; i++) {
    const m = new THREE.Mesh(pulseGeo, pulseMat.clone());
    const conn = connections[Math.floor(Math.random() * connections.length)];
    pulses.push({ mesh: m, conn, t: Math.random(), speed: 0.008 + Math.random() * 0.012 });
    pulseGroup.add(m);
  }
  scene.add(pulseGroup);

  // ── GRID ──
  const gridHelper = new THREE.GridHelper(20, 30, 0x0a2535, 0x071520);
  gridHelper.position.y = -2.5;
  scene.add(gridHelper);

  // ── Camera float ──
  let camAngleX = 0, camAngleY = 0;
  let mouseX = 0, mouseY = 0;
  document.addEventListener('mousemove', e => {
    mouseX = (e.clientX / window.innerWidth  - 0.5) * 0.3;
    mouseY = (e.clientY / window.innerHeight - 0.5) * 0.2;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (e.touches[0]) {
      mouseX = (e.touches[0].clientX / window.innerWidth  - 0.5) * 0.15;
      mouseY = (e.touches[0].clientY / window.innerHeight - 0.5) * 0.1;
    }
  }, { passive: true });

  // ── Resize ──
  const resizeObs = new ResizeObserver(() => {
    const w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  });
  resizeObs.observe(wrap);

  // ── Animation loop ──
  let t = 0;
  function animate(now) {
    rafId = requestAnimationFrame(animate);
    if (!animActive || !moduleActive) return;

    const fpsInterval = 1000 / targetFps;
    if (now - lastFrame < fpsInterval) return;
    lastFrame = now;

    const col = COLORS[state] || COLORS.calm;
    const spd = col.speed;
    t += 0.016 * spd;

    // Camera float
    camAngleX += (mouseX - camAngleX) * 0.03;
    camAngleY += (mouseY - camAngleY) * 0.03;
    camera.position.x = Math.sin(t * 0.08 + camAngleX) * 0.4;
    camera.position.y = Math.sin(t * 0.06 + camAngleY) * 0.2;
    camera.lookAt(0, 0, 0);

    // Core pulse
    const pulse = 0.92 + Math.sin(t * 2.5) * 0.08;
    coreMesh.scale.setScalar(pulse);
    coreMat.color.setHex(col.primary);

    // Node pulse
    nodeMeshes.forEach((m, i) => {
      const s = 0.85 + Math.sin(t * 1.8 + i * 0.4) * 0.15;
      m.scale.setScalar(s);
      m.material.color.setHex(col.primary);
    });
    nodeMat.color.setHex(col.primary);
    lineMat.color.setHex(col.primary);

    // Rings
    rings.forEach(r => {
      r.mesh.rotation.y += 0.005 * r.speed * spd;
      r.mesh.rotation.z += 0.003 * r.speed * spd;
      r.mat.color.setHex(col.ring);
    });
    cubeRingGroup.rotation.y += 0.004 * spd;

    // Pulses
    pulses.forEach(p => {
      p.t += p.speed * spd;
      if (p.t >= 1) {
        p.t = 0;
        p.conn = connections[Math.floor(Math.random() * connections.length)];
      }
      p.mesh.position.lerpVectors(p.conn.a, p.conn.b, p.t);
      p.mesh.material.color.setHex(col.secondary);
    });

    nodeGroup.rotation.y += 0.001 * spd;
    haloGroup.rotation.y += 0.0008 * spd;
    haloGroup.rotation.x += 0.0005 * spd;

    renderer.render(scene, camera);
  }

  rafId = requestAnimationFrame(animate);

  // ── FPS adaptativo + pausas ──
  document.addEventListener('visibilitychange', () => {
    animActive = !document.hidden;
    targetFps = animActive ? (state === 'calm' ? 30 : 60) : 1;
  });

  // Escuchar cambio de módulo activo
  document.addEventListener('arex-module-change', e => {
    moduleActive = (e.detail?.module === 'inicio');
    targetFps = moduleActive ? (state === 'calm' ? 30 : 60) : 1;
  });

  // Reducir FPS en idle
  let idleTimer;
  const setIdleFps = () => {
    clearTimeout(idleTimer);
    if (moduleActive) targetFps = state === 'calm' ? 60 : 60;
    idleTimer = setTimeout(() => {
      if (moduleActive && state === 'calm') targetFps = 30;
    }, 3000);
  };
  document.addEventListener('pointermove', setIdleFps, { passive: true });
  document.addEventListener('keydown', setIdleFps);

  // ── API pública ──
  window.arexReactorSetState = function(newState) {
    if (!['calm','processing','listening','speaking'].includes(newState)) return;
    state = newState;
    targetFps = (newState === 'calm') ? 30 : 60;
  };

  // Cleanup
  window.addEventListener('beforeunload', () => {
    if (rafId) cancelAnimationFrame(rafId);
    resizeObs.disconnect();
    renderer.dispose();
  });
}

// Init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
