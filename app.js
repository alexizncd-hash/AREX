/* ═══════════════════════════════════════════════════════
   AREX — app.js
   Motor: Groq (llama-3.3-70b) + Tavily + Firebase
═══════════════════════════════════════════════════════ */

/* ── Firebase — cargado dinámicamente para no bloquear el boot ── */
let initializeApp, getFirestore, collection, addDoc, getDocs,
    query, orderBy, limit, deleteDoc, doc, setDoc, getDoc, increment, onSnapshot,
    getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
    getRedirectResult, onAuthStateChanged, signOut;

/* v211: versión que ESTA build de la app espera. Se compara contra la que
   reporta el service worker para detectar desajustes (HTML nuevo + JS viejo)
   y para sellar los datos que se sincronizan entre dispositivos. */
const AREX_VERSION = 'v232';
window.AREX_VERSION = AREX_VERSION;

/* ── Carga de configuración ─────────────────────────── */
// Prioridad: config.js (local) → localStorage → pantalla de setup

// CRÍTICO (fix Quest): en un dispositivo nuevo config.js NO existe y las
// referencias sueltas a AREX_CONFIG (sin window.) lanzan ReferenceError —
// el optional chaining NO protege contra identificadores no declarados.
// Eso mataba TODO el arranque de app.js antes de llegar al setup: por eso
// el Quest mostraba "ReferenceError: AREX_CONFIG is not defined" y quedaba
// inutilizable. Con este default seguro, AREX_CONFIG?.x siempre funciona.
if (!('AREX_CONFIG' in window)) window.AREX_CONFIG = null;

// expuesta a window: tareas.js (script clásico) la necesita
function _safeJSON(str, fallback) {
  try { return JSON.parse(str) ?? fallback; } catch { return fallback; }
}
window._safeJSON = _safeJSON;   // usada por tareas.js

/* ── Meta Quest (navegador VR) ──────────────────────── */
// El viewport del PWA bloquea el zoom (correcto en celular, terrible en VR):
// en el Quest el usuario necesita pellizcar/ajustar para leer. Detectamos el
// navegador del Quest, liberamos el zoom y escalamos la UI vía html.quest.
const IS_QUEST = /OculusBrowser/i.test(navigator.userAgent);
if (IS_QUEST) {
  document.documentElement.classList.add('quest');
  document.querySelector('meta[name="viewport"]')?.setAttribute('content',
    'width=device-width, initial-scale=1.0, viewport-fit=cover');
}
window._isQuest = IS_QUEST;

/* ── Forzar actualización completa ──────────────────── */
// Un SW viejo con archivos rotos en caché deja los módulos "vacíos" sin error
// visible (típico: Quest con versión antigua). Esto desregistra el SW, borra
// TODAS las cachés y recarga limpio. Los datos (localStorage) NO se tocan.
async function forzarActualizacion() {
  try {
    if (navigator.serviceWorker) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs) await r.unregister();
    }
    if (window.caches) {
      const keys = await caches.keys();
      for (const k of keys) await caches.delete(k);
    }
  } catch (e) { console.warn('forzarActualizacion:', e); }
  location.reload();
}
window.forzarActualizacion = forzarActualizacion;

/* ── Errores visibles ───────────────────────────────── */
// En dispositivos sin consola (Quest, móvil) los errores de módulos son
// invisibles: el panel simplemente queda vacío. Mostrar un toast breve
// con el error real para poder diagnosticar. Throttle: máx 1 cada 5s.
let _lastErrToast = 0;
window.addEventListener('error', e => {
  try {
    if (typeof logBitacora === 'function') logBitacora('alerta', `JS: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`);
    const now = Date.now();
    if (now - _lastErrToast < 5000) return;
    _lastErrToast = now;
    let t = document.getElementById('arex-err-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'arex-err-toast';
      t.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(40,0,0,0.92);border:1px solid #ff4444;color:#ffb0b0;font-family:monospace;font-size:11px;padding:8px 14px;border-radius:4px;max-width:90vw;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = `⚠ ${e.message}`.slice(0, 140);
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 6000);
  } catch {}
});

function loadConfig() {
  if (window.AREX_CONFIG?.groqKey) return true; // config.js presente
  const saved = localStorage.getItem('arex_config');
  if (saved) {
    const parsed = _safeJSON(saved, null);
    if (parsed) { window.AREX_CONFIG = parsed; return true; }
    localStorage.removeItem('arex_config'); // corrupted — purge to unblock boot
  }
  return false;
}

function showSetup() {
  document.getElementById('setup-screen').classList.remove('hidden');
  document.getElementById('boot-screen').style.display = 'none';
}

function setupSaveHandler() {
  document.getElementById('cfg-save').addEventListener('click', () => {
    const groq = document.getElementById('cfg-groq').value.trim();
    if (!groq) { document.getElementById('cfg-error').style.display = 'block'; return; }
    document.getElementById('cfg-error').style.display = 'none';

    const fbKey     = document.getElementById('cfg-fb-key').value.trim();
    const fbDomain  = document.getElementById('cfg-fb-domain').value.trim();
    const fbProject = document.getElementById('cfg-fb-project').value.trim();
    const fbBucket  = document.getElementById('cfg-fb-bucket').value.trim();
    const fbSender  = document.getElementById('cfg-fb-sender').value.trim();
    const fbApp     = document.getElementById('cfg-fb-app').value.trim();
    const fbVapid   = document.getElementById('cfg-fb-vapid').value.trim();

    const config = {
      groqKey:   groq,
      tavilyKey: document.getElementById('cfg-tavily').value.trim() || '',
      owmKey:    document.getElementById('cfg-owm').value.trim()    || '',
      tomtomKey: document.getElementById('cfg-tomtom')?.value.trim() || '',
      geminiKey: (document.getElementById('cfg-gemini')?.value || '').trim() || '',
      firebase:  fbKey ? { apiKey:fbKey, authDomain:fbDomain, projectId:fbProject,
                           storageBucket:fbBucket, messagingSenderId:fbSender, appId:fbApp,
                           vapidKey: fbVapid || undefined } : null
    };
    localStorage.setItem('arex_config', JSON.stringify(config));
    window.AREX_CONFIG = config;
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('boot-screen').style.display = 'flex';
    initFirebase();
    syncConfigToFirestore();
    boot();
  });
}

/* ── Atajos personalizados ──────────────────────────── */
// 'run' quitado (nunca tuvo implementación); 'proyecto' agregado (tiene case
// en handleCommand pero un atajo del usuario llamado igual lo eclipsaba)
const RESERVED_CMDS = ['ayuda','limpiar','examen','resumir','exportar','notas','stats','recordar','contexto','config','atajos','memoria','tarea','briefing','pomodoro','buscar','hechos','semana','analizar','hoy','proyecto','profundo'];

function loadAtalos() {
  return _safeJSON(localStorage.getItem('arex_atajos'), []);
}
function saveAtalos(arr) {
  localStorage.setItem('arex_atajos', JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData('arex_atajos');
}
function renderAtajosList() {
  const list = document.getElementById('atajos-list');
  const arr = loadAtalos();
  if (!arr.length) {
    list.innerHTML = '<div class="atajo-empty">Sin atajos definidos. Crea tu primero abajo.</div>';
    return;
  }
  list.innerHTML = '';
  arr.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'atajo-item';
    const preview = a.prompt.length > 90 ? a.prompt.slice(0,90) + '…' : a.prompt;
    el.innerHTML = `
      <div class="atajo-header">
        <code class="atajo-cmd">/${a.name}</code>
        ${a.desc ? `<span class="atajo-desc-label">${a.desc.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>` : '<span class="atajo-desc-label"></span>'}
        <button class="atajo-del" title="Eliminar">✕</button>
      </div>
      <div class="atajo-prompt-preview">${preview.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
    `;
    el.querySelector('.atajo-del').onclick = () => {
      const current = loadAtalos();
      current.splice(i, 1);
      saveAtalos(current);
      renderAtajosList();
    };
    list.appendChild(el);
  });
}

/* ── Contexto personal ──────────────────────────────── */
function loadPersonalContext() {
  return _safeJSON(localStorage.getItem('arex_context'), {});
}
function savePersonalContext(ctx) {
  localStorage.setItem('arex_context', JSON.stringify(ctx));
  if (typeof arexSyncData === 'function') arexSyncData('arex_context');
}
function buildContextSection() {
  const ctx = loadPersonalContext();
  const parts = [];
  if (ctx.proyectos)  parts.push(`PROYECTOS ACTIVOS:\n${ctx.proyectos}`);
  if (ctx.universidad) parts.push(`UNIVERSIDAD:\n${ctx.universidad}`);
  if (ctx.metas)      parts.push(`METAS ACTUALES:\n${ctx.metas}`);
  if (ctx.datos)      parts.push(`DATOS FIJOS:\n${ctx.datos}`);
  if (!parts.length) return '';
  return `\n\nCONTEXTO PERSONAL (actualizado por Alexiz):\n${parts.join('\n\n')}`;
}
function updateCtxBadge() {
  const ctx = loadPersonalContext();
  const hasCtx = !!(ctx.proyectos || ctx.universidad || ctx.metas || ctx.datos);
  ctxBadge.classList.toggle('hidden', !hasCtx);
}

/* ── Memoria larga + hechos → extraído a memoria.js (v203) ── */
/* ── System prompt (dinámico según perfil activo) ───── */
function buildSystemBase() {
  const p     = window._arexProfile || {};
  const name  = p.assistantName || 'AREX';
  const owner = p.ownerName     || 'Alexiz';
  const loc   = p.location      || 'Hermosillo, Sonora, México';
  const pers  = p.personality   || 'formal';

  const now   = new Date();
  const fecha = now.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const hora  = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });

  const toneMap = {
    formal:    `Formal, preciso y directo. Sin rodeos. Como JARVIS con Tony Stark.\n- Leal y confiable. Nunca condescendiente.\n- Tratas a ${owner} como alguien capaz e inteligente.\n- Calidez breve en momentos personales, luego vuelves al modo operacional.`,
    cálido:    `Cálido, cercano y empático. Directo pero amable.\n- Apoyas a ${owner} en cada paso. Nunca condescendiente.\n- Combinas profesionalismo con calidez genuina.`,
    amistoso:  `Amistoso y conversacional. Natural, como hablar con un buen amigo.\n- Sin formalismos innecesarios. Claro y humano.\n- Sigues siendo útil y preciso, pero sin rigidez.`,
  };
  const tone = toneMap[pers] || toneMap.formal;

  const phrases = name === 'VIERNES'
    ? `"Sistemas listos." | "Procesando." | "Entendido." | "Aquí el análisis." | "Listo, ${owner}."`
    : `"Sistemas en línea." | "Procesando, ${owner}." | "Entendido." | "Aquí el análisis." | "Datos disponibles." | "Operación completada."`;

  let base = `Eres ${name}, el sistema de inteligencia personal de ${owner}.`;
  if (name === 'AREX') base += `\nTu nombre nace de Alexiz y Margaret — las dos personas más importantes en su vida.`;

  base += `

CONTEXTO OPERACIONAL:
- Fecha: ${fecha}. Hora: ${hora}.
- Ubicación: ${loc}.

IDENTIDAD Y TONO:
- ${tone}
- Nunca pierdes el contexto de la conversación.`;

  // Contexto personal de Alexiz — solo para su perfil
  if (owner === 'Alexiz') {
    base += `

QUIÉN ES ALEXIZ:
- Desarrollador web en crecimiento (HTML, CSS, JavaScript nivel intermedio).
- Estudiante universitario — te usa para trabajos, proyectos y exámenes.
- Emprendedor con negocio propio y proyectos personales.
- Intereses: finanzas personales, desarrollo personal, hábitos, salud, relaciones.
- Positivo, busca el lado constructivo en momentos difíciles.
- Quiere crecer: personal, espiritual, físico, económico y en relaciones.
- Valora su familia y a Margaret, su novia — fundamental en su vida.
- Prefiere entender el "mínimo funcional" antes de profundizar.`;
  }

  base += `

MÓDULOS DEL SISTEMA (puedes referirte a ellos):
- FINANZAS: tarjetas de crédito, saldos, gastos mensuales, calculadora de deuda, recordatorios de pago.
- TAREAS: lista de pendientes con fecha límite y prioridad alta/media/baja.
- RECORDATORIOS: activos con countdown, persistentes entre sesiones (/recordar 30min, /recordar 20:00).
- DASHBOARD: vista de inicio con resumen de tareas urgentes, finanzas y clima.

ÁREAS DE EXPERTISE:
1. PROGRAMACIÓN: HTML, CSS, JavaScript. Explica el concepto antes del código. Comenta solo lo no obvio.
2. UNIVERSIDAD: trabajos, proyectos, exámenes, resúmenes, análisis, ensayos.
3. NEGOCIOS: estrategia, ideas, propuestas, análisis, decisiones.
4. FINANZAS PERSONALES: presupuestos, ahorro, inversión, control de gastos, deuda, tarjetas.
5. DESARROLLO PERSONAL: hábitos, rutinas, mentalidad, metas, disciplina.
6. SALUD Y BIENESTAR: físico, mental, espiritual.
7. RELACIONES: comunicación, familia, pareja.
8. PRODUCTIVIDAD: organización, priorización, gestión del tiempo.
9. ANÁLISIS Y DECISIONES: pros/contras, escenarios, riesgos.
10. CONOCIMIENTO GENERAL: responde con precisión cualquier tema.

REGLAS:
- Responde SIEMPRE en español.
- 3-5 líneas por defecto. Expándete si ${owner} pide más detalle.
- Código: describe brevemente qué hace (1 línea), luego el bloque de código completo.
- Señala errores o mejores enfoques directamente, sin rodeos.
- Si hay riesgos o errores en el planteamiento de ${owner}, díselo primero.
- Cuando tengas resultados de búsqueda web, úsalos e indica las fuentes con claridad.
- Para temas de finanzas personales, considera el contexto de México (tasas, productos, normativa local).

FRASES CARACTERÍSTICAS (úsalas cuando sea natural):
${phrases}

SISTEMA DE ACCIONES — LEE ESTO CON ATENCIÓN:
Puedes ejecutar acciones reales dentro de ${name} usando etiquetas al FINAL de tu respuesta.
Úsalas cuando el usuario pida crear algo, o cuando detectes que debes guardar información.

Crear tarea:       <arex:accion tipo="addTarea" texto="descripción" fecha="YYYY-MM-DD" prioridad="alta|media|baja"/>
Crear nota:        <arex:accion tipo="addNota" titulo="título" cuerpo="contenido completo"/>
Recordatorio:      <arex:accion tipo="recordar" msg="mensaje" mins="30"/>
Guardar hecho:     <arex:accion tipo="hecho" texto="dato importante sobre ${owner}"/>
Abrir módulo:      <arex:accion tipo="modulo" nombre="tareas|notas|finanzas|habitos|inicio"/>

REGLAS DE ACCIONES:
- Usa SOLO si hay intención clara del usuario de crear algo, o si aprendes un hecho nuevo relevante.
- Para "hecho": úsalo cuando aprendas metas, decisiones, datos personales, contexto importante de ${owner}.
- Las etiquetas van AL FINAL del texto, nunca en medio de la respuesta.
- En tu texto NO menciones las etiquetas — solo confirma brevemente lo que hiciste ("Tarea creada.", "Guardado.").
- Puedes incluir múltiples acciones en una respuesta.`;

  return base.trim();
}

/* ── Contexto de módulos (data real de Alexiz) ──────── */
function buildModuleContext() {
  const parts = [];
  try {
    // Finanzas
    if (typeof getFinanzasData === 'function') {
      const fin  = getFinanzasData();
      const deuda = typeof calcularDeudaTotal === 'function' ? calcularDeudaTotal() : 0;
      const margen = typeof calcularMargen === 'function' ? calcularMargen() : 0;
      const pagos = typeof obtenerProximosPagos === 'function' ? obtenerProximosPagos(7) : [];
      const fmtM = n => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:0,maximumFractionDigits:0})}`;
      let finTxt = `FINANZAS: ingreso=${fmtM(fin.config.ingresoMensual)}, deuda_total=${fmtM(deuda)}, margen_mensual=${fmtM(margen)}`;
      if (pagos.length) finTxt += `, próximos_pagos=[${pagos.slice(0,3).map(p=>`${p.tarjeta} en ${p.diasRestantes}d (${fmtM(p.pagoMinimo)})`).join(', ')}]`;
      parts.push(finTxt);
    }
  } catch(e) { console.warn('AREX ctx finanzas:', e); }
  try {
    // Negocio
    if (typeof getNegocioData === 'function') {
      const neg = getNegocioData();
      const now = Date.now();
      const im  = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
      const vM  = neg.ventas.filter(v => v.fecha >= im).reduce((a,v)=>a+v.total,0);
      const gM  = neg.gastos.filter(g => g.fecha >= im).reduce((a,g)=>a+g.monto,0);
      const fmtM = n => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:0})}`;
      let negTxt = `NEGOCIO (${neg.config.variedad}): ventas_mes=${fmtM(vM)}, gastos_mes=${fmtM(gM)}, ganancia_mes=${fmtM(vM-gM)}, stock=${neg.inventario.stockKg}kg`;
      const calle = arexCalleResumen();
      if (calle.totalML > 0) negTxt += `, consignado_en_tiendas=${calle.totalML}ML(${fmtM(calle.valor)})`;
      // v210: predicciones de VIERNES al prompt, para que AREX pueda responder
      // "¿cuándo me quedo sin producto?" con un número CALCULADO, no inventado.
      // Solo si el motor ya está cargado: nunca se fuerza desde el chat.
      try {
        const pred = window.VIERNES?.insights?.() || [];
        if (pred.length) negTxt += `\nTENDENCIAS_CALCULADAS (VIERNES, datos reales — cítalas tal cual, no inventes cifras): ${pred.slice(0,3).map(p => p.texto).join(' | ')}`;
      } catch {}
      if (calle.resurtir.length) negTxt += `, tiendas_por_resurtir=[${calle.resurtir.join(', ')}]`;
      parts.push(negTxt);
    }
  } catch(e) { console.warn('AREX ctx negocio:', e); }
  try {
    // Gastos personales
    if (typeof getGastosData === 'function') {
      const gp   = getGastosData();
      const mesKey = window.mes();   // v216: era UTC
      const gastosMes = (gp.gastos || []).filter(t => t.fecha?.startsWith(mesKey));
      const totalMes  = gastosMes.reduce((a,t)=>a+t.monto,0);
      const fmtM = n => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:0})}`;
      if (totalMes > 0) parts.push(`GASTOS_PERSONALES: total_mes=${fmtM(totalMes)}, gastos=${gastosMes.length}`);
    }
  } catch(e) { console.warn('AREX ctx gastos:', e); }
  try {
    // Metas
    if (typeof getMetas === 'function') {
      const metas = getMetas().filter(m => !m.completada);
      if (metas.length) parts.push(`METAS_ACTIVAS: [${metas.slice(0,5).map(m=>`"${m.titulo}"`).join(', ')}]`);
    }
  } catch(e) { console.warn('AREX ctx metas:', e); }
  try {
    // Tareas urgentes
    const tareas = getTareas().filter(t => !t.done);
    const hoy = window.hoy();   // v216: era UTC
    const urgentes = tareas.filter(t => t.fecha && t.fecha <= hoy);
    if (urgentes.length) parts.push(`TAREAS_URGENTES: ${urgentes.length} vencidas/hoy — [${urgentes.slice(0,4).map(t=>(t.text||t.texto||'').slice(0,40)).join(', ')}]`);
    else if (tareas.length) parts.push(`TAREAS_PENDIENTES: ${tareas.length} total`);
  } catch(e) { console.warn('AREX ctx tareas:', e); }
  try {
    // v222 · HÁBITOS. Antes AREX no los veía: podías llevar 40 días de
    // racha y no podía ni mencionarlo. Es el dato más conversacional del
    // sistema porque cambia cada día y quieres que alguien te lo recuerde.
    const hab = leer('arex_habitos', []);
    if (hab.length) {
      const h = window.hoy();
      parts.push('HÁBITOS: ' + hab.slice(0, 6).map(x => {
        const hecho = x.completados?.[h] || x.hechos?.[h];
        return `${x.nombre} (racha ${x.racha || 0}d, ${hecho ? 'HECHO hoy' : 'pendiente hoy'})`;
      }).join(', '));
    }
  } catch(e) { console.warn('AREX ctx hábitos:', e); }
  try {
    // v222 · NOTAS FIJADAS, con su TEXTO. Mandar solo los títulos no sirve
    // de nada —"Nota 1, Nota 2"—: el valor de una nota está en lo que dice.
    // Por eso van solo las fijadas, que son las que marcaste como
    // importantes, y sí con su contenido. Las demás siguen alcanzables por
    // la búsqueda global.
    const notas = leer('arex_notas', []);
    const fijadas = notas.filter(n => n.pinned).slice(0, 4);
    if (fijadas.length) {
      parts.push('NOTAS_FIJADAS:\n' + fijadas.map(n =>
        `  · ${n.titulo || '(sin título)'}: ${String(n.texto || n.cuerpo || '').replace(/\s+/g,' ').slice(0, 180)}`
      ).join('\n'));
    } else if (notas.length) {
      parts.push(`NOTAS: ${notas.length} guardadas, ninguna fijada`);
    }
  } catch(e) { console.warn('AREX ctx notas:', e); }
  try {
    // v222 · REPARTO. Solo la ruta más reciente y con lo accionable:
    // cuántas paradas y si ya se puede navegar. Los nombres de rutas
    // viejas no responden nada.
    const rutas = leer('arex_reparto_rutas', []);
    if (rutas.length) {
      const r0 = rutas[0];
      parts.push(`REPARTO: última ruta "${r0.nombre}" con ${(r0.waypoints||[]).length} paradas`
               + ` (${rutas.length} guardada${rutas.length!==1?'s':''}).`
               + ` Se puede abrir en Google Maps desde el módulo.`);
    }
  } catch(e) { console.warn('AREX ctx reparto:', e); }

  if (!parts.length) return '';
  const owner = window._arexProfile?.ownerName || 'Alexiz';
  return `\n\nDATA EN TIEMPO REAL (usa esto cuando ${owner} pregunte sobre sus finanzas, negocio, gastos, metas, tareas, hábitos, notas fijadas o rutas de reparto):\n${parts.join('\n')}`;
}

const EXAM_ADDON = `

MODO EXAMEN ACTIVO:
- Respuestas más largas y detalladas de lo normal.
- Estructura clara: pasos numerados, secciones con título.
- Incluye ejemplos prácticos cuando ayuden.
- Explica el razonamiento paso a paso.
- Al final resume los puntos clave en 3-5 bullets.`;

/* ── Firebase (opcional) ────────────────────────────── */
let db = null;
let fbInitialized = false;
const SESSION = Date.now().toString();

// Rutas por-usuario: todos los datos cuelgan de users/{uid}/*
function _userDoc(...segs) { return doc(db, 'users', window._arexUid, ...segs); }
function _userCol(...segs) { return collection(db, 'users', window._arexUid, ...segs); }

async function initFirebase() {
  const fbConfig = window.AREX_FIREBASE_CONFIG || AREX_CONFIG?.firebase;
  if (fbInitialized || !fbConfig?.apiKey) return;
  try {
    ({ initializeApp } = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js"));
    ({ getFirestore, collection, addDoc, getDocs, query, orderBy,
       limit, deleteDoc, doc, setDoc, getDoc, increment, onSnapshot }
      = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js"));
    ({ getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect,
       getRedirectResult, onAuthStateChanged, signOut }
      = await import("https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js"));
    const fbApp = initializeApp(fbConfig);
    db = getFirestore(fbApp);
    window._arexDb = db;
    fbInitialized = true;

    const auth = getAuth(fbApp);
    window._arexAuth = auth;

    // Procesar redirect pendiente (por si venía de una sesión anterior con redirect)
    getRedirectResult(auth).then(result => {
      if (result?.user) console.log('AREX: redirect result ok —', result.user.email);
    }).catch(e => {
      if (e.code !== 'auth/no-current-user')
        console.warn('AREX getRedirectResult:', e.code, e.message);
    });

    let _firstAuthCheck = true;

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        window._arexUid  = user.uid;
        window._arexUser = { uid: user.uid, displayName: user.displayName, email: user.email, photoURL: user.photoURL };
        localStorage.setItem('arex_offline_uid', user.uid);
        localStorage.setItem('arex_offline_name', user.displayName || '');
        _hideLoginOverlay();
        try {
          await _initUserSession();
        } catch(e) {
          console.error('AREX _initUserSession:', e);
          // Usuario autenticado pero sesión falló — no volver a login
        }
      } else {
        // Primera vez: Firebase puede tardar hasta ~1s en restaurar sesión desde IndexedDB.
        // El boot screen cubre este período; no mostrar login todavía.
        if (_firstAuthCheck) {
          _firstAuthCheck = false;
          await new Promise(r => setTimeout(r, 1000));
          if (window._arexUid) return; // sesión restaurada durante la espera
        }
        const cachedUid = localStorage.getItem('arex_offline_uid');
        if (cachedUid && !navigator.onLine) {
          window._arexUid  = cachedUid;
          window._arexUser = { uid: cachedUid, displayName: localStorage.getItem('arex_offline_name') || 'Usuario', email: '', photoURL: null };
          _hideLoginOverlay();
          try { await _initUserSession(); } catch(e) { console.error('AREX offline session:', e); }
        } else {
          if (cachedUid) localStorage.removeItem('arex_offline_uid');
          _showLoginOverlay();
        }
      }
    });

    // Cablear el botón de login vía event listener
    // (app.js es type="module" → las funciones no son globales → onclick inline falla)
    _setupLoginButton();
  } catch(e) { console.warn('Firebase init:', e); }
}

// Arranca la sesión del usuario: perfil → migración → sync → datos
async function _initUserSession() {
  await loadAndApplyProfile();
  await _migrateFirestoreIfNeeded();
  initRealtimeSync();
  initFCM();
  await pullConfigFromFirestore();
  await pullAllModuleData();
  if (window._arexLastSync == null) window._arexLastSync = Date.now();
  await loadHistory();
}

// ── Google Sign-In ────────────────────────────────────

// Detecta si estamos en móvil o entorno sin popups confiables
function _isMobile() {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|Mobile|mobile/i.test(navigator.userAgent)
      || window.innerWidth < 768;
}

// Cablear el botón de login con event listener (no inline onclick —
// app.js es module, las funciones no son globales)
function _setupLoginButton() {
  const btn = document.getElementById('btn-google-signin');
  if (!btn) return;
  btn.onclick = null; // remover posible inline handler residual
  btn.addEventListener('click', _doGoogleSignIn);
}

async function _doGoogleSignIn() {
  const auth = window._arexAuth;
  if (!auth) { _loginError('Sistema no listo. Recarga la página.'); return; }
  const btn = document.getElementById('btn-google-signin');
  const err = document.getElementById('login-error');
  if (btn) btn.disabled = true;
  if (err) err.style.display = 'none';

  const provider = new GoogleAuthProvider();

  // Popup funciona en iOS Safari, Android Chrome y desktop si el usuario lo inicia.
  // Solo usar redirect si el navegador bloqueó el popup explícitamente.
  try {
    await signInWithPopup(auth, provider);
    // onAuthStateChanged maneja el resto
  } catch(e) {
    console.error('AREX signInWithPopup:', e.code, e.message);
    if (e.code === 'auth/popup-blocked') {
      // Navegador bloqueó el popup → usar redirect como último recurso
      try {
        await signInWithRedirect(auth, provider);
      } catch(e2) {
        _loginError(`${e2.code || 'Error'}: ${e2.message}`);
        if (btn) btn.disabled = false;
      }
    } else if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
      // El usuario cerró el popup — no es un error
      if (btn) btn.disabled = false;
    } else {
      _loginError(`${e.code || 'Error'}: ${e.message}`);
      if (btn) btn.disabled = false;
    }
  }
}

// Exponer globalmente por si hay llamadas legacy desde HTML
window._doGoogleSignIn = _doGoogleSignIn;

function _loginError(msg) {
  const err = document.getElementById('login-error');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
  console.error('AREX login error:', msg);
}

// Sign-out global
window._arexSignOut = async () => {
  if (window._arexAuth) {
    await signOut(window._arexAuth).catch(()=>{});
    localStorage.removeItem('arex_offline_uid');
    localStorage.removeItem('arex_offline_name');
    window._arexUid = null; window._arexUser = null; window._arexProfile = null;
    _rtUnsubs.forEach(u => u()); _rtUnsubs.length = 0;
    _showLoginOverlay();
  }
};

// ── Login overlay ─────────────────────────────────────
function _showLoginOverlay() {
  const ov = document.getElementById('login-overlay');
  if (ov) ov.style.display = 'flex';
  // Ocultar elementos flotantes que quedan encima del overlay
  ['qc-fab','fab-analizar','pomo-widget'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('display','none','important');
  });
}
function _hideLoginOverlay() {
  const ov = document.getElementById('login-overlay');
  if (ov) ov.style.display = 'none';
  // Restaurar FAB de captura rápida
  const fab = document.getElementById('qc-fab');
  if (fab) fab.style.removeProperty('display');
}

// ── Sistema de perfiles ───────────────────────────────
const _PROFILE_DEFAULTS = {
  assistantName: 'AREX',
  ownerName: 'Usuario',
  personality: 'formal',
  voiceGender: 'male',
  voicePitch: 0.78,
  voiceRate: 0.91,
  location: 'México',
  activeModules: ['finanzas','negocio','gastos','metas','tareas','notas','agenda','proyectos','habitos','control','evidencias'],
  accent: '#22d3ee',
};

async function loadAndApplyProfile() {
  // 1. Intentar leer desde Firestore
  if (db && window._arexUid) {
    try {
      const snap = await getDoc(_userDoc('arex', 'profile'));
      if (snap.exists()) {
        window._arexProfile = { ..._PROFILE_DEFAULTS, ...snap.data() };
        _applyProfile();
        return;
      }
    } catch(e) { console.warn('loadProfile:', e); }
  }
  // 2. Leer caché local
  const cached = localStorage.getItem('arex_profile_cache');
  if (cached) {
    try {
      window._arexProfile = { ..._PROFILE_DEFAULTS, ...JSON.parse(cached) };
      _applyProfile();
      return;
    } catch {}
  }
  // 3. Sin perfil → onboarding (excepto si ya hay datos migrados de Alexiz)
  const isMigrated = localStorage.getItem('arex_migrated_v1');
  if (isMigrated) {
    // Datos previos → asumir perfil Alexiz/AREX
    window._arexProfile = { ..._PROFILE_DEFAULTS,
      assistantName:'AREX', ownerName:'Alexiz',
      location:'Hermosillo, Sonora, México', personality:'formal' };
    await _saveProfile(window._arexProfile);
    _applyProfile();
  } else {
    _showOnboarding();
  }
}

async function _saveProfile(profile) {
  window._arexProfile = { ..._PROFILE_DEFAULTS, ...profile };
  localStorage.setItem('arex_profile_cache', JSON.stringify(window._arexProfile));
  if (window._arexUser?.displayName) {
    localStorage.setItem('arex_offline_name', window._arexUser.displayName);
  }
  if (db && window._arexUid) {
    try { await setDoc(_userDoc('arex', 'profile'), window._arexProfile); }
    catch(e) { console.warn('saveProfile:', e); }
  }
}

function _applyProfile() {
  const p = window._arexProfile;
  if (!p) return;
  // Header: nombre del asistente
  const nameEl = document.getElementById('hdr-assistant-name');
  if (nameEl) nameEl.textContent = `${p.assistantName} · MARK IV`;
  // Sidebar: etiqueta de voz
  const voiceLbl = document.querySelector('#sb-voice .mt-lbl');
  if (voiceLbl) voiceLbl.textContent = `VOZ DE ${p.assistantName}`;
  // Color de acento personalizado
  if (p.accent && p.accent !== '#22d3ee') {
    document.documentElement.style.setProperty('--cyan', p.accent);
  }
  _updateUserUI();
}

function _updateUserUI() {
  const u = window._arexUser;
  const p = window._arexProfile;
  const nameEl    = document.getElementById('sb-user-name');
  const assistEl  = document.getElementById('sb-assistant-name');
  const avatarEl  = document.getElementById('sb-user-avatar');
  const section   = document.getElementById('sb-user-section');
  if (section) section.style.display = u ? 'block' : 'none';
  if (nameEl)   nameEl.textContent   = u?.displayName || u?.email || 'Offline';
  if (assistEl) assistEl.textContent = p?.assistantName ? `Asistente: ${p.assistantName}` : 'AREX';
  if (avatarEl && u?.photoURL) {
    avatarEl.src = u.photoURL;
    avatarEl.style.display = 'inline-block';
  }
}

// ── Onboarding (primer login sin perfil) ─────────────
function _showOnboarding() {
  const ov = document.getElementById('onboarding-overlay');
  if (ov) ov.style.display = 'flex';
}
function _hideOnboarding() {
  const ov = document.getElementById('onboarding-overlay');
  if (ov) ov.style.display = 'none';
}
async function _finishOnboarding() {
  const aName  = (document.getElementById('ob-assistant-name')?.value || '').trim() || 'AREX';
  const oName  = (document.getElementById('ob-owner-name')?.value    || '').trim() || (window._arexUser?.displayName?.split(' ')[0] || 'Usuario');
  const vGender= document.querySelector('input[name="ob-voice"]:checked')?.value || 'male';
  const profile = { ..._PROFILE_DEFAULTS,
    assistantName: aName,
    ownerName: oName,
    voiceGender: vGender,
    voicePitch: vGender === 'female' ? 1.05 : 0.78,
    voiceRate:  vGender === 'female' ? 0.94 : 0.91,
  };
  await _saveProfile(profile);
  _applyProfile();
  _hideOnboarding();
}

// Migración one-time: copia datos de rutas planas viejas a users/{uid}/*
async function _migrateFirestoreIfNeeded() {
  if (!db || !window._arexUid) return;
  if (localStorage.getItem('arex_migrated_v1')) return;
  const keys = [
    'arex_negocio','arex_gastos_pers','arex_metas','arex_tareas',
    'arex_recordatorios','arex_memoria','arex_hechos','arex_context',
    'arex_atajos','arex_proyectos','arex_evidencias','arex_notas',
    'arex_finanzas','arex_finanzas_overrides','arex_reparto_rutas',
    'arex_personas','arex_gesture_map','arex_habitos',
  ];
  try {
    for (const key of keys) {
      const newSnap = await getDoc(_userDoc('arex_data', key));
      if (newSnap.exists()) continue;                          // ya migrado
      const oldSnap = await getDoc(doc(db, 'arex_data', key));
      if (!oldSnap.exists()) continue;                         // no había datos viejos
      await setDoc(_userDoc('arex_data', key), oldSnap.data());
    }
    // config
    const oldCfgSnap = await getDoc(doc(db, 'arex', 'config'));
    if (oldCfgSnap.exists()) {
      const newCfgSnap = await getDoc(_userDoc('arex', 'config'));
      if (!newCfgSnap.exists()) await setDoc(_userDoc('arex', 'config'), oldCfgSnap.data());
    }
  } catch(e) { console.warn('migración Firestore:', e); }
  localStorage.setItem('arex_migrated_v1', '1');
}

async function syncConfigToFirestore() {
  if (!db || !window._arexUid) return;
  try {
    await setDoc(_userDoc('arex', 'config'), window.AREX_CONFIG);
    window._arexLastSync = Date.now();
    _renderSyncBadge();
  } catch(e) { console.warn('syncConfig:', e); }
}

async function pullConfigFromFirestore() {
  if (!db || !window._arexUid) return;
  try {
    const snap = await getDoc(_userDoc('arex', 'config'));
    if (!snap.exists()) return;
    const remote = snap.data();
    // Keep local firebase credentials (already bootstrapped), fill rest from remote
    const merged = { ...remote, firebase: window.AREX_CONFIG?.firebase ?? remote.firebase };
    localStorage.setItem('arex_config', JSON.stringify(merged));
    window.AREX_CONFIG = merged;
  } catch(e) { console.warn('pullConfig:', e); }
}

// Pull all synced module data back from Firestore on boot
async function pullAllModuleData() {
  if (!db || !window._arexUid) return;
  const keys = [
    'arex_negocio','arex_gastos_pers','arex_metas',
    'arex_tareas','arex_recordatorios','arex_memoria','arex_hechos',
    'arex_context','arex_atajos',
    // Módulos previamente fuera de sync:
    'arex_proyectos','arex_evidencias','arex_notas',
    'arex_finanzas','arex_finanzas_overrides',
    'arex_reparto_rutas','arex_personas','arex_gesture_map',
    'arex_habitos','arex_sessions','arex_session_memories',
  ];
  let synced = 0;
  for (const key of keys) {
    try {
      const snap = await getDoc(_userDoc('arex_data', key));
      if (!snap.exists()) continue;
      const data = snap.data();
      const remoteTs = data._updatedAt || 0;
      _revisarVersionRemota(data, key);
      const { _updatedAt, _arr, ...rest } = data;
      const toStore = _arr !== undefined ? _arr : rest;

      const local = localStorage.getItem(key);
      if (!local) {
        localStorage.setItem(key, JSON.stringify(toStore));
        _setSyncTs(key, remoteTs);
        synced++;
      } else {
        // Resolución de conflictos: gana el timestamp más reciente.
        // Los arrays no llevan _updatedAt — usar el registro de sync local
        try {
          const localTs = Math.max(_getSyncTs(key), JSON.parse(local)?._updatedAt || 0);
          if (remoteTs > localTs) {
            localStorage.setItem(key, JSON.stringify(toStore));
            _setSyncTs(key, remoteTs);
            synced++;
          }
        } catch {
          localStorage.setItem(key, JSON.stringify(toStore)); synced++;
        }
      }
    } catch(e) { console.warn('pullModuleData:', key, e); }
  }
  if (synced > 0) {
    window.renderTareas?.();
    window.renderMetas?.();
    window.renderProyectosModule?.();
    window.renderGpResumen?.();
    if (typeof renderNegocioModule === 'function') renderNegocioModule();
  }
  return synced;
}


/* v211 · DESFASE ENTRE DISPOSITIVOS
   Los datos sincronizados ahora llevan _appVer. Si llegan escritos por una
   versión distinta a la nuestra, se avisa UNA vez por sesión: es la señal de
   que el iPhone y el Quest están en versiones distintas, cosa que antes era
   completamente invisible (solo se comparaba el timestamp). */
let _avisoDesfaseDado = false;
function _revisarVersionRemota(data, key) {
  try {
    const remota = data?._appVer;
    if (!remota || remota === AREX_VERSION || _avisoDesfaseDado) return;
    _avisoDesfaseDado = true;
    const nRem = parseInt(String(remota).replace(/\D/g, ''), 10) || 0;
    const nMia = parseInt(String(AREX_VERSION).replace(/\D/g, ''), 10) || 0;
    const msg = nRem > nMia
      ? `Otro dispositivo tuyo ya está en ${remota} y este va en ${AREX_VERSION}. Conviene actualizar este.`
      : `Otro dispositivo tuyo escribió datos desde ${remota}, una versión más vieja que la tuya (${AREX_VERSION}). Ábrelo y actualízalo para que no pise datos con formato viejo.`;
    logBitacora?.('alerta', `Desfase de versión: local ${AREX_VERSION} vs remoto ${remota} (${key})`);
    setTimeout(() => window.arexAlert?.('SINCRONIZACIÓN', msg, 'warn'), 3000);
  } catch {}
}

// arexSyncData con _updatedAt para resolución de conflictos cross-device
// Registro local de timestamps de sync: los datos array (tareas, notas...)
// no llevan _updatedAt embebido, así que sin esto la resolución de conflictos
// del pull leía localTs=0 y el remoto SIEMPRE pisaba lo local
function _getSyncTs(key) {
  return _safeJSON(localStorage.getItem('arex_sync_meta'), {})[key] || 0;
}
function _setSyncTs(key, ts) {
  const meta = _safeJSON(localStorage.getItem('arex_sync_meta'), {});
  meta[key] = ts;
  localStorage.setItem('arex_sync_meta', JSON.stringify(meta));
}

async function arexSyncData(lsKey) {
  if (!db || !window._arexUid) return;
  try {
    const raw = localStorage.getItem(lsKey);
    if (!raw) return;
    const payload = JSON.parse(raw);
    const ts = Date.now();
    _setSyncTs(lsKey, ts);
    // v211: sellar con la versión de la app. Antes solo iba _updatedAt, así
    // que un dispositivo en versión vieja podía pisar los datos del nuevo sin
    // que nadie notara la diferencia de formato (ya pasó con `texto`/`text`).
    const toStore = Array.isArray(payload)
      ? { _arr: payload, _updatedAt: ts, _appVer: AREX_VERSION }
      : { ...payload, _updatedAt: ts, _appVer: AREX_VERSION };
    _rtLastTs[lsKey] = ts;  // prevent onSnapshot loop for our own write
    await setDoc(_userDoc('arex_data', lsKey), toStore);
    window._arexLastSync = Date.now();
    _renderSyncBadge();
  } catch(e) { console.warn('arexSyncData:', lsKey, e); }
}

window.arexSyncData = arexSyncData;

/* ── Real-time sync via onSnapshot ─────────────────── */
const _rtUnsubs = [];
const _rtLastTs = {};   // tracks last _updatedAt we received or wrote per key

function initRealtimeSync() {
  if (!db || !onSnapshot || !window._arexUid) return;
  _rtUnsubs.forEach(u => u()); _rtUnsubs.length = 0;
  const watchKeys = ['arex_tareas', 'arex_metas', 'arex_notas', 'arex_recordatorios'];
  for (const key of watchKeys) {
    const unsub = onSnapshot(_userDoc('arex_data', key), snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const remoteTs = data._updatedAt || 0;
      _revisarVersionRemota(data, key);
      // Skip if we already processed this timestamp (avoids loop after our own writes)
      if (remoteTs <= (_rtLastTs[key] || 0)) return;
      _rtLastTs[key] = remoteTs;
      const { _updatedAt, _arr, ...rest } = data;
      const toStore = _arr !== undefined ? _arr : rest;
      localStorage.setItem(key, JSON.stringify(toStore));
      window._arexLastSync = Date.now();
      _renderSyncBadge();
      if (key === 'arex_tareas') { window.renderTareas?.(); if (typeof scheduleTaskNotifications === 'function') scheduleTaskNotifications(); }
      if (key === 'arex_metas')  window.renderMetas?.();
      if (key === 'arex_recordatorios') { if (typeof restoreReminders === 'function') restoreReminders(); }
    }, err => console.warn('onSnapshot', key, err));
    _rtUnsubs.push(unsub);
  }
}
window.initRealtimeSync = initRealtimeSync;

/* ── Firebase Cloud Messaging (FCM) ─────────────────── */
let _fcmMessaging = null;
async function initFCM() {
  if (!db || !AREX_CONFIG.firebase?.vapidKey) return;
  try {
    const { getMessaging, getToken, onMessage } =
      await import('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging.js');
    _fcmMessaging = getMessaging();
    const swReg = await navigator.serviceWorker.ready;
    const token = await getToken(_fcmMessaging, {
      vapidKey: AREX_CONFIG.firebase.vapidKey,
      serviceWorkerRegistration: swReg,
    });
    if (token) {
      localStorage.setItem('arex_fcm_token', token);
      // Foreground message handler
      onMessage(_fcmMessaging, payload => {
        const n = payload.notification || {};
        if (Notification.permission === 'granted') {
          swReg.showNotification(n.title || 'AREX', {
            body: n.body || '',
            icon: './icon.svg',
            data: payload.data || {},
          }).catch(() => {});
        }
      });
    }
  } catch(e) { console.warn('initFCM:', e); }
}

/* ── Modo offline ────────────────────────────────────── */
let _isOffline = !navigator.onLine;

function _setOfflineBanner(offline) {
  _isOffline = offline;
  let banner = document.getElementById('arex-offline-banner');
  if (offline) {
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'arex-offline-banner';
      banner.innerHTML = '⚠ SIN CONEXIÓN — funciones de IA no disponibles · datos locales activos';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:8000;background:#1a0a00;border-bottom:1px solid #ff6a00;color:#ff9944;font-family:monospace;font-size:10px;letter-spacing:2px;text-align:center;padding:5px;pointer-events:none;';
      document.body.prepend(banner);
    }
  } else {
    banner?.remove();
  }
}

window.addEventListener('online',  () => _setOfflineBanner(false));
window.addEventListener('offline', () => _setOfflineBanner(true));
if (_isOffline) _setOfflineBanner(true);

function _offlineFallback(userText) {
  const t = userText.toLowerCase();
  if (/tarea|pendiente|hacer/i.test(t)) {
    const ts = getTareas().filter(x => !x.done);
    if (ts.length) return `📋 **Tareas pendientes (${ts.length}):**\n${ts.slice(0,5).map(x=>`- ${x.text}`).join('\n')}`;
  }
  if (/nota|apunte/i.test(t)) {
    const ns = getNotas().slice(0,3);
    if (ns.length) return `📝 **Notas recientes:**\n${ns.map(n=>`- **${n.titulo||'Sin título'}**: ${n.cuerpo.slice(0,60)}…`).join('\n')}`;
  }
  if (/meta|objetivo/i.test(t)) {
    const ms = _safeJSON(localStorage.getItem('arex_metas'), []).filter(m=>!m.completada).slice(0,3);
    if (ms.length) return `🎯 **Metas activas:**\n${ms.map(m=>`- ${m.titulo||m.nombre}`).join('\n')}`;
  }
  if (/recordatorio|recuerda/i.test(t)) {
    const rs = getRecordatorios().filter(r=>!r.disparado).slice(0,3);
    if (rs.length) return `⏰ **Recordatorios activos:**\n${rs.map(r=>r.msg).join('\n')}`;
  }
  return '📡 AREX está sin conexión. Los datos locales están disponibles.\n\nComandos útiles sin internet: `/tareas`, `/notas`, `/metas`, `/recordar`';
}

/* ── Markdown ───────────────────────────────────────── */
if (typeof marked !== 'undefined') {
  marked.use({ breaks: true, gfm: true });
}
function renderMarkdown(text) {
  if (typeof marked === 'undefined' || typeof DOMPurify === 'undefined') {
    return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }
  return DOMPurify.sanitize(marked.parse(text), { ADD_ATTR:['target','rel','class'] });
}
function applyHighlight(el) {
  if (typeof hljs === 'undefined') return;
  el.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
}

/* ── PDF.js (lazy) ──────────────────────────────────── */
const PDF_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let _pdfReady = false;
async function ensurePdfJs() {
  if (_pdfReady) return;
  if (typeof pdfjsLib === 'undefined') {
    await new Promise((ok, fail) => {
      const s = document.createElement('script');
      s.src = PDF_SRC; s.onload = ok; s.onerror = fail;
      document.head.appendChild(s);
    });
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
  _pdfReady = true;
}

/* ── Estado global ──────────────────────────────────── */
let history    = [];
let voiceOn    = false;
let searchOn   = false;
let examMode   = false;
let continuousMode = false;
let isSpeaking = false;
let isBusy     = false;
let _continuousRec     = null;
let _continuousRestart = false;  // false al inicio — solo se pone true cuando el modo está activo
let _listenRec         = null;   // referencia al reconocimiento one-shot
let _listenTimer       = null;   // timeout de seguridad del mic (12s)
let _iosVoiceKa        = null;   // iOS keep-alive para speechSynthesis principal

const _msgRaw = new WeakMap(); // wrap element → raw markdown text

let _lastInteract = Date.now();
let _idleTimer    = null;

/* ── Sonidos del sistema (Web Audio API) ────────────── */
function _playTone(type) {
  try {
    const ctx  = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'mic-on') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(660, now); osc.frequency.linearRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now); osc.stop(now + 0.22);
    } else if (type === 'mic-off') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(880, now); osc.frequency.linearRampToValueAtTime(440, now + 0.14);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'wake') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(1047, now); osc.frequency.linearRampToValueAtTime(1319, now + 0.1);
      gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      osc.start(now); osc.stop(now + 0.18);
    } else if (type === 'msg') {
      osc.type = 'sine'; osc.frequency.setValueAtTime(1047, now);
      gain.gain.setValueAtTime(0.06, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.start(now); osc.stop(now + 0.14);
    }
    setTimeout(() => ctx.close(), 500);
  } catch(e) {}
}

const NOTE_CATEGORIES = ['General','Estudio','Ideas','Trabajo','Personal'];
let noteFilter = 'all';

/* ── DOM ────────────────────────────────────────────── */
const orb          = document.getElementById('orb');
const statusTxt    = document.getElementById('status');
const chat         = document.getElementById('chat');
const txt          = document.getElementById('txt');
const btnSend      = document.getElementById('btn-send');
const btnMic       = document.getElementById('btn-mic');
const btnVoice     = document.getElementById('btn-voice');
const btnSearch    = document.getElementById('btn-search');
const btnFile      = document.getElementById('btn-file');
const fileInput    = document.getElementById('file-input');
const clockEl      = document.getElementById('clock');
const barMem       = document.getElementById('bar-mem');
const valMem       = document.getElementById('val-mem');
const examBadge    = document.getElementById('exam-badge');
const notesPanel   = document.getElementById('notes-panel');
const notesList    = document.getElementById('notes-list');
const noteInput    = document.getElementById('note-input');
const modalStats   = document.getElementById('modal-stats');
const modalHelp    = document.getElementById('modal-help');
const modalConfig  = document.getElementById('modal-config');
const modalContext = document.getElementById('modal-context');
const modalAtalos  = document.getElementById('modal-atajos');
const statsGrid    = document.getElementById('stats-grid');
const ctxBadge     = document.getElementById('ctx-badge');

/* ── Reloj ──────────────────────────────────────────── */
function tickClock() {
  const n = new Date(), p = v => String(v).padStart(2,'0');
  clockEl.textContent = `${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`;
}
setInterval(tickClock, 1000);
tickClock();

/* ── Sesiones múltiples ─────────────────────────────── */
const MAX_SESSIONS = 10;

function getSessions() {
  return _safeJSON(localStorage.getItem('arex_sessions'), []);
}
function saveSessions(arr) {
  localStorage.setItem('arex_sessions', JSON.stringify(arr.slice(0, MAX_SESSIONS)));
}
function getCurrentSid() {
  return localStorage.getItem('arex_current_session') || null;
}
function autoSessionName() {
  const first = history.find(m => m.role === 'user');
  if (!first) return 'Sesión vacía';
  const t = first.content.slice(0, 30);
  return t.length < first.content.length ? t + '…' : t;
}

function saveCurrentSession() {
  if (!history.length) return;
  let sid = getCurrentSid();
  const sessions = getSessions();
  const now = Date.now();
  const preview = history[history.length - 1]?.content?.slice(0, 55) || '';
  const name = autoSessionName();
  const idx = sessions.findIndex(s => s.id === sid);
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], name, preview, updated: now, messages: [...history] };
  } else {
    sid = sid || String(now);
    localStorage.setItem('arex_current_session', sid);
    sessions.unshift({ id: sid, name, preview, created: now, updated: now, messages: [...history] });
  }
  saveSessions(sessions);
  renderSessionsList();
  updateDockSessionName();
  if (history.length >= 6) {
    const sName = autoSessionName();
    setTimeout(() => _autoSummarizeSession([...history], sName), 1200);
  }
}

function updateDockSessionName() {
  const el = document.getElementById('dock-session-name');
  if (!el) return;
  const sid = getCurrentSid();
  const s = getSessions().find(s => s.id === sid);
  el.textContent = s ? s.name.slice(0, 12) : '—';
}

/* ── Memoria de sesiones (resúmenes automáticos) ─────── */
function getSessionMemories() { return _safeJSON(localStorage.getItem('arex_session_memories'), []); }
function saveSessionMemories(arr) {
  localStorage.setItem('arex_session_memories', JSON.stringify(arr.slice(0, 12)));
}

async function _autoSummarizeSession(msgs, sessionName) {
  if (!AREX_CONFIG?.groqKey || msgs.length < 6) return;
  try {
    const excerpt = msgs.slice(-20).map(m => `${m.role === 'user' ? 'Alexiz' : 'AREX'}: ${m.content.slice(0, 200)}`).join('\n');
    const summary = await callBrain('rapido', [
      { role: 'system', content: 'Extrae en 1-2 oraciones MUY breves los datos clave de esta conversación (decisiones, temas, datos relevantes sobre Alexiz). En español, sin formato markdown.' },
      { role: 'user', content: `Sesión "${sessionName}":\n${excerpt}` }
    ], { maxTokens: 200 });
    if (!summary) return;
    const mems = getSessionMemories();
    mems.unshift({ id: String(Date.now()), fecha: _todayStr(), session: sessionName, resumen: summary });
    saveSessionMemories(mems);
  } catch(e) { console.warn('autoSummarize:', e); }
}

function buildSessionMemorySection() {
  const mems = getSessionMemories().slice(0, 4);
  if (!mems.length) return '';
  const lines = mems.map(m => `- [${m.fecha}] ${m.session}: ${m.resumen}`).join('\n');
  return `\n\nCONTEXTO DE SESIONES ANTERIORES:\n${lines}`;
}

function startNewSession() {
  saveCurrentSession();
  const sid = String(Date.now());
  localStorage.setItem('arex_current_session', sid);
  history = [];
  const chatEl = document.getElementById('chat');
  chatEl.innerHTML = '<div class="welcome"><p>Nueva sesión. Soy <strong>AREX</strong> — listo para asistirte.</p></div>';
  updateMemMetric();
  renderSessionsList();
  updateDockSessionName();
}

function loadSession(sid) {
  saveCurrentSession();
  const session = getSessions().find(s => s.id === sid);
  if (!session) return;
  localStorage.setItem('arex_current_session', sid);
  history = [...(session.messages || [])];
  const chatEl = document.getElementById('chat');
  chatEl.innerHTML = '';
  if (history.length) {
    history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'arex', m.content));
  } else {
    chatEl.innerHTML = '<div class="welcome"><p>Sesión cargada. Soy <strong>AREX</strong>.</p></div>';
  }
  updateMemMetric();
  renderSessionsList();
  updateDockSessionName();
}

function deleteSession(sid) {
  const sessions = getSessions().filter(s => s.id !== sid);
  saveSessions(sessions);
  if (getCurrentSid() === sid) {
    localStorage.removeItem('arex_current_session');
    sessions.length ? loadSession(sessions[0].id) : startNewSession();
  } else {
    renderSessionsList();
  }
}

/* ── Módulo Tareas → extraído a tareas.js (v201) ─────
   getTareas, addTarea, renderTareas y compañía viven ahí como
   script clásico; siguen accesibles globalmente. */
// ── Módulo Notas → extraído a notas.js (v202) ────────
//    getNotas, addNota, renderNotas y compañía viven ahí.
//    El sistema legado Firestore (saveNote/loadNotes) sigue abajo.
function _todayStr() { return window.hoy(); }   // v216: era UTC
window._todayStr = _todayStr;   // usada por tareas.js

// ── Vista Calendario ─────────────────────────────────────
let _calYear  = new Date().getFullYear();
let _calMonth = new Date().getMonth();
let _calSelDay = null;

function switchTareasView(v) {
  document.getElementById('tvt-lista').classList.toggle('active', v === 'lista');
  document.getElementById('tvt-cal').classList.toggle('active',   v === 'cal');
  document.querySelector('.tareas-add-row')?.classList.toggle('hidden', v === 'cal');
  document.getElementById('tareas-body').classList.toggle('hidden', v === 'cal');
  document.getElementById('tareas-cal').classList.toggle('hidden', v !== 'cal');
  if (v === 'cal') renderCalendario();
}
window.switchTareasView = switchTareasView;
window.renderTareas     = renderTareas;

function renderCalendario() {
  const tareas   = getTareas();
  const hoy      = new Date(); hoy.setHours(0, 0, 0, 0);
  const firstDay = new Date(_calYear, _calMonth, 1);
  const lastDay  = new Date(_calYear, _calMonth + 1, 0);
  const mesStr   = firstDay.toLocaleDateString('es-MX', { month:'long', year:'numeric' }).toUpperCase();

  document.getElementById('cal-mes-label').textContent = mesStr;

  const taskMap = {};
  tareas.forEach(t => { if (t.fecha) { (taskMap[t.fecha] = taskMap[t.fecha] || []).push(t); } });

  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells = [...Array(startOffset).fill(null)];
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const DAYS = ['LUN','MAR','MIÉ','JUE','VIE','SÁB','DOM'];
  let html = `<div class="cal-days-header">${DAYS.map(d => `<div class="cal-day-name">${d}</div>`).join('')}</div><div class="cal-cells">`;

  cells.forEach(d => {
    if (!d) { html += '<div class="cal-cell empty"></div>'; return; }
    const ds = `${_calYear}-${String(_calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dt = taskMap[ds] || [];
    const isHoy = new Date(_calYear, _calMonth, d).getTime() === hoy.getTime();
    const isSel = _calSelDay === ds;
    const hasUrgent = dt.some(t => !t.done && ['urg-hoy','urg-vencida'].includes(urgenciaTarea(t)?.cls));
    html += `<div class="cal-cell${isHoy?' hoy':''}${isSel?' sel':''}" data-date="${ds}">
      <span class="cal-num">${d}</span>
      ${dt.length ? `<div class="cal-dots">${dt.slice(0,3).map(t =>
        `<span class="cal-dot${t.done?' done':hasUrgent&&!t.done?' urgent':''}"></span>`
      ).join('')}${dt.length>3?`<span class="cal-more">+${dt.length-3}</span>`:''}</div>` : ''}
    </div>`;
  });
  html += '</div>';
  document.getElementById('cal-grid').innerHTML = html;

  document.querySelectorAll('.cal-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      _calSelDay = cell.dataset.date;
      renderCalendario();
      _renderCalDay(taskMap[_calSelDay] || [], _calSelDay);
    });
  });
  if (_calSelDay) _renderCalDay(taskMap[_calSelDay] || [], _calSelDay);
}

function _renderCalDay(tareas, dateStr) {
  const el = document.getElementById('cal-day-tasks');
  if (!tareas.length) { el.classList.add('hidden'); return; }
  const label = new Date(dateStr + 'T00:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
  el.classList.remove('hidden');
  el.innerHTML = `<div class="cdt-title">${label.toUpperCase()}</div>` +
    tareas.map(t => `<div class="cdt-item${t.done?' done':''}">
      <span class="cdt-dot prio-${t.prioridad||'media'}"></span>
      <span class="cdt-text">${t.text.replace(/</g,'&lt;')}</span>
      ${t.done ? '<span class="cdt-badge">✓</span>' : ''}
    </div>`).join('');
}

// ── Exportar / Importar backup ───────────────────────────
function exportarBackup() {
  const data = {};
  Object.keys(localStorage).filter(k => k.startsWith('arex_')).forEach(k => {
    try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); }
  });
  const blob = new Blob([JSON.stringify({ version: 1, date: new Date().toISOString(), data }, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `AREX_backup_${_todayStr()}.json` });
  a.click(); URL.revokeObjectURL(url);
}

function importarBackup(file) {
  if (!file) return;
  const statusEl = document.getElementById('import-status');
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const { data } = JSON.parse(e.target.result);
      if (!data) throw new Error('Formato inválido');
      Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
      statusEl.style.color = '#22d3ee';
      statusEl.textContent = '✓ Datos restaurados. Recargando...';
      setTimeout(() => location.reload(), 1500);
    } catch {
      statusEl.style.color = '#ff4444';
      statusEl.textContent = '✗ Archivo inválido.';
    }
  };
  reader.readAsText(file);
}
window.exportarBackup  = exportarBackup;
window.importarBackup  = importarBackup;

function _renderSyncBadge() {
  const badge = document.getElementById('dash-sync-badge');
  if (!badge) return;
  if (!window._arexLastSync) { badge.textContent = ''; badge.style.display = 'none'; return; }
  const mins = Math.round((Date.now() - window._arexLastSync) / 60000);
  const ok   = mins < 5;
  badge.style.display = '';   // el HTML lo crea con display:none — sin esto jamás se veía
  badge.innerHTML = `<span style="color:${ok?'#34ffc3':'#ff9900'}">● FB ${mins === 0 ? 'SYNC' : mins + 'min'}</span>`;
}

function renderDashboard() {
  const el = document.getElementById('dash-content');
  if (!el) return;

  // Gather live stats
  const tareas       = getTareas();
  const pendTotal    = tareas.filter(t => !t.done).length;
  const urgentes     = tareas.filter(t => { if (t.done) return false; const u = urgenciaTarea(t); return u?.cls==='urg-vencida'||u?.cls==='urg-hoy'; }).length;
  const margen       = typeof calcularMargenReal === 'function' ? calcularMargenReal() : calcularMargen();
  const margenStr    = typeof formatearMoneda === 'function' ? formatearMoneda(margen) : `$${margen}`;
  const metasActivas = (typeof getMetas === 'function') ? getMetas().filter(m => !m.completada).length : 0;
  const hoyStr       = window.hoy();   // v216: era UTC
  const habitos      = _safeJSON(localStorage.getItem('arex_habitos'), []);
  const habsHoy      = habitos.filter(h => h.completados?.[hoyStr]).length;
  const notas        = _safeJSON(localStorage.getItem('arex_notas'), []).length;
  const proyectos    = _safeJSON(localStorage.getItem('arex_proyectos'), []).filter(p => p.estado !== 'completado').length;
  const groqOk       = !!(window.AREX_CONFIG?.groqKey);
  const fbOk         = !!(window._arexDb);
  const gemOk        = !!(window.AREX_CONFIG?.geminiKey);

  el.innerHTML = `
    <!-- v215 · Fuera el saludo. Ocupaba pantalla para decir algo que ya
         sabes y que no cambia nunca. Los datos empiezan arriba. -->
    <!-- v220 · Marcado reescrito sobre el sistema de diseño (diseno.css).
         Los <div onclick> pasan a <button>: responden al teclado, los
         anuncia el lector de pantalla y :focus-visible funciona solo. -->
    <div class="dx-centros-wrap">
      <div class="dx-seccion">
        <span class="dx-etq">Centros operativos</span>
      </div>

      <div class="dx-centros">
        <button type="button" class="dx-sup dx-centro"
                ${margen < 0 ? 'data-acento="alerta"' : ''}
                onclick="abrirCentro('capital');cambiarModulo('finanzas')">
          <span class="dx-centro-ico" aria-hidden="true">💰</span>
          <span class="dx-etq">Capital</span>
          <span class="dx-centro-subs">Finanzas · Gastos · Negocio · Reparto</span>
          <span class="dx-cifra"${margen < 0 ? ' style="color:var(--alerta)"' : ''}>${margenStr}<span class="dx-unidad">margen</span></span>
        </button>

        <button type="button" class="dx-sup dx-centro"
                ${urgentes ? 'data-acento="aviso"' : ''}
                onclick="abrirCentro('impulso');cambiarModulo('metas')">
          <span class="dx-centro-ico" aria-hidden="true">🎯</span>
          <span class="dx-etq">Impulso</span>
          <span class="dx-centro-subs">Metas · Tareas · Agenda · Hábitos</span>
          <span class="dx-cifra">${pendTotal}<span class="dx-unidad">tarea${pendTotal!==1?'s':''}</span></span>
          ${urgentes ? `<span class="dx-ins" data-tono="aviso">${urgentes} urgente${urgentes!==1?'s':''}</span>` : ''}
        </button>

        <button type="button" class="dx-sup dx-centro"
                onclick="abrirCentro('mente');cambiarModulo('notas')">
          <span class="dx-centro-ico" aria-hidden="true">🧠</span>
          <span class="dx-etq">Mente</span>
          <span class="dx-centro-subs">Notas · Evidencias · Proyectos</span>
          <span class="dx-cifra">${notas}<span class="dx-unidad">nota${notas!==1?'s':''}</span></span>
        </button>

        <button type="button" class="dx-sup dx-centro"
                ${(groqOk && fbOk) ? '' : 'data-acento="alerta"'}
                onclick="abrirCentro('control');cambiarModulo('control')">
          <span class="dx-centro-ico" aria-hidden="true">⚙️</span>
          <span class="dx-etq">Control</span>
          <span class="dx-centro-subs">Telemetría · Agentes · Bitácora</span>
          <div class="dx-servicios">
            <span class="dx-ins" data-tono="${groqOk?'ok':'apagado'}">IA</span>
            <span class="dx-ins" data-tono="${fbOk?'ok':'apagado'}">DB</span>
            <span class="dx-ins" data-tono="${gemOk?'ok':'apagado'}">VIS</span>
          </div>
        </button>

        <button type="button" class="dx-sup dx-centro dx-centro-ancho"
                onclick="window.cambiarModulo('chat')">
          <span class="dx-centro-ico" aria-hidden="true">💬</span>
          <span class="dx-centro-txt">
            <span class="dx-etq">Hablar con AREX</span>
            <span class="dx-centro-subs">Chat · voz · comandos · visión</span>
          </span>
        </button>
      </div>

      <!-- Los rellena widgets.js / notas.js si hay algo que mostrar -->
      <div id="dash-weather"      class="dx-sup" style="margin-top:var(--e-3)"></div>
      <div id="dash-rec-body"     class="dx-sup" style="margin-top:var(--e-3)"></div>
      <div id="dash-notas-widget" class="dx-sup" style="margin-top:var(--e-3);display:none">
        <div class="dash-notas-body"></div>
      </div>

      <div class="dx-sistema">
        <span data-tono="${groqOk?'ok':'alerta'}">GROQ <b>${groqOk?'EN LÍNEA':'SIN CLAVE'}</b></span>
        <span data-tono="${fbOk?'ok':'aviso'}">NUBE <b>${fbOk?'ENLAZADA':'SOLO LOCAL'}</b></span>
        <span data-tono="ok">AREX <b>ACTIVO</b></span>
      </div>
    </div>
    <span id="dash-sync-badge" class="dash-sync-badge" style="display:none"></span>
  `;
  // Fetch live exchange rate (async, non-blocking)
  if (typeof renderExchangeWidget === 'function') renderExchangeWidget();
  // Clima, recordatorios y notas fijadas — sus contenedores acaban de
  // crearse arriba; sin estas llamadas los widgets quedaban muertos (v175/v176)
  renderWeatherWidget();
  _refreshRecWidget();
  renderNotasWidget();
}

function renderSessionsList() {
  const container = document.getElementById('sessions-list');
  if (!container) return;
  const sessions = getSessions();
  const currentSid = getCurrentSid();
  if (!sessions.length) {
    container.innerHTML = '<div class="session-empty">Sin sesiones guardadas</div>';
    return;
  }
  container.innerHTML = sessions.map(s => `
    <div class="session-item${s.id === currentSid ? ' active' : ''}" data-sid="${s.id}">
      <div class="session-info">
        <div class="session-name">${s.name.replace(/</g,'&lt;')}</div>
        <div class="session-preview">${(s.preview||'—').replace(/</g,'&lt;').slice(0,50)}</div>
      </div>
      <button class="session-del" data-del="${s.id}" title="Eliminar">✕</button>
    </div>`).join('');
  container.querySelectorAll('.session-item .session-info').forEach(el => {
    el.addEventListener('click', () => loadSession(el.closest('[data-sid]').dataset.sid));
  });
  container.querySelectorAll('.session-del').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); deleteSession(btn.dataset.del); });
  });
}

/* ── Métrica de memoria ─────────────────────────────── */
function updateMemMetric() {
  const c = history.length;
  barMem.style.width = Math.min(100, Math.round((c/100)*100)) + '%';
  valMem.textContent = c + ' msg';
  updateSessionStats();
}

/* ── Panel lateral (sidebar) ────────────────────────── */
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
  updateSidebarAll();
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
}
function setDot(dotId, valId, state, label) {
  const dot = document.getElementById(dotId);
  const val = document.getElementById(valId);
  if (!dot || !val) return;
  dot.className = `ss-dot ${state}`;
  val.textContent = label;
}
function updateSystemStatus() {
  const hasGroq     = !!AREX_CONFIG?.groqKey;
  const hasTavily   = !!AREX_CONFIG?.tavilyKey;
  const hasFirebase = !!db;
  setDot('sdot-groq',     'sval-groq',     hasGroq     ? 'on-line'  : 'on-off', hasGroq     ? 'ONLINE'   : 'NO CONFIG');
  setDot('sdot-tavily',   'sval-tavily',   hasTavily   ? 'on-ready' : 'on-off', hasTavily   ? 'LISTO'    : 'NO CONFIG');
  setDot('sdot-firebase', 'sval-firebase', hasFirebase ? 'on-line'  : 'on-off', hasFirebase ? 'ACTIVO'   : 'OFFLINE');
}
function syncModeBtn(id, active) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.classList.toggle('on', active);
  const st = btn.querySelector('.mt-st');
  if (st) st.textContent = active ? 'ON' : 'OFF';
}
function updateSidebarModes() {
  syncModeBtn('sb-search',     searchOn);
  syncModeBtn('sb-exam',       examMode);
  syncModeBtn('sb-voice',      voiceOn);
  syncModeBtn('sb-continuous', continuousMode);
  orb.classList.toggle('ar-active', continuousMode);
  const arHud = document.getElementById('ar-hud');
  if (arHud) arHud.classList.toggle('visible', continuousMode);
  // Mode strip
  const strip = document.getElementById('mode-strip');
  const modeVal = document.getElementById('sb-mode-val');
  if (!strip) return;
  const pills = [];
  if (continuousMode) pills.push(`<span class="mode-pill mp-ar">MODO AR</span>`);
  if (searchOn) pills.push(`<span class="mode-pill mp-search">BÚSQUEDA ACTIVA</span>`);
  if (examMode) pills.push(`<span class="mode-pill mp-exam">MODO EXAMEN</span>`);
  if (voiceOn)  pills.push(`<span class="mode-pill mp-voice">VOZ ACTIVA</span>`);
  strip.innerHTML = pills.join('');
  strip.classList.toggle('hidden', pills.length === 0);
  if (modeVal) modeVal.textContent = continuousMode ? 'MODO AR' : examMode ? 'EXAMEN' : searchOn ? 'BÚSQUEDA' : 'ESTÁNDAR';
}
function updateStatusBadge(estado) {
  const el = document.getElementById('arex-status-badge');
  if (!el) return;
  const map = {
    calmado:     { label: 'EN ESPERA',    cls: ''             },
    procesando:  { label: 'PROCESANDO',   cls: 'procesando'   },
    hablando:    { label: 'HABLANDO',     cls: 'hablando'     },
    escuchando:  { label: 'ESCUCHANDO',   cls: 'escuchando'   },
    sinconexion: { label: 'SIN CONEXIÓN', cls: 'procesando'   },
  };
  const e = map[estado] || map.calmado;
  el.className = `hdr-mode ${e.cls}`;
  el.textContent = e.label;
}
window.updateStatusBadge = updateStatusBadge;

function updateSessionStats() {
  const sbMsgs = document.getElementById('sb-msgs');
  const sbMem  = document.getElementById('sb-mem');
  if (sbMsgs) sbMsgs.textContent = history.length;
  if (sbMem)  sbMem.textContent  = `${loadMemoria().length} / 20`;
}
function updateSidebarAll() {
  updateSystemStatus();
  updateSidebarModes();
  updateSessionStats();
  renderSessionsList();
}

/* ── HUD Dashboard Panels ───────────────────────────── */
function renderHudPanels() {
  const fmt = n => '$' + Number(n).toLocaleString('es-MX', { maximumFractionDigits: 0 });

  // TAREAS panel
  const tareaBody = document.getElementById('hp-tareas-body');
  if (tareaBody) {
    const all  = typeof window.getTareas === 'function' ? window.getTareas() : [];
    const pend = all.filter(t => !t.done);
    if (!pend.length) {
      tareaBody.innerHTML = '<span class="hp-ok">✓ Todo al día</span>';
    } else {
      const hoy = window.hoy();   // v216: era UTC
      const urg = pend.filter(t => t.fecha && t.fecha <= hoy);
      const first = (urg[0] || pend[0]).text.slice(0, 26);
      tareaBody.innerHTML =
        `<div class="hp-num">${pend.length}<span class="hp-unit"> pendientes</span></div>` +
        (urg.length ? `<div class="hp-warn">⚠ ${urg.length} urgente${urg.length > 1 ? 's' : ''}</div>` : '') +
        `<div class="hp-sub">${first}</div>`;
    }
  }

  // FINANZAS panel
  const finBody = document.getElementById('hp-finanzas-body');
  if (finBody && typeof window.getFinanzasData === 'function') {
    const d   = window.getFinanzasData();
    const ing = d.config?.ingresoMensual || 0;
    const mar = typeof window.calcularMargen === 'function' ? window.calcularMargen() : 0;
    const deu = typeof window.calcularDeudaTotal === 'function' ? window.calcularDeudaTotal() : 0;
    finBody.innerHTML =
      `<div class="hp-row"><span class="hp-lbl">Ingreso</span><span class="hp-val">${fmt(ing)}</span></div>` +
      (deu ? `<div class="hp-row"><span class="hp-lbl">Deuda</span><span class="hp-val hp-red">${fmt(deu)}</span></div>` : '') +
      `<div class="hp-row"><span class="hp-lbl">Margen</span><span class="hp-val hp-green">${fmt(mar)}</span></div>`;
  }

  // Stat chips (móvil)
  const chips = document.getElementById('stat-chips');
  if (chips) {
    const all    = typeof window.getTareas === 'function' ? window.getTareas() : [];
    const pend   = all.filter(t => !t.done).length;
    const metas  = typeof window.getMetas === 'function' ? window.getMetas().filter(m => !m.completada).length : 0;
    const mar    = typeof window.calcularMargen === 'function' ? window.calcularMargen() : null;
    const parts  = [];
    if (pend)       parts.push(`<span class="stat-chip">${pend} tareas</span>`);
    if (mar != null && mar !== 0) parts.push(`<span class="stat-chip">${fmt(mar)} margen</span>`);
    if (metas)      parts.push(`<span class="stat-chip">${metas} metas</span>`);
    chips.innerHTML = parts.join('');
    chips.style.display = parts.length ? 'flex' : 'none';
  }
}
window.renderHudPanels = renderHudPanels;

/* ── Matrix code rain ───────────────────────────────── */
function initMatrixRain() {
  const FRAGS = ['def','if','else','return','const','let','class','=>','{}','[]','()',
    'true','false','null','async','await','for','while','try','catch','new',
    'import','export','fn','var','===','&&','||','0x','str','int','arr',
    '.js','.py','++','--','obj','map','get','set','use','run'];

  ['matrix-l','matrix-r'].forEach(id => {
    const c = document.getElementById(id);
    if (!c || window.innerWidth < 780) return;   // skip on narrow screens
    const ctx2 = c.getContext('2d');
    const W = 48, H = window.innerHeight;
    c.width = W; c.height = H;
    const COLS = 4;
    const drops = Array.from({ length: COLS }, () => ({
      y: -Math.random() * H, speed: 6 + Math.random() * 10,
      frag: FRAGS[Math.floor(Math.random() * FRAGS.length)]
    }));
    function tick() {
      if (document.hidden || window._arexVisionOpen) return;
      ctx2.fillStyle = 'rgba(0,0,0,0.04)';
      ctx2.fillRect(0, 0, W, H);
      drops.forEach((d, i) => {
        ctx2.fillStyle = `rgba(0,212,255,${0.08 + Math.random() * 0.1})`;
        ctx2.font = '8px "Courier New"';
        ctx2.fillText(d.frag, i * 12, d.y);
        d.y += d.speed;
        if (d.y > H) {
          d.y = -20 - Math.random() * 80;
          d.frag = FRAGS[Math.floor(Math.random() * FRAGS.length)];
        }
      });
    }
    setInterval(tick, 90);
  });
}

/* ── City / weather badge below orb ────────────────── */
function updateCityBadge(city, temp, icon) {
  const el = document.getElementById('city-badge');
  if (!el) return;
  if (!city) { el.style.display = 'none'; return; }
  el.innerHTML = `<span class="cb-city">${city}</span>${temp ? `<span class="cb-temp">${Math.round(temp)}°</span>` : ''}${icon ? `<span class="cb-ico">${icon}</span>` : ''}`;
  el.style.display = 'flex';
}
window.updateCityBadge = updateCityBadge;

/* ── Estado del orb ─────────────────────────────────── */
function setOrb(state, label) {
  orb.classList.remove('speaking','listening','thinking','searching');
  if (state) orb.classList.add(state);
  // Update floating status pill above orb
  const sf = document.getElementById('status');
  if (sf) {
    const stateLabels = { thinking:'PROCESANDO', searching:'BUSCANDO', speaking:'HABLANDO', listening:'ESCUCHANDO' };
    sf.textContent = `AREX · ${stateLabels[state] || 'EN ESPERA'}`;
  }
  // Keep statusTxt alias for any other code
  if (statusTxt) statusTxt.textContent = label ?? '';
  if (state === 'thinking' || state === 'searching') {
    updateStatusBadge('procesando');
    window.arexReactorSetState?.('processing');
  } else if (state === 'speaking') {
    updateStatusBadge('hablando');
    window.arexReactorSetState?.('speaking');
  } else if (state === 'listening') {
    updateStatusBadge('escuchando');
    window.arexReactorSetState?.('listening');
  } else {
    updateStatusBadge('calmado');
    window.arexReactorSetState?.('calm');
  }
}

/* ── Render mensajes ────────────────────────────────── */
/* ── Quick reply chips ───────────────────────────────── */
const _QUICK_RULES = [
  { re:/finanzas|deuda|pago|tarjeta|presupuesto|saldo/, chips:['Ver finanzas','¿Cuánto debo?','Resumen financiero'] },
  { re:/tarea|pendiente|hacer|lista|completar/,         chips:['Ver tareas','Nueva tarea','¿Qué está pendiente?'] },
  { re:/meta|objetivo|progreso|logro/,                  chips:['Ver metas','Actualizar progreso','¿Qué metas tengo?'] },
  { re:/nota|apuntar|guardar|anotar/,                   chips:['Ver notas','Nueva nota'] },
  { re:/proyecto|sprint|avance|entrega/,                chips:['Ver proyectos','Estado del proyecto'] },
  { re:/negocio|venta|cliente|ingreso|frijol|mayocoba|reparto/,        chips:['Ver negocio','Registrar venta'] },
  { re:/clima|temperatura|lluvia|pronóstico/,           chips:['¿Cómo estará el clima mañana?','Pronóstico semanal'] },
  { re:/recuerda|recordatorio|mañana a las/,            chips:['Ver recordatorios','/recordar 30min mensaje'] },
];
const _GENERIC_CHIPS = ['Continuar','Cuéntame más','OK, gracias'];

function _showQuickReplies(replyText) {
  const el = document.getElementById('quick-replies');
  if (!el) return;
  const lower = replyText.toLowerCase();
  const matched = _QUICK_RULES.find(r => r.re.test(lower));
  const chips = matched ? matched.chips : _GENERIC_CHIPS;
  el.innerHTML = chips.map(c =>
    `<button class="quick-chip">${c.replace(/</g,'&lt;')}</button>`
  ).join('');
  el.querySelectorAll('.quick-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      txt.value = btn.textContent;
      el.innerHTML = '';
      btnSend.click();
    });
  });
}

function _clearQuickReplies() {
  const el = document.getElementById('quick-replies');
  if (el) el.innerHTML = '';
}

function addMsg(role, text, sources) {
  document.querySelector('.welcome')?.remove();
  const wrap = document.createElement('div');
  wrap.className = `msg ${role}`;
  const contentHTML = role === 'user'
    ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')
    : renderMarkdown(text);
  let srcHTML = '';
  if (sources?.length) {
    srcHTML = `<div class="sources">FUENTES: ${
      sources.map((s,i) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">[${i+1}] ${s.title||s.url}</a>`).join(' · ')
    }</div>`;
  }
  const actionsHTML = role !== 'user'
    ? `<div class="msg-actions"><button class="msg-copy" title="Copiar">⎘</button><button class="msg-star" title="Guardar en Evidencias">☆</button></div>`
    : '';
  wrap.innerHTML = `<span class="who">${role==='user'?'TÚ':'AREX'}</span><div class="bubble">${contentHTML}</div>${actionsHTML}${srcHTML}`;
  if (role !== 'user') {
    wrap.querySelector('.msg-copy')?.addEventListener('click', () => {
      const text = wrap.querySelector('.bubble').textContent;
      navigator.clipboard.writeText(text).then(() => {
        const btn = wrap.querySelector('.msg-copy');
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '⎘', 1500);
      }).catch(() => {});
    });
    wrap.querySelector('.msg-star')?.addEventListener('click', function() {
      const body = wrap.querySelector('.bubble').textContent.slice(0, 600);
      if (typeof addEvidencia === 'function') {
        addEvidencia('general', 'Respuesta guardada', body);
        this.textContent = '★';
        this.style.color = '#ff9900';
      }
    });
  }
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  if (role !== 'user') applyHighlight(wrap);
  return wrap.querySelector('.bubble');
}
window.addMsg = addMsg;   // usada por memoria.js

/* ── Typewriter ─────────────────────────────────────── */
function typewrite(bubble, text) {
  return new Promise(resolve => {
    const words = text.split(' ');
    let i = 0;
    bubble.textContent = '';
    const iv = setInterval(() => {
      if (i < words.length) {
        bubble.textContent = words.slice(0, i + 1).join(' ');
        i++;
        chat.scrollTop = chat.scrollHeight;
      } else {
        clearInterval(iv);
        bubble.innerHTML = renderMarkdown(text);
        applyHighlight(bubble);
        chat.scrollTop = chat.scrollHeight;
        resolve();
      }
    }, 36);
  });
}

/* ── Helpers de render de respuesta AREX ────────────── */
function makeArexWrap(srcHTML = '') {
  document.querySelector('.welcome')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg arex';
  wrap.innerHTML = `<span class="who">AREX</span><div class="bubble"></div><div class="msg-actions"><button class="msg-copy" title="Copiar">⎘</button><button class="msg-regen" title="Regenerar">↺</button></div>${srcHTML}`;

  wrap.querySelector('.msg-copy').addEventListener('click', () => {
    const text = _msgRaw.get(wrap) || wrap.querySelector('.bubble').textContent;
    navigator.clipboard.writeText(text).then(() => {
      const btn = wrap.querySelector('.msg-copy');
      const prev = btn.textContent;
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = prev, 1500);
    }).catch(() => {});
  });

  wrap.querySelector('.msg-regen').addEventListener('click', async () => {
    if (isBusy) return;
    if (history.length && history[history.length - 1].role === 'assistant') history.pop();
    if (!history.length || history[history.length - 1].role !== 'user') return;
    wrap.remove();
    isBusy = true; btnSend.disabled = true;
    setOrb('thinking', 'Regenerando...');
    showThinking();
    try {
      const newWrap = makeArexWrap();
      hideThinking();
      const reply = await streamArexReply(newWrap, null);
      history.push({ role: 'assistant', content: reply });
      await saveMsg('assistant', reply);
      saveCurrentSession();
      if (voiceOn) arexSpeak(reply); else setOrb(null, 'En espera de instrucciones');
    } catch(err) {
      hideThinking();
      addMsg('arex', `Error al regenerar: ${err.message}`);
      setOrb(null, 'En espera de instrucciones');
    } finally {
      isBusy = false; btnSend.disabled = false;
    }
  });

  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}

/* ── Sistema de acciones ────────────────────────────── */
const _ACCION_RE = /<arex:accion([^>]*)\/>/g;

function _parseAttrs(str) {
  const a = {};
  str.replace(/(\w+)="([^"]*)"/g, (_, k, v) => { a[k] = v; });
  return a;
}

function addNotaProgrammatic(titulo, cuerpo) {
  const arr  = getNotas();
  const id   = String(Date.now());
  arr.unshift({ id, titulo: titulo || '', cuerpo: cuerpo || '', pinned: false, color: '', createdAt: Date.now(), updatedAt: Date.now() });
  saveNotas(arr);
  if (document.getElementById('module-notas')?.classList.contains('active')) renderNotas();
  renderDashboard();
}

function _stripAcciones(text) {
  return text.replace(/<arex:accion[^>]*\/>/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

async function ejecutarAcciones(rawText, wrap) {
  const pills = [];
  const re    = /<arex:accion([^>]*)\/>/g;
  let m;
  while ((m = re.exec(rawText)) !== null) {
    const a = _parseAttrs(m[1]);
    switch (a.tipo) {
      case 'addTarea':
        addTarea(a.texto || '', a.fecha || '', a.prioridad || 'media');
        pills.push({ icon: '✓', label: `Tarea: ${a.texto || ''}`, cls: 'apill-tarea' });
        break;
      case 'addNota':
        addNotaProgrammatic(a.titulo || '', a.cuerpo || '');
        pills.push({ icon: '📝', label: a.titulo ? `Nota: ${a.titulo}` : 'Nota creada', cls: 'apill-nota' });
        break;
      case 'recordar': {
        const ms = (parseInt(a.mins) || 30) * 60000;
        saveReminder(ms, a.msg || a.texto || '');
        pills.push({ icon: '⏰', label: `Recordatorio: ${a.msg || a.texto || ''}`, cls: 'apill-rec' });
        break;
      }
      case 'hecho':
        addHecho(a.texto || '', 'arex');
        break;
      case 'modulo':
        AREXNav?.cambiarModulo(a.nombre || '');
        pills.push({ icon: '→', label: `Módulo: ${a.nombre || ''}`, cls: 'apill-nav' });
        break;
    }
  }

  if (pills.length && wrap) {
    const el = document.createElement('div');
    el.className = 'accion-pills';
    el.innerHTML = pills.map(p =>
      `<span class="apill ${p.cls}">${p.icon} <span>${p.label.replace(/</g,'&lt;').slice(0,60)}</span></span>`
    ).join('');
    wrap.appendChild(el);
  }

  return pills.length;
}

async function renderArexReply(wrap, text) {
  const clean = _stripAcciones(text);
  await typewrite(wrap.querySelector('.bubble'), clean);
  _msgRaw.set(wrap, clean);
  await ejecutarAcciones(text, wrap);
}

async function streamArexReply(wrap, webCtx) {
  const bubble = wrap.querySelector('.bubble');
  bubble.classList.add('streaming');
  bubble.textContent = '';
  const full = await callGroqStream(webCtx, accumulated => {
    bubble.textContent = _stripAcciones(accumulated);
    chat.scrollTop = chat.scrollHeight;
  });
  bubble.classList.remove('streaming');
  const clean = _stripAcciones(full);
  bubble.innerHTML = renderMarkdown(clean);
  applyHighlight(bubble);
  _msgRaw.set(wrap, clean);
  chat.scrollTop = chat.scrollHeight;
  await ejecutarAcciones(full, wrap);

  if (typeof logBitacora === 'function') logBitacora('chat', `Respuesta generada (${full?.length || 0} chars)`);

  // Detectar si crear tarjeta de evidencia
  if (full && typeof addEvidencia === 'function') {
    const msgLower = (history[history.length - 2]?.content || '').toLowerCase();
    const isFinance = /analiza.*finanz|resumen.*finanz|estado.*finanz|deuda|tarjeta.*credito/.test(msgLower);
    const isResearch = /investiga|busca informacion|que es|quien es|como funciona/.test(msgLower) && webCtx;
    const isBriefing = /briefing|resumen del dia|como va el dia/.test(msgLower);
    if (isFinance) addEvidencia('finanzas', 'Análisis Financiero', full.slice(0, 600));
    else if (isResearch) addEvidencia('investigacion', msgLower.slice(0, 60), full.slice(0, 600));
    else if (isBriefing) addEvidencia('general', 'Briefing del día', full.slice(0, 600));
  }

  return clean;
}

/* ── Indicador pensando ─────────────────────────────── */
function showThinking() {
  document.querySelector('.welcome')?.remove();
  const d = document.createElement('div');
  d.className = 'msg arex'; d.id = 'thinking';
  d.innerHTML = `<span class="who">AREX</span><div class="bubble"><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
  chat.appendChild(d);
  chat.scrollTop = chat.scrollHeight;
}
function hideThinking() { document.getElementById('thinking')?.remove(); }

/* ── Voz del asistente (dinámica por perfil) ────────── */
// Prioriza voces PREMIUM/MEJORADAS del sistema (iOS: Ajustes → Accesibilidad →
// Contenido hablado → Voces → descargar la versión Premium/Mejorada): son
// neurales, gratis, offline y sin latencia — misma API, mucha mejor calidad
function _isPremiumVoice(v) {
  const s = `${v.name} ${v.voiceURI}`.toLowerCase();
  return s.includes('premium') || s.includes('enhanced') || s.includes('mejorada') || s.includes('neural');
}
function getVoice(profile) {
  const voices = window.speechSynthesis.getVoices();
  const gender = profile?.voiceGender || 'male';
  const names = gender === 'female'
    ? ['paulina','lucia','sofia','valentina','rosa','sabina','monica','google español','microsoft sabina']
    : ['pablo','jorge','diego','carlos','miguel','david','google español','microsoft pablo','microsoft jorge'];
  const esMatch = v => v.lang.startsWith('es') && names.some(n => v.name.toLowerCase().includes(n));
  return voices.find(v => esMatch(v) && _isPremiumVoice(v))                       // nombre preferido + premium
      || voices.find(v => v.lang.startsWith('es') && _isPremiumVoice(v))          // cualquier es premium
      || voices.find(esMatch)                                                     // nombre preferido estándar
      || voices.find(v => v.lang.startsWith('es'));                               // cualquier español
}
// Compatibilidad: getMaleVoice usada en otros lugares
function getMaleVoice() { return getVoice({ voiceGender: 'male' }); }

function arexSpeak(text) {
  if (!voiceOn && !continuousMode) return;
  const p = window._arexProfile;
  window.speechSynthesis.cancel();
  clearInterval(_iosVoiceKa);
  isSpeaking = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-MX'; u.rate = p?.voiceRate ?? 0.91; u.pitch = p?.voicePitch ?? 0.78; u.volume = 1;
  const v = getVoice(p); if (v) u.voice = v;
  u.onstart = () => {
    setOrb('speaking','Transmitiendo respuesta');
    // Show speaking dots on last AREX message
    const lastArex = [...document.querySelectorAll('.msg.arex .bubble')].at(-1);
    if (lastArex && !lastArex.querySelector('.arex-speaking-dot')) {
      const dot = document.createElement('span');
      dot.className = 'arex-speaking-dot';
      dot.innerHTML = '<span></span><span></span><span></span>';
      lastArex.appendChild(dot);
    }
    // iOS Safari pausa speechSynthesis internamente cada ~15s — keep-alive
    _iosVoiceKa = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 5000);
    if (continuousMode && _continuousRec) {
      _continuousRestart = false;
      try { _continuousRec.stop(); } catch(e) {}
    }
  };
  u.onend = () => {
    isSpeaking = false;
    clearInterval(_iosVoiceKa);
    document.querySelectorAll('.arex-speaking-dot').forEach(d => d.remove());
    setOrb(null);
    if (continuousMode) {
      _continuousRestart = true;
      setTimeout(() => {
        if (continuousMode && _continuousRec) {
          try { _continuousRec.start(); } catch(e) {}
        }
      }, 700);
    }
  };
  u.onerror = () => {
    isSpeaking = false;
    clearInterval(_iosVoiceKa);
    setOrb(null);
    if (continuousMode) { _continuousRestart = true; }
  };
  window.speechSynthesis.speak(u);
}

/* ── Notificaciones ─────────────────────────────────── */
const _notifTimers = new Map();

async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  await Notification.requestPermission();
  _updateNotifStatus();
  if (Notification.permission === 'granted') scheduleTaskNotifications();
}

function _updateNotifStatus() {
  const el = document.getElementById('notif-status');
  if (!el) return;
  const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
  const labels = { granted: '✓ ACTIVADAS', denied: '✗ BLOQUEADAS', default: 'SIN CONFIGURAR', unsupported: 'NO SOPORTADO' };
  const colors  = { granted: '#22d3ee', denied: '#ff4444', default: '#4a7a96', unsupported: '#4a7a96' };
  el.textContent = labels[perm] || perm;
  el.style.color  = colors[perm]  || '#4a7a96';
}

function _showTaskNotif(t, label) {
  if (Notification.permission !== 'granted') return;
  const n = new Notification(`AREX — ${label}`, {
    body: t.text, icon: './icon.svg', tag: 'arex-task-' + t.id, renotify: true
  });
  n.onclick = () => { window.focus(); AREXNav?.cambiarModulo('tareas'); n.close(); };
}

function scheduleTaskNotifications() {
  _notifTimers.forEach(id => clearTimeout(id));
  _notifTimers.clear();
  if (Notification.permission !== 'granted') return;
  const now = Date.now();
  getTareas().filter(t => !t.done && t.fecha).forEach(t => {
    const due    = new Date(t.fecha + 'T09:00:00').getTime();
    const before = due - 86400000;
    if (before > now) _notifTimers.set(t.id + 'b', setTimeout(() => _showTaskNotif(t, 'MAÑANA VENCE'), before - now));
    if (due    > now) _notifTimers.set(t.id + 'd', setTimeout(() => _showTaskNotif(t, 'VENCE HOY'),    due    - now));
  });
}
window.scheduleTaskNotifications = scheduleTaskNotifications;   // usada por tareas.js
window.requestNotifPermission = requestNotifPermission;

/* ── Comandos de voz ────────────────────────────────── */
const VOICE_CMDS = [
  { phrases:['limpiar chat','borrar chat','limpiar conversación'],  cmd:'/limpiar'  },
  { phrases:['exportar chat','descargar chat','exportar conversación'], cmd:'/exportar' },
  { phrases:['modo examen','activar examen','modo de examen'],      cmd:'/examen'   },
  { phrases:['abrir notas','ver notas','mis notas'],                cmd:'/notas'    },
  { phrases:['ver estadísticas','estadísticas del sistema'],        cmd:'/stats'    },
  { phrases:['ver hechos','mis hechos','qué recuerdas','memoria aprendida'], cmd:'/hechos' },
  { phrases:['ver comandos','mostrar ayuda','ayuda'],               cmd:'/ayuda'    },
  { phrases:['activar búsqueda','búsqueda web','buscar en internet'], cmd:'__search__' },
  { phrases:['resumir conversación','resume la conversación'],      cmd:'/resumir'  },
  { phrases:['qué ves','qué estás viendo','describe lo que ves','enciende la cámara','activa la cámara'], cmd:'__vision_describe__' },
  { phrases:['identifica esto','qué es esto','identifica el producto','escanea esto','analiza esto'], cmd:'__vision_product__' },
  { phrases:['lee esto','lee el texto','escanea el texto','transcribe esto'],  cmd:'__vision_text__' },
  { phrases:['analiza la escena','describe la escena','qué hay aquí'],         cmd:'__vision_scene__' },
  { phrases:['modo ar','activa ar','encender ar','iniciar ar'],                cmd:'__ar_mode__'     },
  { phrases:['apagar cámara','cerrar cámara','cerrar visión'],                 cmd:'__close_vision__'},
  { phrases:['mis finanzas','ver finanzas','estado de finanzas'],              cmd:'__finanzas__'    },
  { phrases:['mis tareas','ver tareas','tareas pendientes'],                   cmd:'__tareas__'      },
  { phrases:['mis metas','ver metas','estado de metas'],                       cmd:'__metas__'       },
  { phrases:['mi negocio','ver negocio','estado del negocio'],                 cmd:'__negocio__'     },
  { phrases:['silencio','cállate','para de hablar','detente'],                 cmd:'__stop_voice__'  },
];

/* ── Reconocimiento de voz ──────────────────────────── */
function stopListening() {
  clearTimeout(_listenTimer); _listenTimer = null;
  if (_listenRec) { try { _listenRec.abort(); } catch(e) {} _listenRec = null; }
  btnMic.classList.remove('on');
  _playTone('mic-off');
  setOrb(null, 'En espera de instrucciones');
}

function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addMsg('arex','Reconocimiento de voz no disponible en este navegador. Usa Chrome, Edge o Safari.'); return; }

  const rec = new SR();
  _listenRec = rec;
  rec.lang = 'es-MX'; rec.interimResults = false; rec.maxAlternatives = 1;
  btnMic.classList.add('on');
  _playTone('mic-on');
  setOrb('listening','Escuchando...');

  // Timeout de seguridad: si no detecta nada en 12s, libera el mic
  _listenTimer = setTimeout(() => {
    stopListening();
    addMsg('arex', 'No escuché nada. Intenta de nuevo.');
  }, 12000);

  rec.onresult = async e => {
    clearTimeout(_listenTimer); _listenTimer = null;
    btnMic.classList.remove('on');
    const transcript = e.results?.[0]?.[0]?.transcript;
    if (!transcript) { stopListening(); return; }
    const lower = transcript.toLowerCase().trim();

    // Detectar comandos de voz
    for (const vc of VOICE_CMDS) {
      if (vc.phrases.some(p => lower.includes(p))) {
        if (vc.cmd === '__search__')             { btnSearch.click(); }
        else if (vc.cmd === '__vision_describe__') { if (typeof window.captureAndAnalyze === 'function') window.captureAndAnalyze('describe'); }
        else if (vc.cmd === '__vision_product__')  { if (typeof window.captureAndAnalyze === 'function') window.captureAndAnalyze('product');  }
        else if (vc.cmd === '__vision_text__')     { if (typeof window.captureAndAnalyze === 'function') window.captureAndAnalyze('text');     }
        else if (vc.cmd === '__vision_scene__')    { if (typeof window.captureAndAnalyze === 'function') window.captureAndAnalyze('scene');    }
        else if (vc.cmd === '__close_vision__')    { if (typeof window.closeVision === 'function') window.closeVision(); }
        else if (vc.cmd === '__ar_mode__')         { if (typeof window.enterAR === 'function') window.enterAR(); }
        else if (vc.cmd === '__finanzas__')        { AREXNav?.cambiarModulo('finanzas'); }
        else if (vc.cmd === '__tareas__')          { AREXNav?.cambiarModulo('tareas'); }
        else if (vc.cmd === '__metas__')           { AREXNav?.cambiarModulo('metas'); }
        else if (vc.cmd === '__negocio__')         { AREXNav?.cambiarModulo('negocio'); }
        else if (vc.cmd === '__stop_voice__')      { window.speechSynthesis?.cancel(); setOrb(null); }
        else { txt.value = vc.cmd; await handleSend(); }
        return;
      }
    }

    // Mensaje normal de voz
    txt.value = transcript;
    await updateStats('voice');
    handleSend();
  };
  rec.onerror = () => stopListening();
  rec.onend   = () => stopListening();

  try { rec.start(); } catch(e) {
    _listenRec = null;
    stopListening();
    addMsg('arex', 'No se pudo iniciar el micrófono. Verifica los permisos del navegador.');
  }
}

/* ── Modo AR — Voz Continua con Wake Word ───────────── */
const AR_ACKS = ['¿Qué necesitas?','A tus órdenes.','Dime.','Listo.','Escuchando.'];

function startContinuousMode() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    addMsg('arex', 'Modo AR no disponible. El reconocimiento de voz continuo requiere Chrome o Edge en HTTPS.');
    continuousMode = false;
    updateSidebarModes();
    return;
  }
  _continuousRestart = true;
  const rec = new SR();
  rec.lang = 'es-MX';
  rec.continuous = true;
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  _continuousRec = rec;

  rec.onresult = async e => {
    if (isSpeaking || isBusy) return;
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (!e.results[i].isFinal) continue;
      const transcript = e.results[i][0].transcript.trim();
      const lower = transcript.toLowerCase();
      const wakeIdx = lower.search(/\barex\b/);
      if (wakeIdx === -1) continue;

      const cmd = transcript.slice(wakeIdx + 4).replace(/^[,.:!¡¿\s]+/, '').trim();
      window.speechSynthesis.cancel();
      _playTone('wake');
      // Flash verde del orb al detectar la palabra clave
      orb.classList.add('wake-flash');
      setTimeout(() => orb.classList.remove('wake-flash'), 400);

      if (!cmd) {
        const ack = AR_ACKS[Math.floor(Math.random() * AR_ACKS.length)];
        addMsg('arex', ack);
        arexSpeak(ack);
      } else {
        // Comandos directos por voz desde modo AR (sin enviar al chat)
        const cmdL = cmd.toLowerCase();
        if (/qué ves|estás viendo|describe|activa.{0,10}cámara/.test(cmdL) && typeof window.captureAndAnalyze === 'function') {
          arexSpeak('Analizando.'); window.captureAndAnalyze('describe'); continue;
        }
        if (/identifica|qué es esto|escanea|analiza esto/.test(cmdL) && typeof window.captureAndAnalyze === 'function') {
          arexSpeak('Identificando.'); window.captureAndAnalyze('product'); continue;
        }
        if (/lee esto|lee el texto|transcribe/.test(cmdL) && typeof window.captureAndAnalyze === 'function') {
          arexSpeak('Leyendo.'); window.captureAndAnalyze('text'); continue;
        }
        if (/analiza la escena|qué hay aquí/.test(cmdL) && typeof window.captureAndAnalyze === 'function') {
          arexSpeak('Analizando escena.'); window.captureAndAnalyze('scene'); continue;
        }
        if (/cierra.{0,10}cámara|apaga.{0,10}cámara|cierra.{0,10}visión/.test(cmdL)) {
          if (typeof window.closeVision === 'function') window.closeVision();
          arexSpeak('Cámara cerrada.'); continue;
        }
        if (/mis finanzas|estado.{0,10}finanzas/.test(cmdL)) {
          AREXNav?.cambiarModulo('finanzas'); arexSpeak('Abriendo finanzas.'); continue;
        }
        if (/mis tareas|tareas pendientes/.test(cmdL)) {
          AREXNav?.cambiarModulo('tareas'); arexSpeak('Abriendo tareas.'); continue;
        }
        if (/mis metas|estado.{0,10}metas/.test(cmdL)) {
          AREXNav?.cambiarModulo('metas'); arexSpeak('Abriendo metas.'); continue;
        }
        if (/silencio|cállate|para de hablar|detente/.test(cmdL)) {
          window.speechSynthesis?.cancel(); continue;
        }
        if (/analiza|analizar/.test(cmdL)) {
          const modMatch = /finanzas|gastos|metas|tareas|negocio|proyectos/.exec(cmdL);
          const modTarget = modMatch?.[0] || AREXNav?.moduloActual;
          if (modTarget && modTarget !== 'chat' && modTarget !== 'inicio') {
            arexSpeak(`Analizando ${modTarget}.`);
            _analizarConArex(modTarget); continue;
          }
        }
        setOrb('listening', 'Procesando comando de voz...');
        txt.value = cmd;
        await updateStats('voice');
        await handleSend();
      }
    }
  };

  rec.onerror = e => {
    if (e.error === 'no-speech' || e.error === 'audio-capture') return; // errores benignos
    if (e.error === 'not-allowed') {
      addMsg('arex', 'Permiso de micrófono denegado. Actívalo en Ajustes del navegador.');
      continuousMode = false; _continuousRestart = false; updateSidebarModes();
      return;
    }
    // Para otros errores (network, service-not-allowed, etc.): pausar restart 2s en vez de loop infinito
    console.warn('AREX voice recognition error:', e.error);
    _continuousRestart = false;
    setTimeout(() => { if (continuousMode) _continuousRestart = true; }, 1200);
  };

  rec.onend = () => {
    if (continuousMode && _continuousRestart) {
      setTimeout(() => {
        if (continuousMode && _continuousRec) {
          try { rec.start(); } catch(err) {}
        }
      }, 300);
    }
  };

  try { rec.start(); } catch(err) {
    addMsg('arex', 'No se pudo iniciar el reconocimiento de voz.');
    continuousMode = false;
    updateSidebarModes();
  }
}

function stopContinuousMode() {
  _continuousRestart = false;
  if (_continuousRec) {
    try { _continuousRec.abort(); } catch(e) {}
    _continuousRec = null;
  }
}

function toggleContinuousMode() {
  continuousMode = !continuousMode;
  if (continuousMode) {
    startContinuousMode();
    setOrb(null);
    addMsg('arex', '🎙 **Modo AR activado.** Di **"AREX"** seguido de tu comando.\n\nEjemplos:\n- *"AREX, ¿cuánto debo en mis finanzas?"*\n- *"AREX, crea una tarea para mañana"*\n- *"AREX, ¿cuáles son mis metas activas?"*');
  } else {
    stopContinuousMode();
    setOrb(null);
    addMsg('arex', 'Modo AR desactivado.');
  }
  updateSidebarModes();
}
window.toggleContinuousMode  = toggleContinuousMode;
window.stopContinuousMode    = stopContinuousMode;
Object.defineProperty(window, '_arexContModeActive', { get: () => continuousMode });

/* ── Sistema de alertas de sub-agentes ───────────────── */
// Cualquier módulo puede llamar window.arexAlert() para notificar al sistema principal.
// Respeta la jerarquía: AREX es el agente principal, los módulos son sub-agentes que reportan.
function arexAlert(modulo, mensaje, prioridad = 'info') {
  const iconos = { warn:'⚠', info:'ℹ', error:'❌', success:'✓' };
  const icono  = iconos[prioridad] || 'ℹ';
  addMsg('arex', `**[${modulo.toUpperCase()}]** ${icono} ${mensaje}`);
  if (voiceOn || continuousMode) arexSpeak(mensaje);
}
window.arexAlert = arexAlert;

/* ── Análisis IA de módulos (sub-agentes interactivos) ── */
function _buildModuloContext(mod) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const todayStr = window.dia(hoy);   // v216: era UTC
  const mesActual = todayStr.slice(0, 7);
  try {
    if (mod === 'finanzas' && typeof getFinanzasData === 'function') {
      const fd = getFinanzasData();
      const deuda   = fd.tarjetas.reduce((s, t) => s + (t.saldo || 0), 0);
      const gastosFijos = fd.gastos.reduce((s, g) => s + (g.monto || 0), 0);
      const margen  = (fd.config.ingresoMensual || 0) - gastosFijos;
      const pagos   = typeof obtenerProximosPagos === 'function' ? obtenerProximosPagos(10) : [];
      return `FINANZAS:\nIngreso mensual: $${(fd.config.ingresoMensual||0).toLocaleString('es-MX')}\nDeuda total: $${deuda.toLocaleString('es-MX')}\nGastos fijos/mes: $${gastosFijos.toLocaleString('es-MX')}\nMargen libre: $${margen.toLocaleString('es-MX')}\nTarjetas: ${fd.tarjetas.map(t=>`${t.nombre}: $${t.saldo} (límite ${t.fechaLimite})`).join(' | ')}\nPróximos pagos: ${pagos.slice(0,3).map(p=>`${p.tarjeta} $${p.pagoMinimo} en ${p.diasRestantes}d`).join(', ')||'ninguno urgente'}`;
    }
    if (mod === 'gastos' && typeof getGastosData === 'function') {
      const gd = getGastosData();
      const delMes = (gd.gastos||[]).filter(g => g.fecha?.startsWith(mesActual));
      const porCat = {};
      delMes.forEach(g => { porCat[g.categoria] = (porCat[g.categoria]||0) + g.monto; });
      const totalMes = delMes.reduce((s,g) => s + g.monto, 0);
      return `GASTOS DEL MES (${mesActual}):\nTotal: $${totalMes.toLocaleString('es-MX')}\nPor categoría: ${Object.entries(porCat).map(([k,v])=>`${k}: $${v.toLocaleString('es-MX')}`).join(' | ')}\nPresupuestos: ${Object.entries(gd.presupuesto||{}).filter(([,v])=>v>0).map(([k,v])=>`${k}: $${v}`).join(' | ')||'sin definir'}`;
    }
    if (mod === 'metas' && typeof getMetas === 'function') {
      const activas = getMetas().filter(m => !m.completada);
      return `METAS ACTIVAS (${activas.length}):\n${activas.map(m => {
        const pct = m.valorObjetivo > 0 ? Math.round(m.valorActual/m.valorObjetivo*100) : 0;
        const fin = m.fechaLimite ? new Date(m.fechaLimite+'T00:00:00') : null;
        const dias = fin ? Math.round((fin-hoy)/86400000) : null;
        return `"${m.titulo}": ${pct}%${dias!==null?` · vence en ${dias}d`:''}${m.descripcion?` — ${m.descripcion.slice(0,40)}`:''}`;
      }).join('\n')}`;
    }
    if (mod === 'tareas') {
      const pendientes = getTareas().filter(t => !t.done);
      const urgentes   = pendientes.filter(t => t.fecha && t.fecha <= todayStr);
      return `TAREAS PENDIENTES (${pendientes.length} total, ${urgentes.length} para hoy):\n${pendientes.slice(0,12).map(t=>`[${t.prioridad||'media'}] "${t.text||t.texto||'(sin texto)'}"${t.fecha?` · ${t.fecha}`:''}`).join('\n')}`;
    }
    if (mod === 'negocio' && typeof getNegocioData === 'function') {
      const nd = getNegocioData();
      const ventasMes = (nd.ventas||[]).filter(v => (v.fecha||0) >= _inicioMesTs());
      const ingresosMes = ventasMes.reduce((s,v) => s+(v.total||0), 0);
      const gastosMes   = (nd.gastos||[]).filter(g => (g.fecha||0) >= _inicioMesTs()).reduce((s,g) => s+g.monto, 0);
      return `NEGOCIO (${nd.config.variedad}):\nStock: ${nd.inventario.stockKg}kg\nVentas del mes: ${ventasMes.length} · $${ingresosMes.toLocaleString('es-MX')}\nGastos del mes: $${gastosMes.toLocaleString('es-MX')}\nGanancia neta: $${(ingresosMes-gastosMes).toLocaleString('es-MX')}\nSucursales: ${(nd.sucursales||[]).map(s=>s.nombre).join(', ')||'ninguna'}`;
    }
    if (mod === 'proyectos' && typeof getProyectos === 'function') {
      const todos   = getProyectos();
      const activos = todos.filter(p => p.estado === 'activo');
      return `PROYECTOS (${activos.length} activos de ${todos.length} total):\n${activos.map(p=>`"${p.nombre}"${p.descripcion?` — ${p.descripcion.slice(0,60)}`:''}`).join('\n')}`;
    }
  } catch(e) { console.warn('_buildModuloContext:', e); }
  return '';
}

async function _analizarConArex(mod) {
  if (!AREX_CONFIG?.groqKey) {
    addMsg('arex','Configura tu Groq API Key para usar el análisis con IA.');
    return;
  }
  if (isBusy) return;
  const ctx = _buildModuloContext(mod);
  if (!ctx) { addMsg('arex','No hay datos suficientes en este módulo para analizar.'); return; }

  const instrucciones = {
    finanzas:  'Analiza la situación financiera de Alexiz. Menciona el margen libre, deudas urgentes y un consejo concreto. Habla natural, sin listas, 2-3 oraciones.',
    gastos:    'Analiza los gastos del mes. Di en qué categoría se va más, si hay exceso vs presupuesto y qué ajustar. 2-3 oraciones directas.',
    metas:     'Revisa las metas activas. ¿Cuáles van en buen ritmo? ¿Cuáles están en riesgo de no cumplirse? Usa los porcentajes y días reales.',
    tareas:    'Prioriza las tareas pendientes. Di qué hacer primero según urgencia y fecha. Sé concreto.',
    negocio:   'Analiza las métricas del negocio de frijol. ¿Está siendo rentable? ¿Qué mejorar? Usa los números reales.',
    proyectos: 'Revisa el estado de los proyectos activos. ¿Alguno está en riesgo o necesita atención ahora?',
  };
  const instruccion = instrucciones[mod] || 'Analiza estos datos y da un resumen útil en 2-3 oraciones concretas.';

  AREXNav.cambiarModulo('chat');
  isBusy = true; btnSend.disabled = true;
  setOrb('thinking', `Analizando ${mod}...`);
  showThinking();

  try {
    const res = await _groqFetch('fast', {
      max_tokens: 350,
      messages: [
        { role: 'system', content: `Eres AREX, el sistema personal de Alexiz. ${instruccion} Habla de forma natural y directa. Solo usa datos exactos del contexto — no inventes ni supongas cifras.` },
        { role: 'user', content: ctx }
      ]
    }, AREX_CONFIG.groqKey);
    if (!res.ok) throw new Error(res.status);
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content || '';
    hideThinking();
    const wrap = makeArexWrap();
    await renderArexReply(wrap, reply);
    _playTone('msg');
    _showQuickReplies(reply);
    if (voiceOn || continuousMode) arexSpeak(reply); else setOrb(null, 'En espera de instrucciones');
  } catch(e) {
    hideThinking();
    addMsg('arex', 'Error al analizar el módulo. Verifica tu conexión.');
    setOrb(null, 'En espera de instrucciones');
    console.error('_analizarConArex:', e);
  } finally { isBusy = false; btnSend.disabled = false; }
}
window._analizarConArex = _analizarConArex;

/* ── Mensajes proactivos por inactividad (datos reales) ─ */
function _buildIdleMsg() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const todayStr = window.dia(hoy);   // v216: era UTC
  const mesActual = todayStr.slice(0, 7);
  const msgs = [];

  try {
    const pendientes = getTareas().filter(t => !t.done);
    const deHoy = pendientes.filter(t => t.fecha && t.fecha <= todayStr);
    if (deHoy.length === 1) msgs.push(`Tienes una tarea para hoy: "${deHoy[0].text || deHoy[0].texto || ''}".`);
    else if (deHoy.length > 1) msgs.push(`Tienes ${deHoy.length} tareas pendientes para hoy. La primera: "${deHoy[0].text || deHoy[0].texto || ''}".`);
    else if (pendientes.length > 0) msgs.push(`Llevas ${pendientes.length} tarea${pendientes.length > 1 ? 's' : ''} pendiente${pendientes.length > 1 ? 's' : ''} sin completar.`);
  } catch(e) {}

  try {
    const metas = typeof getMetas === 'function' ? getMetas().filter(m => !m.completada && m.fechaLimite) : [];
    if (metas.length) {
      const proxima = metas.sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite))[0];
      const fin  = new Date(proxima.fechaLimite + 'T00:00:00');
      const dias = Math.round((fin - hoy) / 86400000);
      if (dias >= 0 && dias <= 7) {
        const pct = proxima.valorObjetivo > 0 ? Math.round(proxima.valorActual / proxima.valorObjetivo * 100) : 0;
        const label = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
        msgs.push(`Tu meta "${proxima.titulo}" vence ${label} y va al ${pct}%.`);
      }
    }
  } catch(e) {}

  try {
    if (typeof obtenerProximosPagos === 'function') {
      const pagos = obtenerProximosPagos(3);
      if (pagos.length > 0) {
        const p = pagos[0];
        const label = p.diasRestantes === 0 ? 'hoy' : p.diasRestantes === 1 ? 'mañana' : `en ${p.diasRestantes} días`;
        const monto = p.pagoMinimo ? ` ($${p.pagoMinimo.toLocaleString('es-MX')})` : '';
        msgs.push(`Tienes un pago de ${p.tarjeta}${monto} ${label}.`);
      }
    }
  } catch(e) {}

  try {
    if (typeof getGastosData === 'function') {
      const gd = getGastosData();
      const delMes = (gd.gastos || []).filter(g => g.fecha?.startsWith(mesActual));
      const total = delMes.reduce((s, g) => s + (g.monto || 0), 0);
      if (total > 0) msgs.push(`Este mes llevas $${total.toLocaleString('es-MX')} en gastos registrados.`);
    }
  } catch(e) {}

  if (!msgs.length) {
    const fb = ['¿Qué necesitas?', 'Listo cuando quieras.', '¿En qué te ayudo?'];
    return fb[Math.floor(Math.random() * fb.length)];
  }
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function _resetIdleTimer() {
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(() => {
    if (isBusy || continuousMode || isSpeaking) { _resetIdleTimer(); return; }
    const msg = _buildIdleMsg();
    addMsg('arex', msg);
    if (voiceOn) arexSpeak(msg);
    _resetIdleTimer();
  }, 4 * 60 * 1000);
}

/* ── Auto-búsqueda por contexto ─────────────────────── */
const AUTO_SEARCH_KW = [
  'precio','cotización','noticias hoy','ahora mismo','última hora',
  'reciente','actualización','temperatura','clima','pronóstico',
  'tipo de cambio','dólar','euro','bitcoin','cripto','bolsa',
  'tendencia','evento','partido','resultado','marcador','quién ganó',
  'cuándo sale','lanzamiento','estreno','versión nueva','fecha de'
];
function needsAutoSearch(text) {
  if (!AREX_CONFIG.tavilyKey || searchOn) return false;
  const lower = text.toLowerCase();
  return AUTO_SEARCH_KW.some(kw => lower.includes(kw));
}

/* ── Búsqueda web Tavily ────────────────────────────── */
async function webSearch(q) {
  if (!AREX_CONFIG.tavilyKey) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ api_key: AREX_CONFIG.tavilyKey, query: q, search_depth:'basic', max_results:4, include_answer:true })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { answer: data.answer || '', results: data.results || [] };
  } catch { return null; }
}

/* ── Análisis de URLs ───────────────────────────────── */
function isURL(text) {
  return /^https?:\/\/\S+$/i.test(text.trim());
}
function extractURLs(text) {
  const m = text.match(/https?:\/\/[^\s<>"]+/gi);
  return m ? [...new Set(m)] : [];
}

async function extractURL(url) {
  if (!AREX_CONFIG.tavilyKey) return null;
  // Intento 1: Tavily extract (extrae contenido directo de la URL)
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ api_key: AREX_CONFIG.tavilyKey, urls: [url] })
    });
    if (res.ok) {
      const data = await res.json();
      const result = data.results?.[0];
      const content = result?.raw_content || result?.content || '';
      if (content.length > 100) {
        return { title: result.title || url, content: content.slice(0, 6000), url };
      }
    }
  } catch { /* fallback */ }

  // Intento 2: Tavily search con la URL como query
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ api_key: AREX_CONFIG.tavilyKey, query: url,
        search_depth:'advanced', max_results:3, include_answer:true, include_raw_content:true })
    });
    if (!res.ok) return null;
    const data = await res.json();
    const top = data.results?.[0];
    const content = top?.raw_content || top?.content || data.answer || '';
    if (!content) return null;
    return { title: top?.title || url, content: content.slice(0, 6000), url };
  } catch { return null; }
}

async function handleURL(url) {
  isBusy = true;
  btnSend.disabled = true;

  addMsg('user', url);
  await saveMsg('user', url);
  await updateStats('message');

  if (!AREX_CONFIG.tavilyKey) {
    addMsg('arex', 'Para analizar enlaces necesitas una **Tavily API Key**. Escribe `/config` para agregarla.');
    isBusy = false; btnSend.disabled = false; return;
  }

  setOrb('searching', 'Extrayendo contenido del enlace...');
  showThinking();

  try {
    const extracted = await extractURL(url);

    if (!extracted) {
      hideThinking();
      addMsg('arex', `No se pudo extraer el contenido de ese enlace. Puede ser privado, requiere login, o no está disponible.\n\nIntenta compartir el texto directamente y lo analizo.`);
      setOrb(null, 'En espera de instrucciones');
      isBusy = false; btnSend.disabled = false; return;
    }

    const contextMsg = `[URL: ${extracted.url}]\n[TÍTULO: ${extracted.title}]\n\n[CONTENIDO EXTRAÍDO]\n${extracted.content}\n\n[INSTRUCCIÓN] Analiza y resume los puntos más importantes de esta página. Sé directo y estructurado.`;
    history.push({ role:'user', content: contextMsg });
    await saveMsg('user', `[URL analizada: ${url}]`);

    setOrb('thinking', 'Analizando contenido...');
    const reply = await callGroq();
    history.push({ role:'assistant', content: reply });
    await saveMsg('assistant', reply);
    updateMemMetric();

    hideThinking();
    const safeTitle = extracted.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    const srcHTML = `<div class="sources">FUENTE: <a href="${url}" target="_blank" rel="noopener noreferrer">${safeTitle}</a></div>`;
    const wrap = makeArexWrap(srcHTML);
    await renderArexReply(wrap, reply);
    if (voiceOn) arexSpeak(reply); else setOrb(null, 'En espera de instrucciones');

  } catch(err) {
    hideThinking();
    const errMsg = err.message?.includes('401') ? 'API Key inválida. Verifica tu Groq Key en `/config`.' :
                   err.message?.includes('429') ? 'Límite de requests alcanzado. Espera un momento.' :
                   `Error al analizar el enlace: ${err.message}`;
    addMsg('arex', errMsg);
    setOrb(null, 'En espera de instrucciones');
    console.error(err);
  } finally {
    isBusy = false;
    btnSend.disabled = false;
  }
}

async function handleMultipleURLs(urls, question) {
  isBusy = true;
  btnSend.disabled = true;

  const displayMsg = question ? `${urls.join('\n')}\n\n${question}` : urls.join('\n');
  addMsg('user', displayMsg);
  await saveMsg('user', displayMsg);
  await updateStats('message');

  if (!AREX_CONFIG.tavilyKey) {
    addMsg('arex', 'Para analizar enlaces necesitas una **Tavily API Key**. Escribe `/config` para agregarla.');
    isBusy = false; btnSend.disabled = false; return;
  }

  setOrb('searching', `Extrayendo ${urls.length} enlace${urls.length > 1 ? 's' : ''}...`);
  showThinking();

  try {
    const results = await Promise.all(urls.map(u => extractURL(u)));
    const valid = results.filter(r => r !== null);

    if (!valid.length) {
      hideThinking();
      addMsg('arex', 'No se pudo extraer contenido de los enlaces. Pueden ser privados o requerir login.');
      setOrb(null, 'En espera de instrucciones');
      isBusy = false; btnSend.disabled = false; return;
    }

    const urlsContext = valid.map((r, i) =>
      `[ENLACE ${i + 1}: ${r.url}]\n[TÍTULO: ${r.title}]\n${r.content}`
    ).join('\n\n---\n\n');

    const instruction = question
      ? `[INSTRUCCIÓN] ${question}`
      : valid.length > 1
        ? `[INSTRUCCIÓN] Analiza y compara estos ${valid.length} enlaces. Destaca similitudes, diferencias y puntos clave de cada uno.`
        : `[INSTRUCCIÓN] Analiza y resume los puntos más importantes de esta página.`;

    history.push({ role: 'user', content: `${urlsContext}\n\n${instruction}` });
    await saveMsg('user', `[${valid.length} URL(s) analizadas: ${urls.join(', ')}]`);

    setOrb('thinking', 'Analizando contenido...');
    const reply = await callGroq();
    history.push({ role: 'assistant', content: reply });
    await saveMsg('assistant', reply);
    updateMemMetric();

    hideThinking();
    const srcHTML = `<div class="sources">FUENTES: ${valid.map((r, i) =>
      `<a href="${r.url}" target="_blank" rel="noopener noreferrer">[${i + 1}] ${r.title.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</a>`
    ).join(' · ')}</div>`;
    const wrap = makeArexWrap(srcHTML);
    await renderArexReply(wrap, reply);
    if (voiceOn) arexSpeak(reply); else setOrb(null, 'En espera de instrucciones');

  } catch (err) {
    hideThinking();
    const errMsg = err.message?.includes('401') ? 'API Key inválida. Verifica tu Groq Key en `/config`.' :
                   err.message?.includes('429') ? 'Límite de requests alcanzado. Espera un momento.' :
                   `Error al analizar los enlaces: ${err.message}`;
    addMsg('arex', errMsg);
    setOrb(null, 'En espera de instrucciones');
    console.error(err);
  } finally {
    isBusy = false;
    btnSend.disabled = false;
  }
}

/* ── Procesamiento de archivos ──────────────────────── */
async function extractPDF(file) {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const pages = Math.min(pdf.numPages, 10);
  for (let i = 1; i <= pages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text.slice(0, 6000);
}

async function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen.')); };
    img.src = url;
  });
}

async function handleFile(file) {
  const isPDF = file.type === 'application/pdf';
  const isImg = file.type.startsWith('image/');
  if (!isPDF && !isImg) { addMsg('arex','Formato no soportado. Usa PDF o imagen (JPG, PNG, WEBP).'); return; }

  if (isBusy) { addMsg('arex','Espera a que AREX termine de procesar.'); return; }
  isBusy = true;

  // Mostrar burbuja de archivo
  document.querySelector('.welcome')?.remove();
  const safeName = file.name.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const wrap = document.createElement('div');
  wrap.className = 'msg user file';
  wrap.innerHTML = `<span class="who">TÚ</span><div class="bubble">📎 ${safeName}</div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;

  setOrb('thinking', isPDF ? 'Procesando PDF...' : 'Analizando imagen...');
  showThinking();

  try {
    let reply;
    if (isPDF) {
      const text = await extractPDF(file);
      history.push({ role:'user', content: `[PDF: ${file.name}]\n\n${text}\n\nAnaliza este documento y dime los puntos más importantes.` });
      await saveMsg('user', `[PDF adjunto: ${file.name}]`);
      reply = await callGroq();
      history.push({ role:'assistant', content: reply });
      await saveMsg('assistant', reply);
      updateMemMetric();
    } else {
      const dataURL = await resizeImage(file);
      const userHint = txt.value.trim();
      txt.value = '';
      const nameL = file.name.toLowerCase();
      let imgPrompt = userHint ||
        (nameL.match(/ticket|recibo|factura|nota|compra|venta|cobro/) || userHint.match(/gasto|recibo|ticket|factura/i)
          ? 'Analiza este ticket/recibo. Extrae: establecimiento, fecha, artículos con precios, total. Luego dime si quieres que lo registre como gasto.'
          : nameL.match(/pizarr|whiteboard|board|apunte|nota|clase/) || userHint.match(/pizarr|apunte/i)
            ? 'Analiza este apunte o pizarrón. Extrae todo el texto e ideas en formato organizado. ¿Quieres que lo guarde como nota?'
            : 'Analiza esta imagen detalladamente.');
      reply = await analyzeImage(dataURL, imgPrompt);
      history.push({ role:'user', content: `[Imagen: ${file.name}]` });
      history.push({ role:'assistant', content: reply });
      await saveMsg('user', `[Imagen adjunta: ${file.name}]`);
      await saveMsg('assistant', reply);
      updateMemMetric();
    }
    await updateStats('file');
    hideThinking();
    const wrap2 = makeArexWrap();
    await renderArexReply(wrap2, reply);
    if (voiceOn) arexSpeak(reply); else setOrb(null,'En espera de instrucciones');
  } catch(e) {
    hideThinking();
    addMsg('arex',`Error al procesar el archivo: ${e.message}`);
    setOrb(null,'En espera de instrucciones');
    console.error(e);
  } finally {
    isBusy = false;
  }
}

/* ── Groq Model Fallback System ──────────────────────────
   Intenta el mejor modelo disponible; si Groq devuelve 404
   (sin acceso o preview) baja automáticamente al siguiente.
   El estado se guarda en sesión — no vuelve a intentar un
   modelo que ya falló hasta que el usuario recarga la app.
─────────────────────────────────────────────────────── */
const _GROQ_MODELS = {
  // chat: GPT-OSS 120B — Groq DIO DE BAJA kimi-k2-instruct (y su -0905), y el
  // reemplazo vigente recomendado es gpt-oss-120b. Cascada a llama-3.3 →
  // llama-3.1-8b (siempre disponibles). _groqFetch salta modelos retirados
  // aunque Groq los reporte con 400 model_decommissioned, no solo 404.
  chat:   ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  fast:   ['meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.1-8b-instant'],
  // vision necesita modelo con visión — scout (llama-4) la soporta y sigue vigente
  vision: ['meta-llama/llama-4-scout-17b-16e-instruct', 'meta-llama/llama-4-maverick-17b-128e-instruct'],
};
const _groqBad = new Set(); // modelos con 404 en esta sesión

async function _groqFetch(tier, bodyWithoutModel, key) {
  const list = _GROQ_MODELS[tier] || _GROQ_MODELS.chat;
  let lastErr = 'Ningún modelo Groq disponible. Verifica tu API key.';
  for (const model of list) {
    if (_groqBad.has(model)) continue;
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ ...bodyWithoutModel, model }),
    });
    if (res.ok) return res;
    // Modelo retirado por Groq: puede venir como 404 O como 400
    // "model_decommissioned"/"model_not_found". En ambos casos hay que
    // MARCARLO muerto y caer al siguiente de la cascada (antes solo 404 →
    // el chat reventaba cuando Groq dio de baja kimi-k2 con un 400).
    let errBody = {};
    try { errBody = await res.json(); } catch {}
    const detalle = `${errBody?.error?.code || ''} ${errBody?.error?.message || res.statusText}`;
    if (res.status === 404 || /decommission|model_not_found|does not exist|deprecated|no longer/i.test(detalle)) {
      _groqBad.add(model);
      lastErr = `${model} retirado: ${detalle.trim()}`;
      continue;
    }
    // Error real (rate-limit, auth, petición inválida): propagar sin quemar
    // el resto de la cascada por algo que también fallaría en los demás
    throw new Error(`${res.status} — ${errBody?.error?.message || 'Error de API'}`);
  }
  throw new Error(lastErr);
}

// ── callBrain: router de cerebros IA ─────────────────────
async function callBrain(tipo, mensajes, opts = {}) {
  const modelos = {
    core:   'llama-3.3-70b-versatile',
    rapido: 'llama-3.1-8b-instant',
  };
  const modelo = modelos[tipo] || modelos.core;
  const body = {
    model: modelo,
    messages: mensajes,
    max_tokens: opts.maxTokens || 512,
    temperature: opts.temperature ?? 0.7,
    stream: false,
  };
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AREX_CONFIG.groqKey}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
  } catch(e) {
    if (tipo === 'rapido') {
      // Fallback al cerebro core
      console.warn('callBrain RAPIDO falló, reintentando con CORE:', e.message);
      return callBrain('core', mensajes, opts);
    }
    throw e;
  }
}

/* ── Llamada a Groq (texto) ─────────────────────────── */
async function callGroq(webCtx) {
  const systemPrompt = buildSystemBase() + (examMode ? EXAM_ADDON : '') + buildContextSection() + buildMemoriaSection() + buildSessionMemorySection() + buildModuleContext();
  let messages = [...history];

  if (webCtx) {
    const last = messages[messages.length - 1];
    const webSection = webCtx.answer ? `[CONTEXTO WEB]\n${webCtx.answer}\n\n` : '';
    messages[messages.length - 1] = { ...last, content: `${webSection}[PREGUNTA]\n${last.content}` };
  }

  const res = await _groqFetch('chat', {
    max_tokens: examMode ? 4096 : 2048,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  }, AREX_CONFIG.groqKey);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`${res.status} — ${e?.error?.message || 'Error de API'}`); }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta inválida de API');
  return content;
}

/* ── Llamada a Groq (streaming) ─────────────────────── */
async function callGroqStream(webCtx, onChunk) {
  const systemPrompt = buildSystemBase() + (examMode ? EXAM_ADDON : '') + buildContextSection() + buildMemoriaSection() + buildSessionMemorySection() + buildModuleContext();
  let messages = [...history];

  if (webCtx) {
    const last = messages[messages.length - 1];
    const webSection = webCtx.answer ? `[CONTEXTO WEB]\n${webCtx.answer}\n\n` : '';
    messages[messages.length - 1] = { ...last, content: `${webSection}[PREGUNTA]\n${last.content}` };
  }

  const res = await _groqFetch('chat', {
    max_tokens: examMode ? 4096 : 2048,
    stream: true,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  }, AREX_CONFIG.groqKey);
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`${res.status} — ${e?.error?.message || 'Error de API'}`); }

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') return full;
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta?.content || '';
        if (delta) { full += delta; onChunk(full); }
      } catch {}
    }
  }
  return full;
}

/* ── Llamada a Groq (visión) ────────────────────────── */
async function analyzeImage(dataURL, question) {
  // Try Gemini first if key available; fall back to Groq on any error
  if (AREX_CONFIG?.geminiKey) {
    try { return await _analyzeWithGemini(dataURL, question); } catch { /* fall through */ }
  }
  const res = await _groqFetch('vision', {
    max_tokens:1000,
    messages:[{ role:'user', content:[
      { type:'image_url', image_url:{ url: dataURL } },
      { type:'text', text: question }
    ]}]
  }, AREX_CONFIG.groqKey);
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta inválida de API');
  return content;
}

async function _analyzeWithGemini(dataURL, question) {
  const key = AREX_CONFIG.geminiKey;
  // Extract base64 data from dataURL
  const [meta, b64] = dataURL.split(',');
  const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { inline_data: { mime_type: mimeType, data: b64 } },
        { text: question }
      ]}]
    })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`Gemini ${res.status} — ${e?.error?.message||'Error'}`); }
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Respuesta inválida de Gemini');
  return content;
}

/* ── Firebase: guardar mensaje ──────────────────────── */
async function saveMsg(role, content) {
  if (!db || !window._arexUid) return;
  try {
    await addDoc(_userCol('conversations'), { sessionId:SESSION, role, content, timestamp:Date.now() });
  } catch(e) { console.warn('Firebase saveMsg:', e); }
}

/* ── Firebase: cargar historial ─────────────────────── */
/* ── Modo profundo: Gemini 2.5 Pro bajo demanda (/profundo) ──
   Razonamiento pesado con TODO el contexto de AREX. Cuota gratis diaria
   limitada — por eso solo se dispara con el comando explícito, nunca solo. */
async function _callGeminiPro(question) {
  const sys = buildSystemBase() + buildContextSection() + buildMemoriaSection()
            + buildSessionMemorySection() + buildModuleContext();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${AREX_CONFIG.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000),   // razona en serio: darle tiempo
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: [{ role: 'user', parts: [{ text: question }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const d = await res.json();
  const out = d?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  if (!out.trim()) throw new Error('respuesta vacía de Gemini Pro');
  return out;
}

async function loadHistory() {
  if (!db || !window._arexUid) return;
  try {
    const q = query(_userCol('conversations'), orderBy('timestamp','desc'), limit(100));
    const snap = await getDocs(q);
    const msgs = [];
    snap.forEach(d => msgs.push(d.data()));
    msgs.reverse();
    history = msgs.map(m => ({ role:m.role, content:m.content }));
    updateMemMetric();
    if (history.length > 0) {
      history.forEach(m => {
        const display = m.content
          .replace(/^\[Resumen de conversación anterior\]\n/, '📋 **Resumen de sesión anterior:**\n')
          .replace(/^\[Resumen\]\n/, '📋 **Resumen:**\n');
        addMsg(m.role === 'user' ? 'user' : 'arex', display);
      });
    }
  } catch(e) { console.warn('Firebase loadHistory:', e); }
}

/* ── Firebase: notas ────────────────────────────────── */
async function saveNote(text, category = 'General') {
  if (!db || !window._arexUid) return 'local_' + Date.now();
  const ref = await addDoc(_userCol('notes'), { text, category, timestamp:Date.now() });
  return ref.id;
}
async function loadNotes() {
  if (!db || !window._arexUid) {
    if (!notesList.querySelector('.no-db-msg')) {
      const d = document.createElement('div');
      d.className = 'no-db-msg';
      d.style.cssText = 'font-size:10px;color:#4a7a96;text-align:center;padding:1rem;letter-spacing:1px;';
      d.textContent = 'Sin Firebase — las notas solo persisten esta sesión.';
      notesList.appendChild(d);
    }
    return;
  }
  try {
    const q = query(_userCol('notes'), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    notesList.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      if (noteFilter === 'all' || (data.category || 'General') === noteFilter) {
        renderNote(d.id, data.text, data.timestamp, data.category || 'General');
      }
    });
  } catch(e) { console.warn('Firebase loadNotes:', e); }
}
function renderNote(id, text, ts, category = 'General') {
  const el = document.createElement('div');
  el.className = 'note-item'; el.dataset.id = id;
  const time = new Date(ts).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  const safeText = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  el.innerHTML = `
    <div class="note-header">
      <span class="note-cat note-cat-${category.toLowerCase()}">${category}</span>
      <button class="btn-del" title="Eliminar">✕</button>
    </div>
    <div class="note-text">${safeText}</div>
    <div class="note-time">${time}</div>`;
  el.querySelector('.btn-del').onclick = async () => {
    if (db && window._arexUid) await deleteDoc(_userDoc('notes', id)).catch(()=>{});
    el.remove();
  };
  notesList.prepend(el);
}

/* ── Firebase: estadísticas ─────────────────────────── */
async function updateStats(type) {
  if (!db || !window._arexUid) return;
  const today = window.hoy();   // v216: era UTC
  try {
    const globalRef = _userDoc('stats', 'global');
    const dailyRef  = _userDoc('stats', today);
    const gUp = {}, dUp = {};
    if (type==='message'){ gUp.totalMessages=increment(1); dUp.messages=increment(1); }
    if (type==='search') { gUp.webSearches=increment(1);   dUp.searches=increment(1); }
    if (type==='file')   { gUp.filesAnalyzed=increment(1); dUp.files=increment(1); }
    if (type==='voice')  { gUp.voiceMessages=increment(1); }
    await Promise.all([
      setDoc(globalRef, gUp, { merge:true }),
      setDoc(dailyRef,  dUp, { merge:true })
    ]);
  } catch(e) { console.warn('Firebase stats:', e); }
}
async function loadStats() {
  if (!db || !window._arexUid) return { g:{}, d:{} };
  const today = window.hoy();   // v216: era UTC
  try {
    const [gSnap, dSnap] = await Promise.all([
      getDoc(_userDoc('stats', 'global')),
      getDoc(_userDoc('stats', today))
    ]);
    return { g: gSnap.exists()?gSnap.data():{}, d: dSnap.exists()?dSnap.data():{} };
  } catch { return { g:{}, d:{} }; }
}

/* ── Auto-compresión al llegar a 80 mensajes ────────── */
async function autoSummarize() {
  if (history.length < 45) return;
  addMsg('arex', '📋 Optimizando memoria de conversación — comprimiendo historial...');
  const toCompress = history.slice(0, -15);
  const toKeep     = history.slice(-15);
  try {
    const res = await _groqFetch('fast', {
      max_tokens:600,
      messages:[{ role:'user', content:
        `Eres un asistente de memoria. Resume esta conversación en puntos clave detallados ` +
        `(decisiones tomadas, temas discutidos, código generado, datos importantes). ` +
        `Sé específico y conserva información técnica relevante:\n\n${
          toCompress.map(m=>`${m.role==='user'?'Alexiz':'AREX'}: ${m.content}`).join('\n')
        }`
      }]
    }, AREX_CONFIG.groqKey);
    if (!res.ok) return;
    const data = await res.json();
    const summary = data?.choices?.[0]?.message?.content;
    if (!summary) return;
    history = [{ role:'assistant', content:`[Resumen de conversación anterior]\n${summary}` }, ...toKeep];
    updateMemMetric();
  } catch(e) { console.warn('Auto-summarize:', e); }
}

/* ── Recordatorios ──────────────────────────────────── */
async function requestNotifPerm() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  _updateNotifStatus();
}
/* ── Recordatorios persistentes ─────────────────────── */
function getRecordatorios() { return _safeJSON(localStorage.getItem('arex_recordatorios'), []); }
function saveRecordatorios(arr) {
  localStorage.setItem('arex_recordatorios', JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData('arex_recordatorios');
}

function fmtCountdown(disparaEn) {
  const ms = disparaEn - Date.now();
  if (ms <= 0) return 'ahora';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `en ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `en ${m}min`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return rm > 0 ? `en ${h}h ${rm}min` : `en ${h}h`;
  return `en ${Math.floor(h / 24)}d`;
}

function _fireReminderNotification(msg) {
  if (Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification('AREX — Recordatorio', { body: msg, icon: 'icon.svg' })).catch(() => {});
  } else {
    new Notification('AREX — Recordatorio', { body: msg, icon: 'icon.svg' });
  }
}

function armReminder(rec) {
  const ms = rec.disparaEn - Date.now();
  if (ms <= 0) return;
  setTimeout(() => {
    saveRecordatorios(getRecordatorios().map(r => r.id === rec.id ? { ...r, disparado: true } : r));
    _fireReminderNotification(rec.msg);
    addMsg('arex', `⏰ **Recordatorio:** ${rec.msg}`);
    if (voiceOn) arexSpeak(`Recordatorio: ${rec.msg}`);
    _refreshRecWidget();
  }, ms);
}

function restoreReminders() {
  const now = Date.now();
  const all = getRecordatorios();
  let changed = false;
  all.forEach(r => {
    if (!r.disparado) {
      if (r.disparaEn <= now) {
        r.disparado = true; changed = true;
        _fireReminderNotification(r.msg);
        addMsg('arex', `⏰ **Recordatorio (llegó mientras estabas fuera):** ${r.msg}`);
        if (voiceOn) arexSpeak(`Recordatorio: ${r.msg}`);
      } else armReminder(r);
    }
  });
  if (changed) { saveRecordatorios(all); _refreshRecWidget(); }
}

function saveReminder(ms, msg) {
  const rec = { id: String(Date.now()), msg, disparaEn: Date.now() + ms, disparado: false, creadoEn: Date.now() };
  const all = getRecordatorios(); all.push(rec);
  saveRecordatorios(all);
  armReminder(rec);
  _refreshRecWidget();
}

function dismissReminder(id) {
  saveRecordatorios(getRecordatorios().filter(r => r.id !== id));
  _refreshRecWidget();
}

function _buildRecHtml() {
  const all      = getRecordatorios();
  const activos  = all.filter(r => !r.disparado).sort((a,b) => a.disparaEn - b.disparaEn);
  const perdidos = all.filter(r => r.disparado && r.perdido);
  const hechos   = all.filter(r => r.disparado && !r.perdido).slice(-2);

  if (!all.length) return '<div class="dash-empty">Sin recordatorios — usa /recordar 30min mensaje</div>';

  const mkItem = (r, cls, icon, label) => `
    <div class="rec-item ${cls}">
      <span class="rec-icon">${icon}</span>
      <span class="rec-msg">${r.msg.replace(/</g,'&lt;')}</span>
      <span class="rec-cd"${cls==='rec-activo' ? ` data-de="${r.disparaEn}"` : ''}>${label}</span>
      <button class="rec-dismiss" data-id="${r.id}" title="Eliminar">✕</button>
    </div>`;

  return [
    ...activos.map(r  => mkItem(r, 'rec-activo',  '⏰', fmtCountdown(r.disparaEn))),
    ...perdidos.map(r => mkItem(r, 'rec-perdido', '🔕', 'perdido')),
    ...hechos.map(r   => mkItem(r, 'rec-hecho',   '✓',  'completado')),
  ].join('');
}

function _refreshRecWidget() {
  const el = document.getElementById('dash-rec-body');
  if (!el) return;
  el.innerHTML = _buildRecHtml();
  el.querySelectorAll('.rec-dismiss').forEach(b =>
    b.addEventListener('click', () => dismissReminder(b.dataset.id))
  );
}
function parseReminder(args) {
  const minMatch  = args.match(/^(\d+)\s*min\s+(.+)/i);
  const hrMatch   = args.match(/^(\d+)\s*h\s+(.+)/i);
  const timeMatch = args.match(/^(\d{1,2}):(\d{2})\s+(.+)/);
  if (minMatch)  return { ms: parseInt(minMatch[1])  * 60000,   msg: minMatch[2]  };
  if (hrMatch)   return { ms: parseInt(hrMatch[1])   * 3600000, msg: hrMatch[2]   };
  if (timeMatch) {
    const t = new Date(); t.setHours(+timeMatch[1], +timeMatch[2], 0, 0);
    if (t <= new Date()) t.setDate(t.getDate() + 1);
    return { ms: t - new Date(), msg: timeMatch[3] };
  }
  return null;
}

/* ── Comandos ───────────────────────────────────────── */
async function handleCommand(cmd) {
  const [name, ...rest] = cmd.slice(1).trim().split(' ');
  const args = rest.join(' ');
  const nameLow = name.toLowerCase();

  // Resolver atajos personalizados antes del switch
  if (!RESERVED_CMDS.includes(nameLow)) {
    const atajo = loadAtalos().find(a => a.name === nameLow);
    if (atajo) {
      if (atajo.prompt.includes('{args}')) {
        if (args) {
          txt.value = atajo.prompt.replace(/\{args\}/g, args);
        } else {
          // Sin args: pre-rellenar el input para que el usuario complete
          txt.value = atajo.prompt.replace(/\{args\}/g, '');
          txt.focus();
          return;
        }
      } else {
        txt.value = args ? `${atajo.prompt} ${args}` : atajo.prompt;
      }
      await handleSend();
      return;
    }
  }

  switch (nameLow) {
    case 'ayuda':
      modalHelp.classList.remove('hidden');
      break;

    case 'limpiar':
      chat.innerHTML = '';
      history = [];
      updateMemMetric();
      if (db && window._arexUid) {
        try {
          const qSnap = await getDocs(_userCol('conversations'));
          await Promise.all(qSnap.docs.map(d => deleteDoc(d.ref)));
        } catch(e) { console.warn('limpiar Firebase:', e); }
      }
      addMsg('arex','Chat limpiado. Historial borrado.');
      break;

    case 'examen':
      examMode = !examMode;
      examBadge.classList.toggle('hidden', !examMode);
      addMsg('arex', examMode
        ? 'Modo examen activado. Responderé con más detalle y estructura.'
        : 'Modo examen desactivado. Volviendo al modo estándar.');
      updateSidebarModes();
      break;

    case 'resumir': {
      if (isBusy) { addMsg('arex','Espera a que AREX termine de procesar antes de resumir.'); break; }
      if (history.length < 4) { addMsg('arex','No hay suficiente conversación para resumir.'); break; }
      isBusy = true;
      setOrb('thinking','Generando resumen...');
      showThinking();
      try {
        const summaryText = await callBrain('rapido', [
          { role:'user', content:`Resume en puntos clave esta conversación entre Alexiz y AREX:\n\n${
            history.map(m=>`${m.role==='user'?'Alexiz':'AREX'}: ${m.content}`).join('\n')
          }` }
        ], { maxTokens: 500 });
        if (!summaryText) { hideThinking(); return; }
        history.push({ role:'assistant', content: `[Resumen]\n${summaryText}` });
        await saveMsg('assistant', `[Resumen]\n${summaryText}`);
        updateMemMetric();
        hideThinking();
        const wrap = makeArexWrap();
        await renderArexReply(wrap, summaryText);
        setOrb(null,'En espera de instrucciones');
      } catch(e) {
        hideThinking();
        addMsg('arex', e.message?.includes('401') ? 'API Key inválida.' : `Error al generar el resumen: ${e.message}`);
        setOrb(null,'En espera de instrucciones');
      } finally {
        isBusy = false;
      }
      break;
    }

    case 'exportar': {
      const content = history.map(m => `[${m.role==='user'?'ALEXIZ':'AREX'}]\n${m.content}`).join('\n\n---\n\n');
      const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = `AREX_${window.hoy()}.txt`;   // v216: era UTC a.click();
      URL.revokeObjectURL(url);
      addMsg('arex','Conversación exportada correctamente.');
      break;
    }

    case 'notas':
      notesPanel.classList.toggle('open');
      if (notesPanel.classList.contains('open')) await loadNotes();
      break;

    case 'stats': {
      const s = await loadStats();
      statsGrid.innerHTML = `
        <div class="stat-card"><div class="s-label">MENSAJES TOTALES</div><div class="s-value">${s.g.totalMessages||0}</div></div>
        <div class="stat-card"><div class="s-label">MENSAJES HOY</div><div class="s-value">${s.d.messages||0}</div></div>
        <div class="stat-card"><div class="s-label">BÚSQUEDAS WEB</div><div class="s-value">${s.g.webSearches||0}</div></div>
        <div class="stat-card"><div class="s-label">ARCHIVOS ANALIZADOS</div><div class="s-value">${s.g.filesAnalyzed||0}</div></div>
        <div class="stat-card"><div class="s-label">MENSAJES DE VOZ</div><div class="s-value">${s.g.voiceMessages||0}</div></div>
        <div class="stat-card"><div class="s-label">BÚSQUEDAS HOY</div><div class="s-value">${s.d.searches||0}</div></div>
      `;
      modalStats.classList.remove('hidden');
      break;
    }

    case 'profundo': {
      if (!args) {
        addMsg('arex', '**◆ MODO PROFUNDO** — razonamiento pesado con Gemini 2.5 Pro (cuota diaria limitada, tarda 10-30s).\n\nUso: `/profundo tu pregunta`\nEjemplo: `/profundo ¿cómo reestructuro mis pagos para liquidar la Oro 6 meses antes?`');
        break;
      }
      if (!AREX_CONFIG?.geminiKey) {
        addMsg('arex', 'El modo profundo necesita tu **Gemini API Key**. Agrégala en `/config` (gratis en aistudio.google.com).');
        break;
      }
      addMsg('user', `◆ /profundo ${args}`);
      showThinking();
      setOrb('thinking', 'Razonamiento profundo...');
      try {
        const deep = await _callGeminiPro(args);
        hideThinking();
        const texto = `**◆ MODO PROFUNDO · GEMINI 2.5 PRO**\n\n${deep}`;
        history.push({ role: 'assistant', content: texto });
        await saveMsg('assistant', texto);
        updateMemMetric();
        const wrap = makeArexWrap();
        await renderArexReply(wrap, texto);
      } catch (e) {
        hideThinking();
        const esCuota = /429|quota|RESOURCE_EXHAUSTED/i.test(e.message || '');
        addMsg('arex', esCuota
          ? '**[Modo profundo]** Cuota diaria de Gemini Pro agotada — vuelve a intentar mañana. Te respondo con el cerebro normal (K2):'
          : `**[Modo profundo]** Error: ${e.message}. Te respondo con el cerebro normal:`);
        // Fallback: la misma pregunta al cerebro de chat (Kimi K2)
        txt.value = args;
        await handleSend();
      }
      setOrb(null, 'En espera de instrucciones');
      break;
    }

    case 'hechos': {
      if (args?.startsWith('borrar ')) {
        const n = parseInt(args.split(' ')[1]) - 1;
        const arr = getHechos();
        if (arr[n]) { deleteHecho(arr[n].id); addMsg('arex', `Hecho #${n+1} eliminado.`); }
        else addMsg('arex', 'Número de hecho inválido. Usa `/hechos` para ver la lista.');
      } else {
        renderHechosList();
      }
      break;
    }

    case 'recordar': {
      await requestNotifPerm();
      if (!args) {
        const recs = getRecordatorios();
        const activos = recs.filter(r => !r.disparado).sort((a,b) => a.disparaEn - b.disparaEn);
        if (!activos.length) { addMsg('arex', 'Sin recordatorios activos.\nUso: `/recordar 30min mensaje` · `/recordar 2h mensaje` · `/recordar 20:00 mensaje`'); break; }
        const lista = activos.map(r => `⏰ **${r.msg}** — ${fmtCountdown(r.disparaEn)}`).join('\n');
        addMsg('arex', `Recordatorios activos:\n${lista}`);
        break;
      }
      const parsed = parseReminder(args);
      if (!parsed) { addMsg('arex','Formato: `/recordar 30min mensaje` · `/recordar 2h mensaje` · `/recordar 20:00 mensaje`'); break; }
      saveReminder(parsed.ms, parsed.msg);
      const mins = Math.round(parsed.ms / 60000);
      addMsg('arex', `✅ Recordatorio guardado: "${parsed.msg}" — ${mins < 60 ? mins+' min' : (mins/60).toFixed(1)+' h'}.`);
      break;
    }

    case 'atajos':
      renderAtajosList();
      document.getElementById('atajo-name').value   = '';
      document.getElementById('atajo-desc').value   = '';
      document.getElementById('atajo-prompt').value = '';
      document.getElementById('atajo-error').style.display = 'none';
      modalAtalos.classList.remove('hidden');
      break;

    case 'contexto': {
      const ctx = loadPersonalContext();
      document.getElementById('ctx-proyectos').value  = ctx.proyectos  || '';
      document.getElementById('ctx-universidad').value = ctx.universidad || '';
      document.getElementById('ctx-metas').value      = ctx.metas      || '';
      document.getElementById('ctx-datos').value      = ctx.datos      || '';
      document.getElementById('ctx-ok').classList.add('hidden');
      modalContext.classList.remove('hidden');
      break;
    }

    case 'config': {
      abrirConfig();
      break;
    }

    case 'proyecto': {
      if (!args) { addMsg('arex', 'Uso: `/proyecto nombre — descripción`\nEjemplo: `/proyecto Tesis — trabajo final de ingeniería`'); break; }
      const sepIdx = args.indexOf('—');
      const nombre = (sepIdx > -1 ? args.slice(0, sepIdx) : args).trim();
      const desc   = (sepIdx > -1 ? args.slice(sepIdx + 1) : '').trim();
      if (typeof proyectoCrear === 'function') {
        const p = proyectoCrear(nombre, desc);
        if (p) {
          addMsg('arex', `Proyecto **"${p.nombre}"** creado.${desc ? ` *${desc}*` : ''}\n\nPuedes verlo en el módulo PROYECTOS del dock.`);
          if (voiceOn || continuousMode) arexSpeak(`Proyecto ${p.nombre} creado.`);
          AREXNav?.cambiarModulo('proyectos');
        }
      }
      break;
    }

    case 'tarea': {
      if (!args) { addMsg('arex', 'Uso: `/tarea texto !alta @2026-05-25`\n- `!alta` / `!media` / `!baja` → prioridad\n- `@YYYY-MM-DD` → fecha límite'); break; }
      const prioMatch = args.match(/!(alta|media|baja)/i);
      const fechaMatch = args.match(/@(\d{4}-\d{2}-\d{2})/);
      const prio  = prioMatch  ? prioMatch[1].toLowerCase() : 'media';
      const fecha = fechaMatch ? fechaMatch[1] : '';
      const texto = args.replace(/!(alta|media|baja)/gi, '').replace(/@\d{4}-\d{2}-\d{2}/g, '').trim();
      if (!texto) { addMsg('arex', 'Escribe la descripción de la tarea.'); break; }
      addTarea(texto, fecha, prio);
      addMsg('arex', `✅ Tarea agregada: **${texto}**${fecha ? ` · 📅 ${fecha}` : ''}${prio !== 'media' ? ` · prioridad ${prio}` : ''}`);
      break;
    }

    case 'memoria': {
      const memoriaModal = document.getElementById('modal-memoria');
      const memoriaList  = document.getElementById('memoria-list');
      if (!memoriaModal || !memoriaList) break;
      const entries = loadMemoria();
      memoriaList.innerHTML = '';
      if (!entries.length) {
        memoriaList.innerHTML = '<div class="memoria-empty">Sin entradas. Usa el campo de abajo para guardar algo permanentemente.</div>';
      } else {
        entries.forEach((e, i) => {
          const el = document.createElement('div');
          el.className = 'memoria-item';
          el.innerHTML = `<span class="memoria-text">${e.text.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span><button class="memoria-del" data-i="${i}">✕</button>`;
          el.querySelector('.memoria-del').onclick = () => {
            const cur = loadMemoria(); cur.splice(i, 1); saveMemoria(cur);
            handleCommand('/memoria');
          };
          memoriaList.appendChild(el);
        });
      }
      memoriaModal.classList.remove('hidden');
      break;
    }

    case 'semana':
      await generarReporteSemanal();
      break;

    case 'hoy':
      mostrarResumenHoy();
      break;

    case 'analizar': {
      const sub = (args || '').toLowerCase().trim();
      if (!sub || sub === 'gastos') await analizarGastos();
      else if (sub === 'metas') await analizarMetas();
      else addMsg('arex', 'Uso: `/analizar gastos` · `/analizar metas`');
      break;
    }

    case 'briefing':
      localStorage.removeItem('arex_briefing_date');
      await generarBriefing();
      break;

    case 'pomodoro':
      togglePomodoroWidget();
      break;

    case 'buscar':
      // openSearch (search.js) acepta prefill — el flujo viejo rellenaba el
      // overlay legacy oculto y el usuario veía la búsqueda vacía
      if (typeof window.openSearch === 'function') {
        window.openSearch(args || '');
      } else {
        abrirBusqueda();
        if (args) {
          const bi = document.getElementById('busqueda-input');
          if (bi) { bi.value = args; renderBusquedaGlobal(args); }
        }
      }
      break;

    default:
      addMsg('arex',`Comando no reconocido: /${name}. Escribe /ayuda para ver los disponibles.`);
  }
}

/* ── Sugerencias contextuales de comandos ───────────── */
const CTX_RULES = [
  {
    cmd: '/recordar', icon: '⏰', label: 'recordar', reason: 'fecha mencionada',
    priority: 0, execute: false, fill: '/recordar ',
    check: () => {
      const txt2 = (history[history.length - 1]?.content || '') +
                   (history[history.length - 2]?.content || '');
      return /mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|en \d+\s*(hora|minuto|día)/i.test(txt2);
    }
  },
  {
    cmd: '/tarea', icon: '✓', label: 'crear tarea', reason: 'acción pendiente',
    priority: 1, execute: false, fill: '/tarea ',
    check: () => {
      const last = history[history.length - 1];
      return last?.role === 'assistant'
        && /(\n|^)\d+\.\s|\n[-•]\s/m.test(last.content)
        && last.content.length > 80
        && !last.content.includes('```');
    }
  },
  {
    cmd: '/resumir', icon: '📋', label: 'resumir', reason: 'conversación larga',
    priority: 1, execute: true,
    check: () => history.length >= 12
  },
  {
    cmd: '/notas', icon: '📝', label: 'guardar nota', reason: 'respuesta detallada',
    priority: 2, execute: false, fill: '/notas ',
    check: () => {
      const last = history[history.length - 1];
      return last?.role === 'assistant' && last.content.length > 400;
    }
  },
  {
    cmd: '/exportar', icon: '📤', label: 'exportar', reason: 'guardar sesión',
    priority: 3, execute: true,
    check: () => history.length >= 8
  }
];

function updateCtxSuggestions() {
  const container = document.getElementById('ctx-suggestions');
  if (!container) return;
  const active = CTX_RULES
    .filter(r => r.check())
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 4);
  container.innerHTML = '';
  active.forEach(rule => {
    const pill = document.createElement('button');
    pill.className = 'ctx-pill';
    pill.innerHTML = `<span class="pill-icon">${rule.icon}</span><span>${rule.label}</span><span class="pill-reason">${rule.reason}</span>`;
    pill.addEventListener('click', () => {
      container.innerHTML = '';
      if (rule.execute) { handleCommand(rule.cmd); }
      else { txt.value = rule.fill; txt.focus(); }
    });
    container.appendChild(pill);
  });
}

/* ── Flujo principal ────────────────────────────────── */
async function handleSend() {
  if (isBusy) return;
  const msg = txt.value.trim();
  if (!msg) return;
  txt.value = '';

  if (msg.startsWith('/')) { await handleCommand(msg); return; }

  if (_isOffline && !msg.startsWith('/')) {
    addMsg('user', msg);
    addMsg('arex', _offlineFallback(msg));
    return;
  }

  // Detectar "recuerda que..." → guardar hecho inmediatamente
  const recuerdaMatch = msg.match(/^recuerda(?:\s+que)?\s+(.+)/i);
  if (recuerdaMatch) {
    addHecho(recuerdaMatch[1], 'manual');
    addMsg('user', msg);
    addMsg('arex', `Guardado en memoria: "${recuerdaMatch[1]}"`);
    return;
  }

  // Detectar URLs en el mensaje
  const msgURLs = extractURLs(msg);
  if (msgURLs.length > 0) {
    const textWithoutURLs = msg.replace(/https?:\/\/[^\s<>"]+/gi, '').trim();
    if (msgURLs.length === 1 && !textWithoutURLs) {
      await handleURL(msgURLs[0]);
    } else {
      await handleMultipleURLs(msgURLs, textWithoutURLs || null);
    }
    return;
  }

  isBusy = true;
  btnSend.disabled = true;
  _lastInteract = Date.now();
  _clearQuickReplies();

  addMsg('user', msg);
  history.push({ role:'user', content: msg });
  await saveMsg('user', msg);
  await updateStats('message');

  let webCtx = null;
  const autoSearch = needsAutoSearch(msg);
  if (searchOn || autoSearch) {
    setOrb('searching', searchOn ? 'Buscando en la web...' : 'Buscando información actualizada...');
    webCtx = await webSearch(msg);
    if (webCtx) await updateStats('search');
  }

  setOrb('thinking','Procesando...');
  showThinking();
  await autoSummarize();

  try {
    const sources = webCtx?.results?.slice(0, 3) || null;
    let srcHTML = '';
    if (sources?.length) {
      srcHTML = `<div class="sources">FUENTES: ${sources.map((s,i) => `<a href="${s.url}" target="_blank" rel="noopener noreferrer">[${i+1}] ${s.title||s.url}</a>`).join(' · ')}</div>`;
    }
    const wrap = makeArexWrap(srcHTML);
    hideThinking();
    const reply = await streamArexReply(wrap, webCtx);
    history.push({ role:'assistant', content: reply });
    await saveMsg('assistant', reply);
    updateMemMetric();
    updateCtxSuggestions();
    saveCurrentSession();
    _playTone('msg');
    _showQuickReplies(reply);
    _resetIdleTimer();
    if (voiceOn) arexSpeak(reply); else setOrb(null,'En espera de instrucciones');

  } catch(err) {
    hideThinking();
    const errMsg = err.message?.includes('401') ? 'API Key inválida o revocada. Ve a console.groq.com y genera una nueva key.' :
                   err.message?.includes('429') ? 'Límite de requests alcanzado. Espera un momento e intenta de nuevo.' :
                   err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError') || _isOffline
                     ? _offlineFallback(history[history.length - 2]?.content || '')
                     : `Error: ${err.message}`;
    addMsg('arex', errMsg);
    if (_isOffline) _setOfflineBanner(true);
    setOrb(null,'En espera de instrucciones');
    console.error(err);
  } finally {
    isBusy = false;
    btnSend.disabled = false;
  }
}

/* ── Eventos ────────────────────────────────────────── */
document.getElementById('btn-nueva-sesion')?.addEventListener('click', startNewSession);

// Módulo Tareas — prioridad selector
let _prioActual = 'media';
document.getElementById('tarea-prio-btns')?.addEventListener('click', e => {
  const btn = e.target.closest('.prio-btn');
  if (!btn) return;
  _prioActual = btn.dataset.prio;
  document.querySelectorAll('#tarea-prio-btns .prio-btn').forEach(b => b.classList.toggle('active', b === btn));
});

function _doAddTarea() {
  const inp    = document.getElementById('tarea-input');
  const fechaEl = document.getElementById('tarea-fecha');
  const fecha  = fechaEl?.value || '';
  if (!inp?.value.trim()) return;
  addTarea(inp.value.trim(), fecha, _prioActual);
  inp.value = '';
  if (fechaEl) fechaEl.value = '';
}

document.getElementById('tarea-add-btn')?.addEventListener('click', _doAddTarea);
document.getElementById('tarea-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') _doAddTarea();
});
document.getElementById('btn-tarea-hoy')?.addEventListener('click', () => {
  const f = document.getElementById('tarea-fecha');
  if (f) f.value = _todayStr();
  document.getElementById('tarea-input')?.focus();
});
document.getElementById('btn-tarea-man')?.addEventListener('click', () => {
  const d = new Date(); d.setDate(d.getDate() + 1);
  const f = document.getElementById('tarea-fecha');
  if (f) f.value = window.dia(d);   // v216: era UTC
  document.getElementById('tarea-input')?.focus();
});
btnSend.addEventListener('click', handleSend);
txt.addEventListener('keydown', e => { _lastInteract = Date.now(); if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
txt.addEventListener('input', () => {
  const s = document.getElementById('ctx-suggestions');
  if (s && txt.value.trim()) s.innerHTML = '';
});
btnMic.addEventListener('click', () => {
  _lastInteract = Date.now();
  _clearQuickReplies();
  if (btnMic.classList.contains('on')) stopListening();
  else startListening();
});

btnVoice.addEventListener('click', () => {
  voiceOn = !voiceOn;
  btnVoice.classList.toggle('active', voiceOn);
  localStorage.setItem('arex_voiceOn', voiceOn ? '1' : '0');
  const msg = voiceOn ? 'Síntesis de voz activada.' : 'Síntesis de voz desactivada.';
  addMsg('arex', msg);
  if (voiceOn) arexSpeak(msg);
  updateSidebarModes();
});

btnSearch.addEventListener('click', () => {
  if (!searchOn && !AREX_CONFIG.tavilyKey) {
    addMsg('arex','Tavily API Key no configurada. Agrega tu clave en la configuración para activar la búsqueda web.');
    return;
  }
  searchOn = !searchOn;
  btnSearch.classList.toggle('active', searchOn);
  localStorage.setItem('arex_searchOn', searchOn ? '1' : '0');
  addMsg('arex', searchOn ? 'Búsqueda web activada. Consultaré fuentes en tiempo real.' : 'Búsqueda web desactivada.');
  updateSidebarModes();
});

btnFile.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => {
  if (e.target.files[0]) { handleFile(e.target.files[0]); fileInput.value = ''; }
});
document.getElementById('btn-camera')?.addEventListener('click', () => document.getElementById('camera-input')?.click());
document.getElementById('camera-input')?.addEventListener('change', e => {
  if (e.target.files[0]) { handleFile(e.target.files[0]); e.target.value = ''; }
});

// Drag & drop
chat.addEventListener('dragover', e => { e.preventDefault(); chat.classList.add('drag-over'); });
chat.addEventListener('dragleave',  () => chat.classList.remove('drag-over'));
chat.addEventListener('drop', e => {
  e.preventDefault(); chat.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

// Notas
document.getElementById('btn-close-notes').addEventListener('click', () => notesPanel.classList.remove('open'));
document.getElementById('btn-add-note').addEventListener('click', async () => {
  const t = noteInput.value.trim();
  if (!t) return;
  const cat = document.getElementById('note-cat-select')?.value || 'General';
  const id = await saveNote(t, cat);
  renderNote(id, t, Date.now(), cat);
  noteInput.value = '';
});
noteInput.addEventListener('keydown', async e => {
  if (e.key==='Enter') {
    const t = noteInput.value.trim(); if (!t) return;
    const cat = document.getElementById('note-cat-select')?.value || 'General';
    const id = await saveNote(t, cat); renderNote(id, t, Date.now(), cat); noteInput.value='';
  }
});

// Filtro de notas por categoría
document.getElementById('notes-filter-bar')?.addEventListener('click', async e => {
  const btn = e.target.closest('[data-cat]');
  if (!btn) return;
  noteFilter = btn.dataset.cat;
  document.querySelectorAll('#notes-filter-bar [data-cat]').forEach(b => b.classList.toggle('active', b.dataset.cat === noteFilter));
  await loadNotes();
});

// Modales
document.getElementById('btn-close-stats').addEventListener('click',   () => modalStats.classList.add('hidden'));
document.getElementById('btn-close-help').addEventListener('click',    () => modalHelp.classList.add('hidden'));
document.getElementById('btn-close-config').addEventListener('click',  () => modalConfig.classList.add('hidden'));
document.getElementById('btn-close-context').addEventListener('click', () => modalContext.classList.add('hidden'));
document.getElementById('btn-close-atajos').addEventListener('click',  () => modalAtalos.classList.add('hidden'));
document.getElementById('btn-close-memoria').addEventListener('click', () => document.getElementById('modal-memoria').classList.add('hidden'));
const modalMemoria = document.getElementById('modal-memoria');
[modalStats, modalHelp, modalConfig, modalContext, modalAtalos, modalMemoria].filter(m => m).forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.add('hidden'); }));

// Agregar entrada de memoria
document.getElementById('memoria-add').addEventListener('click', () => {
  const input = document.getElementById('memoria-input');
  const t = input.value.trim();
  if (!t) return;
  const cur = loadMemoria();
  if (cur.length >= 20) { addMsg('arex','Máximo 20 entradas en memoria. Elimina algunas primero.'); return; }
  cur.push({ text: t, ts: Date.now() });
  saveMemoria(cur);
  input.value = '';
  handleCommand('/memoria');
});
document.getElementById('memoria-input')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('memoria-add').click();
});

// Agregar atajo personalizado
document.getElementById('atajo-add').addEventListener('click', () => {
  const errorEl  = document.getElementById('atajo-error');
  const rawName  = document.getElementById('atajo-name').value.trim().toLowerCase().replace(/^\/+/, '');
  const desc     = document.getElementById('atajo-desc').value.trim();
  const prompt   = document.getElementById('atajo-prompt').value.trim();

  const show = msg => { errorEl.textContent = msg; errorEl.style.display = 'block'; };
  if (!rawName)                          return show('El nombre del atajo es requerido.');
  if (!/^[a-z0-9\-]+$/.test(rawName))   return show('Solo letras minúsculas, números y guiones.');
  if (!prompt)                           return show('El prompt es requerido.');
  if (RESERVED_CMDS.includes(rawName))  return show(`"/${rawName}" es un comando reservado del sistema.`);

  const arr = loadAtalos();
  if (arr.find(a => a.name === rawName)) return show(`El atajo "/${rawName}" ya existe.`);
  if (arr.length >= 15)                  return show('Máximo 15 atajos personalizados.');

  arr.push({ name: rawName, desc, prompt });
  saveAtalos(arr);
  renderAtajosList();

  document.getElementById('atajo-name').value   = '';
  document.getElementById('atajo-desc').value   = '';
  document.getElementById('atajo-prompt').value = '';
  errorEl.style.display = 'none';
});

// Guardar contexto personal
document.getElementById('ctx-save').addEventListener('click', () => {
  const ctx = {
    proyectos:   document.getElementById('ctx-proyectos').value.trim(),
    universidad: document.getElementById('ctx-universidad').value.trim(),
    metas:       document.getElementById('ctx-metas').value.trim(),
    datos:       document.getElementById('ctx-datos').value.trim()
  };
  savePersonalContext(ctx);
  updateCtxBadge();
  document.getElementById('ctx-ok').classList.remove('hidden');
});

// Guardar config desde modal /config
document.getElementById('cfg2-save').addEventListener('click', () => {
  const groq = document.getElementById('cfg2-groq').value.trim();
  if (!groq) { document.getElementById('cfg2-error').style.display = 'block'; return; }
  document.getElementById('cfg2-error').style.display = 'none';
  const fbKey = document.getElementById('cfg2-fb-key').value.trim();
  const config = {
    groqKey:   groq,
    tavilyKey: document.getElementById('cfg2-tavily').value.trim() || '',
    owmKey:    document.getElementById('cfg2-owm').value.trim()    || '',
    tomtomKey: document.getElementById('cfg2-tomtom')?.value.trim() || '',
    geminiKey: document.getElementById('cfg2-gemini').value.trim() || '',
    firebase:  fbKey ? {
      apiKey:            fbKey,
      authDomain:        document.getElementById('cfg2-fb-domain').value.trim(),
      projectId:         document.getElementById('cfg2-fb-project').value.trim(),
      storageBucket:     document.getElementById('cfg2-fb-bucket').value.trim(),
      messagingSenderId: document.getElementById('cfg2-fb-sender').value.trim(),
      appId:             document.getElementById('cfg2-fb-app').value.trim(),
      vapidKey:          document.getElementById('cfg2-fb-vapid').value.trim() || undefined,
    } : null
  };
  localStorage.setItem('arex_config', JSON.stringify(config));
  window.AREX_CONFIG = config;
  initFirebase();
  syncConfigToFirestore();
  document.getElementById('cfg2-ok').style.display = 'block';
});

// ── Modal de ajustes (botón ⚙ del header, /config y Mission Control) ──
function abrirConfig() {
  const fb = AREX_CONFIG?.firebase || {};
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  set('cfg2-groq',       AREX_CONFIG?.groqKey);
  set('cfg2-tavily',     AREX_CONFIG?.tavilyKey);
  set('cfg2-gemini',     AREX_CONFIG?.geminiKey);
  set('cfg2-owm',        AREX_CONFIG?.owmKey);
  set('cfg2-tomtom',     AREX_CONFIG?.tomtomKey);
  set('cfg2-fb-key',     fb.apiKey);
  set('cfg2-fb-domain',  fb.authDomain);
  set('cfg2-fb-project', fb.projectId);
  set('cfg2-fb-bucket',  fb.storageBucket);
  set('cfg2-fb-sender',  fb.messagingSenderId);
  set('cfg2-fb-app',     fb.appId);
  set('cfg2-fb-vapid',   fb.vapidKey);
  const ok = document.getElementById('cfg2-ok');
  const er = document.getElementById('cfg2-error');
  if (ok) ok.style.display = 'none';
  if (er) er.style.display = 'none';
  if (typeof _updateNotifStatus === 'function') _updateNotifStatus();
  document.getElementById('modal-config')?.classList.remove('hidden');
}
window.abrirConfig = abrirConfig;

// ── Transferencia de config a otro dispositivo (Quest, tablet, etc.) ──
// El código es la config completa en base64 — contiene API keys en claro:
// compartirlo solo por canales privados, nunca publicarlo.

/* Panel de respaldo si el portapapeles falla (v206).
   ANTES caía en prompt(), que en PWAs instaladas de iOS está roto: congela
   el hilo y suele devolver vacío — justo en la función que sirve para pasar
   AREX al Quest. Ahora muestra el código en un textarea seleccionable. */
function _mostrarCodigoManual(code, titulo) {
  document.getElementById('arex-code-panel')?.remove();
  const d = document.createElement('div');
  d.id = 'arex-code-panel';
  d.style.cssText = 'position:fixed;inset:0;z-index:99998;display:flex;align-items:center;justify-content:center;background:rgba(0,4,12,.82);padding:18px;';
  d.innerHTML = `
    <div style="width:min(96%,460px);background:rgba(0,10,24,.98);border:1px solid rgba(34,211,238,.5);border-left:3px solid #22d3ee;border-radius:6px;padding:18px;">
      <div style="font-family:var(--font);font-size:11px;letter-spacing:1.4px;color:#d6f2ff;margin-bottom:10px;">${titulo}</div>
      <div style="font-size:10px;color:#8caabe;margin-bottom:8px;line-height:1.5;">Mantén presionado sobre el código → Seleccionar todo → Copiar.<br>⚠ Contiene tus API keys: compártelo solo por canales privados.</div>
      <textarea id="arex-code-ta" readonly style="width:100%;height:130px;background:rgba(0,6,16,.9);border:1px solid rgba(34,211,238,.35);color:#eaf7ff;font-family:var(--font-mono,monospace);font-size:10px;padding:10px;border-radius:4px;resize:none;word-break:break-all;">${code}</textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button id="arex-code-sel" style="background:rgba(34,211,238,.10);border:1px solid rgba(34,211,238,.6);color:#22d3ee;font-family:var(--font);font-size:10px;letter-spacing:1.4px;padding:10px 16px;min-height:40px;border-radius:4px;cursor:pointer;">SELECCIONAR TODO</button>
        <button id="arex-code-x" style="background:transparent;border:1px solid rgba(140,170,190,.35);color:#8caabe;font-family:var(--font);font-size:10px;letter-spacing:1.4px;padding:10px 16px;min-height:40px;border-radius:4px;cursor:pointer;">CERRAR</button>
      </div>
    </div>`;
  document.body.appendChild(d);
  const ta = d.querySelector('#arex-code-ta');
  d.querySelector('#arex-code-x').onclick = () => d.remove();
  d.querySelector('#arex-code-sel').onclick = () => { ta.focus(); ta.select(); ta.setSelectionRange(0, ta.value.length); };
  setTimeout(() => { ta.focus(); ta.select(); }, 80);
}

function copiarCodigoConfig() {
  const cfg = window.AREX_CONFIG;
  if (!cfg?.groqKey) { tost('No hay configuración cargada para copiar.', 'error'); return; }
  const code = btoa(unescape(encodeURIComponent(JSON.stringify(cfg))));
  const done = () => aviso('Código copiado. Pégalo en la pantalla de configuración del otro dispositivo.\n\n⚠ Contiene tus API keys — no lo compartas ni lo publiques.');
  const manual = () => _mostrarCodigoManual(code, '◈ CÓDIGO DE CONFIGURACIÓN');
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(manual);
  } else {
    manual();
  }
}
window.copiarCodigoConfig = copiarCodigoConfig;

// Código COMPLETO: keys + todos los datos (tarjetas, negocio, tareas, notas...)
// Pensado para el Quest: un solo copy/paste deja el dispositivo idéntico,
// sin andar pasando archivos de backup.
function copiarCodigoCompleto() {
  const cfg = window.AREX_CONFIG;
  if (!cfg?.groqKey) { tost('No hay configuración cargada para copiar.', 'error'); return; }
  const data = {};
  Object.keys(localStorage)
    .filter(k => k.startsWith('arex_') && k !== 'arex_config')
    .forEach(k => { data[k] = localStorage.getItem(k); });
  let code;
  try { code = btoa(unescape(encodeURIComponent(JSON.stringify({ __arex: 'full-v1', config: cfg, data })))); }
  catch (e) { tost('No se pudo generar el código: ' + e.message, 'error'); return; }
  const kb = Math.max(1, Math.round(code.length / 1024));
  const done = () => aviso(`Código completo copiado (${kb} KB) — keys + todos tus datos.\n\nPégalo en la pantalla de configuración del otro dispositivo.\n\n⚠ Contiene tus API keys y datos personales — compártelo solo por canales privados.`);
  const manual = () => _mostrarCodigoManual(code, `◈ CÓDIGO COMPLETO · ${kb} KB`);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(code).then(done).catch(manual);
  } else {
    manual();
  }
}
window.copiarCodigoCompleto = copiarCodigoCompleto;

function importarCodigoConfig() {
  const raw = document.getElementById('cfg-import-code')?.value.trim();
  if (!raw) { tost('Pega primero el código de transferencia.', 'error'); return; }
  let cfg;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (parsed?.__arex === 'full-v1') {
      // Código completo: restaurar también todos los datos
      if (!parsed.config?.groqKey) { tost('El código no contiene una Groq API Key válida.', 'error'); return; }
      Object.entries(parsed.data || {}).forEach(([k, v]) => {
        if (k.startsWith('arex_')) { try { localStorage.setItem(k, v); } catch {} }
      });
      cfg = parsed.config;
    } else {
      cfg = parsed;
    }
  }
  catch { tost('Código inválido. Verifica que lo copiaste completo desde /config → COPIAR CÓDIGO.', 'error'); return; }
  if (!cfg?.groqKey) { tost('El código no contiene una Groq API Key válida.', 'error'); return; }
  localStorage.setItem('arex_config', JSON.stringify(cfg));
  window.AREX_CONFIG = cfg;
  document.getElementById('setup-screen').classList.add('hidden');
  document.getElementById('boot-screen').style.display = 'flex';
  initFirebase();
  syncConfigToFirestore();
  boot();
}
window.importarCodigoConfig = importarCodigoConfig;

// Búsqueda global — Ctrl+K / Esc
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); abrirBusqueda(); }
  if (e.key === 'Escape') cerrarBusqueda();
});
document.getElementById('busqueda-overlay')?.addEventListener('click', e => { if (e.target.id === 'busqueda-overlay') cerrarBusqueda(); });
{ let _bgt; document.getElementById('busqueda-input')?.addEventListener('input', e => { clearTimeout(_bgt); _bgt = setTimeout(() => renderBusquedaGlobal(e.target.value), 220); }); }

// Sidebar: abrir / cerrar
document.getElementById('btn-sidebar').addEventListener('click', openSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

// Notas
document.getElementById('notas-add-btn').addEventListener('click', addNota);
{ let _nst; document.getElementById('notas-search').addEventListener('input', () => { clearTimeout(_nst); _nst = setTimeout(renderNotas, 250); }); }

// Calendario de tareas
document.getElementById('cal-prev').addEventListener('click', () => {
  _calMonth--; if (_calMonth < 0) { _calMonth = 11; _calYear--; }
  _calSelDay = null; renderCalendario();
});
document.getElementById('cal-next').addEventListener('click', () => {
  _calMonth++; if (_calMonth > 11) { _calMonth = 0; _calYear++; }
  _calSelDay = null; renderCalendario();
});

// Sidebar: acciones rápidas
document.querySelectorAll('.qcmd').forEach(btn => {
  btn.addEventListener('click', async () => {
    closeSidebar();
    const cmd = btn.dataset.cmd;
    txt.value = cmd;
    await handleCommand(cmd);
    txt.value = '';
  });
});

// Sidebar: modos toggle
document.getElementById('sb-search').addEventListener('click', () => btnSearch.click());
document.getElementById('sb-exam').addEventListener('click', () => {
  txt.value = '/examen'; handleCommand('/examen'); txt.value = '';
});
document.getElementById('sb-voice').addEventListener('click', () => btnVoice.click());
document.getElementById('sb-continuous').addEventListener('click', toggleContinuousMode);

// Voces
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// PWA
/* v211 · ACTUALIZACIÓN CONTROLADA POR EL USUARIO
   ANTES: skipWaiting() + el mensaje SW_UPDATED forzaban location.reload() a
   los 800 ms, así que el banner de "nueva versión" y la auto-recarga competían
   y ganaba la recarga — el usuario podía perder lo que estaba capturando. Y la
   PRIMERA instalación de un dispositivo nuevo disparaba una recarga espuria.
   AHORA: el banner aparece, la página NO se recarga sola, y solo al tocarlo se
   le pide al SW que aplique la versión nueva. */
if ('serviceWorker' in navigator) {
  let _swReg = null;
  let _ultimoChequeo = 0;

  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    _swReg = reg;
    reg.update();
    _ultimoChequeo = Date.now();

    // Si ya hay un SW esperando de una visita anterior, avisar de una vez
    if (reg.waiting && navigator.serviceWorker.controller) _showUpdateBanner();

    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        // controller != null ⇒ NO es la primera instalación: es una actualización
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner();
        }
      });
    });
  }).catch(e => console.warn('SW:', e));

  /* v211: chequeo al volver a primer plano. Antes solo se comprobaba una vez
     al cargar la página: una PWA instalada que se deja suspendida (el Quest en
     reposo, la app de iOS en segundo plano) podía pasar DÍAS sin enterarse de
     que había versión nueva. Por eso los dos dispositivos divergían. */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !_swReg) return;
    if (Date.now() - _ultimoChequeo < 15 * 60000) return;   // máximo cada 15 min
    _ultimoChequeo = Date.now();
    _swReg.update().catch(() => {});
  });

  // Aplicar la actualización: lo llama el botón del banner
  window._aplicarActualizacion = function () {
    const w = _swReg?.waiting || _swReg?.installing;
    if (w) {
      // Cuando el SW nuevo tome el control, recargamos una sola vez
      let recargado = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!recargado) { recargado = true; window.location.reload(); }
      });
      w.postMessage({ type: 'APLICAR_ACTUALIZACION' });
    } else {
      window.location.reload();
    }
  };

  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED' || e.data?.type === 'SW_VERSION') {
      if (e.data.version) window.AREX_SW_VERSION = e.data.version;
      // v211: el SW avisa si instaló con recursos fallidos — antes era invisible
      if (e.data.fallidos?.length) {
        window.AREX_SW_FALLIDOS = e.data.fallidos;
        try { logBitacora?.('alerta', `SW instalado con ${e.data.fallidos.length} recursos fallidos`); } catch {}
      }
      // v211: comparar la versión del SW contra la que espera esta app.
      // Detecta el escenario "index.html nuevo con app.js viejo" (o al revés),
      // que antes era completamente invisible.
      if (e.data.version && e.data.version !== AREX_VERSION) {
        console.warn(`AREX: desajuste de versión — app ${AREX_VERSION}, SW ${e.data.version}`);
        window.AREX_DESAJUSTE = { app: AREX_VERSION, sw: e.data.version };
      }
      // Ya NO se recarga sola: el usuario decide con el banner.
    }
  });

  // Preguntar la versión real al SW (fuente fiable). Antes se deducía del
  // nombre del caché, que durante una transición es NO determinista: coexisten
  // arex-v210 y arex-v211 y se tomaba la primera del array.
  navigator.serviceWorker.ready.then(reg => {
    reg.active?.postMessage({ type: 'QUE_VERSION' });
  }).catch(() => {});
}

function _showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <span>⬆ Nueva versión de AREX lista</span>
    <button onclick="window._aplicarActualizacion?.()">ACTUALIZAR</button>
    <button onclick="this.parentElement.remove()" style="opacity:0.5;font-size:10px">×</button>
  `;
  banner.style.cssText = `
    position:fixed;bottom:calc(80px + env(safe-area-inset-bottom, 0px));left:50%;transform:translateX(-50%);
    background:rgba(0,14,26,0.97);border:1px solid rgba(0,212,255,0.5);
    color:#22d3ee;font-family:var(--font-mono);font-size:11px;letter-spacing:1px;
    padding:10px 14px;border-radius:6px;z-index:9999;
    display:flex;align-items:center;gap:10px;
    box-shadow:0 0 20px rgba(0,212,255,0.2);
    animation:appear 0.3s ease-out;
    white-space:nowrap;
  `;
  banner.querySelector('button').style.cssText = `
    background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.5);
    color:#22d3ee;font-family:var(--font-mono);font-size:10px;letter-spacing:2px;
    padding:4px 10px;border-radius:3px;cursor:pointer;
  `;
  document.body.appendChild(banner);
}

/* ══════════════════════════════════════════════════════
   QUICK CAPTURE — universal fast input
   ══════════════════════════════════════════════════════ */
(function initQuickCapture() {
  let _qcType    = 'tarea';
  let _qcTimer   = null;
  let _qcVisible = false;

  function _qcOpen() {
    const overlay = document.getElementById('qc-overlay');
    const input   = document.getElementById('qc-input');
    if (!overlay) return;
    overlay.classList.add('visible');
    _qcVisible = true;
    setTimeout(() => input?.focus(), 80);
    _qcSetType('tarea');
    _qcSetHint('Escribe para clasificar...');
    if (input) input.value = '';
    document.getElementById('qc-extra').innerHTML = '';
  }

  function _qcClose() {
    document.getElementById('qc-overlay')?.classList.remove('visible');
    _qcVisible = false;
    clearTimeout(_qcTimer);
  }

  function _qcSetType(type) {
    _qcType = type;
    document.querySelectorAll('.qc-pill').forEach(p => p.classList.toggle('active', p.dataset.type === type));
    _qcRenderExtra(type);
  }

  function _qcSetHint(txt, classified = false) {
    const el = document.getElementById('qc-classify-hint');
    if (!el) return;
    el.textContent = txt;
    el.classList.toggle('classified', classified);
  }

  function _qcRenderExtra(type) {
    const el = document.getElementById('qc-extra');
    if (!el) return;
    if (type === 'tarea') {
      el.innerHTML = `<div class="qc-extra-row">
        <span class="qc-extra-lbl">FECHA</span>
        <input type="date" class="qc-extra-input" id="qc-tarea-fecha"/>
        <span class="qc-extra-lbl">PRIORIDAD</span>
        <select class="qc-extra-input" id="qc-tarea-prio" style="max-width:90px">
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="baja">Baja</option>
        </select>
      </div>`;
    } else if (type === 'gasto') {
      el.innerHTML = `<div class="qc-extra-row">
        <span class="qc-extra-lbl">$</span>
        <input type="number" class="qc-extra-input" id="qc-gasto-monto" placeholder="Monto" min="0" step="0.01" style="max-width:100px"/>
        <span class="qc-extra-lbl">CAT</span>
        <select class="qc-extra-input" id="qc-gasto-cat" style="max-width:110px">
          <option value="comida">Comida</option>
          <option value="transporte">Transporte</option>
          <option value="entretenimiento">Entretenimiento</option>
          <option value="salud">Salud</option>
          <option value="ropa">Ropa</option>
          <option value="hogar">Hogar</option>
          <option value="educacion">Educación</option>
          <option value="otro">Otro</option>
        </select>
      </div>`;
    } else {
      el.innerHTML = '';
    }
  }

  async function _qcClassify(text) {
    if (text.length < 4) return;
    clearTimeout(_qcTimer);
    _qcTimer = setTimeout(async () => {
      const key = window.AREX_CONFIG?.groqKey;
      if (!key) {
        // Heurística sin IA
        const lower = text.toLowerCase();
        if (/\d+\s*(peso|mxn|$|pago|gasto|compré|compre|gasté|gaste)/i.test(lower)) _qcSetType('gasto');
        else if (/quiero|objetivo|lograr|alcanzar|meta/i.test(lower)) _qcSetType('meta');
        else if (/nota|apunte|recordé|recorde|idea/i.test(lower)) _qcSetType('nota');
        else _qcSetType('tarea');
        return;
      }
      try {
        const reply = (await callBrain('rapido', [{
          role: 'user',
          content: `Clasifica este texto en UNA palabra: tarea, nota, gasto, o meta. Solo responde la palabra. Texto: "${text.slice(0, 120)}"`
        }], { maxTokens: 20 })).toLowerCase().trim();
        const type  = ['tarea','nota','gasto','meta'].find(t => reply.includes(t)) || 'tarea';
        _qcSetType(type);
        _qcSetHint(`AREX clasificó como: ${type.toUpperCase()}`, true);
      } catch { /* use current type */ }
    }, 700);
  }

  function _qcSave() {
    const text = document.getElementById('qc-input')?.value?.trim();
    if (!text) return;

    try {
      switch (_qcType) {
        case 'tarea': {
          const fecha = document.getElementById('qc-tarea-fecha')?.value || '';
          const prio  = document.getElementById('qc-tarea-prio')?.value  || 'media';
          if (typeof addTarea === 'function') addTarea(text, fecha, prio);
          break;
        }
        case 'nota': {
          const ns = _safeJSON(localStorage.getItem('arex_notas'), []);
          const now = Date.now();
          ns.unshift({ id: String(now), titulo: '', cuerpo: text, pinned: false, color: '', createdAt: now, updatedAt: now });
          localStorage.setItem('arex_notas', JSON.stringify(ns));
          window.renderNotas?.();
          if (typeof arexSyncData === 'function') arexSyncData('arex_notas');
          break;
        }
        case 'gasto': {
          const monto = parseFloat(document.getElementById('qc-gasto-monto')?.value || '0');
          const cat   = document.getElementById('qc-gasto-cat')?.value || 'otro';
          if (monto > 0 && typeof window.gpAddGastoAuto === 'function') {
            window.gpAddGastoAuto(monto, cat, text);
          } else if (monto > 0) {
            const gpData = _safeJSON(localStorage.getItem('arex_gastos_pers'), { gastos: [], presupuesto: {} });
            if (!Array.isArray(gpData.gastos)) gpData.gastos = [];
            gpData.gastos.unshift({ id: String(Date.now()), concepto: text, monto, categoria: cat, fecha: window.hoy() });   // v216: era UTC
            localStorage.setItem('arex_gastos_pers', JSON.stringify(gpData));
            if (typeof arexSyncData === 'function') arexSyncData('arex_gastos_pers');
          }
          break;
        }
        case 'meta': {
          const ms = _safeJSON(localStorage.getItem('arex_metas'), []);
          ms.unshift({ id: String(Date.now()), titulo: text, descripcion: '', tipo: 'porcentaje', valorActual: 0, valorObjetivo: 100, unidad: '%', categoria: 'personal', completada: false, creada: Date.now() });
          localStorage.setItem('arex_metas', JSON.stringify(ms));
          window.renderMetas?.();
          if (typeof arexSyncData === 'function') arexSyncData('arex_metas');
          break;
        }
      }
      // Visual confirmation
      const btn = document.getElementById('qc-save');
      if (btn) { btn.textContent = '✓ GUARDADO'; setTimeout(() => { btn.textContent = 'GUARDAR →'; }, 1200); }
      setTimeout(_qcClose, 800);
      if (typeof logBitacora === 'function') logBitacora('sistema', `Quick capture: ${_qcType} — ${text.slice(0,40)}`);
    } catch (e) { console.warn('Quick capture save:', e); }
  }

  // Wire up after DOM ready
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('qc-fab')?.addEventListener('click', _qcOpen);
    document.getElementById('qc-close')?.addEventListener('click', _qcClose);
    document.getElementById('qc-save')?.addEventListener('click', _qcSave);

    document.getElementById('qc-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'qc-overlay') _qcClose();
    });

    document.getElementById('qc-input')?.addEventListener('input', e => _qcClassify(e.target.value));
    document.getElementById('qc-input')?.addEventListener('keydown', e => {
      if (e.key === 'Escape') _qcClose();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) _qcSave();
    });

    document.getElementById('qc-type-pills')?.addEventListener('click', e => {
      const pill = e.target.closest('.qc-pill');
      if (pill) _qcSetType(pill.dataset.type);
    });

    // Keyboard shortcut: Q key (when no input focused)
    document.addEventListener('keydown', e => {
      if (e.key === 'q' && !e.ctrlKey && !e.metaKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        _qcVisible ? _qcClose() : _qcOpen();
      }
      if (e.key === 'Escape' && _qcVisible) _qcClose();
    });
  });

  window.openQuickCapture = _qcOpen;
})();

/* ── Secuencia de arranque ──────────────────────────── */
async function boot() {
  const bootScreen = document.getElementById('boot-screen');

  // Wrap all init work — any error must NOT block the boot screen from hiding
  // Firebase pulls (pullConfigFromFirestore, pullAllModuleData, loadHistory)
  // se ejecutan en el callback de onAuthStateChanged, no aquí.
  try {
    // Acotado a 3s: si el prompt de permisos se cuelga (Quest/iOS raros),
    // el arranque NO puede quedarse esperando eternamente
    await Promise.race([requestNotifPerm(), new Promise(r => setTimeout(r, 3000))]);
    updateCtxBadge();
    updateSidebarAll();
    renderTareas();
    restoreReminders();
    renderHudPanels();
    initMatrixRain();
    if (typeof initSearch === 'function') initSearch();

    // Restaurar preferencias de sesión anterior
    if (localStorage.getItem('arex_voiceOn') === '1') {
      voiceOn = true;
      btnVoice?.classList.add('active');
    }
    if (localStorage.getItem('arex_searchOn') === '1' && AREX_CONFIG.tavilyKey) {
      searchOn = true;
      btnSearch?.classList.add('active');
    }
    updateSidebarModes();

    // Sub-agentes: verificar alertas de pagos urgentes al arrancar
    setTimeout(() => {
      if (typeof window.checkFinanzasAlerts === 'function') window.checkFinanzasAlerts();
      if (typeof window.checkMetasAlerts === 'function') window.checkMetasAlerts();
      // VIGÍA (v204): vigilancia proactiva cruzando módulos. control.js es
      // lazy — si aún no cargó, se reintenta una vez más adelante.
      if (typeof window._vigilancia === 'function') window._vigilancia();
      else setTimeout(() => window._vigilancia?.(), 12000);
    }, 3500);

    // Iniciar temporizador de mensajes proactivos por inactividad
    _resetIdleTimer();

    // Detección de múltiples pestañas (avisa si hay otra instancia abierta)
    if (typeof BroadcastChannel !== 'undefined') {
      const _tabCh = new BroadcastChannel('arex_tab');
      _tabCh.postMessage({ type: 'NEW_TAB' });
      _tabCh.addEventListener('message', e => {
        if (e.data?.type === 'NEW_TAB') {
          addMsg('arex', '⚠ **Aviso:** AREX está abierto en otra pestaña. Usar dos pestañas simultáneas puede causar conflictos en los datos guardados.');
        }
      });
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') restoreReminders(); });
  } catch(e) {
    console.warn('AREX boot error:', e);
  }

  // Lazy-load motores visuales pesados tras la primera interacción
  // (holo.js, parallax.js, vision.js no son esenciales para INICIO/CHAT)
  const _loadVisualEngines = (() => {
    let done = false;
    return () => {
      if (done) return; done = true;
      ['holo.js', 'parallax.js', 'vision-orb.js', 'vision.js'].forEach(src => {
        if (document.querySelector(`script[src="${src}"]`)) return;
        const s = document.createElement('script');
        if (src === 'vision.js') s.type = 'module';
        s.src = src;
        document.body.appendChild(s);
      });
    };
  })();
  document.addEventListener('pointerdown', _loadVisualEngines, { once: true });
  document.addEventListener('keydown',     _loadVisualEngines, { once: true });
  setTimeout(_loadVisualEngines, 4000); // fallback si no hay interacción

  // Fade del boot — v197: recortado de ~3.5s de esperas a ~1.3s máximo.
  // La espera de auth baja de 2.5s a 1s: si Firebase tarda más, el login
  // overlay aparece SOBRE la app sin problema — no vale la pena retener
  // la pantalla de carga por evitar un parpadeo de medio segundo.
  bootScreen.style.transition = 'opacity 0.35s';
  bootScreen.style.opacity = '0';
  await new Promise(r => setTimeout(r, 350));
  for (let i = 0; i < 10; i++) {
    if (window._arexUid) break;
    const lo = document.getElementById('login-overlay');
    if (lo && lo.style.display !== 'none') break;
    await new Promise(r => setTimeout(r, 100));
  }
  bootScreen.style.display = 'none';
  txt?.focus();
  setTimeout(() => generarBriefing(), 800);
}

/* ── clima, globo, insignias, pomodoro y tipo de cambio → extraído a widgets.js (v219) ── */
// ── Exponer funciones de render al scope global para jarvis.js
// (app.js es módulo ES6 — sus funciones no son globales por defecto)
window.renderDashboard = renderDashboard;
window.getTareas       = getTareas;
window.getNotas        = getNotas;
window._arexHistory    = () => history;
window.loadSession     = loadSession;
// El botón del onboarding la invoca con onclick="_finishOnboarding?.()" —
// sin esta línea el ?. fallaba en silencio y el usuario nuevo quedaba atrapado
window._finishOnboarding = _finishOnboarding;

// Escape HTML compartido — todos los módulos lazy (negocio, hábitos, reparto,
// agenda, control, evidencias, proyectos, search) lo usan al renderizar listas
window._h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

// Consignación: producto en la calle (lee localStorage directo — funciona
// aunque negocio.js no esté cargado; lo usan finanzas.js y buildModuleContext)
// v209: FUENTE ÚNICA DE VERDAD de la existencia por tienda.
// Este cálculo estaba escrito 4 veces (aquí, negTiendaStats en negocio.js, el
// VIGÍA y el filtro de reparto) y ya divergía. Vive en app.js porque es el
// único archivo siempre cargado: negocio.js es lazy y INICIO/FINANZAS se
// pintan antes de que exista. negocio.js y control.js lo consumen desde aquí.
// v209: ventas/gastos de negocio guardan `fecha` como TIMESTAMP numérico.
// El código de contexto usaba v.fecha?.startsWith(...) — que lanza TypeError
// sobre un número; el try/catch lo tragaba y el análisis IA del módulo NEGOCIO
// respondía SIEMPRE "no hay datos suficientes". Este helper compara bien.
function _inicioMesTs() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1).getTime();
}

function negExistenciaTienda(neg, sucId) {
  const out = { existencia: 0, entregado: 0, vendido: 0, ultimaEntrega: null };
  if (!neg) return out;
  const ent = (neg.entregas || []).filter(e => e.sucursalId === sucId);
  if (!ent.length) return out;
  const primera = Math.min(...ent.map(e => e.fecha));
  out.entregado = ent.reduce((a, e) => a + (e.cantidadML || 0), 0);
  out.vendido   = (neg.ventas || [])
    .filter(v => v.sucursalId === sucId && v.fecha >= primera)
    .reduce((a, v) => a + (v.cantidad || 0), 0);
  out.existencia    = Math.max(0, out.entregado - out.vendido);
  out.ultimaEntrega = ent.reduce((m, e) => e.fecha > m.fecha ? e : m, ent[0]);
  return out;
}
window.negExistenciaTienda = negExistenciaTienda;

// Consignación: producto en la calle (lee localStorage directo — funciona
// aunque negocio.js no esté cargado; lo usan finanzas.js y buildModuleContext)
function arexCalleResumen() {
  const empty = { totalML: 0, tiendas: 0, valor: 0, resurtir: [] };
  try {
    const neg = _safeJSON(localStorage.getItem('arex_negocio'), null);
    if (!neg) return empty;
    // v209: default 12 como getNegocioData(). Antes, si faltaba precioVenta
    // en config, el valor del producto en la calle salía $0 con producto real.
    const precio = neg.config?.precioVenta ?? 12;
    // v209: ya NO se excluyen las tiendas pausadas — si una tienda pausada
    // tiene producto tuyo, ese dinero SIGUE en la calle. Antes se subestimaba.
    const sucs = (neg.sucursales || []).filter(s => s.modo === 'consignacion');
    let totalML = 0; const resurtir = [];
    sucs.forEach(s => {
      const { existencia } = negExistenciaTienda(neg, s.id);
      totalML += existencia;
      // <= para que una tienda vacía con minML 0 también pida resurtido
      if (existencia <= (s.minML ?? 10)) resurtir.push(s.nombre);
    });
    return { totalML, tiendas: sucs.length, valor: totalML * precio, resurtir };
  } catch { return empty; }
}
window.arexCalleResumen = arexCalleResumen;

// getMetas vive en metas.js (lazy) — fallback global para que proyectos.js
// cuente metas aunque el módulo Metas no se haya abierto aún.
// Cuando metas.js carga, su declaración global lo reemplaza sin conflicto.
if (typeof window.getMetas !== 'function') {
  window.getMetas = () => _safeJSON(localStorage.getItem('arex_metas'), []);
}

// Actualiza countdowns de recordatorios cada 30 segundos (short-circuit si no hay elementos)
setInterval(() => {
  const els = document.querySelectorAll('.rec-cd[data-de]');
  if (!els.length) return;
  els.forEach(el => { el.textContent = fmtCountdown(parseInt(el.dataset.de)); });
}, 30000);

// Punto de entrada — siempre registrar el handler del setup
setupSaveHandler();

// ── Rescate de arranque (v192) ──────────────────────────
// Si boot() muere o se cuelga por CUALQUIER razón, la pantalla de carga
// jamás debe quedarse eterna: a los 12s se libera la interfaz a la fuerza
// y se reporta qué pasó. "Cargando para siempre" queda prohibido.
function _bootRescue(err) {
  const bs = document.getElementById('boot-screen');
  if (!bs || bs.style.display === 'none') return;   // el boot sí terminó
  bs.style.display = 'none';
  const detalle = err?.message || 'el arranque tardó demasiado (>12s)';
  try { logBitacora?.('alerta', `BOOT RESCATADO: ${detalle}`); } catch {}
  try { addMsg('arex', `⚠ **El arranque se atoró y fue rescatado.**\nDetalle: ${detalle}\n\nLa interfaz quedó liberada. Si algo se ve incompleto: ⚙ → 🔄 FORZAR ACTUALIZACIÓN COMPLETA.`); } catch {}
}

// Promesas rechazadas sin catch (async): el listener de 'error' no las ve —
// eran exactamente los fallos invisibles del "se queda cargando"
window.addEventListener('unhandledrejection', e => {
  try {
    const msg = e.reason?.message || String(e.reason || 'promesa rechazada');
    if (typeof logBitacora === 'function') logBitacora('alerta', `ASYNC: ${msg.slice(0, 120)}`);
    let t = document.getElementById('arex-err-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'arex-err-toast';
      t.style.cssText = 'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(40,0,0,0.92);border:1px solid #ff4444;color:#ffb0b0;font-family:monospace;font-size:11px;padding:8px 14px;border-radius:4px;max-width:90vw;pointer-events:none;';
      document.body.appendChild(t);
    }
    t.textContent = `⚠ ${msg}`.slice(0, 140);
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 6000);
  } catch {}
});

if (loadConfig()) {
  initFirebase();
  // 8s: verificado con el infiltrado — sin red, el boot natural se bloquea
  // y es el watchdog quien libera la interfaz; que espere menos
  const _bootWatchdog = setTimeout(_bootRescue, 8000);
  boot()
    .catch(e => _bootRescue(e))
    .finally(() => clearTimeout(_bootWatchdog));
} else {
  showSetup();
}

// Extender AREXNav.cambiarModulo para mostrar/ocultar FAB de análisis
(function() {
  const _orig = AREXNav.cambiarModulo.bind(AREXNav);
  AREXNav.cambiarModulo = function(mod) {
    _orig(mod);
    const fab = document.getElementById('fab-analizar');
    if (fab) fab.style.display = (mod !== 'chat' && mod !== 'inicio') ? 'flex' : 'none';
  };
})();

// ── BRIEFING DIARIO ───────────────────────────────────────────────────────────
async function generarBriefing() {
  const hoy = _todayStr();
  if (localStorage.getItem('arex_briefing_date') === hoy) return;

  const tareas = getTareas().filter(t => !t.done);
  const recs   = getRecordatorios().filter(r => !r.disparado);
  const today  = new Date();
  const mesKey = hoy.slice(0, 7);

  const tareasUrgentes = tareas.filter(t => t.prioridad === 'alta').slice(0, 3);
  const tareasHoy      = tareas.filter(t => t.fecha === hoy).slice(0, 3);

  // Metas activas con progreso
  const metas = _safeJSON(localStorage.getItem('arex_metas'), []).filter(m => !m.completada);
  const metasStr = metas.slice(0, 3).map(m => {
    const pct = m.tipo === 'porcentaje'
      ? `${m.valorActual || 0}%`
      : (m.objetivo ? `${m.valorActual || 0}/${m.objetivo}` : '—');
    return `${m.titulo || m.nombre}: ${pct}`;
  }).join(', ') || 'ninguna';

  // Gastos del mes
  let gastosMesStr = '';
  try {
    const gd = _safeJSON(localStorage.getItem('arex_gastos_pers'), {});
    const gArr = (gd.gastos || []).filter(g => g.fecha?.startsWith(mesKey));
    const total = gArr.reduce((a, g) => a + (g.monto || 0), 0);
    if (total > 0) gastosMesStr = `$${total.toLocaleString('es-MX', {maximumFractionDigits:0})} MXN`;
  } catch {}

  // Hábitos pendientes hoy (si módulo cargado)
  let habitosStr = '';
  try {
    const habs = _safeJSON(localStorage.getItem('arex_habitos'), []);
    const pendientes = habs.filter(h => !h.completados?.[hoy]).map(h => h.nombre);
    if (pendientes.length) habitosStr = pendientes.slice(0, 3).join(', ');
  } catch {}

  // Agenda del día (si módulo cargado)
  let agendaStr = '';
  try {
    if (typeof window._agGetEvents === 'function') {
      const evHoy = window._agGetEvents()[hoy] || [];
      if (evHoy.length) agendaStr = evHoy.slice(0, 3).map(e => e.title || e.titulo).join(', ');
    }
  } catch {}

  const contexto = [
    `Fecha: ${today.toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`,
    `Tareas urgentes: ${tareasUrgentes.map(t => t.text).join(', ') || 'ninguna'}`,
    `Tareas para hoy: ${tareasHoy.map(t => t.text).join(', ') || 'ninguna'}`,
    `Total pendiente: ${tareas.length} tarea${tareas.length !== 1 ? 's' : ''}`,
    `Recordatorios activos: ${recs.slice(0,3).map(r => r.msg).join(', ') || 'ninguno'}`,
    `Metas en progreso: ${metasStr}`,
    gastosMesStr ? `Gastos del mes: ${gastosMesStr}` : '',
    habitosStr   ? `Hábitos pendientes hoy: ${habitosStr}` : '',
    agendaStr    ? `Agenda de hoy: ${agendaStr}` : '',
  ].filter(Boolean).join('\n');

  try {
    const briefing = await callBrain('rapido', [
      { role: 'system', content: 'Eres AREX, asistente personal de Alexiz. Genera un briefing matutino breve (4-6 líneas) en español, directo y motivador. Puedes usar 2-3 bullet points cortos para las prioridades del día. Menciona metas, hábitos y agenda si hay datos.' },
      { role: 'user', content: `Datos de hoy:\n${contexto}` }
    ], { maxTokens: 200 });
    if (!briefing) return;
    localStorage.setItem('arex_briefing_date', hoy);
    addMsg('arex', `**Briefing — ${today.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'short' })}**\n\n${briefing}`);
  } catch(e) { console.warn('Briefing:', e); }
}
window.generarBriefing = generarBriefing;

/* ── Análisis IA de gastos ───────────────────────────── */
async function analizarGastos() {
  if (_isOffline) { addMsg('arex', _offlineFallback('gastos')); return; }
  addMsg('user', '/analizar gastos');
  setOrb('thinking', 'Analizando gastos...');
  showThinking();
  try {
    const hoy = _todayStr();
    const meses = [hoy.slice(0,7)];
    for (let i = 1; i <= 2; i++) {
      const d = new Date(hoy + 'T00:00:00'); d.setMonth(d.getMonth() - i);
      meses.push(window.mes(d));   // v216: era UTC
    }
    const gd = typeof getGastosData === 'function' ? getGastosData() : _safeJSON(localStorage.getItem('arex_gastos_pers'), {});
    const todos = gd.gastos || [];
    const presupuesto = gd.presupuesto || {};
    const resumen = meses.map(m => {
      const arr   = todos.filter(g => g.fecha?.startsWith(m));
      const total = arr.reduce((a,g) => a+(g.monto||0), 0);
      const porCat = {};
      arr.forEach(g => { porCat[g.categoria||'Otros'] = (porCat[g.categoria||'Otros']||0) + g.monto; });
      return `${m}: $${total.toLocaleString('es-MX',{maximumFractionDigits:0})} — ${Object.entries(porCat).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([c,v])=>`${c}:$${v.toLocaleString('es-MX',{maximumFractionDigits:0})}`).join(', ')}`;
    }).join('\n');
    const presupStr = Object.entries(presupuesto).map(([c,v])=>`${c}:$${v}`).join(', ') || 'no definido';
    const reply = await callBrain('rapido', [
      {role:'system', content:'Eres AREX, analista financiero personal de Alexiz. Analiza sus gastos y da recomendaciones claras y prácticas en español usando markdown simple.'},
      {role:'user', content:`Gastos por mes:\n${resumen}\n\nPresupuesto: ${presupStr}\n\nDa: tendencia principal, categoría más alta, y 3 recomendaciones concretas.`}
    ], { maxTokens: 200 });
    hideThinking();
    if (reply) addMsg('arex', reply);
  } catch(e) { hideThinking(); addMsg('arex','No se pudo analizar: '+e.message); }
  setOrb(null,'En espera de instrucciones');
}

async function analizarMetas() {
  if (_isOffline) { addMsg('arex', _offlineFallback('metas')); return; }
  addMsg('user', '/analizar metas');
  setOrb('thinking', 'Analizando metas...');
  showThinking();
  try {
    const metas = _safeJSON(localStorage.getItem('arex_metas'), []).filter(m => !m.completada);
    if (!metas.length) { hideThinking(); addMsg('arex','No tienes metas activas.'); return; }
    const resumen = metas.slice(0,8).map(m => {
      const pct = m.tipo === 'porcentaje' ? `${m.valorActual||0}%/${m.objetivo||100}%` : (m.objetivo ? `${m.valorActual||0}/${m.objetivo}` : 'cualitativa');
      const deadline = m.fechaLimite ? ` · vence ${m.fechaLimite}` : '';
      return `- ${m.titulo||m.nombre}: ${pct}${deadline}`;
    }).join('\n');
    const res = await _groqFetch('fast', {
      max_tokens:400,
      messages:[
        {role:'system', content:'Eres AREX, coach personal de Alexiz. Analiza sus metas y da orientación motivadora y práctica en español.'},
        {role:'user', content:`Metas activas:\n${resumen}\n\nEvalúa: progreso general, metas en riesgo, y 2-3 acciones concretas para esta semana.`}
      ]
    }, AREX_CONFIG.groqKey);
    hideThinking();
    if (!res.ok) { addMsg('arex','Error al analizar.'); return; }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (reply) addMsg('arex', reply);
  } catch(e) { hideThinking(); addMsg('arex','Error: '+e.message); }
  setOrb(null,'En espera de instrucciones');
}

/* ── Resumen del día (/hoy) ─────────────────────────── */
function mostrarResumenHoy() {
  addMsg('user', '/hoy');
  const hoyStr  = window.hoy();   // v216: era UTC
  const tareas  = getTareas();
  const urgentes = sortPending(tareas.filter(t => !t.done)).filter(t => {
    const u = urgenciaTarea(t);
    return u?.cls === 'urg-vencida' || u?.cls === 'urg-hoy';
  });
  const habitos  = _safeJSON(localStorage.getItem('arex_habitos'), []);
  const habsPend = habitos.filter(h => !h.completados?.[hoyStr]);
  const agEvents = typeof _agGetEvents === 'function'
    ? (_agGetEvents()[hoyStr] || []) : [];
  const recs = _safeJSON(localStorage.getItem('arex_recordatorios'), []).filter(r => !r.disparado);

  const fecha = new Date().toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
  const lines = [`**◈ RESUMEN DEL DÍA · ${fecha.toUpperCase()}**\n`];

  if (urgentes.length) {
    lines.push(`**⚠ TAREAS URGENTES (${urgentes.length})**`);
    urgentes.slice(0, 5).forEach(t => lines.push(`- ${t.text}`));
  } else {
    lines.push('✓ Sin tareas urgentes hoy');
  }

  if (habitos.length) {
    lines.push('');
    if (habsPend.length) {
      lines.push(`**◎ HÁBITOS PENDIENTES (${habsPend.length}/${habitos.length})**`);
      habsPend.slice(0, 5).forEach(h => lines.push(`- ${h.emoji || '•'} ${h.nombre}`));
    } else {
      lines.push(`✓ Todos los hábitos completados hoy (${habitos.length}/${habitos.length})`);
    }
  }

  if (agEvents.length) {
    lines.push('');
    lines.push('**◷ AGENDA HOY**');
    agEvents.forEach(ev => lines.push(`- ${ev.hora ? ev.hora + ' · ' : ''}${ev.title}`));
  }

  if (recs.length) {
    lines.push('');
    lines.push(`**⏰ RECORDATORIOS ACTIVOS (${recs.length})**`);
    recs.slice(0, 3).forEach(r => lines.push(`- ${r.msg}`));
  }

  addMsg('arex', lines.join('\n'));
}

/* ── Reporte semanal (/semana) ───────────────────────── */
async function generarReporteSemanal() {
  if (_isOffline) { addMsg('arex', _offlineFallback('semana')); return; }
  addMsg('user', '/semana');
  setOrb('thinking', 'Generando reporte semanal...');
  showThinking();
  try {
    const hoy = new Date();
    const lunes = new Date(hoy);
    lunes.setDate(hoy.getDate() - ((hoy.getDay() + 6) % 7));
    const lunesStr = window.dia(lunes);   // v216: era UTC
    const tareasHechas = getTareas().filter(t => t.done && t.doneAt && new Date(t.doneAt) >= lunes);
    const tareasPend   = getTareas().filter(t => !t.done);
    const gd = typeof getGastosData === 'function' ? getGastosData() : _safeJSON(localStorage.getItem('arex_gastos_pers'), {});
    const gastosSemanales = (gd.gastos||[]).filter(g => g.fecha >= lunesStr);
    const totalGastos = gastosSemanales.reduce((a,g)=>a+(g.monto||0),0);
    const metas = _safeJSON(localStorage.getItem('arex_metas'), []).filter(m=>!m.completada).slice(0,5);
    const metasStr = metas.map(m=>`${m.titulo||m.nombre}: ${m.valorActual||0}/${m.objetivo||'?'}`).join(', ') || 'ninguna';
    let habitosStr = '';
    try {
      const habs = _safeJSON(localStorage.getItem('arex_habitos'), []);
      const days = Array.from({length:7},(_,i)=>{const d=new Date(lunes);d.setDate(d.getDate()+i);return window.dia(d);});   // v216: era UTC
      habitosStr = habs.map(h=>`${h.nombre}: ${days.filter(d=>h.completados?.[d]).length}/7`).join(', ');
    } catch {}
    const contexto = [
      `Semana del ${lunes.toLocaleDateString('es-MX',{day:'numeric',month:'short'})} al ${hoy.toLocaleDateString('es-MX',{day:'numeric',month:'short'})}`,
      `Tareas completadas: ${tareasHechas.length}`,
      `Tareas pendientes: ${tareasPend.length}`,
      `Gastos de la semana: $${totalGastos.toLocaleString('es-MX',{maximumFractionDigits:0})} MXN`,
      `Metas: ${metasStr}`,
      habitosStr ? `Hábitos: ${habitosStr}` : '',
    ].filter(Boolean).join('\n');
    const res = await _groqFetch('fast', {
      max_tokens:480,
      messages:[
        {role:'system', content:'Eres AREX, asistente personal de Alexiz. Genera un reporte semanal motivador en español: evaluación del progreso, logros destacados, y 2-3 objetivos para la próxima semana. Usa markdown.'},
        {role:'user', content:`Datos de la semana:\n${contexto}`}
      ]
    }, AREX_CONFIG.groqKey);
    hideThinking();
    if (!res.ok) { addMsg('arex','Error generando reporte.'); return; }
    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (reply) {
      const week = `${lunes.toLocaleDateString('es-MX',{day:'numeric',month:'short'})}–${hoy.toLocaleDateString('es-MX',{day:'numeric',month:'short'})}`;
      addMsg('arex', `**Reporte semanal · ${week}**\n\n${reply}`);
    }
  } catch(e) { hideThinking(); addMsg('arex','Error: '+e.message); }
  setOrb(null,'En espera de instrucciones');
}

// ── SALUDOS PROACTIVOS POR MÓDULO ─────────────────────────────────────────────
function _proactiveModuleGreeting(mod) {
  if (!voiceOn) return;
  try {
    const now = new Date();
    const greetings = {
      tareas() {
        const ts = getTareas ? getTareas() : [];
        const venc = ts.filter(t => !t.done && t.fecha && new Date(t.fecha) < now).length;
        const pend = ts.filter(t => !t.done).length;
        if (venc > 0) return `Tienes ${venc} tarea${venc > 1 ? 's' : ''} vencida${venc > 1 ? 's' : ''}. ${pend} pendientes en total.`;
        if (pend > 0) return `${pend} tarea${pend > 1 ? 's' : ''} pendiente${pend > 1 ? 's' : ''}.`;
        return 'Sin tareas pendientes. Bien hecho.';
      },
      metas() {
        const ms = typeof getMetas === 'function' ? getMetas() : [];
        const act = ms.filter(m => !m.completada);
        if (!act.length) return null;
        // Las metas guardan valorActual/valorObjetivo, no "progreso"
        const pct = m => m.valorObjetivo > 0 ? ((m.valorActual || 0) / m.valorObjetivo) * 100 : 0;
        const top = act.reduce((a, b) => pct(b) > pct(a) ? b : a, act[0]);
        return `Meta principal: ${top.titulo}. Al ${Math.round(pct(top))} por ciento.`;
      },
      finanzas() {
        const raw = JSON.parse(localStorage.getItem('arex_gastos_pers') || '{}');
        const gastosList = Array.isArray(raw) ? raw : (raw.gastos || []);
        const gMes = gastosList.filter(g => {
          const d = new Date(g.fecha);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }).reduce((s, g) => s + (g.monto || 0), 0);
        return gMes > 0 ? `Gasto este mes: ${gMes.toLocaleString('es-MX')} pesos.` : null;
      },
      negocio() {
        try {
          const d = typeof getNegocioData === 'function' ? getNegocioData() : null;
          if (!d) return null;
          const stockKg = Number(d.inventario?.stockKg) || 0;
          const stockMin = d.config?.stockMinimo ?? 5;
          if (stockKg < stockMin) return `Alerta: stock bajo (${stockKg.toFixed(1)} kg, mínimo ${stockMin} kg).`;
        } catch (_) {}
        return null;
      },
      proyectos() {
        const ps = JSON.parse(localStorage.getItem('arex_proyectos') || '[]');
        const act = ps.filter(p => p.estado !== 'completado');
        return act.length ? `${act.length} proyecto${act.length > 1 ? 's' : ''} activo${act.length > 1 ? 's' : ''}.` : null;
      },
      chat() { return null; },
    };
    const fn = greetings[mod];
    if (!fn) return;
    const msg = fn();
    if (msg) arexSpeak(msg);
  } catch (_) {}
}
window._arexModuleGreeting = _proactiveModuleGreeting;

/* ── … → extraído a widgets.js (v219) ── */
// ── BÚSQUEDA GLOBAL ───────────────────────────────────────────────────────────
function buscarGlobal(q) {
  if (!q.trim()) return { tareas:[], notas:[], hechos:[], recordatorios:[], metas:[], gastos:[], negocio:[] };
  const ql = q.toLowerCase();
  const match = s => s?.toLowerCase().includes(ql);

  let metas = [], gastos = [], negocio = [];
  try { if (typeof getMetas === 'function') metas = getMetas().filter(m => match(m.titulo) || match(m.descripcion)); } catch(e) {}
  try {
    if (typeof getGastosData === 'function') {
      const gp = getGastosData();
      gastos = (gp.gastos || []).filter(t => match(t.concepto) || match(t.categoria));
    }
  } catch(e) {}
  try {
    if (typeof getNegocioData === 'function') {
      const neg    = getNegocioData();
      const sucMap = Object.fromEntries((neg.sucursales || []).map(s => [s.id, s.nombre]));
      const ventas = (neg.ventas || []).filter(v => match(sucMap[v.sucursalId] || '') || match(String(v.total || '')));
      const gNeg   = (neg.gastos || []).filter(g => match(g.concepto) || match(g.categoria));
      negocio = [...ventas.map(v => ({ tipo:'venta',  texto: sucMap[v.sucursalId] || 'Venta', monto: v.total })),
                 ...gNeg.map(g  => ({ tipo:'gasto',   texto: g.concepto || 'Gasto', monto: g.monto }))];
    }
  } catch(e) {}

  return {
    tareas:        getTareas().filter(t => !t.done && (match(t.text) || match(t.fecha))),
    notas:         getNotas().filter(n => match(n.titulo) || match(n.cuerpo)),
    hechos:        getHechos().filter(h => match(h.texto)),
    recordatorios: getRecordatorios().filter(r => !r.disparado && match(r.msg)),
    metas, gastos, negocio
  };
}

function renderBusquedaGlobal(q) {
  const el = document.getElementById('busqueda-results');
  if (!el) return;
  if (!q.trim()) { el.innerHTML = '<div class="bg-empty">Escribe para buscar en tareas, notas, memoria, recordatorios, metas, gastos y negocio</div>'; return; }
  const { tareas, notas, hechos, recordatorios, metas, gastos, negocio } = buscarGlobal(q);
  const total = tareas.length + notas.length + hechos.length + recordatorios.length + metas.length + gastos.length + negocio.length;
  if (!total) { el.innerHTML = `<div class="bg-empty">Sin resultados para "${q}"</div>`; return; }

  const safeRe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hl = t => t.replace(new RegExp(safeRe, 'gi'), m => `<mark class="bg-hl">${m}</mark>`);
  const safe = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  const fmtP = n => `$${Number(n).toLocaleString('es-MX', {minimumFractionDigits:0,maximumFractionDigits:0})}`;

  let html = '';
  if (tareas.length)        html += `<div class="bg-group"><div class="bg-gtitle">TAREAS (${tareas.length})</div>${tareas.slice(0,6).map(t => `<div class="bg-item" data-mod="tareas"><span class="bg-ico">✓</span><span>${hl(safe(t.text))}</span></div>`).join('')}</div>`;
  if (notas.length)         html += `<div class="bg-group"><div class="bg-gtitle">NOTAS (${notas.length})</div>${notas.slice(0,5).map(n => `<div class="bg-item" data-mod="notas"><span class="bg-ico">📝</span><span>${hl(safe(n.titulo || n.cuerpo.slice(0,60)))}</span></div>`).join('')}</div>`;
  if (hechos.length)        html += `<div class="bg-group"><div class="bg-gtitle">MEMORIA (${hechos.length})</div>${hechos.slice(0,5).map(h => `<div class="bg-item" data-mod="chat"><span class="bg-ico">🧠</span><span>${hl(safe(h.texto))}</span></div>`).join('')}</div>`;
  if (recordatorios.length) html += `<div class="bg-group"><div class="bg-gtitle">RECORDATORIOS (${recordatorios.length})</div>${recordatorios.slice(0,3).map(r => `<div class="bg-item" data-mod="inicio"><span class="bg-ico">⏰</span><span>${hl(safe(r.msg))}</span></div>`).join('')}</div>`;
  if (metas.length)         html += `<div class="bg-group"><div class="bg-gtitle">METAS (${metas.length})</div>${metas.slice(0,4).map(m => `<div class="bg-item" data-mod="metas"><span class="bg-ico">🎯</span><span>${hl(safe(m.titulo))}</span></div>`).join('')}</div>`;
  if (gastos.length)        html += `<div class="bg-group"><div class="bg-gtitle">GASTOS (${gastos.length})</div>${gastos.slice(0,4).map(t => `<div class="bg-item" data-mod="gastos"><span class="bg-ico">💸</span><span>${hl(safe(t.concepto))} <small>${fmtP(t.monto)}</small></span></div>`).join('')}</div>`;
  if (negocio.length)       html += `<div class="bg-group"><div class="bg-gtitle">NEGOCIO (${negocio.length})</div>${negocio.slice(0,4).map(n => `<div class="bg-item" data-mod="negocio"><span class="bg-ico">${n.tipo==='venta'?'💰':'🏷'}</span><span>${hl(safe(n.texto))} <small>${fmtP(n.monto)}</small></span></div>`).join('')}</div>`;

  el.innerHTML = html;
  el.querySelectorAll('.bg-item[data-mod]').forEach(item => {
    item.addEventListener('click', () => { cerrarBusqueda(); AREXNav.cambiarModulo(item.dataset.mod); });
  });
}

function abrirBusqueda() {
  // Usar el nuevo overlay de búsqueda global si está disponible
  if (typeof openSearch === 'function') { openSearch(); return; }
  // Fallback al overlay original
  const overlay = document.getElementById('busqueda-overlay');
  const input   = document.getElementById('busqueda-input');
  if (!overlay || !input) return;
  overlay.classList.remove('hidden');
  input.value = '';
  renderBusquedaGlobal('');
  setTimeout(() => input.focus(), 50);
}
function cerrarBusqueda() {
  if (typeof closeSearch === 'function') closeSearch();
  document.getElementById('busqueda-overlay')?.classList.add('hidden');
}
window.abrirBusqueda  = abrirBusqueda;
window.cerrarBusqueda = cerrarBusqueda;

/* ── … → extraído a widgets.js (v219) ── */
/* ── v225 · Perfil de rendimiento ────────────────────────────────────────
   EL FALLO: la versión anterior decidía así si tu equipo era flojo:

       const cores = navigator.hardwareConcurrency || 4;
       const isLow = cores <= 4 || mem <= 2;

   El valor por defecto cuando el navegador NO expone el dato es 4… y el
   umbral es "4 o menos". O sea que **cualquier navegador que no publique
   cuántos núcleos tiene quedaba clasificado como equipo flojo** y se
   quedaba sin blur. Un iPhone 16 Pro Max podía estar entrando por esa
   puerta sin que nadie lo notara: el sistema de cristal llevaba tiempo
   apagado sin motivo.

   Además deviceMemory solo existe en Chrome, así que en Safari `mem`
   siempre valía 4 y esa mitad de la condición nunca decidía nada.

   AHORA: desconocido ≠ flojo. Solo se apaga el cristal cuando el navegador
   AFIRMA que el equipo es limitado, o cuando el propio sistema pide menos
   efectos. Y se puede forzar a mano desde la configuración, porque quien
   mejor sabe si va fluido eres tú mirando la pantalla. */
(function aplicarPerfilRendimiento() {
  const root = document.documentElement.style;
  const forzado = localStorage.getItem('arex_efectos');   // 'on' | 'off' | null

  /* v231 · EL CRISTAL VUELVE A NACER APAGADO, Y AHORA ES A PROPÓSITO.

     v225 lo encendió por primera vez en el iPhone —hasta entonces la
     detección de "equipo flojo" lo apagaba en cualquier navegador que no
     publicara sus núcleos, que es el caso de Safari—. Desde entonces AREX no
     arranca en su teléfono: pantalla negra. Y sigue sin arrancar con el
     código de v227, así que el sospechoso no es nada de v228/v229.

     Hay 63 declaraciones de backdrop-filter repartidas por el CSS, muchas
     apiladas unas sobre otras. En WebKit eso es un modo de fallo conocido:
     el compositor se rinde y pinta negro. No lo puedo comprobar aquí —este
     entorno solo tiene Chromium y el proxy no deja bajar WebKit—, así que no
     lo voy a afirmar: lo que sí puedo hacer es dejar de encender por defecto
     algo que no puedo probar donde de verdad corre.

     Encendido: arexEfectos('on'). Se guarda y sobrevive a las recargas. */
  if (forzado === 'on') {
    window.AREX_EFECTOS = { cristal: 'encendido a mano' };
    return;   // los valores del CSS (3/6/10px) se quedan
  }
  root.setProperty('--blur-sm', '0px');
  root.setProperty('--blur-md', '0px');
  root.setProperty('--blur-lg', '0px');
  window.AREX_EFECTOS = {
    cristal: 'apagado (por defecto desde v231)',
    nucleos: navigator.hardwareConcurrency ?? 'no lo dice',
    comoEncenderlo: "arexEfectos('on')",
  };
})();

/* Encender o apagar el cristal a mano. Lo expone /config y el módulo
   Control; la decisión se guarda y sobrevive a recargas. */
window.arexEfectos = function (estado) {
  if (estado === 'auto') localStorage.removeItem('arex_efectos');
  else localStorage.setItem('arex_efectos', estado === 'on' ? 'on' : 'off');
  location.reload();
};

/* v215 · CAMPO DE ESTRELLAS — RETIRADO
   Era un canvas a pantalla completa (390×844 = 0,33 Mpx) repintando ~55
   estrellas en un bucle de requestAnimationFrame a 60 fps, para siempre,
   en todos los módulos. Medido: junto con las partículas de holo.js hacían
   120 rAF/s constantes. Es la mayor fuente de consumo de batería del
   sistema y aporta un punteado que apenas se distingue del fondo negro.
   Se retira. Está en el historial de git si algún día se quiere de vuelta,
   pero entonces debería arrancar solo bajo un ajuste explícito. */

/* ── Boot animation: letras una por una ─────────────── */
(function bootLetterAnim() {
  const bar  = document.getElementById('boot-bar');
  const logo = document.querySelector('.boot-logo');
  if (!logo) return;
  const lines = ['AREX · MARK IV · INICIANDO...', 'CARGANDO MÓDULOS...', 'CONECTANDO IA · GROQ · GEMINI...', 'TODOS LOS SISTEMAS EN LÍNEA.'];
  const linesEl = document.getElementById('boot-lines');
  if (!linesEl) return;

  let lineIdx = 0, charIdx = 0, lineEl = null;
  const interval = setInterval(() => {
    if (lineIdx >= lines.length) { clearInterval(interval); return; }
    if (!lineEl || charIdx === 0) {
      lineEl = document.createElement('div');
      lineEl.style.cssText = 'font-size:9px;letter-spacing:2px;color:#22d3ee;opacity:0.7;height:14px;overflow:hidden;';
      linesEl.appendChild(lineEl);
    }
    lineEl.textContent += lines[lineIdx][charIdx] || '';
    charIdx++;
    if (charIdx >= lines[lineIdx].length) {
      charIdx = 0; lineIdx++;
    }
    if (bar) bar.style.width = `${(lineIdx / lines.length) * 100}%`;
  }, 45);
})();
