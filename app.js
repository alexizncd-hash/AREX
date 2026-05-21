/* ═══════════════════════════════════════════════════════
   AREX — app.js
   Motor: Groq (llama-3.3-70b) + Tavily + Firebase
═══════════════════════════════════════════════════════ */

import { initializeApp }    from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs,
         query, orderBy, limit, deleteDoc,
         doc, setDoc, getDoc, increment }
  from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

/* ── Carga de configuración ─────────────────────────── */
// Prioridad: config.js (local) → localStorage → pantalla de setup
function loadConfig() {
  if (window.AREX_CONFIG?.groqKey) return true; // config.js presente
  const saved = localStorage.getItem('arex_config');
  if (saved) { window.AREX_CONFIG = JSON.parse(saved); return true; }
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

    const config = {
      groqKey:   groq,
      tavilyKey: document.getElementById('cfg-tavily').value.trim() || '',
      owmKey:    document.getElementById('cfg-owm').value.trim()    || '',
      firebase:  fbKey ? { apiKey:fbKey, authDomain:fbDomain, projectId:fbProject,
                           storageBucket:fbBucket, messagingSenderId:fbSender, appId:fbApp } : null
    };
    localStorage.setItem('arex_config', JSON.stringify(config));
    window.AREX_CONFIG = config;
    document.getElementById('setup-screen').classList.add('hidden');
    document.getElementById('boot-screen').style.display = 'flex';
    initFirebase();
    boot();
  });
}

/* ── Atajos personalizados ──────────────────────────── */
const RESERVED_CMDS = ['ayuda','limpiar','examen','resumir','exportar','notas','stats','recordar','contexto','config','atajos','memoria','run','tarea','briefing','pomodoro','buscar','hechos'];

function loadAtalos() {
  const saved = localStorage.getItem('arex_atajos');
  return saved ? JSON.parse(saved) : [];
}
function saveAtalos(arr) {
  localStorage.setItem('arex_atajos', JSON.stringify(arr));
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
  const saved = localStorage.getItem('arex_context');
  return saved ? JSON.parse(saved) : {};
}
function savePersonalContext(ctx) {
  localStorage.setItem('arex_context', JSON.stringify(ctx));
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

/* ── Memoria larga ──────────────────────────────────── */
function loadMemoria() {
  const saved = localStorage.getItem('arex_memoria');
  return saved ? JSON.parse(saved) : [];
}
function saveMemoria(entries) {
  localStorage.setItem('arex_memoria', JSON.stringify(entries));
}
function buildMemoriaSection() {
  const entries  = loadMemoria();
  const lastUser = history.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const hechos   = getHechosRelevantes(lastUser, 8);
  let section = '';
  if (entries.length) section += `MEMORIA PERMANENTE (datos fijos de Alexiz):\n${entries.map((e,i) => `${i+1}. ${e.text}`).join('\n')}`;
  if (hechos.length)  section += `${section?'\n\n':''}HECHOS APRENDIDOS EN CONVERSACIONES:\n${hechos.map(h => `- [${h.fecha}] ${h.texto}`).join('\n')}`;
  return section ? `\n\n${section}` : '';
}

/* ── Memoria de hechos ──────────────────────────────── */
function getHechos() { return JSON.parse(localStorage.getItem('arex_hechos') || '[]'); }
function saveHechos(arr) { localStorage.setItem('arex_hechos', JSON.stringify(arr)); }

function addHecho(texto, fuente = 'auto') {
  if (!texto?.trim()) return;
  const arr = getHechos();
  if (arr.some(h => h.texto.toLowerCase() === texto.toLowerCase().trim())) return;
  arr.unshift({ id: String(Date.now()), texto: texto.trim(), fecha: _todayStr(), fuente });
  if (arr.length > 300) arr.splice(300);
  saveHechos(arr);
}

function deleteHecho(id) {
  saveHechos(getHechos().filter(h => h.id !== id));
}

function getHechosRelevantes(query, max = 10) {
  const all = getHechos();
  if (!query) return all.slice(0, max);
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return all.slice(0, max);
  return all
    .map(h => ({ ...h, score: words.filter(w => h.texto.toLowerCase().includes(w)).length }))
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score || b.id.localeCompare(a.id))
    .slice(0, max);
}

function renderHechosList() {
  const hechos = getHechos();
  if (!hechos.length) return addMsg('arex', 'Sin hechos almacenados aún. AREX los aprende automáticamente de las conversaciones, o dime explícitamente "recuerda que..."');
  const txt = hechos.slice(0, 30).map((h, i) => `**${i+1}.** [${h.fecha}] ${h.texto}`).join('\n');
  addMsg('arex', `📚 **HECHOS APRENDIDOS** (${hechos.length} total):\n\n${txt}\n\n_Usa \`/hechos borrar N\` para eliminar el hecho #N._`);
}
window.deleteHecho = deleteHecho;

/* ── System prompt ──────────────────────────────────── */
function buildSystemBase() {
  const now  = new Date();
  const fecha = now.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const hora  = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  return `Eres AREX, el sistema de inteligencia personal de Alexiz.
Tu nombre nace de Alexiz y Margaret — las dos personas más importantes en su vida.

CONTEXTO OPERACIONAL:
- Fecha: ${fecha}. Hora: ${hora}.
- Ubicación: Hermosillo, Sonora, México (UTC-7).

IDENTIDAD Y TONO:
- Formal, preciso y directo. Sin rodeos. Como JARVIS con Tony Stark.
- Leal y confiable. Nunca condescendiente.
- Tratas a Alexiz como alguien capaz e inteligente.
- Calidez breve en momentos personales, luego vuelves al modo operacional.
- Nunca pierdes el contexto de la conversación.

QUIÉN ES ALEXIZ:
- Desarrollador web en crecimiento (HTML, CSS, JavaScript nivel intermedio).
- Estudiante universitario — te usa para trabajos, proyectos y exámenes.
- Emprendedor con negocio propio y proyectos personales.
- Intereses: finanzas personales, desarrollo personal, hábitos, salud, relaciones.
- Positivo, busca el lado constructivo en momentos difíciles.
- Quiere crecer: personal, espiritual, físico, económico y en relaciones.
- Valora su familia y a Margaret, su novia — fundamental en su vida.
- Prefiere entender el "mínimo funcional" antes de profundizar.

MÓDULOS DEL SISTEMA (puedes referirte a ellos):
- FINANZAS: tarjetas de crédito, saldos, gastos mensuales, calculadora de deuda, recordatorios de pago.
- TAREAS: lista de pendientes con fecha límite y prioridad alta/media/baja.
- RECORDATORIOS: activos con countdown, persistentes entre sesiones (/recordar 30min, /recordar 20:00).
- SOS: módulo de emergencias — 911, GPS, SMS, WhatsApp, tarjeta médica, contactos de emergencia.
- CÓDIGO: editor con preview en vivo de HTML/CSS/JS (sandbox iframe).
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

CAPACIDAD CRÍTICA — PANEL DE CÓDIGO EN VIVO:
AREX está integrado con un panel de ejecución de código en tiempo real. Cuando Alexiz pide una visualización, juego, animación, simulación, herramienta o cualquier cosa interactiva, AREX SIEMPRE genera el código HTML/CSS/JS completo. El sistema muestra automáticamente un botón "▶ EJECUTAR EN AREX" que abre el resultado directamente en la app.
NUNCA digas que no puedes renderizar, ejecutar o mostrar cosas. NUNCA redirijas a links externos para algo que se puede construir con código. SIEMPRE genera el código y el usuario lo ejecuta con un clic.
Reglas de código para el panel:
- Usa Canvas 2D o CSS puro — sin librerías externas (no Chart.js, no Three.js, no D3)
- Código siempre autocontenido: todo en un solo bloque HTML (estilos y scripts inline)
- Fondo: #020c14 (negro azulado), colores principales: #00d4ff (cian), #00ffaa (verde), #ff9900 (naranja)
- Si piden sistema solar → Canvas con planetas orbitando, click para info
- Si piden juego → Canvas con game loop, controles de teclado/mouse
- Si piden gráfica → Canvas dibujado a mano con los datos
- Si piden herramienta → HTML/CSS/JS funcional completo
- CRÍTICO: antes de cerrar el bloque de código, verifica mentalmente que no haya comas dobles, paréntesis sin cerrar ni variables sin declarar. ctx.arc() requiere exactamente 5 argumentos: (x, y, radius, startAngle, endAngle).
- CANVAS RESPONSIVO: SIEMPRE define el tamaño así: const W = Math.min(600, window.innerWidth); const H = W; canvas.width = W; canvas.height = H; — nunca uses width/height fijos mayores al viewport.
- CANVAS CLICKS: SIEMPRE usa getBoundingClientRect() para coordenadas: const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) * (canvas.width / r.width); const y = (e.clientY - r.top) * (canvas.height / r.height);
- ANIMACIÓN: usa requestAnimationFrame, nunca setInterval para animaciones.
- TOOLTIP: para info al hacer click/hover usa un div HTML flotante, nunca alert().
- ÓRBITAS: dibuja los anillos de órbita antes de los planetas (ctx.strokeStyle con opacity baja).
- COLORES: diferencia visualmente cada elemento — no uses el mismo color para todo.

PATRONES DE REFERENCIA — copia estos exactos en tu código:

// ── Canvas responsivo (siempre al inicio):
const W = Math.min(600, window.innerWidth - 16);
const H = W;
canvas.width = W; canvas.height = H;

// ── requestAnimationFrame (nunca setInterval para animar):
function loop() { draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// ── Click con coords correctas (nunca clientX - offsetLeft):
canvas.addEventListener('click', e => {
  const r = canvas.getBoundingClientRect();
  const x = (e.clientX - r.left) * (W / r.width);
  const y = (e.clientY - r.top)  * (H / r.height);
  // usar x, y para hit-testing
});

// ── Tooltip HTML (nunca alert):
const tip = document.createElement('div');
tip.style.cssText = 'position:fixed;background:rgba(0,14,26,0.95);border:1px solid #00d4ff;color:#00d4ff;padding:6px 12px;border-radius:4px;font:11px monospace;pointer-events:none;display:none;z-index:99';
document.body.appendChild(tip);
function showTip(text, ex, ey) { tip.textContent = text; tip.style.left = ex+8+'px'; tip.style.top = ey+8+'px'; tip.style.display='block'; }
function hideTip() { tip.style.display='none'; }

// ── Órbita dibujada:
ctx.save(); ctx.strokeStyle='rgba(0,212,255,0.15)'; ctx.lineWidth=1;
ctx.beginPath(); ctx.arc(cx, cy, orbit, 0, Math.PI*2); ctx.stroke(); ctx.restore();

// ── Paleta de colores diferenciada para múltiples elementos:
const COLORS = ['#e8c47a','#c2955c','#4fa3e0','#c1440e','#c88b3a','#e4d191','#7de8e8','#4060ff'];

REGLAS:
- Responde SIEMPRE en español.
- 3-5 líneas por defecto. Expándete si Alexiz pide más detalle.
- Código: describe brevemente qué hace (1 línea), luego el bloque de código completo.
- Señala errores o mejores enfoques directamente, sin rodeos.
- Si hay riesgos o errores en el planteamiento de Alexiz, díselo primero.
- Cuando tengas resultados de búsqueda web, úsalos e indica las fuentes con claridad.
- Para temas de finanzas personales, considera el contexto de México (tasas, productos, normativa local).

FRASES CARACTERÍSTICAS (úsalas cuando sea natural):
"Sistemas en línea." | "Procesando, Alexiz." | "Entendido."
"Aquí el análisis." | "Datos disponibles." | "Operación completada."

SISTEMA DE ACCIONES — LEE ESTO CON ATENCIÓN:
Puedes ejecutar acciones reales dentro de AREX usando etiquetas al FINAL de tu respuesta.
Úsalas cuando el usuario pida crear algo, o cuando detectes que debes guardar información.

Crear tarea:       <arex:accion tipo="addTarea" texto="descripción" fecha="YYYY-MM-DD" prioridad="alta|media|baja"/>
Crear nota:        <arex:accion tipo="addNota" titulo="título" cuerpo="contenido completo"/>
Crear hábito:      <arex:accion tipo="addHabito" nombre="nombre" emoji="🎯"/>
Recordatorio:      <arex:accion tipo="recordar" msg="mensaje" mins="30"/>
Guardar hecho:     <arex:accion tipo="hecho" texto="dato importante sobre Alexiz"/>
Abrir módulo:      <arex:accion tipo="modulo" nombre="tareas|notas|finanzas|habitos|inicio"/>

REGLAS DE ACCIONES:
- Usa SOLO si hay intención clara del usuario de crear algo, o si aprendes un hecho nuevo relevante.
- Para "hecho": úsalo cuando aprendas metas, decisiones, datos personales, contexto importante de Alexiz.
- Las etiquetas van AL FINAL del texto, nunca en medio de la respuesta.
- En tu texto NO menciones las etiquetas — solo confirma brevemente lo que hiciste ("Tarea creada.", "Guardado.").
- Puedes incluir múltiples acciones en una respuesta.`.trim();
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
function initFirebase() {
  if (fbInitialized || !AREX_CONFIG.firebase?.apiKey) return;
  try {
    const fbApp = initializeApp(AREX_CONFIG.firebase);
    db = getFirestore(fbApp);
    fbInitialized = true;
  } catch(e) { console.warn('Firebase init:', e); }
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
let isSpeaking = false;
let isBusy     = false;

const _msgRaw = new WeakMap(); // wrap element → raw markdown text

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
  return JSON.parse(localStorage.getItem('arex_sessions') || '[]');
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
}

function updateDockSessionName() {
  const el = document.getElementById('dock-session-name');
  if (!el) return;
  const sid = getCurrentSid();
  const s = getSessions().find(s => s.id === sid);
  el.textContent = s ? s.name.slice(0, 12) : '—';
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

/* ── Módulo Tareas ──────────────────────────────────── */
function getTareas() { return JSON.parse(localStorage.getItem('arex_tareas') || '[]'); }
function saveTareasData(arr) { localStorage.setItem('arex_tareas', JSON.stringify(arr)); }

function urgenciaTarea(t) {
  if (!t.fecha) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = new Date(t.fecha + 'T00:00:00');
  const dias = Math.round((vence - hoy) / 86400000);
  if (dias < 0)  return { cls: 'urg-vencida',  icon: '🔴', txt: `Venció hace ${-dias}d` };
  if (dias === 0) return { cls: 'urg-hoy',      icon: '🔴', txt: 'Vence HOY' };
  if (dias <= 2)  return { cls: 'urg-pronto',   icon: '🟠', txt: `${dias}d` };
  if (dias <= 7)  return { cls: 'urg-semana',   icon: '🟡', txt: `${dias}d` };
  const d = new Date(t.fecha + 'T00:00:00');
  return { cls: 'urg-normal', icon: '📅', txt: d.toLocaleDateString('es-MX', { day:'numeric', month:'short' }) };
}

function sortPending(arr) {
  const prioVal = { alta: 0, media: 1, baja: 2 };
  return [...arr].sort((a, b) => {
    const ua = urgenciaTarea(a), ub = urgenciaTarea(b);
    const urgOrder = { 'urg-vencida': 0, 'urg-hoy': 1, 'urg-pronto': 2, 'urg-semana': 3, 'urg-normal': 4, null: 5 };
    const oa = urgOrder[ua?.cls ?? null] ?? 5;
    const ob = urgOrder[ub?.cls ?? null] ?? 5;
    if (oa !== ob) return oa - ob;
    if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
    return (prioVal[a.prioridad] ?? 1) - (prioVal[b.prioridad] ?? 1);
  });
}

function addTarea(text, fecha = '', prioridad = 'media') {
  if (!text.trim()) return;
  const arr = getTareas();
  arr.unshift({ id: String(Date.now()), text: text.trim(), done: false, created: Date.now(), fecha, prioridad });
  saveTareasData(arr);
  renderTareas();
}
function toggleTarea(id) {
  saveTareasData(getTareas().map(t => t.id === id ? { ...t, done: !t.done } : t));
  renderTareas();
}
function deleteTarea(id) {
  saveTareasData(getTareas().filter(t => t.id !== id));
  renderTareas();
}
function updateTarea(id, changes) {
  saveTareasData(getTareas().map(t => t.id === id ? { ...t, ...changes } : t));
  renderTareas();
}
function renderTareas() {
  const all     = getTareas();
  const pending = sortPending(all.filter(t => !t.done));
  const done    = all.filter(t =>  t.done);

  const makeItem = t => {
    const urg  = urgenciaTarea(t);
    const prio = t.prioridad || 'media';
    const div  = document.createElement('div');
    div.className = `tarea-item${t.done ? ' done' : ''}${urg ? ' ' + urg.cls : ''}`;
    div.innerHTML = `
      <button class="tarea-toggle" data-id="${t.id}">${t.done ? '✓' : ''}</button>
      <div class="tarea-content">
        <span class="tarea-text">${t.text.replace(/</g,'&lt;')}</span>
        <div class="tarea-meta">
          ${!t.done ? `<span class="tarea-prio-badge prio-${prio}">${prio.toUpperCase()}</span>` : ''}
          ${urg && !t.done ? `<span class="tarea-urg-badge ${urg.cls}">${urg.icon} ${urg.txt}</span>` : ''}
          ${t.fecha && t.done ? `<span class="tarea-fecha-done">📅 ${new Date(t.fecha+'T00:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</span>` : ''}
        </div>
      </div>
      <div class="tarea-actions">
        ${!t.done ? '<button class="tarea-edit" title="Editar">✎</button>' : ''}
        <button class="tarea-del" title="Eliminar">✕</button>
      </div>`;

    div.querySelector('.tarea-toggle').addEventListener('click', () => toggleTarea(t.id));

    div.querySelector('.tarea-edit')?.addEventListener('click', () => {
      let _ep = t.prioridad || 'media';
      div.innerHTML = `
        <div class="tarea-edit-form">
          <input class="tarea-edit-text" type="text" value="${t.text.replace(/"/g,'&quot;')}" placeholder="Descripción..."/>
          <div class="tarea-edit-row">
            <input class="tarea-edit-fecha" type="date" value="${t.fecha || ''}"/>
            <div class="tarea-edit-prio-btns">
              <button class="tep${t.prioridad==='alta'?' active':''}" data-p="alta">ALTA</button>
              <button class="tep${(!t.prioridad||t.prioridad==='media')?' active':''}" data-p="media">MEDIA</button>
              <button class="tep${t.prioridad==='baja'?' active':''}" data-p="baja">BAJA</button>
            </div>
          </div>
          <div class="tarea-edit-btns">
            <button class="tarea-edit-save">GUARDAR</button>
            <button class="tarea-edit-cancel">CANCELAR</button>
          </div>
        </div>`;
      div.querySelectorAll('.tep').forEach(b => b.addEventListener('click', () => {
        _ep = b.dataset.p;
        div.querySelectorAll('.tep').forEach(x => x.classList.toggle('active', x === b));
      }));
      div.querySelector('.tarea-edit-save').addEventListener('click', () => {
        const text = div.querySelector('.tarea-edit-text').value.trim();
        if (!text) return;
        updateTarea(t.id, { text, fecha: div.querySelector('.tarea-edit-fecha').value, prioridad: _ep });
      });
      div.querySelector('.tarea-edit-cancel').addEventListener('click', () => renderTareas());
      div.querySelector('.tarea-edit-text').select();
    });

    let _tap = false, _tapTimer;
    div.querySelector('.tarea-del').addEventListener('click', function() {
      if (_tap) {
        clearTimeout(_tapTimer); deleteTarea(t.id);
      } else {
        _tap = true; this.textContent = '?'; this.classList.add('confirming');
        _tapTimer = setTimeout(() => {
          _tap = false; this.textContent = '✕'; this.classList.remove('confirming');
        }, 2000);
      }
    });

    return div;
  };

  const elPending = document.getElementById('tareas-list-pending');
  const elDone    = document.getElementById('tareas-list-done');
  if (!elPending) return;

  elPending.innerHTML = '';
  elDone.innerHTML    = '';
  pending.forEach(t => elPending.appendChild(makeItem(t)));
  done.forEach(t    => elDone.appendChild(makeItem(t)));

  if (!pending.length) elPending.innerHTML = '<div class="tarea-empty">Sin tareas pendientes</div>';
  if (!done.length)    elDone.innerHTML    = '<div class="tarea-empty">—</div>';

  const urgentes = pending.filter(t => { const u = urgenciaTarea(t); return u?.cls === 'urg-vencida' || u?.cls === 'urg-hoy'; }).length;
  const count    = pending.length;
  const countEl  = document.getElementById('tareas-count');
  if (countEl) {
    countEl.textContent = urgentes
      ? `${count} pendiente${count !== 1 ? 's' : ''} · ${urgentes} urgente${urgentes !== 1 ? 's' : ''}`
      : `${count} pendiente${count !== 1 ? 's' : ''}`;
    countEl.classList.toggle('has-urgentes', urgentes > 0);
  }

  const badge = document.getElementById('dock-tareas-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    badge.classList.toggle('urgente', urgentes > 0);
  }
  scheduleTaskNotifications();
}

// ── Módulo Notas ────────────────────────────────────────
function getNotas() { return JSON.parse(localStorage.getItem('arex_notas') || '[]'); }
function saveNotas(arr) { localStorage.setItem('arex_notas', JSON.stringify(arr)); }

function addNota() {
  const arr = getNotas();
  const id  = String(Date.now());
  arr.unshift({ id, titulo: '', cuerpo: '', pinned: false, color: '', createdAt: Date.now(), updatedAt: Date.now() });
  saveNotas(arr);
  renderNotas();
  setTimeout(() => document.querySelector('#notas-list .nota-titulo')?.focus(), 60);
}

function updateNota(id, changes) {
  saveNotas(getNotas().map(n => n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n));
}

function deleteNota(id) {
  saveNotas(getNotas().filter(n => n.id !== id));
  renderNotas();
  renderDashboard();
}

function renderNotas() {
  const el = document.getElementById('notas-list');
  if (!el) return;
  const q = (document.getElementById('notas-search')?.value || '').toLowerCase().trim();
  let notas = getNotas();
  if (q) notas = notas.filter(n => n.titulo.toLowerCase().includes(q) || n.cuerpo.toLowerCase().includes(q));
  notas.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

  if (!notas.length) {
    const safeQ = q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    el.innerHTML = `<div class="notas-empty">${q ? `Sin resultados para "${safeQ}"` : 'Sin notas — toca + NUEVA para crear una'}</div>`;
    return;
  }

  el.innerHTML = '';
  notas.forEach(n => {
    const card = document.createElement('div');
    card.className = 'nota-card' + (n.pinned ? ' pinned' : '') + (n.color ? ' nc-' + n.color : '');
    card.dataset.id = n.id;
    card.innerHTML = `
      <div class="nota-card-head">
        <input class="nota-titulo" value="${n.titulo.replace(/"/g,'&quot;')}" placeholder="Título..."/>
        <div class="nota-btn-row">
          <button class="nota-pin-btn${n.pinned ? ' active' : ''}" title="${n.pinned ? 'Desanclar' : 'Anclar'}">📌</button>
          <button class="nota-del-btn">✕</button>
        </div>
      </div>
      <textarea class="nota-cuerpo" placeholder="Escribe aquí...">${n.cuerpo.replace(/</g,'&lt;')}</textarea>
      <div class="nota-footer">
        <div class="nota-colors">
          ${['','amber','emerald','rose'].map(c =>
            `<span class="ncolor${n.color===c?' active':''}" data-c="${c}" title="${c||'default'}"></span>`
          ).join('')}
        </div>
        <span class="nota-wc">${n.cuerpo.trim() ? n.cuerpo.trim().split(/\s+/).length + ' pal' : ''}</span>
        <span class="nota-ts">${new Date(n.updatedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</span>
      </div>`;

    const ti = card.querySelector('.nota-titulo');
    let tt; ti.addEventListener('input', () => { clearTimeout(tt); tt = setTimeout(() => updateNota(n.id, { titulo: ti.value }), 700); });

    const ta = card.querySelector('.nota-cuerpo');
    let ct; ta.addEventListener('input', () => {
      clearTimeout(ct);
      ct = setTimeout(() => updateNota(n.id, { cuerpo: ta.value }), 700);
      const wc = card.querySelector('.nota-wc');
      if (wc) wc.textContent = ta.value.trim() ? ta.value.trim().split(/\s+/).length + ' pal' : '';
    });

    card.querySelector('.nota-pin-btn').addEventListener('click', () => {
      updateNota(n.id, { pinned: !n.pinned });
      renderNotas(); renderDashboard();
    });

    let _dt = null;
    const db = card.querySelector('.nota-del-btn');
    db.addEventListener('click', () => {
      if (_dt) { clearTimeout(_dt); deleteNota(n.id); return; }
      db.classList.add('confirming'); db.textContent = '¿Eliminar?';
      _dt = setTimeout(() => { db.classList.remove('confirming'); db.textContent = '✕'; _dt = null; }, 2500);
    });

    card.querySelectorAll('.ncolor').forEach(dot =>
      dot.addEventListener('click', () => { updateNota(n.id, { color: dot.dataset.c }); renderNotas(); })
    );

    el.appendChild(card);
  });
}
window.renderNotas = renderNotas;

function renderNotasWidget() {
  const el = document.getElementById('dash-notas-widget');
  if (!el) return;
  const pinned = getNotas().filter(n => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!pinned.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.querySelector('.dash-notas-body').innerHTML = pinned.map(n => `
    <div class="dash-nota-item" onclick="AREXNav.cambiarModulo('notas')">
      ${n.titulo ? `<div class="dash-nota-titulo">${n.titulo.replace(/</g,'&lt;')}</div>` : ''}
      ${n.cuerpo ? `<div class="dash-nota-cuerpo">${n.cuerpo.replace(/</g,'&lt;').slice(0, 80)}${n.cuerpo.length > 80 ? '…' : ''}</div>` : ''}
    </div>`).join('');
}

// ── Módulo Hábitos ───────────────────────────────────────
function getHabitos() { return JSON.parse(localStorage.getItem('arex_habitos') || '[]'); }
function saveHabitos(arr) { localStorage.setItem('arex_habitos', JSON.stringify(arr)); }

function _todayStr() { return new Date().toISOString().slice(0, 10); }

function _getStreak(h) {
  const today = _todayStr();
  let streak = 0;
  const d = new Date(); d.setHours(0, 0, 0, 0);
  while (true) {
    const s = d.toISOString().slice(0, 10);
    if (!h.history.includes(s)) {
      if (streak === 0 && s === today) { d.setDate(d.getDate() - 1); continue; }
      break;
    }
    streak++; d.setDate(d.getDate() - 1);
  }
  return streak;
}

function _last7(h) {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const s = d.toISOString().slice(0, 10);
    return { date: s, checked: h.history.includes(s), isToday: i === 6 };
  });
}

function checkHabito(id) {
  const today = _todayStr();
  saveHabitos(getHabitos().map(h => {
    if (h.id !== id) return h;
    const history = h.history.includes(today)
      ? h.history.filter(d => d !== today)
      : [...h.history, today];
    return { ...h, history };
  }));
  renderHabitos(); renderDashboard();
}

function deleteHabito(id) {
  saveHabitos(getHabitos().filter(h => h.id !== id));
  renderHabitos(); renderDashboard();
}

function addHabito(nombre, emoji) {
  if (!nombre.trim()) return;
  saveHabitos([...getHabitos(), { id: String(Date.now()), nombre: nombre.trim(), emoji: emoji || '🎯', history: [], created: Date.now() }]);
  renderHabitos();
}

function renderHabitos() {
  const el = document.getElementById('hab-list');
  if (!el) return;
  const habitos = getHabitos();
  const today = _todayStr();

  const sub = document.getElementById('hab-subtitle');
  if (sub) {
    const done = habitos.filter(h => h.history.includes(today)).length;
    sub.textContent = habitos.length
      ? `${done}/${habitos.length} completados hoy`
      : 'Sin hábitos aún';
  }

  if (!habitos.length) {
    el.innerHTML = '<div class="hab-empty">Sin hábitos — toca + NUEVO para agregar uno</div>';
    return;
  }

  el.innerHTML = '';
  habitos.forEach(h => {
    const streak = _getStreak(h);
    const done   = h.history.includes(today);
    const div    = document.createElement('div');
    div.className = 'hab-card' + (done ? ' checked' : '');
    div.innerHTML = `
      <button class="hab-check${done ? ' done' : ''}" data-id="${h.id}">
        <span class="hab-emoji">${h.emoji}</span>
        ${done ? '<span class="hab-tick">✓</span>' : ''}
      </button>
      <div class="hab-info">
        <div class="hab-nombre">${h.nombre.replace(/</g,'&lt;')}</div>
        <div class="hab-dots">${_last7(h).map(d =>
          `<span class="hab-dot${d.checked?' on':''}${d.isToday?' today':''}"></span>`
        ).join('')}</div>
      </div>
      <div class="hab-right">
        <div class="hab-streak">${streak}<span class="hab-sl"> racha</span></div>
        <button class="hab-del">✕</button>
      </div>`;

    div.querySelector('.hab-check').addEventListener('click', () => checkHabito(h.id));
    let _hdt = null;
    const db = div.querySelector('.hab-del');
    db.addEventListener('click', () => {
      if (_hdt) { clearTimeout(_hdt); deleteHabito(h.id); return; }
      db.classList.add('confirming'); db.textContent = '¿?';
      _hdt = setTimeout(() => { db.classList.remove('confirming'); db.textContent = '✕'; _hdt = null; }, 2000);
    });
    el.appendChild(div);
  });
}
window.renderHabitos = renderHabitos;

function renderHabitosWidget() {
  const el = document.getElementById('dash-habitos-widget');
  if (!el) return;
  const habitos = getHabitos();
  if (!habitos.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  const today = _todayStr();
  const done  = habitos.filter(h => h.history.includes(today)).length;
  el.querySelector('.dash-hab-body').innerHTML = `
    <div class="dash-hab-progress">
      <div class="dhp-bar"><div class="dhp-fill" style="width:${Math.round(done/habitos.length*100)}%"></div></div>
      <span class="dhp-label">${done}/${habitos.length} hoy</span>
    </div>
    ${habitos.map(h => {
      const isDone = h.history.includes(today);
      const streak = _getStreak(h);
      return `<div class="dash-hab-item${isDone?' done':''}">
        <button class="dash-hab-check${isDone?' done':''}" data-id="${h.id}">${isDone?'✓':h.emoji}</button>
        <span class="dash-hab-nombre">${h.nombre.replace(/</g,'&lt;')}</span>
        ${streak > 1 ? `<span class="dash-hab-streak">🔥${streak}</span>` : ''}
      </div>`;
    }).join('')}`;
  el.querySelectorAll('.dash-hab-check').forEach(btn =>
    btn.addEventListener('click', () => checkHabito(btn.dataset.id))
  );
}

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
      statusEl.style.color = '#00d4ff';
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

function renderDashboard() {
  const el = document.getElementById('dash-content');
  if (!el) return;

  const fin       = getFinanzasData();
  const tareas    = getTareas();
  const pendientes = sortPending(tareas.filter(t => !t.done));
  const urgentes  = pendientes.filter(t => { const u = urgenciaTarea(t); return u?.cls === 'urg-vencida' || u?.cls === 'urg-hoy'; });
  const proximas  = pendientes.filter(t => { const u = urgenciaTarea(t); return u && !['urg-vencida','urg-hoy'].includes(u.cls); }).slice(0, 3);
  const sinFecha  = pendientes.filter(t => !t.fecha).slice(0, 2);
  const mostrar   = [...urgentes, ...proximas, ...sinFecha].slice(0, 6);

  const deuda    = calcularDeudaTotal();
  const margen   = calcularMargen();
  const ingreso  = fin.config.ingresoMensual;
  const pagos    = obtenerProximosPagos(30);

  const hoy      = new Date();
  const diasMes  = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const pctMes   = Math.round((hoy.getDate() / diasMes) * 100);
  const fechaStr = hoy.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  const mesStr   = hoy.toLocaleDateString('es-MX', { month:'long', year:'numeric' }).toUpperCase();

  const mkTareaItem = t => {
    const u    = urgenciaTarea(t);
    const prio = t.prioridad || 'media';
    const esUrgente = u?.cls === 'urg-vencida' || u?.cls === 'urg-hoy';
    return `<div class="dash-tarea-item${esUrgente ? ' urgent' : ''}">
      <button class="dash-check" data-id="${t.id}"></button>
      <span class="dash-tarea-txt">${t.text.replace(/</g,'&lt;')}</span>
      ${u ? `<span class="dash-urg ${u.cls}">${u.icon} ${u.txt}</span>`
           : `<span class="dash-prio-dot prio-${prio}"></span>`}
    </div>`;
  };

  el.innerHTML = `
    <div class="dash-topbar">
      <span class="dash-fecha-hoy">${fechaStr.toUpperCase()}</span>
      <div class="dash-quick-stats">
        ${urgentes.length
          ? `<span class="dash-stat dash-stat-alert">${urgentes.length} URGENTE${urgentes.length!==1?'S':''}</span>`
          : `<span class="dash-stat">${pendientes.length} PENDIENTE${pendientes.length!==1?'S':''}</span>`}
      </div>
    </div>

    <div class="dash-grid">

      <div class="dash-widget">
        <div class="dash-w-header">
          <span class="dash-w-title">TAREAS</span>
          <button class="dash-w-link" onclick="AREXNav.cambiarModulo('tareas')">VER TODAS →</button>
        </div>
        ${mostrar.length
          ? mostrar.map(mkTareaItem).join('')
          : '<div class="dash-empty">Sin tareas pendientes</div>'}
      </div>

      <div class="dash-widget">
        <div class="dash-w-header">
          <span class="dash-w-title">FINANZAS</span>
          <button class="dash-w-link" onclick="AREXNav.cambiarModulo('finanzas')">VER TODO →</button>
        </div>
        <div class="dash-kpis">
          <div class="dash-kpi">
            <span class="dash-kpi-label">INGRESO</span>
            <span class="dash-kpi-val kpi-green">${formatearMoneda(ingreso)}</span>
          </div>
          <div class="dash-kpi">
            <span class="dash-kpi-label">DEUDA</span>
            <span class="dash-kpi-val kpi-red">${formatearMoneda(deuda)}</span>
          </div>
          <div class="dash-kpi">
            <span class="dash-kpi-label">MARGEN</span>
            <span class="dash-kpi-val ${margen >= 0 ? 'kpi-green' : 'kpi-red'}">${formatearMoneda(margen)}</span>
          </div>
        </div>
        <div class="dash-w-subtitle">PRÓXIMOS PAGOS</div>
        ${pagos.length
          ? pagos.map(p => `
            <div class="dash-pago urg-pago-${p.urgencia}">
              <span class="dash-pago-nom">${p.tarjeta}</span>
              <span class="dash-pago-dias">${p.diasRestantes === 0 ? 'HOY' : p.diasRestantes + 'd'}</span>
              <span class="dash-pago-monto">${formatearMoneda(p.pagoMinimo)}</span>
            </div>`).join('')
          : '<div class="dash-empty">Sin pagos en los próximos 30 días</div>'}
      </div>

    </div>

    <div id="dash-weather" class="dash-widget dash-w-full"></div>

    <div id="dash-habitos-widget" class="dash-widget dash-w-full" style="display:none">
      <div class="dash-w-header">
        <span class="dash-w-title">🔥 HÁBITOS DE HOY</span>
        <button class="dash-w-link" onclick="AREXNav.cambiarModulo('habitos')">VER TODOS →</button>
      </div>
      <div class="dash-hab-body"></div>
    </div>

    <div id="dash-notas-widget" class="dash-widget dash-w-full" style="display:none">
      <div class="dash-w-header">
        <span class="dash-w-title">📌 NOTAS FIJADAS</span>
        <button class="dash-w-link" onclick="AREXNav.cambiarModulo('notas')">VER TODAS →</button>
      </div>
      <div class="dash-notas-body"></div>
    </div>

    <div class="dash-widget dash-w-full">
      <div class="dash-w-header">
        <span class="dash-w-title">RECORDATORIOS</span>
        <button class="dash-w-link" onclick="document.getElementById('txt')?.focus()">+ NUEVO →</button>
      </div>
      <div id="dash-rec-body">${_buildRecHtml()}</div>
    </div>

    <div class="dash-mes-wrap">
      <span class="dash-mes-label">${mesStr} — DÍA ${hoy.getDate()} DE ${diasMes} (${pctMes}%)</span>
      <div class="dash-mes-bar"><div class="dash-mes-fill" style="width:${pctMes}%"></div></div>
    </div>
  `;

  el.querySelectorAll('.dash-check').forEach(btn =>
    btn.addEventListener('click', () => { toggleTarea(btn.dataset.id); renderDashboard(); })
  );
  el.querySelectorAll('.rec-dismiss').forEach(b =>
    b.addEventListener('click', () => dismissReminder(b.dataset.id))
  );

  renderWeatherWidget();
  renderHabitosWidget();
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
  syncModeBtn('sb-search', searchOn);
  syncModeBtn('sb-exam',   examMode);
  syncModeBtn('sb-voice',  voiceOn);
  // Mode strip
  const strip = document.getElementById('mode-strip');
  const modeVal = document.getElementById('sb-mode-val');
  if (!strip) return;
  const pills = [];
  if (searchOn) pills.push(`<span class="mode-pill mp-search">BÚSQUEDA ACTIVA</span>`);
  if (examMode) pills.push(`<span class="mode-pill mp-exam">MODO EXAMEN</span>`);
  if (voiceOn)  pills.push(`<span class="mode-pill mp-voice">VOZ ACTIVA</span>`);
  strip.innerHTML = pills.join('');
  strip.classList.toggle('hidden', pills.length === 0);
  if (modeVal) modeVal.textContent = examMode ? 'EXAMEN' : searchOn ? 'BÚSQUEDA' : 'ESTÁNDAR';
}
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

/* ── Estado del orb ─────────────────────────────────── */
function setOrb(state, label) {
  orb.classList.remove('speaking','listening','thinking','searching');
  if (state) orb.classList.add(state);
  statusTxt.textContent = label;
}

/* ── Render mensajes ────────────────────────────────── */
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
    ? `<div class="msg-actions"><button class="msg-copy" title="Copiar">⎘</button></div>`
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
  }
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  if (role !== 'user') applyHighlight(wrap);
  return wrap.querySelector('.bubble');
}

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

/* ── Código en vivo ─────────────────────────────────── */
function extractCodeBlock(text) {
  // Acepta cualquier lenguaje o ninguno: ```html, ```js, ```, ```python, etc.
  const re = /```[^\n`]*\n([\s\S]+?)```/g;
  let best = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    const code = m[1].trim();
    if (code.length > 60 && (!best || code.length > best.length)) best = code;
  }
  return best;
}
const _CP_ERR_HANDLER = `<script>(function(){function _arexErr(m,l){if(document.getElementById('__ae'))return;var d=document.createElement('div');d.id='__ae';d.style.cssText='position:fixed;top:0;left:0;right:0;background:rgba(200,28,28,0.94);color:#fff;font-family:monospace;font-size:11px;padding:8px 12px;z-index:99999;word-break:break-all;line-height:1.5';d.textContent='⚠ Error'+(l?' — l\xednea '+l:'')+': '+m;(document.body||document.documentElement).appendChild(d);}window.onerror=function(m,s,l){_arexErr(m,l);return true;};window.addEventListener('error',function(e){_arexErr(e.message||e.type,e.lineno);});})();<\/script>`;
const _CP_META = `<meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0}canvas,img,video{max-width:100%;height:auto;display:block}</style><script>(function(){
  /* Hace el canvas responsivo y corrige coordenadas de click al escalar */
  var _origAEL = HTMLCanvasElement.prototype.addEventListener;
  HTMLCanvasElement.prototype.addEventListener = function(type, fn, opts) {
    var cv = this;
    if (['click','mousedown','mousemove','mouseup','touchstart','touchend','touchmove'].indexOf(type) !== -1) {
      _origAEL.call(cv, type, function(e) {
        var r = cv.getBoundingClientRect();
        var scaleX = cv.width / (r.width || cv.width);
        var scaleY = cv.height / (r.height || cv.height);
        if (Math.abs(scaleX - 1) > 0.01 || Math.abs(scaleY - 1) > 0.01) {
          /* Corregir clientX/Y para que coincidan con el sistema de coordenadas del canvas */
          try {
            Object.defineProperty(e, 'clientX', { get: function(){ return r.left + (e.__cx !== undefined ? e.__cx : (e.__cx = (e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0))) * scaleX - r.left * (scaleX - 1); }, configurable:true });
            Object.defineProperty(e, 'clientY', { get: function(){ return r.top  + (e.__cy !== undefined ? e.__cy : (e.__cy = (e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0))) * scaleY - r.top  * (scaleY - 1); }, configurable:true });
          } catch(_) {}
        }
        fn(e);
      }, opts);
    } else { _origAEL.call(cv, type, fn, opts); }
  };
  /* Aplicar aspect-ratio al canvas para que height:auto funcione correctamente */
  function _fitCanvas() {
    document.querySelectorAll('canvas').forEach(function(cv) {
      var W = parseInt(cv.getAttribute('width')) || 0;
      var H = parseInt(cv.getAttribute('height')) || 0;
      if (W && H) { cv.style.aspectRatio = W + '/' + H; cv.style.maxWidth = '100%'; cv.style.height = 'auto'; }
    });
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', _fitCanvas); }
  else { _fitCanvas(); }
  window.addEventListener('resize', _fitCanvas);
})();<\/script>`;

function wrapCodeIfNeeded(code) {
  if (/<!DOCTYPE|<html/i.test(code)) {
    // Full HTML — inject error handler + responsive meta after opening <head>
    if (/<head>/i.test(code))  return code.replace(/<head>/i,  '<head>'  + _CP_META + _CP_ERR_HANDLER);
    if (/<body[^>]*>/i.test(code)) return code.replace(/<body([^>]*)>/i, '<body$1>' + _CP_ERR_HANDLER);
    return _CP_ERR_HANDLER + code;
  }
  if (!/^\s*</.test(code)) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${_CP_META}${_CP_ERR_HANDLER}<style>body{margin:0;background:#020c14;color:#e0f4ff;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body><script>${code}<\/script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${_CP_META}${_CP_ERR_HANDLER}<style>body{margin:0;background:#020c14;color:#e0f4ff;}</style></head><body>${code}</body></html>`;
}
function runInIframe(code) {
  document.getElementById('cp-iframe').srcdoc = wrapCodeIfNeeded(code);
}
const CODE_TEMPLATE = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AREX Código</title>
<style>
  body { margin: 0; font-family: monospace; background: #030d18; color: #00d4ff; padding: 1rem; }
</style>
</head>
<body>
  <h1>Hola desde AREX</h1>
  <p>Edita este código o pídele a AREX que genere algo.</p>
  <script>
    // Tu código aquí
  <\/script>
</body>
</html>`;

function openCodePanel(code) {
  const src = code || CODE_TEMPLATE;
  document.getElementById('cp-editor').value = src;
  document.getElementById('code-panel').classList.remove('hidden');
  // Si es plantilla vacía, abre en el editor para que el usuario escriba de inmediato
  switchCpTab(code ? 'preview' : 'code');
  if (code) requestAnimationFrame(() => requestAnimationFrame(() => runInIframe(code)));
}
function closeCpPanel() {
  document.getElementById('code-panel').classList.add('hidden');
  setTimeout(() => { document.getElementById('cp-iframe').srcdoc = ''; }, 300);
}
function switchCpTab(tab) {
  document.querySelectorAll('.cp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('cp-preview-pane').classList.toggle('hidden', tab !== 'preview');
  document.getElementById('cp-code-pane').classList.toggle('hidden',   tab !== 'code');
}

/* ── Helpers de render de respuesta AREX ────────────── */
function makeArexWrap(srcHTML = '') {
  document.querySelector('.welcome')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg arex';
  wrap.innerHTML = `<span class="who">AREX</span><div class="bubble"></div><div class="msg-actions"><button class="msg-copy" title="Copiar">⎘</button><button class="msg-regen" title="Regenerar">↺</button></div><div class="run-wrap"></div>${srcHTML}`;

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

function _attachRunBtn(wrap, text) {
  const code = extractCodeBlock(text);
  if (!code) return;
  const btn = document.createElement('button');
  btn.className = 'run-btn';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg> EJECUTAR EN AREX';
  btn.onclick = () => openCodePanel(code);
  wrap.querySelector('.run-wrap').appendChild(btn);
  if (/<!DOCTYPE|<html/i.test(code)) setTimeout(() => openCodePanel(code), 400);
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
      case 'addHabito':
        addHabito(a.nombre || a.texto || '', a.emoji || '🎯');
        pills.push({ icon: '🔥', label: `Hábito: ${a.nombre || a.texto || ''}`, cls: 'apill-habito' });
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
  _attachRunBtn(wrap, clean);
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
  _attachRunBtn(wrap, clean);
  await ejecutarAcciones(full, wrap);
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

/* ── Voz de AREX ────────────────────────────────────── */
function getMaleVoice() {
  const voices = window.speechSynthesis.getVoices();
  const maleNames = ['pablo','jorge','diego','carlos','miguel','david','google español','microsoft pablo','microsoft jorge'];
  return voices.find(v => v.lang.startsWith('es') && maleNames.some(n => v.name.toLowerCase().includes(n)))
      || voices.find(v => v.lang.startsWith('es'));
}
function arexSpeak(text) {
  if (!voiceOn) return;
  window.speechSynthesis.cancel();
  isSpeaking = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'es-MX'; u.rate = 0.91; u.pitch = 0.78; u.volume = 1;
  const v = getMaleVoice(); if (v) u.voice = v;
  u.onstart = () => setOrb('speaking','Transmitiendo respuesta');
  u.onend   = () => { isSpeaking = false; setOrb(null,'En espera de instrucciones'); };
  u.onerror = () => { isSpeaking = false; setOrb(null,'En espera de instrucciones'); };
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
  const colors  = { granted: '#00d4ff', denied: '#ff4444', default: '#4a7a96', unsupported: '#4a7a96' };
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
window.requestNotifPermission = requestNotifPermission;

/* ── Módulo SOS / Emergencias ───────────────────────── */
const SOS_DEFAULT = { contactos: [], medico: { tipoSangre:'', alergias:'', medicamentos:'', condiciones:'' } };
function getSOSData()      { return JSON.parse(localStorage.getItem('arex_sos') || JSON.stringify(SOS_DEFAULT)); }
function saveSOSData(data) { localStorage.setItem('arex_sos', JSON.stringify(data)); }

let _sosGPS = null; // { lat, lng, accuracy }

function _emergencyMsg() {
  const loc = _sosGPS
    ? `GPS: ${_sosGPS.lat.toFixed(5)}, ${_sosGPS.lng.toFixed(5)}\nhttps://maps.google.com/?q=${_sosGPS.lat},${_sosGPS.lng}`
    : 'Hermosillo, Sonora, México';
  return `🆘 EMERGENCIA 🆘\nSoy Alexiz Cejudo. Necesito ayuda urgente.\n📍 Ubicación:\n${loc}\nPor favor llama al 911 o ven a ayudarme.`;
}

function _fmtPhone(raw) {
  const d = raw.replace(/\D/g, '');
  return d.startsWith('52') ? d : '52' + d;
}

function renderSOSContacts() {
  const el = document.getElementById('sos-contacts-list');
  if (!el) return;
  const { contactos } = getSOSData();
  if (!contactos.length) {
    el.innerHTML = '<div class="sos-empty">Sin contactos — toca ⚙ CONFIGURAR para agregar</div>';
    return;
  }
  const msg = encodeURIComponent(_emergencyMsg());
  el.innerHTML = contactos.map(c => {
    const p = c.telefono.replace(/\D/g, '');
    const wa = _fmtPhone(p);
    return `<div class="sos-contact-card">
      <div class="sos-contact-info">
        <div class="sos-contact-name">${c.nombre.replace(/</g,'&lt;')}</div>
        <div class="sos-contact-rel">${c.relacion.replace(/</g,'&lt;')}</div>
        <div class="sos-contact-phone">${c.telefono}</div>
      </div>
      <div class="sos-contact-btns">
        <a href="tel:${p}" class="sos-btn sos-call">📞 LLAMAR</a>
        <a href="sms:${p}?body=${msg}" class="sos-btn sos-sms">💬 SMS</a>
        <a href="https://wa.me/${wa}?text=${msg}" target="_blank" class="sos-btn sos-wa">📲 WA</a>
      </div>
    </div>`;
  }).join('');
}

function renderSOSMedico() {
  const el = document.getElementById('sos-medico-card');
  if (!el) return;
  const { medico } = getSOSData();
  const row = (label, val, empty) => `
    <div class="sos-med-row${!val ? ' sos-med-empty' : ''}">
      <span class="sos-med-label">${label}</span>
      <span class="sos-med-val">${val || empty}</span>
    </div>`;
  el.innerHTML = `<div class="sos-med-grid">
    ${row('SANGRE',       medico.tipoSangre,   '—')}
    ${row('ALERGIAS',     medico.alergias,     'Ninguna')}
    ${row('MEDICAMENTOS', medico.medicamentos, 'Ninguno')}
    ${row('CONDICIONES',  medico.condiciones,  'Ninguna')}
  </div>`;
}

function renderSOSShareRow() {
  const el = document.getElementById('sos-share-row');
  if (!el) return;
  const { contactos } = getSOSData();
  const msg = encodeURIComponent(_emergencyMsg());
  el.innerHTML = contactos.length
    ? contactos.map(c =>
        `<a href="https://wa.me/${_fmtPhone(c.telefono)}?text=${msg}" target="_blank"
            class="sos-share-wa">💬 ${c.nombre.replace(/</g,'&lt;')}</a>`
      ).join('')
    : '';
}

function renderSOSEditContacts() {
  const el = document.getElementById('sos-edit-contacts-list');
  if (!el) return;
  const { contactos } = getSOSData();
  if (!contactos.length) { el.innerHTML = '<div class="sos-empty">Sin contactos aún</div>'; return; }
  el.innerHTML = contactos.map((c, i) => `
    <div class="sos-edit-contact-row">
      <span>${c.nombre} · ${c.relacion} · ${c.telefono}</span>
      <button class="sos-del-contact" data-i="${i}">✕</button>
    </div>`).join('');
  el.querySelectorAll('.sos-del-contact').forEach(btn =>
    btn.addEventListener('click', () => {
      const d = getSOSData();
      d.contactos.splice(parseInt(btn.dataset.i), 1);
      saveSOSData(d);
      renderSOSModule();
      renderSOSEditContacts();
    })
  );
}

function renderSOSModule() {
  renderSOSContacts();
  renderSOSMedico();
  renderSOSShareRow();
  if (!_sosGPS) sosGetGPS();
}

function sosGetGPS() {
  const locEl  = document.getElementById('sos-loc-text');
  const gpsBtn = document.getElementById('sos-get-loc');
  if (!locEl || !gpsBtn) return;
  if (!navigator.geolocation) { locEl.textContent = 'GPS no disponible'; return; }
  gpsBtn.textContent = '...';
  gpsBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    pos => {
      _sosGPS = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: Math.round(pos.coords.accuracy) };
      locEl.innerHTML = `<strong>${_sosGPS.lat.toFixed(5)}, ${_sosGPS.lng.toFixed(5)}</strong> <small>±${_sosGPS.accuracy}m</small>`;
      gpsBtn.textContent = '↻';
      gpsBtn.disabled = false;
      renderSOSShareRow();
      renderSOSContacts();
    },
    () => {
      _sosGPS = null;
      locEl.textContent = 'Sin GPS — Hermosillo, Sonora, México';
      gpsBtn.textContent = 'GPS';
      gpsBtn.disabled = false;
    },
    { enableHighAccuracy: true, timeout: 12000 }
  );
}

function initSOSEvents() {
  document.getElementById('sos-get-loc')?.addEventListener('click', sosGetGPS);

  document.getElementById('sos-copy-msg')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(_emergencyMsg());
      const btn = document.getElementById('sos-copy-msg');
      const orig = btn.textContent;
      btn.textContent = '✓ COPIADO';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    } catch { /* clipboard not available */ }
  });

  document.getElementById('sos-edit-toggle')?.addEventListener('click', () => {
    const panel = document.getElementById('sos-edit-panel');
    const isOpen = !panel.classList.contains('hidden');
    panel.classList.toggle('hidden', isOpen);
    document.getElementById('sos-edit-toggle').textContent = isOpen ? '⚙ CONFIGURAR' : '✕ CERRAR';
    if (!isOpen) { renderSOSEditContacts(); _prefillSOSMedico(); }
  });

  document.getElementById('sos-add-contact-btn')?.addEventListener('click', () => {
    const nombre  = document.getElementById('sos-add-name').value.trim();
    const relacion = document.getElementById('sos-add-rel').value.trim();
    const telefono = document.getElementById('sos-add-phone').value.trim();
    if (!nombre || !telefono) return;
    const d = getSOSData();
    d.contactos.push({ id: String(Date.now()), nombre, relacion: relacion || 'Contacto', telefono });
    saveSOSData(d);
    document.getElementById('sos-add-name').value = '';
    document.getElementById('sos-add-rel').value  = '';
    document.getElementById('sos-add-phone').value = '';
    renderSOSModule();
    renderSOSEditContacts();
  });

  document.getElementById('sos-save-medico-btn')?.addEventListener('click', () => {
    const d = getSOSData();
    d.medico = {
      tipoSangre:   document.getElementById('sos-med-sangre').value.trim(),
      alergias:     document.getElementById('sos-med-alergias').value.trim(),
      medicamentos: document.getElementById('sos-med-meds').value.trim(),
      condiciones:  document.getElementById('sos-med-cond').value.trim(),
    };
    saveSOSData(d);
    renderSOSMedico();
    const btn = document.getElementById('sos-save-medico-btn');
    btn.textContent = '✓ GUARDADO';
    setTimeout(() => { btn.textContent = 'GUARDAR DATOS MÉDICOS'; }, 2000);
  });
}

function _prefillSOSMedico() {
  const { medico } = getSOSData();
  const f = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  f('sos-med-sangre',   medico.tipoSangre);
  f('sos-med-alergias', medico.alergias);
  f('sos-med-meds',     medico.medicamentos);
  f('sos-med-cond',     medico.condiciones);
}

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
];

/* ── Reconocimiento de voz ──────────────────────────── */
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addMsg('arex','Reconocimiento de voz no disponible en este navegador.'); return; }
  const rec = new SR();
  rec.lang = 'es-MX'; rec.interimResults = false; rec.maxAlternatives = 1;
  btnMic.classList.add('on');
  setOrb('listening','Escuchando...');
  rec.onresult = async e => {
    btnMic.classList.remove('on');
    const transcript = e.results?.[0]?.[0]?.transcript;
    if (!transcript) return;
    const lower = transcript.toLowerCase().trim();

    // Detectar comandos de voz
    for (const vc of VOICE_CMDS) {
      if (vc.phrases.some(p => lower.includes(p))) {
        if (vc.cmd === '__search__') {
          btnSearch.click();
        } else {
          txt.value = vc.cmd;
          await handleSend();
        }
        return;
      }
    }

    // Mensaje normal de voz
    txt.value = transcript;
    await updateStats('voice');
    handleSend();
  };
  rec.onerror = () => { btnMic.classList.remove('on'); setOrb(null,'En espera de instrucciones'); };
  rec.onend   = () => btnMic.classList.remove('on');
  rec.start();
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

/* ── Llamada a Groq (texto) ─────────────────────────── */
async function callGroq(webCtx) {
  const systemPrompt = buildSystemBase() + (examMode ? EXAM_ADDON : '') + buildContextSection() + buildMemoriaSection();
  let messages = [...history];

  if (webCtx) {
    const last = messages[messages.length - 1];
    const webSection = webCtx.answer
      ? `[CONTEXTO WEB]\n${webCtx.answer}\n\n`
      : '';
    messages[messages.length - 1] = {
      ...last,
      content: `${webSection}[PREGUNTA]\n${last.content}`
    };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
    body: JSON.stringify({ model:'llama-3.3-70b-versatile', max_tokens: examMode ? 4096 : 2048,
      messages: [{ role:'system', content: systemPrompt }, ...messages] })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta inválida de API');
  return content;
}

/* ── Llamada a Groq (streaming) ─────────────────────── */
async function callGroqStream(webCtx, onChunk) {
  const systemPrompt = buildSystemBase() + (examMode ? EXAM_ADDON : '') + buildContextSection() + buildMemoriaSection();
  let messages = [...history];

  if (webCtx) {
    const last = messages[messages.length - 1];
    const webSection = webCtx.answer ? `[CONTEXTO WEB]\n${webCtx.answer}\n\n` : '';
    messages[messages.length - 1] = { ...last, content: `${webSection}[PREGUNTA]\n${last.content}` };
  }

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AREX_CONFIG.groqKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: examMode ? 4096 : 2048,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });
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
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
    body: JSON.stringify({
      model:'meta-llama/llama-4-scout-17b-16e-instruct', max_tokens:1000,
      messages:[{ role:'user', content:[
        { type:'image_url', image_url:{ url: dataURL } },
        { type:'text', text: question }
      ]}]
    })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Respuesta inválida de API');
  return content;
}

/* ── Firebase: guardar mensaje ──────────────────────── */
async function saveMsg(role, content) {
  if (!db) return;
  try {
    await addDoc(collection(db,'conversations'), { sessionId:SESSION, role, content, timestamp:Date.now() });
  } catch(e) { console.warn('Firebase saveMsg:', e); }
}

/* ── Firebase: cargar historial ─────────────────────── */
async function loadHistory() {
  if (!db) return;
  try {
    const q = query(collection(db,'conversations'), orderBy('timestamp','desc'), limit(100));
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
  if (!db) return 'local_' + Date.now();
  const ref = await addDoc(collection(db,'notes'), { text, category, timestamp:Date.now() });
  return ref.id;
}
async function loadNotes() {
  if (!db) {
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
    const q = query(collection(db,'notes'), orderBy('timestamp','desc'));
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
    if (db) await deleteDoc(doc(db,'notes',id)).catch(()=>{});
    el.remove();
  };
  notesList.prepend(el);
}

/* ── Firebase: estadísticas ─────────────────────────── */
async function updateStats(type) {
  if (!db) return;
  const today = new Date().toISOString().slice(0,10);
  try {
    const globalRef = doc(db,'stats','global');
    const dailyRef  = doc(db,'stats',today);
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
  if (!db) return { g:{}, d:{} };
  const today = new Date().toISOString().slice(0,10);
  try {
    const [gSnap, dSnap] = await Promise.all([
      getDoc(doc(db,'stats','global')),
      getDoc(doc(db,'stats',today))
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
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
      body: JSON.stringify({
        model:'llama-3.3-70b-versatile', max_tokens:600,
        messages:[{ role:'user', content:
          `Eres un asistente de memoria. Resume esta conversación en puntos clave detallados ` +
          `(decisiones tomadas, temas discutidos, código generado, datos importantes). ` +
          `Sé específico y conserva información técnica relevante:\n\n${
            toCompress.map(m=>`${m.role==='user'?'Alexiz':'AREX'}: ${m.content}`).join('\n')
          }`
        }]
      })
    });
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
function getRecordatorios() { return JSON.parse(localStorage.getItem('arex_recordatorios') || '[]'); }
function saveRecordatorios(arr) { localStorage.setItem('arex_recordatorios', JSON.stringify(arr)); }

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

function armReminder(rec) {
  const ms = rec.disparaEn - Date.now();
  if (ms <= 0) return;
  setTimeout(() => {
    saveRecordatorios(getRecordatorios().map(r => r.id === rec.id ? { ...r, disparado: true } : r));
    if (Notification.permission === 'granted') new Notification('AREX — Recordatorio', { body: rec.msg, icon:'icon.svg' });
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
      if (r.disparaEn <= now) { r.disparado = true; r.perdido = true; changed = true; }
      else armReminder(r);
    }
  });
  if (changed) saveRecordatorios(all);
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
      if (db) {
        try {
          const qSnap = await getDocs(collection(db,'conversations'));
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
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method:'POST',
          headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
          body: JSON.stringify({ model:'llama-3.3-70b-versatile', max_tokens:500,
            messages:[{ role:'user', content:`Resume en puntos clave esta conversación entre Alexiz y AREX:\n\n${
              history.map(m=>`${m.role==='user'?'Alexiz':'AREX'}: ${m.content}`).join('\n')
            }` }] })
        });
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
        const data = await res.json();
        const summaryText = data?.choices?.[0]?.message?.content;
        if (!summaryText) return;
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
      a.href = url; a.download = `AREX_${new Date().toISOString().slice(0,10)}.txt`; a.click();
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
      const fb = AREX_CONFIG.firebase || {};
      document.getElementById('cfg2-groq').value    = AREX_CONFIG.groqKey   || '';
      document.getElementById('cfg2-tavily').value  = AREX_CONFIG.tavilyKey || '';
      document.getElementById('cfg2-owm').value     = AREX_CONFIG.owmKey    || '';
      document.getElementById('cfg2-fb-key').value     = fb.apiKey            || '';
      document.getElementById('cfg2-fb-domain').value  = fb.authDomain        || '';
      document.getElementById('cfg2-fb-project').value = fb.projectId         || '';
      document.getElementById('cfg2-fb-bucket').value  = fb.storageBucket     || '';
      document.getElementById('cfg2-fb-sender').value  = fb.messagingSenderId || '';
      document.getElementById('cfg2-fb-app').value     = fb.appId             || '';
      document.getElementById('cfg2-ok').style.display    = 'none';
      document.getElementById('cfg2-error').style.display = 'none';
      _updateNotifStatus();
      modalConfig.classList.remove('hidden');
      break;
    }

    case 'run': {
      let found = null;
      for (let i = history.length - 1; i >= 0; i--) {
        found = extractCodeBlock(history[i].content);
        if (found) break;
      }
      if (found) { openCodePanel(found); }
      else { openCodePanel(''); addMsg('arex','No encontré código reciente — abrí el editor con una plantilla vacía.'); }
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

    case 'briefing':
      localStorage.removeItem('arex_briefing_date');
      await generarBriefing();
      break;

    case 'pomodoro':
      togglePomodoroWidget();
      break;

    case 'buscar':
      abrirBusqueda();
      if (args) {
        const bi = document.getElementById('busqueda-input');
        if (bi) { bi.value = args; renderBusquedaGlobal(args); }
      }
      break;

    default:
      addMsg('arex',`Comando no reconocido: /${name}. Escribe /ayuda para ver los disponibles.`);
  }
}

/* ── Sugerencias contextuales de comandos ───────────── */
const CTX_RULES = [
  {
    cmd: '/run', icon: '▶', label: 'run', reason: 'código detectado',
    priority: 0, execute: true,
    check: () => {
      const last = history[history.length - 1];
      return last?.role === 'assistant' && last.content.includes('```');
    }
  },
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
    if (voiceOn) arexSpeak(reply); else setOrb(null,'En espera de instrucciones');

  } catch(err) {
    hideThinking();
    const errMsg = err.message?.includes('401') ? 'API Key inválida o revocada. Ve a console.groq.com y genera una nueva key.' :
                   err.message?.includes('429') ? 'Límite de requests alcanzado. Espera un momento e intenta de nuevo.' :
                   err.message?.includes('Failed to fetch') ? 'Sin conexión a internet o CORS bloqueado.' :
                   `Error: ${err.message}`;
    addMsg('arex', errMsg);
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
  if (f) f.value = d.toISOString().slice(0, 10);
  document.getElementById('tarea-input')?.focus();
});
btnSend.addEventListener('click', handleSend);
txt.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
txt.addEventListener('input', () => {
  const s = document.getElementById('ctx-suggestions');
  if (s && txt.value.trim()) s.innerHTML = '';
});
btnMic.addEventListener('click', () => { if(!btnMic.classList.contains('on')) startListening(); });

btnVoice.addEventListener('click', () => {
  voiceOn = !voiceOn;
  btnVoice.classList.toggle('active', voiceOn);
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
    firebase:  fbKey ? {
      apiKey:            fbKey,
      authDomain:        document.getElementById('cfg2-fb-domain').value.trim(),
      projectId:         document.getElementById('cfg2-fb-project').value.trim(),
      storageBucket:     document.getElementById('cfg2-fb-bucket').value.trim(),
      messagingSenderId: document.getElementById('cfg2-fb-sender').value.trim(),
      appId:             document.getElementById('cfg2-fb-app').value.trim()
    } : null
  };
  localStorage.setItem('arex_config', JSON.stringify(config));
  window.AREX_CONFIG = config;
  document.getElementById('cfg2-ok').style.display = 'block';
});

// Panel de código en vivo
document.querySelectorAll('.cp-tab').forEach(tab =>
  tab.addEventListener('click', () => switchCpTab(tab.dataset.tab))
);
document.getElementById('cp-close').addEventListener('click', closeCpPanel);
document.getElementById('dock-btn-codigo').addEventListener('click', () => {
  const currentCode = document.getElementById('cp-editor').value.trim();
  openCodePanel(currentCode || '');
});
document.getElementById('cp-run-btn').addEventListener('click', () => {
  const code = document.getElementById('cp-editor').value.trim();
  if (code) {
    switchCpTab('preview');
    requestAnimationFrame(() => requestAnimationFrame(() => runInIframe(code)));
  }
});
document.getElementById('cp-copy').addEventListener('click', async () => {
  const code = document.getElementById('cp-editor').value;
  try {
    await navigator.clipboard.writeText(code);
    const btn = document.getElementById('cp-copy');
    const orig = btn.textContent;
    btn.textContent = 'COPIADO ✓';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch { /* no disponible */ }
});

// Búsqueda global — Ctrl+K / Esc
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); abrirBusqueda(); }
  if (e.key === 'Escape') cerrarBusqueda();
});
document.getElementById('busqueda-overlay')?.addEventListener('click', e => { if (e.target.id === 'busqueda-overlay') cerrarBusqueda(); });
document.getElementById('busqueda-input')?.addEventListener('input', e => renderBusquedaGlobal(e.target.value));

// Sidebar: abrir / cerrar
document.getElementById('btn-sidebar').addEventListener('click', openSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

// Notas
document.getElementById('notas-add-btn').addEventListener('click', addNota);
document.getElementById('notas-search').addEventListener('input', renderNotas);

// Hábitos
document.getElementById('hab-add-btn').addEventListener('click', () => {
  document.getElementById('hab-form').classList.toggle('hidden');
  document.getElementById('hab-nombre').focus();
});
document.getElementById('hab-form-save').addEventListener('click', () => {
  const nombre = document.getElementById('hab-nombre').value.trim();
  const emoji  = document.getElementById('hab-emoji').value.trim() || '🎯';
  if (!nombre) return;
  addHabito(nombre, emoji);
  document.getElementById('hab-nombre').value = '';
  document.getElementById('hab-emoji').value  = '🎯';
  document.getElementById('hab-form').classList.add('hidden');
});
document.getElementById('hab-form-cancel').addEventListener('click', () => {
  document.getElementById('hab-form').classList.add('hidden');
});
document.getElementById('hab-nombre').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('hab-form-save').click();
});

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

// Voces
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

// PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    // Detectar cuando el SW se actualiza en segundo plano
    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      newWorker?.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _showUpdateBanner();
        }
      });
    });
  }).catch(e => console.warn('SW:', e));

  // Mensaje del SW activo indicando nueva versión
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data?.type === 'SW_UPDATED') _showUpdateBanner();
  });
}

function _showUpdateBanner() {
  if (document.getElementById('update-banner')) return;
  const banner = document.createElement('div');
  banner.id = 'update-banner';
  banner.innerHTML = `
    <span>⬆ Nueva versión de AREX disponible</span>
    <button onclick="window.location.reload(true)">ACTUALIZAR</button>
    <button onclick="this.parentElement.remove()" style="opacity:0.5;font-size:10px">×</button>
  `;
  banner.style.cssText = `
    position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
    background:rgba(0,14,26,0.97);border:1px solid rgba(0,212,255,0.5);
    color:#00d4ff;font-family:monospace;font-size:11px;letter-spacing:1px;
    padding:10px 14px;border-radius:6px;z-index:9999;
    display:flex;align-items:center;gap:10px;
    box-shadow:0 0 20px rgba(0,212,255,0.2);
    animation:appear 0.3s ease-out;
    white-space:nowrap;
  `;
  banner.querySelector('button').style.cssText = `
    background:rgba(0,212,255,0.15);border:1px solid rgba(0,212,255,0.5);
    color:#00d4ff;font-family:monospace;font-size:10px;letter-spacing:2px;
    padding:4px 10px;border-radius:3px;cursor:pointer;
  `;
  document.body.appendChild(banner);
}

/* ── Secuencia de arranque ──────────────────────────── */
async function boot() {
  const lines = [
    'Iniciando AREX v4.0...',
    'Cargando módulos — IA · Finanzas · Tareas · SOS...',
    'Conectando Firebase...',
    'Restaurando memoria de sesión...',
    'Activando recordatorios y notificaciones...',
    'Activando búsqueda web y sistema de clima...',
    'Todos los sistemas en línea.'
  ];
  const bootLines = document.getElementById('boot-lines');
  const bootBar   = document.getElementById('boot-bar');
  const bootScreen = document.getElementById('boot-screen');

  for (let i = 0; i < lines.length; i++) {
    await new Promise(r => setTimeout(r, 350));
    const isLast = i === lines.length - 1;
    bootLines.innerHTML += `<span style="color:${isLast?'#00d4ff':'#4a7a96'}">${lines[i]}</span><br>`;
    bootBar.style.width = ((i+1)/lines.length*100) + '%';
  }

  await loadHistory();
  await requestNotifPerm();
  updateCtxBadge();
  updateSidebarAll();
  renderTareas();
  restoreReminders();
  initSOSEvents();
  renderSOSModule();

  await new Promise(r => setTimeout(r, 400));
  bootScreen.style.transition = 'opacity 0.6s';
  bootScreen.style.opacity = '0';
  await new Promise(r => setTimeout(r, 600));
  bootScreen.style.display = 'none';
  txt.focus();
  setTimeout(() => generarBriefing(), 800);
}

// ── CLIMA ─────────────────────────────────────────────────────────────────
const WEATHER_CACHE_KEY = 'arex_weather_cache';
const WEATHER_HIDE_KEY  = 'arex_weather_hidden';
const WEATHER_TTL       = 30 * 60 * 1000;

async function fetchWeather() {
  const key = AREX_CONFIG?.owmKey;
  if (!key) return null;
  const cached = localStorage.getItem(WEATHER_CACHE_KEY);
  if (cached) {
    const { data, ts } = JSON.parse(cached);
    if (Date.now() - ts < WEATHER_TTL) return data;
  }
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?q=Hermosillo,MX&appid=${encodeURIComponent(key)}&units=metric&lang=es`
    );
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
    return data;
  } catch { return null; }
}

function _weatherIcon(id) {
  if (id >= 200 && id < 300) return '⛈';
  if (id >= 300 && id < 400) return '🌦';
  if (id >= 500 && id < 600) return '🌧';
  if (id >= 600 && id < 700) return '❄';
  if (id >= 700 && id < 800) return '🌫';
  if (id === 800)             return '☀';
  if (id === 801)             return '🌤';
  if (id === 802)             return '⛅';
  return '☁';
}

function renderWeatherWidget() {
  const el = document.getElementById('dash-weather');
  if (!el) return;
  const hidden = localStorage.getItem(WEATHER_HIDE_KEY) === '1';
  const key    = AREX_CONFIG?.owmKey;

  const toggleBtn = `<button class="weather-toggle" onclick="toggleWeatherWidget()" title="${hidden ? 'Mostrar' : 'Ocultar'}">${hidden ? '◎' : '⊙'}</button>`;

  if (!key) {
    el.innerHTML = `
      <div class="dash-w-header">
        <span class="dash-w-title">CLIMA — HERMOSILLO</span>
        <button class="dash-w-link" onclick="document.getElementById('modal-config').classList.remove('hidden')">CONFIGURAR →</button>
      </div>
      <div class="dash-empty">Agrega tu OpenWeatherMap API Key en /config para ver el clima</div>`;
    return;
  }

  el.innerHTML = `
    <div class="dash-w-header">
      <span class="dash-w-title">CLIMA — HERMOSILLO</span>
      ${toggleBtn}
    </div>
    <div class="weather-body${hidden ? ' hidden' : ''}">
      <span class="dash-empty" style="font-size:0.65rem">Cargando...</span>
    </div>`;

  fetchWeather().then(data => {
    const body = el.querySelector('.weather-body');
    if (!body) return;
    if (!data) {
      body.innerHTML = '<div class="dash-empty">Sin datos — verifica tu API Key en /config</div>';
      return;
    }
    const icon  = _weatherIcon(data.weather[0].id);
    const desc  = data.weather[0].description.replace(/^\w/, c => c.toUpperCase());
    const temp  = Math.round(data.main.temp);
    const feels = Math.round(data.main.feels_like);
    const hum   = data.main.humidity;
    const wind  = Math.round(data.wind.speed * 3.6);
    const tmax  = Math.round(data.main.temp_max);
    const tmin  = Math.round(data.main.temp_min);
    body.innerHTML = `
      <div class="weather-main">
        <span class="weather-icon">${icon}</span>
        <span class="weather-temp">${temp}°<span class="weather-unit">C</span></span>
        <span class="weather-desc">${desc}</span>
      </div>
      <div class="weather-details">
        <div class="weather-stat"><span class="wst-label">SENSACIÓN</span><span class="wst-val">${feels}°C</span></div>
        <div class="weather-stat"><span class="wst-label">HUMEDAD</span><span class="wst-val">${hum}%</span></div>
        <div class="weather-stat"><span class="wst-label">VIENTO</span><span class="wst-val">${wind} km/h</span></div>
        <div class="weather-stat"><span class="wst-label">MÁX / MÍN</span><span class="wst-val">${tmax}° / ${tmin}°</span></div>
      </div>`;
  });
}

function toggleWeatherWidget() {
  const hidden = localStorage.getItem(WEATHER_HIDE_KEY) === '1';
  localStorage.setItem(WEATHER_HIDE_KEY, hidden ? '0' : '1');
  renderWeatherWidget();
}
window.toggleWeatherWidget = toggleWeatherWidget;

// ── Exponer funciones de render al scope global para jarvis.js
// (app.js es módulo ES6 — sus funciones no son globales por defecto)
window.renderDashboard = renderDashboard;
window.renderSOSModule = renderSOSModule;

// Actualiza countdowns de recordatorios cada 30 segundos
setInterval(() => {
  document.querySelectorAll('.rec-cd[data-de]').forEach(el => {
    el.textContent = fmtCountdown(parseInt(el.dataset.de));
  });
}, 30000);

// Punto de entrada — siempre registrar el handler del setup
setupSaveHandler();

if (loadConfig()) {
  initFirebase();
  boot();
} else {
  showSetup();
}

// ── BRIEFING DIARIO ───────────────────────────────────────────────────────────
async function generarBriefing() {
  const hoy = _todayStr();
  if (localStorage.getItem('arex_briefing_date') === hoy) return;

  const tareas = getTareas().filter(t => !t.done);
  const habitos = getHabitos();
  const habitosPendientes = habitos.filter(h => !h.history.includes(hoy));
  const recs = getRecordatorios().filter(r => !r.disparado);
  const today = new Date();

  const tareasUrgentes = tareas.filter(t => t.prioridad === 'alta').slice(0, 3);
  const tareasHoy = tareas.filter(t => t.fecha === hoy).slice(0, 3);

  const contexto = [
    `Fecha: ${today.toLocaleDateString('es-MX', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}`,
    `Tareas urgentes: ${tareasUrgentes.map(t => t.text).join(', ') || 'ninguna'}`,
    `Tareas para hoy: ${tareasHoy.map(t => t.text).join(', ') || 'ninguna'}`,
    `Total pendiente: ${tareas.length} tarea${tareas.length !== 1 ? 's' : ''}`,
    `Hábitos pendientes: ${habitosPendientes.map(h => `${h.emoji} ${h.nombre}`).join(', ') || 'todos completados'}`,
    `Recordatorios activos: ${recs.slice(0,3).map(r => r.msg).join(', ') || 'ninguno'}`,
  ].join('\n');

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AREX_CONFIG.groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile', max_tokens: 280,
        messages: [
          { role: 'system', content: 'Eres AREX, asistente personal de Alexiz. Genera un briefing matutino MUY breve (3-4 líneas), directo y motivador en español. Sin listas, sin asteriscos de markdown, solo texto fluido con lo más importante del día.' },
          { role: 'user', content: `Datos de hoy:\n${contexto}` }
        ]
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const briefing = data?.choices?.[0]?.message?.content;
    if (!briefing) return;
    localStorage.setItem('arex_briefing_date', hoy);
    addMsg('arex', `**Briefing — ${today.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'short' })}**\n\n${briefing}`);
  } catch(e) { console.warn('Briefing:', e); }
}
window.generarBriefing = generarBriefing;

// ── BÚSQUEDA GLOBAL ───────────────────────────────────────────────────────────
function buscarGlobal(q) {
  if (!q.trim()) return { tareas:[], notas:[], hechos:[], recordatorios:[] };
  const ql = q.toLowerCase();
  const match = s => s?.toLowerCase().includes(ql);
  return {
    tareas:        getTareas().filter(t => !t.done && (match(t.text) || match(t.fecha))),
    notas:         getNotas().filter(n => match(n.titulo) || match(n.cuerpo)),
    hechos:        getHechos().filter(h => match(h.texto)),
    recordatorios: getRecordatorios().filter(r => !r.disparado && match(r.msg))
  };
}

function renderBusquedaGlobal(q) {
  const el = document.getElementById('busqueda-results');
  if (!el) return;
  if (!q.trim()) { el.innerHTML = '<div class="bg-empty">Escribe para buscar en tareas, notas, memoria y recordatorios</div>'; return; }
  const { tareas, notas, hechos, recordatorios } = buscarGlobal(q);
  const total = tareas.length + notas.length + hechos.length + recordatorios.length;
  if (!total) { el.innerHTML = `<div class="bg-empty">Sin resultados para "${q}"</div>`; return; }

  const safeRe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hl = t => t.replace(new RegExp(safeRe, 'gi'), m => `<mark class="bg-hl">${m}</mark>`);
  const safe = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;');

  let html = '';
  if (tareas.length)        html += `<div class="bg-group"><div class="bg-gtitle">TAREAS (${tareas.length})</div>${tareas.slice(0,6).map(t => `<div class="bg-item" data-mod="tareas"><span class="bg-ico">✓</span><span>${hl(safe(t.text))}</span></div>`).join('')}</div>`;
  if (notas.length)         html += `<div class="bg-group"><div class="bg-gtitle">NOTAS (${notas.length})</div>${notas.slice(0,5).map(n => `<div class="bg-item" data-mod="notas"><span class="bg-ico">📝</span><span>${hl(safe(n.titulo || n.cuerpo.slice(0,60)))}</span></div>`).join('')}</div>`;
  if (hechos.length)        html += `<div class="bg-group"><div class="bg-gtitle">MEMORIA (${hechos.length})</div>${hechos.slice(0,5).map(h => `<div class="bg-item" data-mod="chat"><span class="bg-ico">🧠</span><span>${hl(safe(h.texto))}</span></div>`).join('')}</div>`;
  if (recordatorios.length) html += `<div class="bg-group"><div class="bg-gtitle">RECORDATORIOS (${recordatorios.length})</div>${recordatorios.slice(0,3).map(r => `<div class="bg-item" data-mod="inicio"><span class="bg-ico">⏰</span><span>${hl(safe(r.msg))}</span></div>`).join('')}</div>`;

  el.innerHTML = html;
  el.querySelectorAll('.bg-item[data-mod]').forEach(item => {
    item.addEventListener('click', () => { cerrarBusqueda(); AREXNav.cambiarModulo(item.dataset.mod); });
  });
}

function abrirBusqueda() {
  const overlay = document.getElementById('busqueda-overlay');
  const input   = document.getElementById('busqueda-input');
  if (!overlay || !input) return;
  overlay.classList.remove('hidden');
  input.value = '';
  renderBusquedaGlobal('');
  setTimeout(() => input.focus(), 50);
}
function cerrarBusqueda() { document.getElementById('busqueda-overlay')?.classList.add('hidden'); }
window.abrirBusqueda  = abrirBusqueda;
window.cerrarBusqueda = cerrarBusqueda;

// ── POMODORO ──────────────────────────────────────────────────────────────────
const POMO_TIMES = { work: 25 * 60, short: 5 * 60, long: 15 * 60 };
let _pom = { running: false, mode: 'work', elapsed: 0, total: 25 * 60, interval: null };

function _pomRender() {
  const el = document.getElementById('pomo-widget');
  if (!el || el.classList.contains('hidden')) return;
  const remaining = _pom.total - _pom.elapsed;
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  const pct = _pom.total > 0 ? (_pom.elapsed / _pom.total) : 0;
  const modeLabel = _pom.mode === 'work' ? 'FOCO' : _pom.mode === 'short' ? 'DESCANSO' : 'DESCANSO LARGO';
  const r = 38, circ = 2 * Math.PI * r;
  const dash = circ - pct * circ;

  el.querySelector('.pomo-time').textContent = `${m}:${s}`;
  el.querySelector('.pomo-mode').textContent = modeLabel;
  el.querySelector('.pomo-circle-progress').setAttribute('stroke-dashoffset', dash.toFixed(1));
  el.querySelector('.pomo-btn-main').textContent = _pom.running ? '⏸' : '▶';
}

function _pomDone() {
  clearInterval(_pom.interval);
  _pom.running = false; _pom.interval = null;
  const wasWork = _pom.mode === 'work';
  const msg = wasWork ? '⏱ Pomodoro completado. ¡Tómate un descanso merecido!' : '⏱ Descanso terminado. ¡A trabajar!';
  if (Notification.permission === 'granted') new Notification('AREX — Pomodoro', { body: msg, icon: 'icon.svg' });
  addMsg('arex', msg);
  _pom.mode = wasWork ? 'short' : 'work';
  _pom.elapsed = 0;
  _pom.total = POMO_TIMES[_pom.mode];
  _pomRender();
}

function togglePomodoro() {
  if (_pom.running) {
    clearInterval(_pom.interval); _pom.running = false; _pom.interval = null;
  } else {
    _pom.interval = setInterval(() => { _pom.elapsed++; if (_pom.elapsed >= _pom.total) { _pomDone(); } else { _pomRender(); } }, 1000);
    _pom.running = true;
  }
  _pomRender();
}

function resetPomodoro(mode) {
  clearInterval(_pom.interval);
  _pom.running = false; _pom.interval = null;
  _pom.mode = mode || 'work';
  _pom.elapsed = 0;
  _pom.total = POMO_TIMES[_pom.mode];
  _pomRender();
}

function togglePomodoroWidget() {
  const el = document.getElementById('pomo-widget');
  if (!el) return;
  el.classList.toggle('hidden');
  if (!el.classList.contains('hidden')) _pomRender();
}
window.togglePomodoro       = togglePomodoro;
window.resetPomodoro        = resetPomodoro;
window.togglePomodoroWidget = togglePomodoroWidget;

// ── TIPO DE CAMBIO MXN/USD ────────────────────────────────────────────────────
const FX_CACHE_KEY = 'arex_fx_cache';
const FX_TTL       = 60 * 60 * 1000;

async function fetchExchangeRate() {
  const cached = localStorage.getItem(FX_CACHE_KEY);
  if (cached) {
    const { rate, ts } = JSON.parse(cached);
    if (Date.now() - ts < FX_TTL) return rate;
  }
  const apis = [
    async () => {
      const r = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN');
      if (!r.ok) return null;
      const d = await r.json();
      return d.rates?.MXN || null;
    },
    async () => {
      const r = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!r.ok) return null;
      const d = await r.json();
      return d.rates?.MXN || null;
    }
  ];
  for (const api of apis) {
    try {
      const rate = await api();
      if (rate) {
        localStorage.setItem(FX_CACHE_KEY, JSON.stringify({ rate, ts: Date.now() }));
        return rate;
      }
    } catch { /* intenta siguiente */ }
  }
  return null;
}

async function renderExchangeWidget() {
  const el = document.getElementById('dash-fx-widget');
  if (!el) return;
  el.innerHTML = '<div style="font-size:0.62rem;color:var(--text-muted);letter-spacing:1px">Cargando...</div>';
  const rate = await fetchExchangeRate();
  if (!rate) { el.innerHTML = '<div style="font-size:0.62rem;color:var(--text-muted)">Sin datos · sin conexión</div>'; return; }
  const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || '{}');
  const upd = cached.ts ? new Date(cached.ts).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' }) : '';
  el.innerHTML = `
    <div class="fx-main">
      <span class="fx-pair">1 USD</span>
      <span class="fx-arrow">→</span>
      <span class="fx-rate">$${rate.toFixed(2)} <span class="fx-unit">MXN</span></span>
    </div>
    <div class="fx-upd">Actualizado ${upd} · frankfurter.app</div>`;
}
window.renderExchangeWidget = renderExchangeWidget;

// Fix keyboard/viewport jump on mobile
(function fixMobileVH() {
  const update = () => {
    const h = (window.visualViewport?.height ?? window.innerHeight);
    document.documentElement.style.setProperty('--real-vh', h + 'px');
  };
  window.visualViewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  update();
})();
