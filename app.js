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

REGLAS:
- Responde SIEMPRE en español.
- 3-5 líneas por defecto. Expándete si Alexiz pide más detalle.
- Código: explica el concepto primero (1-2 líneas), luego el código comentado.
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
const SESSION = Date.now().toString();
function initFirebase() {
  if (!AREX_CONFIG.firebase?.apiKey) return;
  try {
    const fbApp = initializeApp(AREX_CONFIG.firebase);
    db = getFirestore(fbApp);
  } catch(e) { console.warn('Firebase init:', e); }
}

/* ── PDF.js worker ──────────────────────────────────── */
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

/* ── Estado global ──────────────────────────────────── */
let history   = [];
let voiceOn   = false;
let searchOn  = false;
let examMode  = false;
let isSpeaking = false;

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
const statsGrid    = document.getElementById('stats-grid');

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
  const safe = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\n/g,'<br>');
  let srcHTML = '';
  if (sources?.length) {
    srcHTML = `<div class="sources">FUENTES: ${
      sources.map((s,i) => `<a href="${s.url}" target="_blank">[${i+1}] ${s.title||s.url}</a>`).join(' · ')
    }</div>`;
  }
  wrap.innerHTML = `<span class="who">${role==='user'?'TÚ':'AREX'}</span><div class="bubble">${safe}</div>${srcHTML}`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;
  return wrap.querySelector('.bubble');
}

/* ── Typewriter ─────────────────────────────────────── */
function typewrite(bubble, text) {
  return new Promise(resolve => {
    const safe = text
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\n/g,'<br>');
    const words = safe.split(' ');
    let i = 0;
    bubble.innerHTML = '';
    const iv = setInterval(() => {
      if (i < words.length) {
        bubble.innerHTML += (i > 0 ? ' ' : '') + words[i++];
        chat.scrollTop = chat.scrollHeight;
      } else { clearInterval(iv); resolve(); }
    }, 36);
  });
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

/* ── Reconocimiento de voz ──────────────────────────── */
function startListening() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { addMsg('arex','Reconocimiento de voz no disponible en este navegador.'); return; }
  const rec = new SR();
  rec.lang = 'es-MX'; rec.interimResults = false; rec.maxAlternatives = 1;
  btnMic.classList.add('on');
  setOrb('listening','Escuchando...');
  rec.onresult = e => {
    btnMic.classList.remove('on');
    txt.value = e.results[0][0].transcript;
    updateStats('voice');
    handleSend();
  };
  rec.onerror = () => { btnMic.classList.remove('on'); setOrb(null,'En espera de instrucciones'); };
  rec.onend   = () => btnMic.classList.remove('on');
  rec.start();
}

/* ── Búsqueda web Tavily ────────────────────────────── */
async function webSearch(q) {
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

/* ── Procesamiento de archivos ──────────────────────── */
async function extractPDF(file) {
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
  return new Promise(resolve => {
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
    img.src = url;
  });
}

async function handleFile(file) {
  const isPDF = file.type === 'application/pdf';
  const isImg = file.type.startsWith('image/');
  if (!isPDF && !isImg) { addMsg('arex','Formato no soportado. Usa PDF o imagen (JPG, PNG, WEBP).'); return; }

  // Mostrar burbuja de archivo
  document.querySelector('.welcome')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'msg user file';
  wrap.innerHTML = `<span class="who">TÚ</span><div class="bubble">📎 ${file.name}</div>`;
  chat.appendChild(wrap);
  chat.scrollTop = chat.scrollHeight;

  setOrb('thinking', isPDF ? 'Procesando PDF...' : 'Analizando imagen...');
  showThinking();
  await updateStats('file');

  try {
    let reply;
    if (isPDF) {
      const text = await extractPDF(file);
      history.push({ role:'user', content: `[PDF: ${file.name}]\n\n${text}\n\nAnaliza este documento y dime los puntos más importantes.` });
      await saveMsg('user', `[PDF adjunto: ${file.name}]`);
      reply = await callGroq();
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
    hideThinking();
    const wrap2 = document.createElement('div');
    wrap2.className = 'msg arex';
    wrap2.innerHTML = `<span class="who">AREX</span><div class="bubble"></div>`;
    chat.appendChild(wrap2);
    await typewrite(wrap2.querySelector('.bubble'), reply);
    if (voiceOn) arexSpeak(reply); else setOrb(null,'En espera de instrucciones');
  } catch(e) {
    hideThinking();
    addMsg('arex','Error al procesar el archivo. Intenta de nuevo.');
    setOrb(null,'En espera de instrucciones');
    console.error(e);
  }
}

/* ── Llamada a Groq (texto) ─────────────────────────── */
async function callGroq(webCtx) {
  const systemPrompt = SYSTEM_BASE + (examMode ? EXAM_ADDON : '');
  let messages = [...history];

  if (webCtx) {
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = {
      ...last,
      content: `[CONTEXTO WEB]\n${webCtx.answer}\n\n[PREGUNTA]\n${last.content}`
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
  } catch(e) { console.warn('Firebase loadHistory:', e); }
}

/* ── Firebase: notas ────────────────────────────────── */
async function saveNote(text) {
  if (!db) return 'local_' + Date.now();
  const ref = await addDoc(collection(db,'notes'), { text, timestamp:Date.now() });
  return ref.id;
}
async function loadNotes() {
  if (!db) { addMsg('arex','Firebase no configurado. Las notas no persisten entre sesiones.'); return; }
  try {
    const q = query(collection(db,'notes'), orderBy('timestamp','desc'));
    const snap = await getDocs(q);
    notesList.innerHTML = '';
    snap.forEach(d => renderNote(d.id, d.data().text, d.data().timestamp));
  } catch(e) { console.warn('Firebase loadNotes:', e); }
}
function renderNote(id, text, ts) {
  const el = document.createElement('div');
  el.className = 'note-item'; el.dataset.id = id;
  const time = new Date(ts).toLocaleDateString('es-MX', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
  el.innerHTML = `<div class="note-text">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div><div class="note-time">${time}</div><button class="btn-del" title="Eliminar">✕</button>`;
  el.querySelector('.btn-del').onclick = async () => {
    await deleteDoc(doc(db,'notes',id));
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

  switch (name.toLowerCase()) {
    case 'ayuda':
      modalHelp.classList.remove('hidden');
      break;

    case 'limpiar':
      chat.innerHTML = '';
      history = [];
      updateMemMetric();
      addMsg('arex','Chat limpiado. Historial local borrado.');
      break;

    case 'examen':
      examMode = !examMode;
      examBadge.classList.toggle('hidden', !examMode);
      addMsg('arex', examMode
        ? 'Modo examen activado. Responderé con más detalle y estructura.'
        : 'Modo examen desactivado. Volviendo al modo estándar.');
      break;

    case 'resumir': {
      if (history.length < 4) { addMsg('arex','No hay suficiente conversación para resumir.'); break; }
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
        const data = await res.json();
        hideThinking();
        const wrap = document.createElement('div');
        wrap.className = 'msg arex';
        wrap.innerHTML = `<span class="who">AREX</span><div class="bubble"></div>`;
        chat.appendChild(wrap);
        await typewrite(wrap.querySelector('.bubble'), data.choices[0].message.content);
        setOrb(null,'En espera de instrucciones');
      } catch { hideThinking(); addMsg('arex','Error al generar el resumen.'); setOrb(null,'En espera de instrucciones'); }
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

    default:
      addMsg('arex',`Comando no reconocido: /${name}. Escribe /ayuda para ver los disponibles.`);
  }
}

/* ── Flujo principal ────────────────────────────────── */
async function handleSend() {
  const msg = txt.value.trim();
  if (!msg) return;
  txt.value = '';

  if (msg.startsWith('/')) { await handleCommand(msg); return; }

  addMsg('user', msg);
  history.push({ role:'user', content: msg });
  await saveMsg('user', msg);
  await updateStats('message');

  let webCtx = null;
  if (searchOn) {
    setOrb('searching','Buscando en la web...');
    webCtx = await webSearch(msg);
    await updateStats('search');
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
    const sources = webCtx ? webCtx.results.slice(0,3) : null;
    document.querySelector('.welcome')?.remove();
    const wrap = document.createElement('div');
    wrap.className = 'msg arex';
    let srcHTML = '';
    if (sources?.length) {
      srcHTML = `<div class="sources">FUENTES: ${sources.map((s,i)=>`<a href="${s.url}" target="_blank">[${i+1}] ${s.title||s.url}</a>`).join(' · ')}</div>`;
    }
    wrap.innerHTML = `<span class="who">AREX</span><div class="bubble"></div>${srcHTML}`;
    chat.appendChild(wrap);
    chat.scrollTop = chat.scrollHeight;

    await typewrite(wrap.querySelector('.bubble'), reply);
    if (voiceOn) arexSpeak(reply); else setOrb(null,'En espera de instrucciones');

  } catch(err) {
    hideThinking();
    const msg = err.message?.includes('401') ? 'API Key inválida o revocada. Ve a console.groq.com y genera una nueva key.' :
                err.message?.includes('429') ? 'Límite de requests alcanzado. Espera un momento e intenta de nuevo.' :
                err.message?.includes('Failed to fetch') ? 'Sin conexión a internet o CORS bloqueado.' :
                `Error: ${err.message}`;
    addMsg('arex', msg);
    setOrb(null,'En espera de instrucciones');
    console.error(err);
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
});

btnSearch.addEventListener('click', () => {
  searchOn = !searchOn;
  btnSearch.classList.toggle('active', searchOn);
  addMsg('arex', searchOn ? 'Búsqueda web activada. Consultaré fuentes en tiempo real.' : 'Búsqueda web desactivada.');
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
  const id = await saveNote(t);
  renderNote(id, t, Date.now());
  noteInput.value = '';
});
noteInput.addEventListener('keydown', async e => {
  if (e.key==='Enter') { const t=noteInput.value.trim(); if(!t)return; const id=await saveNote(t); renderNote(id,t,Date.now()); noteInput.value=''; }
});

// Modales
document.getElementById('btn-close-stats').addEventListener('click', () => modalStats.classList.add('hidden'));
document.getElementById('btn-close-help').addEventListener('click',  () => modalHelp.classList.add('hidden'));
[modalStats, modalHelp].forEach(m => m.addEventListener('click', e => { if(e.target===m) m.classList.add('hidden'); }));

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
