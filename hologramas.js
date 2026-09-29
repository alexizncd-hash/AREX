// AREX — Hologramas 3D (Fase 3.5)
// Objetos volumétricos que flotan en tu espacio real junto a los paneles AR.
//
// Por qué es un archivo aparte: webxr.js carga Three.js bajo demanda y este
// módulo se importa DESPUÉS, también bajo demanda. Si algo aquí falla, los
// paneles AR siguen funcionando; solo faltan los hologramas.
//
// No importa Three.js por su cuenta: lo recibe de webxr.js para que haya una
// sola copia del motor en memoria.
//
// Tres hologramas, a altura de mesa (≈1 m), entre tú y los paneles:
//   · NÚCLEO   — el reactor de AREX proyectado desde una base de luz
//   · VENTAS   — barras 3D de las ventas del negocio, últimos 7 días
//   · METAS    — anillos de progreso concéntricos, uno por meta activa
// Los tres se agarran con el gatillo (o pellizco con la mano) y se mueven.

const CYAN  = 0x00d4ff;
const GREEN = 0x00ffaa;
const ORANGE = 0xff9900;

/* ─── Utilidades ─────────────────────────────────────── */
function _lsJSON(key, def) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? def; } catch { return def; }
}
function _dia(d) {
  if (typeof window.dia === 'function') return window.dia(d);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const _fmt = n => `$${Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`;

/* ─── Datos ──────────────────────────────────────────── */
/** Ventas del negocio por día, últimos 7 días (hoy al final). Hora local. */
export function ventasUltimos7() {
  const neg    = _lsJSON('arex_negocio', {});
  const ventas = Array.isArray(neg?.ventas) ? neg.ventas : [];
  const dias   = [];
  const hoy    = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i);
    dias.push({ fecha: _dia(d), letra: 'DLMMJVS'[d.getDay()], total: 0 });
  }
  const idx = Object.fromEntries(dias.map((d, i) => [d.fecha, i]));
  for (const v of ventas) {
    const i = idx[v?.fecha];
    if (i != null) dias[i].total += Number(v.total) || 0;
  }
  return dias;
}

/** Metas activas con su % real (valorActual / valorObjetivo), máx. 4. */
export function metasActivas() {
  const metas = _lsJSON('arex_metas', []);
  return (Array.isArray(metas) ? metas : [])
    .filter(m => m && !m.completada)
    .slice(0, 4)
    .map(m => ({
      titulo: String(m.titulo || 'Meta'),
      pct: m.valorObjetivo > 0 ? Math.min(100, Math.max(0, Math.round((m.valorActual / m.valorObjetivo) * 100))) : 0,
    }));
}

/* ─── Constructor principal ──────────────────────────── */
/**
 * @param THREE  el módulo de Three.js ya cargado
 * @param scene  la escena de webxr.js
 * @param eyeH   altura de ojo (local-floor)
 * @returns { targets, tick(t), refresh(), dispose() }
 */
export function crearHologramas(THREE, scene, eyeH = 1.42) {
  const mesaY = eyeH - 0.45;             // ≈ altura de mesa
  const disposables = [];
  const track = o => { disposables.push(o); return o; };

  // Material "holograma": aditivo, sin escribir profundidad → brilla sobre el passthrough
  const holoMat = (color, opacity) => track(new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending,
    depthWrite: false, side: THREE.DoubleSide,
  }));
  const lineMat = (color, opacity) => track(new THREE.LineBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false,
  }));

  /* Etiqueta de texto como sprite (siempre mira hacia ti) */
  function etiqueta(texto, { size = 0.05, color = '#00d4ff', ancho = 512 } = {}) {
    const cvs = document.createElement('canvas');
    cvs.width = ancho; cvs.height = 96;
    const tex = track(new THREE.CanvasTexture(cvs));
    const mat = track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const spr = new THREE.Sprite(mat);
    spr.scale.set(size * ancho / 96, size, 1);
    spr.userData.set = (t, c = color) => {
      const ctx = cvs.getContext('2d');
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      let px = 54;   // encoge la fuente hasta que el texto quepa en el lienzo
      do { ctx.font = `bold ${px}px "Courier New", monospace`; px -= 4; }
      while (px > 20 && ctx.measureText(String(t)).width > cvs.width - 24);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = c; ctx.shadowBlur = 18;
      ctx.fillStyle = c;
      ctx.fillText(String(t), cvs.width / 2, cvs.height / 2);
      tex.needsUpdate = true;
    };
    spr.userData.set(texto);
    return spr;
  }

  /* Base de proyector: disco + anillos + cono de luz hacia arriba */
  function proyector(radio, altura) {
    const g = new THREE.Group();
    const disco = new THREE.Mesh(track(new THREE.CircleGeometry(radio, 48)), holoMat(CYAN, 0.10));
    disco.rotation.x = -Math.PI / 2;
    g.add(disco);
    for (const [r, o] of [[radio, 0.8], [radio * 0.7, 0.4]]) {
      const anillo = new THREE.Mesh(track(new THREE.RingGeometry(r - 0.004, r, 64)), holoMat(CYAN, o));
      anillo.rotation.x = -Math.PI / 2;
      g.add(anillo);
    }
    // Cono abierto, se desvanece hacia arriba (degradado en los colores de vértice)
    const conoGeo = track(new THREE.CylinderGeometry(radio * 1.15, radio * 0.9, altura, 48, 8, true));
    const pos = conoGeo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const k = 1 - (pos.getY(i) + altura / 2) / altura;   // 1 abajo → 0 arriba
      cols[i * 3] = 0; cols[i * 3 + 1] = 0.83 * k; cols[i * 3 + 2] = k;
    }
    conoGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const conoMat = track(new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.22,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }));
    const cono = new THREE.Mesh(conoGeo, conoMat);
    cono.position.y = altura / 2;
    g.add(cono);
    g.userData.cono = conoMat;
    return g;
  }

  /* ── 1 · NÚCLEO AREX ─────────────────────────────── */
  const nucleo = new THREE.Group();
  nucleo.name = 'holo-nucleo';
  nucleo.position.set(0, mesaY, -1.25);
  const baseN = proyector(0.13, 0.30);
  nucleo.add(baseN);

  const core = new THREE.Group();
  core.position.y = 0.34;
  nucleo.add(core);

  const ico = new THREE.LineSegments(
    track(new THREE.EdgesGeometry(track(new THREE.IcosahedronGeometry(0.085, 1)))),
    lineMat(CYAN, 0.9));
  core.add(ico);
  const esfera = new THREE.Mesh(track(new THREE.SphereGeometry(0.045, 24, 16)), holoMat(CYAN, 0.35));
  core.add(esfera);

  const anillos = [];
  [[0.13, 0], [0.155, Math.PI / 3], [0.18, -Math.PI / 4]].forEach(([r, tilt], i) => {
    const a = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.0022, 6, 96)), holoMat(i === 1 ? GREEN : CYAN, 0.7));
    a.rotation.x = Math.PI / 2 + tilt;
    core.add(a);
    anillos.push(a);
  });

  // Partículas orbitando
  const N = 180;
  const pts = new Float32Array(N * 3);
  const semillas = [];
  for (let i = 0; i < N; i++) {
    semillas.push({ r: 0.1 + Math.random() * 0.14, a: Math.random() * Math.PI * 2, y: (Math.random() - 0.5) * 0.22, v: 0.3 + Math.random() * 0.9 });
  }
  const ptsGeo = track(new THREE.BufferGeometry());
  ptsGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  const particulas = new THREE.Points(ptsGeo, track(new THREE.PointsMaterial({
    color: CYAN, size: 0.004, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  core.add(particulas);

  const lblN = etiqueta('A.R.E.X', { size: 0.035 });
  lblN.position.y = 0.60;
  nucleo.add(lblN);
  scene.add(nucleo);

  /* ── 2 · VENTAS 7 DÍAS (barras 3D) ──────────────── */
  const ventasG = new THREE.Group();
  ventasG.name = 'holo-ventas';
  ventasG.position.set(0.62, mesaY, -1.15);
  ventasG.rotation.y = -0.45;           // girada hacia ti
  ventasG.add(proyector(0.20, 0.04));

  const BAR_W = 0.034, BAR_GAP = 0.018, BAR_MAX = 0.28;
  const x0 = -((7 * BAR_W + 6 * BAR_GAP) / 2) + BAR_W / 2;
  const barGeo = track(new THREE.BoxGeometry(BAR_W, 1, BAR_W));
  barGeo.translate(0, 0.5, 0);          // crece desde la base
  const barEdges = track(new THREE.EdgesGeometry(barGeo));
  const barras = [];
  for (let i = 0; i < 7; i++) {
    const hoyBar = i === 6;
    const cuerpo = new THREE.Mesh(barGeo, holoMat(hoyBar ? GREEN : CYAN, 0.28));
    const borde  = new THREE.LineSegments(barEdges, lineMat(hoyBar ? GREEN : CYAN, 0.9));
    const col = new THREE.Group();
    col.add(cuerpo, borde);
    col.position.set(x0 + i * (BAR_W + BAR_GAP), 0.01, 0);
    col.scale.y = 0.001;
    ventasG.add(col);
    const letra = etiqueta('-', { size: 0.03, color: hoyBar ? '#00ffaa' : '#4a7a96', ancho: 96 });
    letra.position.set(col.position.x, -0.02, 0.05);
    ventasG.add(letra);
    barras.push({ col, letra, objetivo: 0.001 });
  }
  const lblV  = etiqueta('VENTAS 7D', { size: 0.028 });
  lblV.position.y = BAR_MAX + 0.10;
  const lblVt = etiqueta('$0', { size: 0.034, color: '#e0f4ff' });
  lblVt.position.y = BAR_MAX + 0.06;
  ventasG.add(lblV, lblVt);
  scene.add(ventasG);

  /* ── 3 · METAS (anillos de progreso) ─────────────── */
  const metasG = new THREE.Group();
  metasG.name = 'holo-metas';
  metasG.position.set(-0.62, mesaY, -1.15);
  metasG.rotation.y = 0.45;
  metasG.add(proyector(0.20, 0.04));

  const giro = new THREE.Group();
  giro.position.y = 0.22;
  metasG.add(giro);
  const radiosM = [0.17, 0.135, 0.10, 0.065];
  const anillosM = radiosM.map(r => {
    const fondo = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.0018, 6, 96)), holoMat(CYAN, 0.12));
    giro.add(fondo);
    return { r, fondo, arco: null };
  });
  const lblM  = etiqueta('METAS', { size: 0.028 });
  lblM.position.y = 0.46;
  const lblMd = etiqueta('', { size: 0.024, color: '#e0f4ff' });
  lblMd.position.y = 0.42;
  metasG.add(lblM, lblMd);
  scene.add(metasG);

  /* ─── Actualizar con datos reales ─────────────────── */
  let _hash = '';
  function refresh() {
    const dias  = ventasUltimos7();
    const metas = metasActivas();
    const h = JSON.stringify([dias, metas]);
    if (h === _hash) return;
    _hash = h;

    const max = Math.max(...dias.map(d => d.total), 1);
    const semana = dias.reduce((s, d) => s + d.total, 0);
    dias.forEach((d, i) => {
      barras[i].objetivo = d.total > 0 ? Math.max(0.012, (d.total / max) * BAR_MAX) : 0.001;
      barras[i].letra.userData.set(d.letra);
    });
    lblVt.userData.set(semana > 0 ? _fmt(semana) : 'SIN VENTAS', semana > 0 ? '#e0f4ff' : '#4a7a96');

    anillosM.forEach((a, i) => {
      if (a.arco) { giro.remove(a.arco); a.arco.geometry.dispose(); a.arco = null; }
      const m = metas[i];
      a.fondo.visible = !!m;
      if (!m || m.pct <= 0) return;
      const color = m.pct >= 100 ? GREEN : (m.pct < 25 ? ORANGE : CYAN);
      const geo = new THREE.TorusGeometry(a.r, 0.006, 8, 96, (m.pct / 100) * Math.PI * 2);
      a.arco = new THREE.Mesh(geo, holoMat(color, 0.85));
      a.arco.rotation.z = Math.PI / 2;   // arranca arriba
      giro.add(a.arco);
    });
    lblMd.userData.set(metas.length
      ? metas.map(m => `${m.pct}%`).join(' · ')
      : 'SIN METAS ACTIVAS', metas.length ? '#e0f4ff' : '#4a7a96');
  }

  /* ─── Animación (llamar cada frame, t en segundos) ── */
  function tick(t) {
    // Núcleo: gira, respira y parpadea como holograma
    core.rotation.y = t * 0.5;
    ico.rotation.x = t * 0.3;
    anillos[0].rotation.z = t * 0.9;
    anillos[1].rotation.z = -t * 0.6;
    anillos[2].rotation.z = t * 0.4;
    const pulso = 1 + Math.sin(t * 2.2) * 0.06;
    esfera.scale.setScalar(pulso);
    core.position.y = 0.34 + Math.sin(t * 1.1) * 0.012;
    const flicker = Math.random() < 0.02 ? 0.4 : 1;
    ico.material.opacity = 0.9 * flicker;
    baseN.userData.cono.opacity = 0.18 + Math.sin(t * 3) * 0.04;

    for (let i = 0; i < N; i++) {
      const s = semillas[i];
      const a = s.a + t * s.v;
      pts[i * 3]     = Math.cos(a) * s.r;
      pts[i * 3 + 1] = s.y + Math.sin(t * s.v + s.a) * 0.02;
      pts[i * 3 + 2] = Math.sin(a) * s.r;
    }
    ptsGeo.attributes.position.needsUpdate = true;

    // Barras: suben suave hacia su valor
    for (const b of barras) b.col.scale.y += (b.objetivo - b.col.scale.y) * 0.08;

    // Metas: giran lento y se inclinan un poco para verse en 3D
    giro.rotation.y = Math.sin(t * 0.4) * 0.5;
    giro.rotation.x = -0.25;
  }

  function dispose() {
    [nucleo, ventasG, metasG].forEach(g => scene.remove(g));
    anillosM.forEach(a => a.arco?.geometry.dispose());
    disposables.forEach(o => o.dispose?.());
  }

  refresh();
  return { targets: [nucleo, ventasG, metasG], tick, refresh, dispose };
}
