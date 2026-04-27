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
const RESERVED_CMDS = ['ayuda','limpiar','examen','resumir','exportar','notas','stats','recordar','contexto','config','atajos','memoria','run'];

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
  const entries = loadMemoria();
  if (!entries.length) return '';
  return `\n\nMEMORIA PERMANENTE (datos que Alexiz guardó para referencia constante):\n${entries.map((e, i) => `${i + 1}. ${e.text}`).join('\n')}`;
}

/* ── System prompt ──────────────────────────────────── */
const SYSTEM_BASE = `
Eres AREX, el sistema de inteligencia personal de Alexiz.
Tu nombre nace de Alexiz y Margaret — las dos personas más importantes en su vida.

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

ÁREAS DE EXPERTISE:
1. PROGRAMACIÓN: HTML, CSS, JavaScript. Explica el concepto antes del código. Comenta el código clave.
2. UNIVERSIDAD: trabajos, proyectos, exámenes, resúmenes, análisis, ensayos.
3. NEGOCIOS: estrategia, ideas, propuestas, análisis, decisiones.
4. FINANZAS PERSONALES: presupuestos, ahorro, inversión, control de gastos.
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

REGLAS:
- Responde SIEMPRE en español.
- 3-5 líneas por defecto. Expándete si Alexiz pide más detalle.
- Código: describe brevemente qué hace (1 línea), luego el bloque de código completo.
- Señala errores o mejores enfoques directamente.
- Si hay riesgos, menciónalos con claridad.
- Cuando tengas resultados de búsqueda web, úsalos e indica las fuentes.

FRASES CARACTERÍSTICAS (úsalas cuando sea natural):
"Sistemas en línea." | "Procesando, Alexiz." | "Entendido."
"Aquí el análisis." | "Datos disponibles." | "Operación completada."
`.trim();

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

/* ── PDF.js worker ──────────────────────────────────── */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ── Estado global ──────────────────────────────────── */
let history    = [];
let voiceOn    = false;
let searchOn   = false;
let examMode   = false;
let isSpeaking = false;
let isBusy     = false;

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

/* ── Métrica de memoria ─────────────────────────────── */
function updateMemMetric() {
  const c = history.length;
  barMem.style.width = Math.min(100, Math.round((c/40)*100)) + '%';
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
  wrap.innerHTML = `<span class="who">${role==='user'?'TÚ':'AREX'}</span><div class="bubble">${contentHTML}</div>${srcHTML}`;
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
function wrapCodeIfNeeded(code) {
  if (/<!DOCTYPE|<html/i.test(code)) return code;
  if (!/^\s*</.test(code)) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;background:#020c14;color:#e0f4ff;font-family:'Courier New',monospace;display:flex;align-items:center;justify-content:center;min-height:100vh;}</style></head><body><script>${code}<\/script></body></html>`;
  }
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box}body{margin:0;background:#020c14;color:#e0f4ff;}</style></head><body>${code}</body></html>`;
}
function runInIframe(code) {
  document.getElementById('cp-iframe').srcdoc = wrapCodeIfNeeded(code);
}
function openCodePanel(code) {
  document.getElementById('cp-editor').value = code;
  document.getElementById('code-panel').classList.remove('hidden');
  switchCpTab('preview');
  // requestAnimationFrame asegura que el iframe esté pintado antes de cargar el código
  requestAnimationFrame(() => requestAnimationFrame(() => runInIframe(code)));
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
  wrap.innerHTML = `<span class="who">AREX</span><div class="bubble"></div><div class="run-wrap"></div>${srcHTML}`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap;
}
async function renderArexReply(wrap, text) {
  await typewrite(wrap.querySelector('.bubble'), text);
  const code = extractCodeBlock(text);
  if (code) {
    const btn = document.createElement('button');
    btn.className = 'run-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><polygon points="5 3 19 12 5 21 5 3"/></svg> EJECUTAR EN AREX';
    btn.onclick = () => openCodePanel(code);
    wrap.querySelector('.run-wrap').appendChild(btn);
  }
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

/* ── Comandos de voz ────────────────────────────────── */
const VOICE_CMDS = [
  { phrases:['limpiar chat','borrar chat','limpiar conversación'],  cmd:'/limpiar'  },
  { phrases:['exportar chat','descargar chat','exportar conversación'], cmd:'/exportar' },
  { phrases:['modo examen','activar examen','modo de examen'],      cmd:'/examen'   },
  { phrases:['abrir notas','ver notas','mis notas'],                cmd:'/notas'    },
  { phrases:['ver estadísticas','estadísticas del sistema'],        cmd:'/stats'    },
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
    const transcript = e.results[0][0].transcript;
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
  if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js no disponible. Recarga la página.');
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
      reply = await analyzeImage(dataURL, txt.value.trim() || 'Analiza esta imagen detalladamente.');
      txt.value = '';
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
  const systemPrompt = SYSTEM_BASE + (examMode ? EXAM_ADDON : '') + buildContextSection() + buildMemoriaSection();
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
    body: JSON.stringify({ model:'llama-3.3-70b-versatile', max_tokens: examMode ? 1500 : 1000,
      messages: [{ role:'system', content: systemPrompt }, ...messages] })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
  const data = await res.json();
  return data.choices[0].message.content;
}

/* ── Llamada a Groq (visión) ────────────────────────── */
async function analyzeImage(dataURL, question) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
    body: JSON.stringify({
      model:'llama-3.2-11b-vision-preview', max_tokens:1000,
      messages:[{ role:'user', content:[
        { type:'image_url', image_url:{ url: dataURL } },
        { type:'text', text: question }
      ]}]
    })
  });
  if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(`${res.status} — ${e?.error?.message||'Error de API'}`); }
  const data = await res.json();
  return data.choices[0].message.content;
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
    const q = query(collection(db,'conversations'), orderBy('timestamp','desc'), limit(20));
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

/* ── Auto-resumen al llegar a 30 mensajes ───────────── */
async function autoSummarize() {
  if (history.length < 30) return;
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${AREX_CONFIG.groqKey}` },
      body: JSON.stringify({
        model:'llama-3.3-70b-versatile', max_tokens:400,
        messages:[{ role:'user', content:`Resume en puntos clave esta conversación:\n\n${
          history.map(m=>`${m.role==='user'?'Alexiz':'AREX'}: ${m.content}`).join('\n')
        }` }]
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const summary = data.choices[0].message.content;
    history = [{ role:'assistant', content:`[Resumen de conversación anterior]\n${summary}` }, ...history.slice(-4)];
    updateMemMetric();
  } catch(e) { console.warn('Auto-summarize:', e); }
}

/* ── Recordatorios ──────────────────────────────────── */
async function requestNotifPerm() {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}
function scheduleReminder(ms, message) {
  setTimeout(() => {
    if (Notification.permission === 'granted') {
      new Notification('AREX — Recordatorio', { body: message, icon:'icon.svg' });
    }
    addMsg('arex', `⏰ Recordatorio: ${message}`);
    if (voiceOn) arexSpeak(`Recordatorio: ${message}`);
  }, ms);
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
        const summaryText = data.choices[0].message.content;
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

    case 'recordar': {
      await requestNotifPerm();
      const parsed = parseReminder(args);
      if (!parsed) { addMsg('arex','Formato: /recordar 30min mensaje · /recordar 2h mensaje · /recordar 20:00 mensaje'); break; }
      scheduleReminder(parsed.ms, parsed.msg);
      const mins = Math.round(parsed.ms / 60000);
      addMsg('arex', `Recordatorio programado: "${parsed.msg}" en ${mins < 60 ? mins+' minutos' : (mins/60).toFixed(1)+' horas'}.`);
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
      document.getElementById('cfg2-fb-key').value     = fb.apiKey            || '';
      document.getElementById('cfg2-fb-domain').value  = fb.authDomain        || '';
      document.getElementById('cfg2-fb-project').value = fb.projectId         || '';
      document.getElementById('cfg2-fb-bucket').value  = fb.storageBucket     || '';
      document.getElementById('cfg2-fb-sender').value  = fb.messagingSenderId || '';
      document.getElementById('cfg2-fb-app').value     = fb.appId             || '';
      document.getElementById('cfg2-ok').style.display    = 'none';
      document.getElementById('cfg2-error').style.display = 'none';
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
      else { addMsg('arex','No encontré código en el historial reciente. Pídeme que genere código HTML/JS primero.'); }
      break;
    }

    case 'memoria': {
      const memoriaModal = document.getElementById('modal-memoria');
      const memoriaList  = document.getElementById('memoria-list');
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

    default:
      addMsg('arex',`Comando no reconocido: /${name}. Escribe /ayuda para ver los disponibles.`);
  }
}

/* ── Flujo principal ────────────────────────────────── */
async function handleSend() {
  if (isBusy) return;
  const msg = txt.value.trim();
  if (!msg) return;
  txt.value = '';

  if (msg.startsWith('/')) { await handleCommand(msg); return; }

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
    const reply = await callGroq(webCtx);
    history.push({ role:'assistant', content: reply });
    await saveMsg('assistant', reply);
    updateMemMetric();

    hideThinking();
    const sources = webCtx?.results?.slice(0,3) || null;
    let srcHTML = '';
    if (sources?.length) {
      srcHTML = `<div class="sources">FUENTES: ${sources.map((s,i)=>`<a href="${s.url}" target="_blank" rel="noopener noreferrer">[${i+1}] ${s.title||s.url}</a>`).join(' · ')}</div>`;
    }
    const wrap = makeArexWrap(srcHTML);
    await renderArexReply(wrap, reply);
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
btnSend.addEventListener('click', handleSend);
txt.addEventListener('keydown', e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSend();} });
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
[modalStats, modalHelp, modalConfig, modalContext, modalAtalos, modalMemoria].forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.add('hidden'); }));

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

// Sidebar: abrir / cerrar
document.getElementById('btn-sidebar').addEventListener('click', openSidebar);
document.getElementById('btn-sidebar-close').addEventListener('click', closeSidebar);
document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

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
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW:', e));
}

/* ── Secuencia de arranque ──────────────────────────── */
async function boot() {
  const lines = [
    'Iniciando AREX v3.0...',
    'Cargando módulos de IA...',
    'Conectando Firebase...',
    'Restaurando memoria de sesión...',
    'Cargando sistema de voz...',
    'Activando búsqueda web...',
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

  await new Promise(r => setTimeout(r, 400));
  bootScreen.style.transition = 'opacity 0.6s';
  bootScreen.style.opacity = '0';
  await new Promise(r => setTimeout(r, 600));
  bootScreen.style.display = 'none';
  txt.focus();
}

// Punto de entrada — siempre registrar el handler del setup
setupSaveHandler();

if (loadConfig()) {
  initFirebase();
  boot();
} else {
  showSetup();
}
