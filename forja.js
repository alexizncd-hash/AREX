/* ═══════════════════════════════════════════════════════
   AREX — FORJA · Motor de hologramas 3D sobre la cámara
   Magic-window en iPhone: los hologramas quedan anclados al
   espacio usando el giroscopio; se crean con IA (Groq) y se
   manipulan con la mano (pellizco vía gesture.js).
   Presupuesto estricto de GPU/memoria: pixelRatio 1, additive
   blending sin depth-write, máx 6 objetos × 25 primitivas.
   ═══════════════════════════════════════════════════════ */

const ForjaEngine = (() => {
  let THREE = null;
  let on = false;
  let renderer = null, scene = null, camera = null, objRoot = null;
  let animId = null;
  let objects = [], grabbed = null, grabDepth = 2;
  let raycaster = null;
  let baseInv = null;            // calibración: hacia donde miras al activar = frente
  let lastOrient = null;
  const MAX_OBJ = 6, MAX_PARTS = 25;

  async function _ensureThree() {
    if (THREE) return true;
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js');
      return true;
    } catch (e) { console.warn('FORJA: Three.js CDN falló:', e.message); return false; }
  }

  /* ── Orientación del dispositivo → cámara (magic window) ── */
  function _onOrient(e) { lastOrient = e; }

  function _applyOrient() {
    const e = lastOrient;
    if (!e || e.alpha == null) return;
    const alpha = THREE.MathUtils.degToRad(e.alpha);
    const beta  = THREE.MathUtils.degToRad(e.beta);
    const gamma = THREE.MathUtils.degToRad(e.gamma);
    const euler = new THREE.Euler(beta, alpha, -gamma, 'YXZ');
    const q = new THREE.Quaternion().setFromEuler(euler);
    // La cámara del dispositivo mira -Z: rotar -90° en X
    q.multiply(new THREE.Quaternion(-Math.SQRT1_2, 0, 0, Math.SQRT1_2));
    // Compensar orientación de pantalla (portrait/landscape)
    const so = (screen.orientation?.angle || 0);
    if (so) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -THREE.MathUtils.degToRad(so)));
    if (!baseInv) baseInv = q.clone().invert();
    camera.quaternion.copy(baseInv.clone().multiply(q));
  }

  /* ── Materiales holográficos ── */
  function _matSolid(color) {
    return new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false });
  }
  function _matWire(color) {
    return new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  }

  function _geo(shape, size) {
    const [x = 0.2, y = 0.2, z = 0.2] = Array.isArray(size) ? size : [];
    switch (shape) {
      case 'sphere':   return new THREE.SphereGeometry(Math.max(x, 0.02) / 2, 16, 12);
      case 'cylinder': return new THREE.CylinderGeometry(x / 2, x / 2, Math.max(y, 0.02), 18);
      case 'cone':     return new THREE.ConeGeometry(x / 2, Math.max(y, 0.02), 18);
      case 'torus':    return new THREE.TorusGeometry(x / 2, Math.max(z || x * 0.15, 0.01) / 2, 8, 22);
      case 'plane':    return new THREE.PlaneGeometry(Math.max(x, 0.02), Math.max(y, 0.02));
      default:         return new THREE.BoxGeometry(Math.max(x, 0.02), Math.max(y, 0.02), Math.max(z, 0.02));
    }
  }

  function _disposeObj(g) {
    g.traverse?.(m => { m.geometry?.dispose?.(); m.material?.dispose?.(); });
  }

  /* ── Construir y colocar un holograma frente a la cámara ── */
  function spawn(spec) {
    if (!on) return null;
    if (objects.length >= MAX_OBJ) { const old = objects.shift(); old.removeFromParent(); _disposeObj(old); }
    const g = new THREE.Group();
    (spec.parts || []).slice(0, MAX_PARTS).forEach(p => {
      const geo   = _geo(p.shape, p.size);
      const color = new THREE.Color(p.color || '#00d4ff');
      const part  = new THREE.Group();
      part.add(new THREE.Mesh(geo, _matSolid(color)));
      part.add(new THREE.Mesh(geo, _matWire(color)));
      if (Array.isArray(p.pos)) part.position.set(p.pos[0] || 0, p.pos[1] || 0, p.pos[2] || 0);
      if (Array.isArray(p.rot)) part.rotation.set(...p.rot.map(d => (d || 0) * Math.PI / 180));
      g.add(part);
    });
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    g.position.copy(camera.position).addScaledVector(dir, 2);
    g.userData = { spin: 0.004, name: spec.name || 'holograma' };
    objRoot.add(g);
    objects.push(g);
    return g;
  }

  /* ── IA: la receta del objeto la diseña Groq en vivo ── */
  async function crear(desc) {
    const key = window.AREX_CONFIG?.groqKey;
    if (!key) throw new Error('Sin Groq key');
    const sys = 'Eres un diseñador 3D de hologramas. Responde SOLO JSON válido (sin markdown): '
      + '{"name":"...","parts":[{"shape":"box|sphere|cylinder|cone|torus|plane","size":[x,y,z] metros (0.02 a 1.2),'
      + '"pos":[x,y,z] metros relativos al centro,"rot":[x,y,z] grados,"color":"#hex"}]}. '
      + 'Máximo 25 parts. Diseña el objeto RECONOCIBLE y bien proporcionado, componiendo primitivas con ingenio. '
      + 'Paleta holográfica: cian #00d4ff, azul #3399ff, blanco #cfefff, con un acento si aplica.';
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 1400, temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: sys }, { role: 'user', content: `Diseña: ${desc}` }],
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const d = await res.json();
    const spec = JSON.parse(d?.choices?.[0]?.message?.content || '{}');
    if (!spec.parts?.length) throw new Error('la IA no devolvió un diseño');
    return spawn(spec);
  }

  /* ── Interacción: pellizco = agarrar, mover, soltar ── */
  function tryGrab(nx, ny) {
    if (!on || !objects.length) return false;
    raycaster = raycaster || new THREE.Raycaster();
    raycaster.setFromCamera({ x: nx * 2 - 1, y: -(ny * 2 - 1) }, camera);
    const hits = raycaster.intersectObjects(objects, true);
    if (!hits.length) return false;
    let g = hits[0].object;
    while (g.parent && !objects.includes(g)) g = g.parent;
    if (!objects.includes(g)) return false;
    grabbed = g;
    grabDepth = camera.position.distanceTo(g.position);
    g.userData.spin = 0;
    navigator.vibrate?.([25]);
    return true;
  }
  function drag(nx, ny) {
    if (!grabbed || !raycaster) return;
    raycaster.setFromCamera({ x: nx * 2 - 1, y: -(ny * 2 - 1) }, camera);
    grabbed.position.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, grabDepth);
  }
  function release() {
    if (grabbed) { grabbed.userData.spin = 0.004; grabbed = null; }
  }

  /* ── Loop de render (pausa si la pestaña se oculta) ── */
  function _loop() {
    animId = requestAnimationFrame(_loop);
    if (!on || document.hidden) return;
    _applyOrient();
    for (const o of objects) o.rotation.y += o.userData.spin || 0;
    renderer.render(scene, camera);
  }

  function _onResize() {
    const cv = document.getElementById('forja-canvas');
    const p  = cv?.parentElement;
    if (!p || !renderer || !camera) return;
    renderer.setSize(p.clientWidth, p.clientHeight, false);
    camera.aspect = p.clientWidth / p.clientHeight;
    camera.updateProjectionMatrix();
  }

  /* ── Ciclo de vida ── */
  async function start(panel) {
    if (on) return true;
    if (!panel || !await _ensureThree()) return false;
    // iOS pide permiso explícito para el giroscopio (requiere gesto del usuario — este es el tap del botón)
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && DeviceOrientationEvent.requestPermission) {
        await DeviceOrientationEvent.requestPermission();
      }
    } catch {}
    let cv = document.getElementById('forja-canvas');
    if (!cv) {
      cv = document.createElement('canvas');
      cv.id = 'forja-canvas';
      cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;pointer-events:none;';
      const video = panel.querySelector('#vis-video');
      if (video) video.after(cv); else panel.prepend(cv);
    }
    renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false });
    renderer.setPixelRatio(1);   // 1x deliberado: hologramas se ven bien y la GPU respira
    renderer.setSize(panel.clientWidth, panel.clientHeight, false);
    scene   = new THREE.Scene();
    camera  = new THREE.PerspectiveCamera(65, panel.clientWidth / panel.clientHeight, 0.05, 60);
    objRoot = new THREE.Group();
    scene.add(objRoot);
    baseInv = null; lastOrient = null;
    window.addEventListener('deviceorientation', _onOrient);
    window.addEventListener('resize', _onResize);
    on = true;
    _loop();
    return true;
  }

  function clear() {
    objects.forEach(o => { o.removeFromParent(); _disposeObj(o); });
    objects = []; grabbed = null;
  }

  function stop() {
    if (!on && !renderer) return;
    on = false;
    cancelAnimationFrame(animId); animId = null;
    window.removeEventListener('deviceorientation', _onOrient);
    window.removeEventListener('resize', _onResize);
    clear();
    renderer?.dispose(); renderer = null;
    scene = null; camera = null; objRoot = null; baseInv = null; raycaster = null;
    document.getElementById('forja-canvas')?.remove();
  }

  function recentrar() { baseInv = null; }   // recalibrar el "frente" hacia donde miras

  return { start, stop, crear, spawn, clear, tryGrab, drag, release, recentrar, isOn: () => on, count: () => objects.length };
})();

window.ForjaEngine = ForjaEngine;
