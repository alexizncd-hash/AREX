// AREX — Visión en vivo · MARK IV
// Full-screen HUD · Groq Scout first · Gemini fallback
// Personas conocidas · Prompts dinámicos · Modo continuo reactivo
// Gesture Engine · Voice Commands · JARVIS HUD

/* ─── State ───────────────────────────────────────────── */
let _stream       = null;
let _video        = null;
let _panel        = null;
let _resultTimer  = null;
let _contOn       = false;
let _contRunning  = false;
let _contCycle    = 0;
let _busy         = false;
let _arMode       = false;
let _busyTimer    = null;
let _facingMode   = 'environment';
let _voiceOn      = true;
let _iosKa        = null;

// Gesture + voice command state
let _gestureOn      = false;
let _voiceCmdOn     = false;
let _vsr            = null;    // SpeechRecognition instance
let _vsrRunning     = false;
let _moduleGridVis  = false;
let _telTimer       = null;
let _cmdFeedbackT   = null;
let _lastInterim    = '';

// New Mark IV state
let _hudModuleId    = null;
let _gestureMapCache= null;
let _contWasPaused  = false;
let _busyCont       = false;
let _lastPixels     = null;
let _noMotionCnt    = 0;
let _lastContTxt    = '';
let _motionCanvas   = null;   // reused canvas for pixel diff (avoids GC pressure)
let _captureCanvas  = null;   // reused canvas for frame capture (avoids GC pressure)
let _tapAnalyzing  = false;
let _longPressTimer= null;
let _askBarVisible = false;
let _opening       = false;   // guard: getUserMedia en curso (evita doble apertura)
let _greetTimer    = null;    // saludo "Visión activa" — se cancela al cerrar

// Vision Workspace state (full module panels + mini-chat in vision)
let _wkOn    = false;
let _wkModId = localStorage.getItem('arex_vision_wkmod') || 'tareas';

// JARVIS AR extras
let _hudTimer  = null;
let _audioCtx  = null;

/* ─── JARVIS Audio FX ─────────────────────────────────── */
function _jarvisSound(type) {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ctx = _audioCtx;
    const t   = ctx.currentTime;
    if (type === 'scan') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(1400, t); o.frequency.linearRampToValueAtTime(600, t + 0.28);
      g.gain.setValueAtTime(0.12, t); g.gain.linearRampToValueAtTime(0, t + 0.28);
      o.start(t); o.stop(t + 0.28);
    } else if (type === 'result') {
      [800, 1100].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.09, t + i * 0.1); g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.14);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.14);
      });
    } else if (type === 'open') {
      [440, 660, 880, 1100].forEach((freq, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.09, t + i * 0.07); g.gain.linearRampToValueAtTime(0, t + i * 0.07 + 0.14);
        o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.14);
      });
    } else if (type === 'action') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'square'; o.frequency.value = 420;
      g.gain.setValueAtTime(0.07, t); g.gain.linearRampToValueAtTime(0, t + 0.1);
      o.start(t); o.stop(t + 0.1);
    } else if (type === 'error') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sawtooth'; o.frequency.value = 180;
      g.gain.setValueAtTime(0.09, t); g.gain.linearRampToValueAtTime(0, t + 0.35);
      o.start(t); o.stop(t + 0.35);
    }
  } catch {}
}

/* ─── Live HUD Data ───────────────────────────────────── */
function _updateVisionHudData() {
  if (!_panel) return;
  try {
    const now = new Date();
    const timeEl = document.getElementById('vis-dr-time');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const tasks  = JSON.parse(localStorage.getItem('arex_tareas') || '[]');
    const pend   = tasks.filter(t => !t.done);
    const venc   = pend.filter(t => t.fecha && new Date(t.fecha) < now).length;
    const taskEl = document.getElementById('vis-dr-tasks');
    if (taskEl) taskEl.textContent = `${pend.length} tareas`;
    const metas  = JSON.parse(localStorage.getItem('arex_metas') || '[]');
    const metEl  = document.getElementById('vis-dr-metas');
    if (metEl) metEl.textContent = `${metas.filter(m => !m.completada).length} metas`;
    const fd     = JSON.parse(localStorage.getItem('arex_finanzas_overrides') || localStorage.getItem('arex_finanzas') || '{}');
    const saldo  = fd.saldoCuenta ?? fd.ingresoMensual ?? null;
    const finEl  = document.getElementById('vis-dr-fin');
    if (finEl) finEl.textContent = saldo != null ? `$${Number(saldo).toLocaleString('es-MX')}` : '···';
    // Corner widgets
    const cwTasks = document.getElementById('vis-cw-tasks');
    if (cwTasks) cwTasks.innerHTML = `<span>${pend.length} pend.${venc ? ` · <span style="color:#ff6655">${venc} venc.</span>` : ''}</span>`;
    const cwFin = document.getElementById('vis-cw-fin');
    if (cwFin) cwFin.textContent = saldo != null ? `$${Number(saldo).toLocaleString('es-MX')}` : '···';
  } catch {}
}

/* ─── Radial Menu ─────────────────────────────────────── */
window._toggleRadial = function() {
  const rm = document.getElementById('vis-radial');
  if (!rm) return;
  const isOpen = rm.classList.contains('vr-open');
  if (isOpen) { _closeRadialEl(rm); } else { _openRadialEl(rm); }
};
window._closeRadial = function() {
  _closeRadialEl(document.getElementById('vis-radial'));
};
function _openRadialEl(rm) {
  if (!rm) return;
  rm.classList.add('vr-open');
  rm.setAttribute('aria-hidden', 'false');
  _jarvisSound('action');
  document.getElementById('vis-radial-btn')?.classList.add('on');
}
function _closeRadialEl(rm) {
  if (!rm) return;
  rm.classList.remove('vr-open');
  rm.setAttribute('aria-hidden', 'true');
  document.getElementById('vis-radial-btn')?.classList.remove('on');
}

/* ─── Personas conocidas ──────────────────────────────── */
function _loadPersonas() {
  try { return JSON.parse(localStorage.getItem('arex_personas') || '[]'); } catch { return []; }
}
function _savePersonas(arr) { localStorage.setItem('arex_personas', JSON.stringify(arr)); }

function _personasCtxStr() {
  const arr = _loadPersonas();
  if (!arr.length) return '';
  return '\n\nPersonas conocidas (si la persona visible coincide con alguna descripción, salúdala por su nombre con energía JARVIS):\n' +
    arr.map(p => `- ${p.nombre}: ${p.descripcion}`).join('\n');
}

/* ─── Cross-module context ────────────────────────────── */
function _getCrossCtx() {
  try {
    const tasks  = JSON.parse(localStorage.getItem('arex_tareas')      || '[]');
    const metas  = JSON.parse(localStorage.getItem('arex_metas')       || '[]');
    const gastos = JSON.parse(localStorage.getItem('arex_gastos_pers') || '[]');
    const now    = new Date();
    const venc   = tasks.filter(t => !t.done && t.fecha && new Date(t.fecha) < now).length;
    const pend   = tasks.filter(t => !t.done).length;
    const mact   = metas.filter(m => !m.completada).length;
    const gMes   = gastos.filter(g => {
      const d = new Date(g.fecha);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, g) => s + (g.monto || 0), 0);
    return `\n\n[Estado actual de Alexiz]\n• Tareas: ${pend} pendientes (${venc} vencidas)\n• Metas activas: ${mact}\n• Gasto este mes: $${gMes.toLocaleString('es-MX')} MXN`;
  } catch { return ''; }
}

/* ─── Prompts dinámicos ───────────────────────────────── */
// Los modelos AI rechazan "identificar" personas, pero SÍ describen características físicas.
// La estrategia: describir apariencia visual → usuario guardó descripciones → el modelo hace matching.
function _buildVisionPrompt(mode) {
  const pc = _personasCtxStr();

  const ctx = _getCrossCtx();
  if (mode === 'describe') {
    if (_contOn && _contCycle > 1) {
      const prevHint = _lastContTxt
        ? ` Antes observaste: "${_lastContTxt.slice(0, 120).trim()}".`
        : '';
      return `Eres AREX, el asistente de Alexiz. Sigues observando en vivo.${prevHint}${pc}${ctx}

Dime algo nuevo o interesante de lo que ves ahora — si algo cambió respecto a antes, menciónalo. Habla de forma natural y directa, como en una conversación. Si hay alguien conocido, salúdalo. Máximo 2 frases. En español.`;
    }
    return `Eres AREX, el sistema de IA personal de Alexiz (Hermosillo, México). Tienes la cámara apuntando a algo y necesitas describirlo.${pc}${ctx}

Habla como una persona inteligente y observadora, no como si hicieras un inventario. Describe lo que ves de forma natural y conversacional: si hay personas, menciona cómo se ven físicamente (cabello, ropa, expresión, postura) — si alguna coincide con alguien conocido, salúdala por nombre con energía; si hay objetos interesantes o texto visible, cuéntalo de forma fluida; menciona el ambiente o lugar de fondo. Responde en 2-3 frases que suenen como si le hablaras a alguien, no como una lista. En español.`;
  }

  if (mode === 'scene') {
    return `Eres AREX. Alexiz quiere que le describas todo lo que está viendo en esta escena.${pc}${ctx}

Cuéntaselo de forma natural, como si estuvieras ahí con él describiendo lo que pasa: quién hay y cómo se ven físicamente, qué objetos o cosas destacan, qué tipo de lugar o ambiente es, qué está pasando. Si reconoces a alguien de las personas conocidas, nómbralo. Habla fluido, sin listas ni bullet points, como una persona. En español.`;
  }

  // product y text usan prompts estáticos (no aplica el problema de personas)
  return PROMPTS_STATIC[mode] || PROMPTS_STATIC.product;
}

/* ─── Prompts estáticos (producto y texto) ────────────── */
const PROMPTS_STATIC = {
  product: `Eres AREX identificando un objeto/producto para Alexiz. Analiza con el MÁXIMO DETALLE posible. Responde EXACTAMENTE así:

**Objeto:** [nombre específico]
**Marca:** [marca exacta o "No visible"]
**Modelo:** [modelo/serie si es visible]
**Color:** [colores exactos]
**Material:** [material principal]
**Descripción:** [características específicas en 1-2 líneas]
**Precio estimado MX:** [$X,XXX – $XX,XXX MXN aprox]
**Dónde comprar:** Amazon.com.mx · MercadoLibre · [tiendas específicas]

Si no identificas el objeto exacto, describe TODOS los detalles visuales. En español.`,

  text: `Lee y transcribe EXACTAMENTE todo el texto visible en esta imagen, incluidos números, signos y símbolos. Mantén el orden original con saltos de línea. Si hay texto en inglés, transcríbelo igual. Responde en español solo el encabezado "Texto encontrado:" y luego el texto tal cual.`,

  recibo: `Eres AREX procesando un TICKET/RECIBO de compra para registrar el gasto de Alexiz. Lee el recibo y extrae los datos. Responde EXACTAMENTE en este formato, sin texto adicional:

**Total:** [solo el número del total final pagado, ej: 247.50]
**Comercio:** [nombre del establecimiento o "Desconocido"]
**Fecha:** [fecha del ticket en formato YYYY-MM-DD, o "hoy" si no es legible]
**Categoria:** [UNA de estas exactamente: comida, transporte, entretenimiento, salud, ropa, hogar, educacion, otro]
**Resumen:** [productos principales en máximo 8 palabras]

Si no logras leer el total claramente, pon "Total: 0". En español.`,
};

const MODE_LABELS = {
  describe: '👁 VER',
  product:  '🔍 OBJETO',
  text:     '📄 TEXTO',
  scene:    '🌐 ESCENA',
  recibo:   '🧾 RECIBO',
};

const MODE_RES = { describe: 420, product: 600, text: 640, scene: 600, recibo: 720 };

/* ─── Region Capture (tap to analyze) ────────────────── */
async function _captureRegion(relX, relY, frac = 0.50) {
  if (!_video || _video.videoWidth === 0) return null;
  if (_video.paused) { try { await _video.play(); } catch { return null; } }
  const vw = _video.videoWidth, vh = _video.videoHeight;
  const size = Math.min(vw, vh) * frac;
  const cx = relX * vw, cy = relY * vh;
  const sx = Math.max(0, Math.min(cx - size / 2, vw - size));
  const sy = Math.max(0, Math.min(cy - size / 2, vh - size));
  const rw = Math.min(size, vw - sx), rh = Math.min(size, vh - sy);
  const out = 320;
  const cv = document.createElement('canvas');
  cv.width = out; cv.height = Math.round(out * rh / rw);
  cv.getContext('2d').drawImage(_video, sx, sy, rw, rh, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', 0.80);
  return dataUrl.length < 3000 ? null : dataUrl;
}

function _drawTapReticle(x, y) {
  const cv = document.getElementById('vis-tap-canvas');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const r = 44;
  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,212,255,0.85)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Inner ring
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0,212,255,0.55)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // Crosshairs
  const arm = r * 0.7;
  ctx.strokeStyle = 'rgba(0,212,255,0.75)';
  ctx.lineWidth = 1.5;
  [[x - arm, y, x - r * 0.15, y], [x + r * 0.15, y, x + arm, y],
   [x, y - arm, x, y - r * 0.15], [x, y + r * 0.15, x, y + arm]].forEach(([x1,y1,x2,y2]) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  });
  // Label
  ctx.font = '9px "JetBrains Mono", monospace';
  ctx.fillStyle = 'rgba(0,212,255,0.9)';
  ctx.letterSpacing = '2px';
  ctx.fillText('ANALIZANDO', x - 38, y + r + 18);
  // Fade out reticle after 1.8s
  clearTimeout(cv._fadeTimer);
  cv._fadeTimer = setTimeout(() => ctx.clearRect(0, 0, cv.width, cv.height), 1800);
}

async function _handleTapAnalyze(clientX, clientY) {
  if (_tapAnalyzing || _busy) return;
  _tapAnalyzing = true;
  const vid = document.getElementById('vis-video');
  if (!vid) { _tapAnalyzing = false; return; }
  const rect = vid.getBoundingClientRect();
  const relX = (clientX - rect.left)  / rect.width;
  const relY = (clientY - rect.top)   / rect.height;
  // Mirror X for front camera
  const adjX = _facingMode === 'user' ? 1 - relX : relX;

  // Show reticle on tap canvas
  const cv = document.getElementById('vis-tap-canvas');
  if (cv) {
    cv.width  = rect.width;
    cv.height = rect.height;
    _drawTapReticle(clientX - rect.left, clientY - rect.top);
  }

  _setStatus('ENFOCANDO...');
  try {
    const frame = await _captureRegion(adjX, relY, 0.55);
    if (!frame) { _setStatus('LISTO'); _tapAnalyzing = false; return; }
    const groqKey = window.AREX_CONFIG?.groqKey;
    const gemKey  = window.AREX_CONFIG?.geminiKey;
    const prompt  = `Eres AREX. Alexiz apuntó a una zona específica de la cámara. Descríbela en 1-2 oraciones naturales y directas: qué es, qué hace, algo interesante. Si hay texto, léelo. En español.`;
    _setStatus('ANALIZANDO ZONA...');
    let reply;
    if (groqKey) { try { reply = await _withTimeout(_callGroq(frame, prompt, groqKey, true), 10000); } catch {} }
    if (!reply && gemKey) { try { reply = await _withTimeout(_callGemini(frame, prompt, gemKey), 10000); } catch {} }
    if (reply) {
      _showResult('🎯 ZONA', reply, frame, 'describe');
      _visionSpeak(reply);
    }
  } catch (e) { console.warn('tap analyze:', e); }
  finally { _tapAnalyzing = false; _setStatus(_contOn ? 'SMART · EN ESPERA' : 'LISTO'); }
}

/* ─── Public API ──────────────────────────────────────── */
export async function openVision() {
  if (_panel) { _panel.style.display = 'flex'; _video?.play(); return; }
  if (_opening) return;   // doble tap durante getUserMedia → evita doble stream/panel
  if (!navigator.mediaDevices?.getUserMedia) {
    _say('Cámara no disponible en este navegador.'); return;
  }
  _opening = true;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: _facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    _opening = false;
    _say(`No se pudo acceder a la cámara.\n\n${e.message}`); return;
  }
  _opening = false;
  _stream = stream;
  _buildPanel();
  document.getElementById('btn-vision')?.classList.add('active');
  clearTimeout(_greetTimer);
  _greetTimer = setTimeout(() => { if (_panel) { _jarvisSound('open'); _visionSpeak('Visión activa. Aquí contigo.'); } }, 600);
  _hudTimer = setInterval(_updateVisionHudData, 5000);
  _updateVisionHudData();
}

export function closeVision() {
  _contOn      = false;
  _contRunning = false;
  _contCycle   = 0;
  if (_arMode && typeof window.stopContinuousMode === 'function') {
    window.stopContinuousMode();
  }
  _arMode = false;
  _hudModuleId  = null;
  _motionCanvas = null;
  _captureCanvas = null;
  _lastPixels   = null;
  _wkOn         = false;
  window.speechSynthesis?.cancel();
  _stopIosKa();
  clearTimeout(_resultTimer);
  clearTimeout(_greetTimer);
  clearTimeout(_busyTimer);
  clearTimeout(_cmdFeedbackT);
  clearTimeout(_longPressTimer);
  clearInterval(_telTimer);
  _telTimer = null;
  clearInterval(_hudTimer);
  _hudTimer = null;
  _busy     = false;
  _busyCont = false;
  _moduleGridVis = false;
  // Stop gesture engine
  if (_gestureOn) { _gestureOn = false; if (typeof stopGestureEngine === 'function') stopGestureEngine(); }
  // Stop voice commands
  _voiceCmdOn = false;
  _stopVoiceCmd();
  // Restore JARVIS AR mode if we paused it when vision voice started
  if (_contWasPaused) {
    _contWasPaused = false;
    setTimeout(() => { if (!window._arexContModeActive) window.toggleContinuousMode?.(); }, 700);
  }
  _stream?.getTracks().forEach(t => t.stop());
  _stream = null; _video = null;
  window.VisionOrb?.destroy();
  _panel?._cleanupResize?.();
  _panel?.remove(); _panel = null;
  document.getElementById('btn-vision')?.classList.remove('active');
}

// Llamado desde webxr.js cuando se activa el modo CAM AR
export function setVisionArMode(active) {
  _arMode = active;
  if (active && _panel) {
    // Mostrar badge AR en el panel de visión
    if (!_panel.querySelector('.vp-ar-badge')) {
      const badge = document.createElement('div');
      badge.className = 'vp-ar-badge';
      badge.id = 'vp-ar-badge';
      badge.textContent = '🎙 MODO AR · DI "AREX" + COMANDO';
      _panel.appendChild(badge);
    }
  } else {
    document.getElementById('vp-ar-badge')?.remove();
  }
}

window.setVisionArMode   = setVisionArMode;
window._setVisionArMode  = setVisionArMode;

export async function captureAndAnalyze(mode = 'describe', extra = '') {
  if (!_stream) {
    await openVision();
    if (!_stream) return;
    await new Promise(r => setTimeout(r, 1000));
  }
  await _analyze(mode, extra);
}

window.openVision        = openVision;
window.closeVision       = closeVision;
window.captureAndAnalyze = captureAndAnalyze;

/* ─── Panel UI ────────────────────────────────────────── */
const _MODS_GRID = [
  { id:'inicio',     icon:'◈', label:'INICIO' },
  { id:'finanzas',   icon:'💳', label:'FINANZAS' },
  { id:'metas',      icon:'🎯', label:'METAS' },
  { id:'tareas',     icon:'✓',  label:'TAREAS' },
  { id:'notas',      icon:'📝', label:'NOTAS' },
  { id:'negocio',    icon:'📦', label:'NEGOCIO' },
  { id:'gastos',     icon:'💸', label:'GASTOS' },
  { id:'proyectos',  icon:'⚡', label:'PROYECTOS' },
  { id:'evidencias', icon:'🔍', label:'EVIDENCIAS' },
  { id:'control',    icon:'⚙',  label:'CONTROL' },
  { id:'chat',       icon:'▸',  label:'CHAT' },
];

function _buildPanel() {
  const el = document.createElement('div');
  el.id = 'vision-panel';
  el.innerHTML = `
    <video id="vis-video" autoplay playsinline muted></video>
    <canvas id="vis-gesture-canvas" class="vp-gesture-canvas"></canvas>
    <div class="vp-scan-line" id="vis-scan"></div>
    <div class="vp-corner vp-tl"></div>
    <div class="vp-corner vp-tr"></div>
    <div class="vp-corner vp-bl"></div>
    <div class="vp-corner vp-br"></div>
    <!-- 3-D PARTICLE ORB -->
    <canvas id="vis-orb-canvas" class="vp-orb-canvas"></canvas>

    <!-- TOP BAR -->
    <div class="vp-hud-top">
      <div class="vp-title"><span class="vp-dot"></span>AREX · VISIÓN</div>
      <div class="vp-top-btns">
        <button class="vp-icon-btn vp-gesture-btn" id="vis-gesture" title="Gestos">✋</button>
        <button class="vp-icon-btn vp-vcmd-btn"    id="vis-vcmd"    title="Comandos de voz">🎙</button>
        <button class="vp-icon-btn vp-voice-btn on" id="vis-voice"  title="Síntesis de voz">🔊</button>
        <button class="vp-icon-btn" id="vis-personas" title="Personas conocidas">👤</button>
        <button class="vp-icon-btn" id="vis-flip" title="Cambiar cámara">⟳</button>
        <button class="vp-icon-btn vp-close-btn" onclick="closeVision()" title="Cerrar">✕</button>
      </div>
    </div>

    <!-- LIVE DATA RIBBON -->
    <div class="vp-data-ribbon" id="vis-data-ribbon">
      <span id="vis-dr-time">--:--</span>
      <span class="vp-dr-sep">·</span>
      <span id="vis-dr-tasks">··· tareas</span>
      <span class="vp-dr-sep">·</span>
      <span id="vis-dr-metas">··· metas</span>
      <span class="vp-dr-sep">·</span>
      <span id="vis-dr-fin">···</span>
    </div>

    <!-- CINEMATIC SWEEP (enhanced scan overlay) -->
    <div class="vp-sweep-line" id="vis-sweep"></div>

    <!-- LEFT TELEMETRY -->
    <div class="vp-telemetry" id="vis-telemetry">
      <div class="vp-tel-hdr"><span class="vp-tel-dot"></span>TELEMETRÍA</div>
      <div class="vp-tel-row"><span>CAM</span><span id="vis-tel-cam">—</span></div>
      <div class="vp-tel-row"><span>AI</span><span id="vis-tel-ai">${window.AREX_CONFIG?.groqKey ? 'GROQ ⬤' : 'GEMINI ⬤'}</span></div>
      <div class="vp-tel-row"><span>MODO</span><span id="vis-tel-mode">VISUAL</span></div>
      <div class="vp-tel-row"><span>SEÑA</span><span id="vis-tel-gest">—</span></div>
      <div class="vp-tel-row"><span>VOZ</span><span id="vis-tel-voice">—</span></div>
    </div>

    <!-- RIGHT GESTURE GUIDE -->
    <div class="vp-gest-guide" id="vis-gest-guide">
      <div class="vp-tel-hdr"><span class="vp-tel-dot"></span>GESTOS<button class="vp-gg-cfg-btn" id="vis-gest-cfg-btn" title="Configurar gestos">⚙</button></div>
      <div class="vp-gg-row"><span>✋</span><span>ANALIZAR</span></div>
      <div class="vp-gg-row"><span>✊</span><span>DETENER</span></div>
      <div class="vp-gg-row"><span>☝</span><span>MÓDULOS</span></div>
      <div class="vp-gg-row"><span>✌</span><span>AUTO</span></div>
      <div class="vp-gg-row"><span>👍</span><span>VOZ</span></div>
    </div>

    <!-- STATUS BADGE -->
    <div class="vp-status-badge" id="vis-status">
      <span class="vp-status-dot"></span>
      <span id="vis-status-txt">LISTO</span>
    </div>

    <!-- VOICE COMMAND BAR -->
    <div class="vp-voice-bar" id="vis-voice-bar">
      <div class="vp-wave" id="vis-wave">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      <span id="vis-cmd-text">DI "AREX" + COMANDO</span>
    </div>

    <!-- MODULE NAVIGATION GRID -->
    <div class="vp-module-grid" id="vis-module-grid">
      <div class="vp-mg-title">◈ NAVEGAR</div>
      <div class="vp-mg-items">
        ${_MODS_GRID.map(m => `
          <button class="vp-mg-btn" onclick="visNavigate('${m.id}')">
            <span class="vp-mg-ico">${m.icon}</span>
            <span class="vp-mg-lbl">${m.label}</span>
          </button>`).join('')}
      </div>
    </div>

    <!-- GESTURE FLASH (brief fullscreen overlay) -->
    <div class="vp-gesture-flash" id="vis-gest-flash"></div>

    <!-- PERSONAS PANEL -->
    <div class="vp-personas-panel" id="vis-personas-panel">
      <div class="vp-result-hd">
        <span class="vp-result-lbl">👤 PERSONAS CONOCIDAS</span>
        <button class="vp-icon-btn vp-close-btn" id="vis-personas-close">✕</button>
      </div>
      <div id="vis-personas-list" class="vp-personas-list"></div>
      <div class="vp-personas-form">
        <input id="vp-p-nombre" placeholder="Nombre (ej: Margaret)" class="vp-personas-input"/>
        <textarea id="vp-p-desc" placeholder="Descripción física: cabello largo oscuro, piel morena, talla media, usa lentes..." rows="3" class="vp-personas-textarea"></textarea>
        <div id="vp-msg" class="vp-personas-msg"></div>
        <button class="vp-personas-add-btn" id="vp-p-add">+ GUARDAR PERSONA</button>
      </div>
    </div>

    <!-- RESULT PANEL -->
    <div class="vp-result" id="vis-result">
      <div class="vp-result-hd">
        <span class="vp-result-lbl" id="vis-result-lbl">ANÁLISIS</span>
        <button class="vp-icon-btn vp-close-btn" id="vis-result-close" title="Cerrar">✕</button>
      </div>
      <div class="vp-result-inner">
        <img class="vp-result-thumb" id="vis-result-thumb" alt="frame"/>
        <div class="vp-result-body" id="vis-result-body"></div>
      </div>
      <div class="vp-result-actions" id="vis-result-actions"></div>
    </div>

    <canvas id="vis-tap-canvas" class="vp-tap-canvas"></canvas>
    <!-- QUICK ASK BAR -->
    <div class="vp-ask-bar" id="vis-ask-bar">
      <span class="vp-ask-ico">💬</span>
      <input class="vp-ask-input" id="vis-ask-input" placeholder="Pregúntame sobre lo que ves..." autocomplete="off" spellcheck="false"/>
      <button class="vp-ask-send" id="vis-ask-send">▶</button>
    </div>

    <!-- SWIPE HINT -->
    <div class="vp-swipe-hint">TAP = ANALIZAR ZONA · MANTENER = PREGUNTAR LIBRE</div>

    <!-- MODULE HUD (permanece en visión al navegar módulos) -->
    <div class="vp-module-hud" id="vis-module-hud">
      <div class="vp-mhud-header">
        <span class="vp-mhud-icon" id="vis-mhud-icon">◈</span>
        <span class="vp-mhud-title" id="vis-mhud-title">MÓDULO</span>
        <button class="vp-mhud-act-btn" id="vis-mhud-open" data-vaction="open">ABRIR →</button>
        <button class="vp-icon-btn vp-close-btn" id="vis-mhud-close">✕</button>
      </div>
      <div class="vp-mhud-body" id="vis-mhud-body"></div>
      <div class="vp-mhud-actions" id="vis-mhud-actions"></div>
    </div>

    <!-- GESTURE CONFIG PANEL -->
    <div class="vp-gesture-config" id="vis-gesture-config">
      <div class="vp-result-hd">
        <span class="vp-result-lbl">⚙ CONFIGURAR GESTOS</span>
        <button class="vp-icon-btn vp-close-btn" id="vis-gest-config-close">✕</button>
      </div>
      <div class="vp-gest-cfg-list" id="vis-gest-cfg-list"></div>
    </div>

    <!-- VISION WORKSPACE (full module panels + mini-chat while camera runs) -->
    <div id="vis-workspace">
      <div class="vis-wk-topbar">
        <span class="vis-wk-title">◈ <span id="vis-wk-lbl">MÓDULOS</span></span>
        <button class="vis-wk-close" onclick="window._closeWorkspace()">✕</button>
      </div>
      <div class="vis-wk-tabs" id="vis-wk-tabs">
        <button class="vis-wk-tab active" data-wkmod="tareas">TAREAS</button>
        <button class="vis-wk-tab" data-wkmod="gastos">GASTOS</button>
        <button class="vis-wk-tab" data-wkmod="metas">METAS</button>
        <button class="vis-wk-tab" data-wkmod="finanzas">FINANZAS</button>
        <button class="vis-wk-tab" data-wkmod="negocio">NEGOCIO</button>
        <button class="vis-wk-tab" data-wkmod="notas">NOTAS</button>
      </div>
      <div class="vis-wk-body" id="vis-wk-body"></div>
      <div class="vis-wk-msgs" id="vis-wk-msgs"></div>
      <div class="vis-wk-bar">
        <input class="vis-wk-inp" id="vis-wk-inp" placeholder='Dile algo a AREX...' autocomplete="off"/>
        <button class="vis-wk-snd" id="vis-wk-snd">▶</button>
      </div>
    </div>

    <!-- CORNER DATA WIDGETS -->
    <div class="vp-corner-widget vp-cw-bl" id="vis-cw-bl">
      <div class="vp-cw-label">TAREAS</div>
      <div class="vp-cw-val" id="vis-cw-tasks">···</div>
    </div>
    <div class="vp-corner-widget vp-cw-br" id="vis-cw-br">
      <div class="vp-cw-label">FINANZAS</div>
      <div class="vp-cw-val" id="vis-cw-fin">···</div>
    </div>

    <!-- RADIAL ACTION MENU -->
    <div class="vp-radial-menu" id="vis-radial" aria-hidden="true">
      <button class="vp-radial-close" onclick="window._closeRadial()">✕</button>
      <div class="vp-radial-ring">
        <button class="vp-radial-btn" style="--i:0" onclick="captureAndAnalyze('describe');window._closeRadial()">
          <span class="vp-rb-ico">👁</span><span class="vp-rb-lbl">VER</span>
        </button>
        <button class="vp-radial-btn" style="--i:1" onclick="captureAndAnalyze('product');window._closeRadial()">
          <span class="vp-rb-ico">🔍</span><span class="vp-rb-lbl">OBJETO</span>
        </button>
        <button class="vp-radial-btn" style="--i:2" onclick="captureAndAnalyze('text');window._closeRadial()">
          <span class="vp-rb-ico">📄</span><span class="vp-rb-lbl">TEXTO</span>
        </button>
        <button class="vp-radial-btn" style="--i:3" onclick="captureAndAnalyze('recibo');window._closeRadial()">
          <span class="vp-rb-ico">🧾</span><span class="vp-rb-lbl">RECIBO</span>
        </button>
        <button class="vp-radial-btn" style="--i:4" onclick="captureAndAnalyze('scene');window._closeRadial()">
          <span class="vp-rb-ico">🌐</span><span class="vp-rb-lbl">ESCENA</span>
        </button>
        <button class="vp-radial-btn" style="--i:5" onclick="window._toggleWorkspace();window._closeRadial()">
          <span class="vp-rb-ico">▦</span><span class="vp-rb-lbl">PANEL</span>
        </button>
      </div>
      <div class="vp-radial-center">AREX</div>
    </div>

    <!-- BOTTOM ACTION BUTTONS -->
    <div class="vp-hud-bottom">
      <button class="vp-action-btn" data-mode="describe" onclick="captureAndAnalyze('describe')">
        <span class="vp-btn-ico">👁</span><span class="vp-btn-lbl">VER</span>
      </button>
      <button class="vp-action-btn" data-mode="product" onclick="captureAndAnalyze('product')">
        <span class="vp-btn-ico">🔍</span><span class="vp-btn-lbl">OBJETO</span>
      </button>
      <button class="vp-action-btn" data-mode="text" onclick="captureAndAnalyze('text')">
        <span class="vp-btn-ico">📄</span><span class="vp-btn-lbl">TEXTO</span>
      </button>
      <button class="vp-action-btn" data-mode="recibo" onclick="captureAndAnalyze('recibo')">
        <span class="vp-btn-ico">🧾</span><span class="vp-btn-lbl">RECIBO</span>
      </button>
      <button class="vp-action-btn" data-mode="scene" onclick="captureAndAnalyze('scene')">
        <span class="vp-btn-ico">🌐</span><span class="vp-btn-lbl">ESCENA</span>
      </button>
      <button class="vp-action-btn vp-qr-btn" id="vis-qr">
        <span class="vp-btn-ico">🔲</span><span class="vp-btn-lbl">QR</span>
      </button>
      <button class="vp-action-btn vp-cont-btn" id="vis-cont">
        <span class="vp-btn-ico">⬤</span><span class="vp-btn-lbl">AUTO</span>
      </button>
      <button class="vp-action-btn vp-radial-trigger" id="vis-radial-btn" onclick="window._toggleRadial()">
        <span class="vp-btn-ico">⊕</span><span class="vp-btn-lbl">MENÚ</span>
      </button>
    </div>
  `;

  document.body.appendChild(el);
  _panel = el;

  _video = document.getElementById('vis-video');
  _video.srcObject = _stream;
  _video.play().catch(() => {});

  // Camera info on metadata load
  _video.addEventListener('loadedmetadata', () => {
    const telCam = document.getElementById('vis-tel-cam');
    if (telCam) telCam.textContent = `${_video.videoWidth}×${_video.videoHeight}`;
    _applyMirror();
  });

  document.getElementById('vis-cont').addEventListener('click', _toggleContinuous);
  document.getElementById('vis-flip').addEventListener('click', _flipCamera);
  document.getElementById('vis-qr').addEventListener('click', _detectQR);
  document.getElementById('vis-result-close').addEventListener('click', _hideResult);
  document.getElementById('vis-voice').addEventListener('click', _toggleVoice);
  document.getElementById('vis-personas').addEventListener('click', _openPersonasPanel);
  document.getElementById('vis-personas-close').addEventListener('click', _closePersonasPanel);
  document.getElementById('vp-p-add').addEventListener('click', _addPersona);
  document.getElementById('vis-gesture').addEventListener('click', _toggleGesture);
  document.getElementById('vis-vcmd').addEventListener('click', _toggleVoiceCmd);

  // Module HUD
  document.getElementById('vis-mhud-close').addEventListener('click', _hideModuleHud);
  document.getElementById('vis-mhud-open').addEventListener('click', () => {
    if (_hudModuleId) _navigateAndClose(_hudModuleId);
  });
  // Gesture config
  document.getElementById('vis-gest-cfg-btn')?.addEventListener('click', _toggleGestureConfig);
  document.getElementById('vis-gest-config-close').addEventListener('click', () => {
    document.getElementById('vis-gesture-config')?.classList.remove('visible');
  });

  // Close module grid on outside tap
  document.getElementById('vis-module-grid').addEventListener('click', e => {
    if (e.target === document.getElementById('vis-module-grid')) _hideModuleGrid();
  });

  // Vision Workspace tabs
  document.getElementById('vis-wk-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-wkmod]');
    if (!btn) return;
    document.querySelectorAll('.vis-wk-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    _wkModId = btn.dataset.wkmod;
    localStorage.setItem('arex_vision_wkmod', _wkModId);
    document.getElementById('vis-wk-lbl').textContent = btn.dataset.wkmod.toUpperCase();
    _wkRender();
  });
  document.getElementById('vis-wk-snd').addEventListener('click', _wkSendChat);
  document.getElementById('vis-wk-inp').addEventListener('keydown', e => {
    if (e.key === 'Enter') _wkSendChat();
  });

  // Resize canvas when window rotates / resizes
  const _resizeCanvas = () => {
    const canvas = document.getElementById('vis-gesture-canvas');
    if (canvas && _video) {
      canvas.width  = _video.clientWidth  || 320;
      canvas.height = _video.clientHeight || 480;
    }
  };
  window.addEventListener('resize', _resizeCanvas);
  _panel._cleanupResize = () => window.removeEventListener('resize', _resizeCanvas);

  // Tap-to-analyze: single tap on video area triggers region analysis
  const tapCv = document.getElementById('vis-tap-canvas');
  if (tapCv) {
    let _tapStart = null;
    tapCv.addEventListener('touchstart', e => {
      if (e.touches.length !== 1) return;
      _tapStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      // Long press → ask bar
      _longPressTimer = setTimeout(() => {
        if (!_tapStart) return;
        _tapStart = null;
        _toggleAskBar();
      }, 650);
    }, { passive: true });
    tapCv.addEventListener('touchend', e => {
      clearTimeout(_longPressTimer);
      if (!_tapStart) return;
      const dx = e.changedTouches[0].clientX - _tapStart.x;
      const dy = e.changedTouches[0].clientY - _tapStart.y;
      const dt = Date.now() - _tapStart.t;
      _tapStart = null;
      // Only fire on short taps with little movement
      if (dt < 400 && Math.abs(dx) < 15 && Math.abs(dy) < 15) {
        _handleTapAnalyze(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
      }
    }, { passive: true });
    tapCv.addEventListener('click', e => {
      // Desktop: single click to analyze region
      if (e.detail === 1) _handleTapAnalyze(e.clientX, e.clientY);
    });
  }

  document.getElementById('vis-ask-send').addEventListener('click', _sendAskBar);
  document.getElementById('vis-ask-input').addEventListener('keydown', e => { if (e.key === 'Enter') _sendAskBar(); });

  // Init 3-D Vision Orb — retry hasta que vision-orb.js termine de parsear
  const _initOrb = () => {
    const orbCv = document.getElementById('vis-orb-canvas');
    if (!orbCv) return;
    if (window.VisionOrb) {
      const dpr = devicePixelRatio || 1;
      const sz  = 88;
      orbCv.width  = sz * dpr;
      orbCv.height = sz * dpr;
      orbCv.style.width  = sz + 'px';
      orbCv.style.height = sz + 'px';
      // NO pre-escalar el contexto: VisionOrb calcula centro/radio con
      // canvas.width real; con scale(dpr) el orbe queda en la esquina y recortado
      window.VisionOrb.init(orbCv);
    } else {
      setTimeout(_initOrb, 400);
    }
  };
  _initOrb();

  // Start telemetry ticker
  _telTimer = setInterval(_updateTelemetry, 3000);
  _updateTelemetry();
  // HUD data is also populated on open (openVision calls _updateVisionHudData)
}

/* ─── Frame Capture ───────────────────────────────────── */
async function _waitForVideo() {
  for (let i = 0; i < 20; i++) {
    if (_video && _video.videoWidth > 0) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

async function _captureFrame(maxPx = 480) {
  if (!_video) return null;
  // Keep stream alive on iOS (Safari pauses video under memory pressure)
  if (_video.paused) { try { await _video.play(); } catch { return null; } }
  const ready = await _waitForVideo();
  if (!ready) return null;
  const vw = _video.videoWidth, vh = _video.videoHeight;
  const scale = Math.min(1, maxPx / Math.max(vw, vh));
  const w = Math.round(vw * scale);
  const h = Math.round(vh * scale);
  // Reuse canvas — avoid GC pressure on repeated captures
  if (!_captureCanvas || _captureCanvas.width !== w || _captureCanvas.height !== h) {
    _captureCanvas = document.createElement('canvas');
    _captureCanvas.width  = w;
    _captureCanvas.height = h;
  }
  _captureCanvas.getContext('2d').drawImage(_video, 0, 0, w, h);
  const dataUrl = _captureCanvas.toDataURL('image/jpeg', 0.72);
  if (dataUrl.length < 5000) return null;
  return dataUrl;
}

/* ─── Analysis ────────────────────────────────────────── */
async function _analyze(mode, extra = '') {
  if (_busy) return;
  _busy = true;

  // Safety: si _analyze se cuelga por cualquier razón, libera _busy a los 30s.
  // Debe ser MAYOR que el peor caso real (Groq 14s + fallback Gemini 14s = 28s);
  // si fuera menor, liberaría _busy con el análisis aún corriendo → dobles análisis
  clearTimeout(_busyTimer);
  _busyTimer = setTimeout(() => {
    _busy = false;
    _setScanActive(false);
    _setAnalyzing(false, mode);
    _setStatus('LISTO');
    console.warn('AREX Vision: _busy forzado a false por timeout de seguridad');
  }, 30000);

  _setStatus('CAPTURANDO...');
  _setAnalyzing(true, mode);

  const res = MODE_RES[mode] || 480;
  const frame = await _captureFrame(res);
  if (!frame) {
    _setStatus('SIN SEÑAL');
    _showResult('SIN SEÑAL', 'No se pudo capturar el frame. Espera y vuelve a intentarlo.', null);
    _busy = false;
    _setAnalyzing(false, mode);
    return;
  }

  _setStatus('ANALIZANDO...');
  _setScanActive(true);
  _jarvisSound('scan');

  // Cinematic sweep animation
  const sweepEl = document.getElementById('vis-sweep');
  if (sweepEl) { sweepEl.classList.remove('active'); void sweepEl.offsetWidth; sweepEl.classList.add('active'); }

  const prompt    = extra || _buildVisionPrompt(mode);
  const geminiKey = window.AREX_CONFIG?.geminiKey;
  const groqKey   = window.AREX_CONFIG?.groqKey;

  try {
    let reply;

    if (groqKey) {
      try {
        _setStatus('ANALIZANDO · GROQ...');
        reply = await _withTimeout(_callGroq(frame, prompt, groqKey), 14000);
      } catch (e) {
        console.warn('Groq vision failed:', e.message);
      }
    }

    if (!reply && geminiKey) {
      _setStatus('ANALIZANDO · GEMINI...');
      reply = await _withTimeout(_callGemini(frame, prompt, geminiKey), 14000);
    }

    if (!reply) throw new Error('No hay API de visión disponible. Verifica tus keys en /config.');

    const label = MODE_LABELS[mode] || 'ANÁLISIS';

    if (mode === 'recibo') {
      _handleReceipt(reply, frame, label);
    } else {
      _showResult(label, reply, frame, mode);
      _say(`**[${label}]**\n\n${reply}`);
      _visionSpeak(reply);
    }

    if (mode === 'product' && window.AREX_CONFIG?.tavilyKey) {
      const m = reply.match(/\*\*Objeto:\*\*\s*(.+)/);
      if (m) _searchProduct(m[1].trim().slice(0, 60));
    }

    _setStatus(_contOn ? 'MODO CONTINUO' : 'LISTO');
  } catch (e) {
    const msg = e.message || 'Error desconocido';
    _setStatus('ERROR');
    _showResult('⚠ ERROR', msg, null);
    _say(`**[Visión · Error]** ${msg}`);
    console.warn('AREX Vision error:', e);
  } finally {
    clearTimeout(_busyTimer);
    _busy = false;
    _setScanActive(false);
    _setAnalyzing(false, mode);
  }
}

async function _callGemini(frame, prompt, key) {
  const [, b64] = frame.split(',');
  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  let lastErr;
  for (const model of models) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [
          { inline_data: { mime_type: 'image/jpeg', data: b64 } },
          { text: prompt }
        ]}]})
      }
    );
    if (res.ok) {
      const data = await res.json();
      return data?.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta de Gemini.';
    }
    const err = await res.json().catch(() => ({}));
    lastErr = `Gemini ${res.status}: ${err?.error?.message || res.statusText}`;
    if (res.status !== 404) break;
  }
  throw new Error(lastErr);
}

async function _callGroq(frame, prompt, key, fast = false) {
  const models = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'llama-3.2-11b-vision-preview',
  ];
  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        max_tokens: fast ? 220 : 800,
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: frame } },
          { type: 'text', text: prompt }
        ]}]
      })
    });
    if (res.status === 404) continue;
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Groq ${res.status}: ${err?.error?.message || res.statusText}`);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'Sin respuesta de Groq.';
  }
  throw new Error('Sin modelo Groq disponible para visión.');
}

function _withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Tiempo de espera agotado (${ms/1000}s)`)), ms))
  ]);
}

/* ─── QR / Barcode Detection ──────────────────────────── */
async function _detectQR() {
  if (_busy) return;
  if (!('BarcodeDetector' in window)) {
    _showResult('🔲 QR/CÓDIGO', 'BarcodeDetector no disponible.\nUsa Chrome en Android o escritorio.', null);
    return;
  }
  _busy = true;
  _setStatus('ESCANEANDO QR...');
  _setScanActive(true);
  try {
    const frame = await _captureFrame(640);
    if (!frame) throw new Error('No se pudo capturar frame');
    const img = new Image();
    img.src = frame;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const detector = new BarcodeDetector({
      formats: ['qr_code','code_128','ean_13','ean_8','code_39','aztec','data_matrix','upc_a','upc_e']
    });
    const codes = await detector.detect(img);
    if (!codes.length) {
      _showResult('🔲 QR/CÓDIGO', 'No se detectó ningún código.\nAcerca la cámara e intenta de nuevo.', frame, 'qr');
    } else {
      const txt = codes.map(c => `**${c.format.toUpperCase()}:** ${c.rawValue}`).join('\n\n');
      _showResult('🔲 QR/CÓDIGO', txt, frame, 'qr');
      _say(`**[🔲 QR/Código]**\n\n${txt}`);
    }
  } catch (e) {
    _showResult('⚠ QR ERROR', e.message, null);
  } finally {
    _busy = false;
    _setScanActive(false);
    _setStatus('LISTO');
  }
}

/* ─── Result Panel ────────────────────────────────────── */
function _showResult(label, text, thumb, mode = '') {
  const panel = document.getElementById('vis-result');
  const lbl   = document.getElementById('vis-result-lbl');
  const body  = document.getElementById('vis-result-body');
  const img   = document.getElementById('vis-result-thumb');
  if (!panel) return;
  if (lbl) lbl.textContent = label;
  if (img) {
    if (thumb) { img.src = thumb; img.style.display = 'block'; }
    else        { img.src = '';   img.style.display = 'none'; }
  }
  const html = _h(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  if (body) body.innerHTML = html;
  panel.classList.add('visible');
  _jarvisSound('result');
  clearTimeout(_resultTimer);
  if (!_contOn) _resultTimer = setTimeout(_hideResult, 20000);
  _buildResultActions(mode, text);
}

function _hideResult() {
  document.getElementById('vis-result')?.classList.remove('visible');
  const actionsEl = document.getElementById('vis-result-actions');
  if (actionsEl) actionsEl.innerHTML = '';
}

/* ─── Context-aware quick actions after analysis ──────── */
function _buildResultActions(mode, rawText) {
  const actionsEl = document.getElementById('vis-result-actions');
  if (!actionsEl) return;
  actionsEl.innerHTML = '';
  const actions = [];

  if (mode === 'describe' || mode === 'scene') {
    actions.push({ label: '+ TAREA', accent: true, fn: () => {
      const preview = rawText.replace(/\*\*(.+?)\*\*/g, '$1').slice(0, 80).trim();
      _voiceAddTarea(`Vista: ${preview}`, 'media');
      _visionSpeak('Tarea agregada.');
    }});
    actions.push({ label: '+ NOTA', fn: () => {
      _saveNotaFromVision(rawText);
      _visionSpeak('Nota guardada.');
    }});
  } else if (mode === 'product') {
    actions.push({ label: '+ NOTA', fn: () => {
      _saveNotaFromVision(rawText);
      _visionSpeak('Nota guardada.');
    }});
    if (window.AREX_CONFIG?.tavilyKey) {
      actions.push({ label: 'BUSCAR PRECIO', accent: true, fn: () => {
        const m = rawText.match(/\*\*Objeto:\*\*\s*(.+)/);
        if (m) _searchProduct(m[1].trim().slice(0, 60));
        _visionSpeak('Buscando precios en línea.');
      }});
    }
  } else if (mode === 'text') {
    actions.push({ label: 'COPIAR', accent: true, fn: (btn) => {
      const clean = rawText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/<[^>]+>/g, '');
      navigator.clipboard?.writeText(clean).then(() => _visionSpeak('Texto copiado.')).catch(() => {});
    }});
    actions.push({ label: '+ NOTA', fn: () => {
      _saveNotaFromVision(rawText);
      _visionSpeak('Nota guardada.');
    }});
  } else if (mode === 'qr') {
    const urlMatch = rawText.match(/https?:\/\/[^\s)<]+/);
    if (urlMatch) {
      actions.push({ label: 'ABRIR ENLACE', accent: true, fn: () => {
        window.open(urlMatch[0], '_blank', 'noopener,noreferrer');
      }});
    }
    actions.push({ label: 'COPIAR', fn: () => {
      const clean = rawText.replace(/\*\*(.+?)\*\*/g, '$1').replace(/<[^>]+>/g, '');
      navigator.clipboard?.writeText(clean).then(() => _visionSpeak('Copiado.')).catch(() => {});
    }});
  }

  if (!actions.length) return;

  actionsEl.innerHTML = actions.map((a, i) =>
    `<button class="vp-act-btn${a.accent ? ' accent' : ''}" data-actidx="${i}">${a.label}</button>`
  ).join('');

  actionsEl.querySelectorAll('[data-actidx]').forEach(btn => {
    btn.addEventListener('click', () => {
      actions[parseInt(btn.dataset.actidx)]?.fn?.();
      const orig = btn.textContent;
      btn.textContent = '✓ ' + orig;
      btn.disabled = true;
    });
  });
}

function _saveNotaFromVision(text) {
  try {
    const ns = JSON.parse(localStorage.getItem('arex_notas') || '[]');
    ns.push({
      id:        String(Date.now()),
      texto:     text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/<[^>]+>/g, '').trim().slice(0, 500),
      categoria: 'Visión',
      creadaEn:  new Date().toISOString(),
    });
    localStorage.setItem('arex_notas', JSON.stringify(ns));
    window.renderNotas?.();
  } catch {}
}

/* ─── Receipt → Gasto automático ──────────────────────── */
function _handleReceipt(reply, frame, label) {
  const get = (re) => (reply.match(re)?.[1] || '').trim();
  const totalRaw = get(/\*\*Total:\*\*\s*\$?\s*([\d.,]+)/i);
  const total    = parseFloat(totalRaw.replace(/,/g, ''));
  const comercio = get(/\*\*Comercio:\*\*\s*(.+)/i) || 'Recibo';
  let   fecha    = get(/\*\*Fecha:\*\*\s*(.+)/i);
  const catRaw   = get(/\*\*Categor[ií]a:\*\*\s*(.+)/i).toLowerCase();
  const resumen  = get(/\*\*Resumen:\*\*\s*(.+)/i);

  // Normalizar fecha a YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    fecha = new Date().toISOString().slice(0, 10);
  }
  // Mapear categoría al set válido de GP_CATS
  const validCats = window.GP_CATS ? Object.keys(window.GP_CATS) : [];
  const categoria = validCats.includes(catRaw) ? catRaw : 'otro';

  if (!total || total <= 0) {
    _showResult('🧾 RECIBO', `No pude leer el total del recibo.\n\n${reply}`, frame);
    _say(`**[🧾 Recibo]** No logré leer el total. Acerca el ticket e intenta de nuevo.`);
    _visionSpeak('No pude leer el total del recibo. Intenta de nuevo.');
    return;
  }

  const desc = [comercio, resumen].filter(Boolean).join(' · ').slice(0, 120);

  if (typeof window.gpAddGastoAuto === 'function') {
    const gasto = window.gpAddGastoAuto(total, categoria, desc, fecha);
    const catLabel = window.GP_CATS?.[categoria]?.l || categoria;
    const catEmoji = window.GP_CATS?.[categoria]?.e || '📦';
    const montoStr = `$${total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    const summary = `**Gasto registrado ✓**\n\n💰 ${montoStr} MXN\n${catEmoji} ${catLabel}\n🏪 ${comercio}\n📅 ${fecha}${resumen ? `\n📝 ${resumen}` : ''}`;
    _showResult('🧾 RECIBO → GASTO', summary, frame);
    _say(`**[🧾 Recibo registrado]**\n\n${summary}`);
    _visionSpeak(`Gasto registrado. ${montoStr} pesos en ${catLabel}.`);
    if (gasto && window.AREXNav?.moduloActual === 'gastos' && typeof window.renderGpResumen === 'function') {
      window.renderGpResumen();
    }
  } else {
    _showResult('🧾 RECIBO', reply, frame);
    _say(`**[🧾 Recibo]**\n\n${reply}`);
  }
}

/* ─── Product search ──────────────────────────────────── */
async function _searchProduct(nombre) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: window.AREX_CONFIG.tavilyKey,
        query: `comprar ${nombre} precio México`,
        search_depth: 'basic', max_results: 4
      })
    });
    if (!res.ok) return;
    const data = await res.json();
    const links = (data.results || []).filter(r => r.url).slice(0, 3);
    if (!links.length) return;
    _say(`**🛒 Links para "${nombre}":**\n\n${links.map(l => `- [${(l.title||l.url).slice(0,50)}](${l.url})`).join('\n')}`);
  } catch (_) {}
}

/* ─── Continuous mode — secuencial, no setInterval ───── */
function _toggleContinuous() {
  _contOn = !_contOn;
  const btn = document.getElementById('vis-cont');
  const lbl = btn?.querySelector('.vp-btn-lbl');
  if (btn) btn.classList.toggle('on', _contOn);
  if (lbl) lbl.textContent = _contOn ? 'SMART ⬤' : 'AUTO';
  if (_contOn) {
    _setStatus('SMART · EN ESPERA');
    _runContinuous();
  } else {
    window.speechSynthesis?.cancel();
    _stopIosKa();
    _lastPixels  = null;
    _noMotionCnt = 0;
    _lastContTxt = '';
    _motionCanvas = null;
    _setStatus('LISTO');
  }
}

async function _runContinuous() {
  if (_contRunning) return;
  _contRunning = true;
  _contCycle   = 0;
  _noMotionCnt = 0;
  _lastPixels  = null;
  try {
    while (_contOn) {
      await new Promise(r => setTimeout(r, 3500));  // 1.8s → 3.5s: menos carga CPU/GPU
      if (!_contOn) break;
      // Keep stream alive on iOS
      if (_video?.paused) { _video.play().catch(() => {}); }
      const motion = _checkMotion();
      if (motion) {
        _noMotionCnt = 0;
      } else {
        _noMotionCnt++;
        // Sin movimiento ~28s (8 ciclos × 3.5s): análisis ambient de todas formas
        if (_noMotionCnt < 8) { _setStatus('SMART · EN ESPERA'); continue; }
        _noMotionCnt = 0;
      }
      if (_busyCont) continue;
      _contCycle++;
      await _analyzeCont();
    }
  } finally {
    _contRunning = false;
    _contCycle   = 0;
    _lastPixels  = null;
  }
}

function _waitForSpeech() {
  return new Promise(resolve => {
    if (!window.speechSynthesis?.speaking) { resolve(); return; }
    const maxT = setTimeout(resolve, 16000);
    function poll() {
      if (!window.speechSynthesis?.speaking) { clearTimeout(maxT); resolve(); }
      else setTimeout(poll, 300);
    }
    setTimeout(poll, 400);
  });
}

/* ─── Motion detection (64×48 pixel diff) ────────────── */
function _checkMotion() {
  if (!_video || _video.videoWidth === 0) return true;
  try {
    if (!_motionCanvas) { _motionCanvas = document.createElement('canvas'); _motionCanvas.width = 64; _motionCanvas.height = 48; }
    const c = _motionCanvas;
    const ctx = c.getContext('2d');
    ctx.drawImage(_video, 0, 0, 64, 48);
    const pixels = ctx.getImageData(0, 0, 64, 48);
    if (!_lastPixels) { _lastPixels = pixels; return true; }
    let diff = 0;
    const n = pixels.data.length;
    for (let i = 0; i < n; i += 4) {
      if (Math.abs(pixels.data[i]   - _lastPixels.data[i])
        + Math.abs(pixels.data[i+1] - _lastPixels.data[i+1])
        + Math.abs(pixels.data[i+2] - _lastPixels.data[i+2]) > 50) diff++;
    }
    _lastPixels = pixels;
    return (diff / (n / 4)) > 0.04;
  } catch { return true; }
}

/* ─── Background continuous analysis (non-blocking) ─────── */
async function _analyzeCont() {
  if (_busyCont) return;
  _busyCont = true;
  // Safety reset: 12s máximo — si la API no respondió, libera y sigue
  const timer = setTimeout(() => { _busyCont = false; }, 12000);
  _setStatus('SMART · ANALIZANDO');
  try {
    // 240px en AUTO: suficiente para describir, mucho más rápido de enviar
    const frame = await _captureFrame(240);
    if (!frame) return;
    const prompt  = _buildVisionPrompt('describe');
    const groqKey = window.AREX_CONFIG?.groqKey;
    const gemKey  = window.AREX_CONFIG?.geminiKey;
    let reply;
    if (groqKey) {
      // fast=true → llama-3.2-11b-vision: respuesta rápida para modo AUTO
      try { reply = await _withTimeout(_callGroq(frame, prompt, groqKey, true), 10000); } catch { /**/ }
    }
    if (!reply && gemKey) {
      try { reply = await _withTimeout(_callGemini(frame, prompt, gemKey), 10000); } catch { /**/ }
    }
    if (!reply) return;
    const isSame = _lastContTxt && _textSimilarity(reply, _lastContTxt) > 0.70;
    _lastContTxt = reply;
    if (!isSame) {
      _showResult(MODE_LABELS.describe, reply, frame, 'describe');
      if (!window.speechSynthesis?.speaking) _visionSpeak(reply);
      _say(`**[Smart Auto]** ${reply}`);
    }
    _setStatus('SMART · EN ESPERA');
  } catch (e) {
    console.warn('analyzeCont:', e);
    _setStatus('SMART · EN ESPERA');
  } finally {
    clearTimeout(timer);
    _busyCont = false;
  }
}

function _textSimilarity(a, b) {
  const words = s => new Set(s.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const wa = words(a), wb = words(b);
  const inter = [...wa].filter(w => wb.has(w)).length;
  const union = new Set([...wa, ...wb]).size;
  return union > 0 ? inter / union : 0;
}

/* ─── Camera mirror ───────────────────────────────────── */
function _applyMirror() {
  const m = _facingMode === 'user' ? 'scaleX(-1)' : 'none';
  if (_video) _video.style.transform = m;
  const gc = document.getElementById('vis-gesture-canvas');
  if (gc) gc.style.transform = m;
}

/* ─── Camera flip ─────────────────────────────────────── */
async function _flipCamera() {
  if (!_stream) return;
  _stream.getTracks().forEach(t => t.stop());
  _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    // Si el usuario cerró Visión mientras esperábamos, apagar el stream nuevo
    // (si no, la cámara queda encendida sin nadie que la detenga)
    if (!_panel) { stream.getTracks().forEach(t => t.stop()); return; }
    _stream = stream;
    if (_video) {
      _video.srcObject = _stream;
      _video.play().catch(() => {});
      _video.addEventListener('loadedmetadata', _applyMirror, { once: true });
    }
  } catch (e) { _say('No se pudo cambiar de cámara.'); }
}

/* ─── Helpers ─────────────────────────────────────────── */
function _setStatus(txt) {
  const el = document.getElementById('vis-status-txt');
  if (el) el.textContent = txt;
  const badge = document.getElementById('vis-status');
  if (badge) {
    badge.classList.toggle('error',  txt.startsWith('ERROR') || txt.startsWith('SIN SEÑAL'));
    badge.classList.toggle('active', txt.includes('ANALIZANDO') || txt.includes('CONTINUO') || txt.includes('ESCANEANDO'));
  }
  // Sync Vision Orb state
  if (window.VisionOrb) {
    const orbState =
      txt.startsWith('ERROR') || txt.startsWith('SIN SEÑAL') ? 'error'
      : txt.includes('ANALIZANDO') || txt.includes('PENSANDO') || txt.includes('ENFOCANDO') ? 'analyzing'
      : txt.includes('ESCANEANDO') || txt.includes('SMART · ANALIZANDO') ? 'scanning'
      : txt.includes('CONTINUO') || txt.includes('SMART') ? 'scanning'
      : 'idle';
    window.VisionOrb.setState(orbState);
  }
}
function _setScanActive(on) {
  document.getElementById('vis-scan')?.classList.toggle('active', on);
}
function _setAnalyzing(on, mode) {
  document.querySelectorAll('#vision-panel [data-mode]').forEach(b => {
    b.classList.toggle('analyzing', on && b.dataset.mode === mode);
  });
}

/* ─── Voice synthesis + iOS keep-alive ───────────────── */
function _visionSpeak(text) {
  // No hablar si el panel ya se cerró (análisis que resolvió tarde)
  if (!_panel || !_voiceOn || !window.speechSynthesis) return;
  window.VisionOrb?.setState('speaking');

  const clean = text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^[-•]\s/gm, '')
    .replace(/<[^>]+>/g, '')
    .trim();

  const MAX = 600;
  const truncated = clean.length > MAX
    ? (clean.slice(0, MAX).match(/([\s\S]*[.!?])/)?.[1] || clean.slice(0, MAX))
    : clean;

  // No cancelar si ya está hablando en modo continuo (se espera con _waitForSpeech)
  if (!_contOn) window.speechSynthesis.cancel();

  const u = new SpeechSynthesisUtterance(truncated);
  u.lang = 'es-MX'; u.rate = 0.97; u.pitch = 0.90; u.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length) _applyVoice(u);
  else window.speechSynthesis.addEventListener('voiceschanged', () => _applyVoice(u), { once: true });

  // iOS keep-alive: Safari pausa speechSynthesis internamente cada ~15s
  u.onstart = () => {
    _stopIosKa();
    _iosKa = setInterval(() => {
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    }, 5000);
  };
  u.onend   = () => { _stopIosKa(); window.VisionOrb?.setState(_contOn ? 'scanning' : 'idle'); };
  u.onerror = () => { _stopIosKa(); window.VisionOrb?.setState('idle'); };

  window.speechSynthesis.speak(u);
}

function _stopIosKa() {
  clearInterval(_iosKa);
  _iosKa = null;
}

function _applyVoice(u) {
  const voices = window.speechSynthesis.getVoices();
  const names = ['pablo','jorge','diego','carlos','miguel','david','google español','microsoft pablo','microsoft jorge'];
  const v = voices.find(v => v.lang.startsWith('es') && names.some(n => v.name.toLowerCase().includes(n)))
         || voices.find(v => v.lang.startsWith('es'));
  if (v) u.voice = v;
}

function _toggleVoice() {
  _voiceOn = !_voiceOn;
  window.speechSynthesis?.cancel();
  _stopIosKa();
  const btn = document.getElementById('vis-voice');
  if (btn) {
    btn.textContent = _voiceOn ? '🔊' : '🔇';
    btn.classList.toggle('on', _voiceOn);
    btn.title = _voiceOn ? 'Voz activada' : 'Voz desactivada';
  }
}

function _say(msg) {
  if (typeof window.addMsg === 'function') window.addMsg('arex', msg);
}

/* ─── Personas panel ──────────────────────────────────── */
function _setPanelMsg(txt, isErr = false) {
  const el = document.getElementById('vp-msg');
  if (!el) return;
  el.textContent = txt;
  el.className = 'vp-personas-msg ' + (isErr ? 'err' : 'ok');
}

function _openPersonasPanel() {
  document.getElementById('vis-result')?.classList.remove('visible');
  _setPanelMsg('');
  _renderPersonasList();
  document.getElementById('vis-personas-panel')?.classList.add('visible');
}

function _closePersonasPanel() {
  document.getElementById('vis-personas-panel')?.classList.remove('visible');
}

function _renderPersonasList() {
  const el = document.getElementById('vis-personas-list');
  if (!el) return;
  const arr = _loadPersonas();
  if (!arr.length) {
    el.innerHTML = '<div class="vp-personas-empty">Sin personas guardadas.<br>Agrega a Alexiz y Margaret con su descripción física para que AREX las reconozca en cámara.</div>';
    return;
  }
  el.innerHTML = arr.map((p, i) => `
    <div class="vp-persona-item">
      <div class="vp-persona-data">
        <strong>${p.nombre}</strong>
        <span>${p.descripcion.slice(0, 80)}${p.descripcion.length > 80 ? '…' : ''}</span>
      </div>
      <button class="vp-icon-btn vp-close-btn vp-persona-del" data-idx="${i}" title="Eliminar">✕</button>
    </div>`).join('');

  el.querySelectorAll('.vp-persona-del').forEach(btn =>
    btn.addEventListener('click', () => _deletePersona(Number(btn.dataset.idx)))
  );
}

function _addPersona() {
  const ni    = document.getElementById('vp-p-nombre');
  const di    = document.getElementById('vp-p-desc');
  const nombre = ni?.value.trim() || '';
  const desc   = di?.value.trim() || '';
  if (!nombre) {
    _setPanelMsg('Escribe un nombre para la persona', true);
    ni?.focus();
    return;
  }
  if (desc.length < 3) {
    _setPanelMsg('Agrega una descripción física (ej: cabello oscuro, piel clara)', true);
    di?.focus();
    return;
  }
  const arr = _loadPersonas();
  const idx = arr.findIndex(p => p.nombre.toLowerCase() === nombre.toLowerCase());
  const isUpdate = idx >= 0;
  if (isUpdate) arr[idx].descripcion = desc;
  else arr.push({ nombre, descripcion: desc });
  _savePersonas(arr);
  if (ni) ni.value = '';
  if (di) di.value = '';
  _renderPersonasList();
  _setPanelMsg(isUpdate ? `${nombre} actualizado ✓` : `${nombre} guardado ✓`);
  setTimeout(() => _setPanelMsg(''), 3000);
}

function _deletePersona(i) {
  const arr = _loadPersonas();
  arr.splice(i, 1);
  _savePersonas(arr);
  _renderPersonasList();
}

/* ─── Gesture Engine Toggle ───────────────────────────── */
function _toggleGesture() {
  _gestureOn = !_gestureOn;
  const btn = document.getElementById('vis-gesture');
  if (btn) btn.classList.toggle('on', _gestureOn);

  const canvas = document.getElementById('vis-gesture-canvas');
  if (_gestureOn && _video && canvas) {
    canvas.width  = 320;
    canvas.height = 240;
    const _startGE = () => {
      if (typeof initGestureEngine !== 'function') return;
      _say('**[Gestos]** CARGANDO MOTOR DE GESTOS...');
      initGestureEngine(_video, canvas, _handleGesture)
        .then(ok => {
          if (!ok) {
            _gestureOn = false;
            if (btn) btn.classList.remove('on');
            _say('**[Gestos]** No se pudo iniciar MediaPipe. Verifica tu conexión.');
          } else {
            _setStatus('GESTOS ON');
            document.getElementById('vis-gest-guide')?.classList.add('visible');
          }
        });
    };
    if (typeof initGestureEngine === 'function') {
      _startGE();
    } else {
      const existing = document.querySelector('script[src="./gesture.js"]');
      if (existing) {
        // Ya se está cargando (toque rápido doble) — engancharse a esa carga
        existing.addEventListener('load', _startGE, { once: true });
      } else {
        const s = document.createElement('script');
        s.src = './gesture.js';
        s.onload = _startGE;
        s.onerror = () => { s.remove(); _say('**[Gestos]** Error cargando gesture.js'); };
        document.body.appendChild(s);
      }
    }
  } else {
    if (typeof stopGestureEngine === 'function') stopGestureEngine();
    document.getElementById('vis-gest-guide')?.classList.remove('visible');
    const telGest = document.getElementById('vis-tel-gest');
    if (telGest) telGest.textContent = '—';
    _setStatus('LISTO');
  }
}

/* ─── Voice Command Toggle ────────────────────────────── */
function _toggleVoiceCmd() {
  _voiceCmdOn = !_voiceCmdOn;
  const btn = document.getElementById('vis-vcmd');
  if (btn) btn.classList.toggle('on', _voiceCmdOn);
  if (_voiceCmdOn) {
    _initVoiceCmd();
  } else {
    _stopVoiceCmd();
    document.getElementById('vis-voice-bar')?.classList.remove('active');
    const telVoice = document.getElementById('vis-tel-voice');
    if (telVoice) telVoice.textContent = '—';
  }
}

function _initVoiceCmd() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    _say('**[Voz]** SpeechRecognition no disponible en este navegador.');
    _voiceCmdOn = false;
    document.getElementById('vis-vcmd')?.classList.remove('on');
    return;
  }
  // Pause JARVIS AR mode to prevent dual SpeechRecognition conflict
  if (!_contWasPaused && window._arexContModeActive) {
    _contWasPaused = true;
    window.toggleContinuousMode?.();
  }
  _stopVoiceCmd();

  _vsr = new SR();
  _vsr.lang = 'es-MX';
  _vsr.continuous = true;
  _vsr.interimResults = true;
  _vsr.maxAlternatives = 1;

  _vsr.onstart = () => {
    _vsrRunning = true;
    document.getElementById('vis-voice-bar')?.classList.add('active');
    const telVoice = document.getElementById('vis-tel-voice');
    if (telVoice) telVoice.textContent = 'ON ⬤';
  };

  _vsr.onresult = (e) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) final += t;
      else interim += t;
    }
    const display = final || interim;
    const cmdEl = document.getElementById('vis-cmd-text');
    if (cmdEl && display) cmdEl.textContent = display.toUpperCase();
    if (final) _processVoiceCmd(final.trim().toLowerCase());
  };

  _vsr.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    console.warn('VSR error:', e.error);
    const telVoice = document.getElementById('vis-tel-voice');
    if (telVoice) telVoice.textContent = 'ERR';
    // Permiso de micrófono negado: apagar voz definitivamente — si no,
    // onend reintenta start() cada 500ms en bucle infinito
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      _voiceCmdOn = false;
      document.getElementById('vis-vcmd')?.classList.remove('on');
      document.getElementById('vis-voice-bar')?.classList.remove('active');
      _stopVoiceCmd();
      _say('**[Voz]** Permiso de micrófono denegado. Actívalo en los ajustes del navegador.');
    }
  };

  _vsr.onend = () => {
    _vsrRunning = false;
    if (_voiceCmdOn && _panel) {
      setTimeout(() => { if (_voiceCmdOn && _panel) { try { _vsr?.start(); } catch (_) {} } }, 500);
    }
  };

  try { _vsr.start(); } catch (e) { console.warn('VSR start:', e); }
}

function _stopVoiceCmd() {
  if (_vsr) {
    try { _vsr.abort(); } catch (_) {}
    _vsr = null;
  }
  _vsrRunning = false;
}

/* ─── Voice Command Parser ────────────────────────────── */
function _processVoiceCmd(text) {
  if (!text.includes('arex')) return;

  const t = text.replace(/arex\s*/i, '').trim();
  const cmdEl = document.getElementById('vis-cmd-text');

  const feedback = (lbl) => {
    if (cmdEl) cmdEl.textContent = `⬤ ${lbl}`;
    clearTimeout(_cmdFeedbackT);
    _cmdFeedbackT = setTimeout(() => {
      if (cmdEl) cmdEl.textContent = 'DI "AREX" + COMANDO';
    }, 3000);
  };

  if (/\b(?:recibo|ticket|gasto(?!s)|factura)\b/.test(t)) {
    feedback('ESCANEAR RECIBO');
    _say('**[Voz]** Escaneando recibo...');
    _analyze('recibo');
    return;
  }

  // Conversational JARVIS triggers
  if (/\b(qué ves|que ves|cuéntame|cuentame|dime qué hay|dime que hay|qué hay ahí|que hay ahi|qué pasa|que pasa)\b/.test(t)) {
    feedback('DESCRIBIR');
    if (!_busy) _analyze('describe');
    return;
  }

  if (/\b(dime más|dime mas|más detalle|mas detalle|explícame|explicame|amplía|amplia|y qué más|y que mas)\b/.test(t)) {
    feedback('MÁS DETALLE');
    if (!_busy) _analyze('scene');
    return;
  }

  if (/\b(quién es|quien es|quién hay|quien hay|quién está|quien esta|alguien ahí|alguien ahi|reconoce)\b/.test(t)) {
    feedback('IDENTIFICAR PERSONA');
    if (!_busy) _analyze('describe');
    return;
  }

  if (/\b(analiz|ver|mira|describe|scene|escena|producto|objeto|texto)\b/.test(t)) {
    const mode = /\b(escena|scene)\b/.test(t) ? 'scene'
               : /\b(producto|objeto)\b/.test(t) ? 'product'
               : /\b(texto|lee)\b/.test(t) ? 'text' : 'describe';
    feedback(`ANALIZAR · ${mode.toUpperCase()}`);
    if (!_busy) _analyze(mode);
    return;
  }

  if (/\b(detener|para|stop|cerrar|salir|cierra)\b/.test(t)) {
    feedback('DETENER');
    if (/\b(cerrar|salir|cierra)\b/.test(t)) { closeVision(); return; }
    _contOn = false;
    window.speechSynthesis?.cancel();
    _setStatus('LISTO');
    _say('**[Voz]** Detenido.');
    return;
  }

  if (/\b(auto|continuo|automático)\b/.test(t)) {
    feedback('MODO AUTO');
    _toggleContinuous();
    return;
  }

  if (/\b(silencio|mute|mudo|callate)\b/.test(t)) {
    feedback('SILENCIO');
    if (_voiceOn) _toggleVoice();
    return;
  }

  if (/\b(voz on|habla|hablar)\b/.test(t)) {
    feedback('VOZ ON');
    if (!_voiceOn) _toggleVoice();
    return;
  }

  if (/\b(workspace|panel lateral|mis datos|abre el panel|panel)\b/.test(t)) {
    feedback('WORKSPACE');
    _toggleWorkspace();
    return;
  }

  if (/\b(módulos|modulos|navegar|navega)\b/.test(t)) {
    feedback('MÓDULOS');
    _toggleModuleGrid();
    return;
  }

  // "AREX nueva tarea X [prioridad alta/baja]"
  const tareaMatch = t.match(/\b(?:nueva\s+tarea|agregar\s+tarea|add\s+tarea|tarea\s+nueva)\s+(.+)/);
  if (tareaMatch) {
    const raw      = tareaMatch[1];
    const priority = /\balta\b/.test(raw) ? 'alta' : /\bbaja\b/.test(raw) ? 'baja' : 'media';
    const texto    = raw.replace(/\b(?:prioridad\s+)?(?:alta|baja|media)\b/g, '').trim();
    if (texto) {
      _voiceAddTarea(texto, priority);
      feedback('TAREA AGREGADA ✓');
      _visionSpeak(`Tarea agregada: ${texto}.`);
      _say(`**[Voz]** Tarea: *${texto}* (${priority})`);
      return;
    }
  }

  // "AREX gasto 150 comida"
  const gastoMatch = t.match(/\bgasto\s+(\d+(?:[.,]\d+)?)\s*(\w+)?/);
  if (gastoMatch) {
    const monto = parseFloat(gastoMatch[1].replace(/,/g, ''));
    const cat   = gastoMatch[2] || 'otro';
    if (monto > 0) {
      window.gpAddGastoAuto?.(monto, cat, 'AREX Voz');
      feedback(`GASTO $${monto} ✓`);
      _visionSpeak(`Gasto de ${monto} pesos en ${cat} registrado.`);
      _say(`**[Voz]** Gasto: $${monto} · ${cat}`);
      return;
    }
  }

  // Module navigation: "abrir X" → close vision + navigate; just "X" → show HUD
  const openMode = /\b(?:abrir|abre|abré|ir\s+a|navegar\s+a|ve\s+a|vé\s+a)\b/.test(t);
  const modMap = {
    inicio:     ['inicio', 'home'],
    finanzas:   ['finanzas', 'dinero'],
    metas:      ['metas', 'meta', 'objetivos'],
    tareas:     ['tareas', 'pendientes'],
    notas:      ['notas', 'nota', 'apuntes'],
    negocio:    ['negocio', 'tienda', 'inventario'],
    gastos:     ['gastos'],
    proyectos:  ['proyectos', 'proyecto'],
    evidencias: ['evidencias', 'evidencia'],
    control:    ['control', 'configuración', 'ajustes'],
    chat:       ['chat', 'chatear'],
  };
  for (const [id, keywords] of Object.entries(modMap)) {
    if (keywords.some(k => t.includes(k))) {
      if (openMode) {
        feedback(`ABRIR ${id.toUpperCase()}`);
        _say(`**[Voz]** Abriendo ${id}...`);
        setTimeout(() => _navigateAndClose(id), 800);
      } else {
        feedback(`◈ ${id.toUpperCase()}`);
        _showModuleHud(id);
      }
      return;
    }
  }

  // Free voice fallback: if speech starts with "arex" but matched nothing,
  // treat the rest as a natural language question about the current camera view
  if (t.length > 3 && !_busy) {
    feedback('PREGUNTA LIBRE');
    _freeVoiceQuery(t);
  }
}

async function _freeVoiceQuery(question) {
  if (_busy) return;
  _busy = true;
  clearTimeout(_busyTimer);
  _busyTimer = setTimeout(() => { _busy = false; _setScanActive(false); _setStatus('LISTO'); }, 14000);
  _setStatus('PENSANDO...');
  _setScanActive(true);
  try {
    const frame   = await _captureFrame(360);
    const groqKey = window.AREX_CONFIG?.groqKey;
    const gemKey  = window.AREX_CONFIG?.geminiKey;
    if (!frame && !groqKey && !gemKey) { _busy = false; _setScanActive(false); _setStatus('LISTO'); return; }
    const prompt = frame
      ? `Eres AREX, el asistente de Alexiz. Tienes la cámara activa. Alexiz preguntó: "${question}". Responde en 1-3 oraciones naturales basándote en lo que ves en la imagen. Si la pregunta no es sobre la imagen, responde igual de forma directa. En español.`
      : `Eres AREX. Alexiz preguntó mientras usaba la cámara: "${question}". Responde de forma directa en 1-2 oraciones. En español.`;
    let reply;
    if (frame && groqKey) { try { reply = await _withTimeout(_callGroq(frame, prompt, groqKey, true), 10000); } catch {} }
    if (!reply && frame && gemKey) { try { reply = await _withTimeout(_callGemini(frame, prompt, gemKey), 10000); } catch {} }
    if (!reply && groqKey) {
      const res = await _withTimeout(fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${groqKey}` },
        body: JSON.stringify({ model: 'llama-3.3-70b-versatile', max_tokens: 120,
          messages: [{ role: 'user', content: prompt }] })
      }), 10000);
      const d = await res.json();
      reply = d?.choices?.[0]?.message?.content;
    }
    if (reply) { _showResult('💬 AREX', reply, frame || null, 'describe'); _visionSpeak(reply); }
  } catch (e) { console.warn('freeVoiceQuery:', e); }
  finally { clearTimeout(_busyTimer); _busy = false; _setScanActive(false); _setStatus(_contOn ? 'SMART · EN ESPERA' : 'LISTO'); }
}

function _toggleAskBar() {
  _askBarVisible = !_askBarVisible;
  const bar = document.getElementById('vis-ask-bar');
  if (bar) {
    bar.classList.toggle('visible', _askBarVisible);
    if (_askBarVisible) document.getElementById('vis-ask-input')?.focus();
  }
}

async function _sendAskBar() {
  const input = document.getElementById('vis-ask-input');
  const q = input?.value?.trim();
  if (!q) return;
  input.value = '';
  _toggleAskBar();
  await _freeVoiceQuery(q);
}

/* ─── Module HUD Overlay (navegar sin salir de visión) ─── */
function _escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _getModuleHudContent(id) {
  try {
    const now = new Date();
    switch (id) {
      case 'tareas': {
        const ts   = JSON.parse(localStorage.getItem('arex_tareas') || '[]');
        const pend = ts.filter(t => !t.done);
        const venc = pend.filter(t => t.fecha && new Date(t.fecha) < now);
        if (!pend.length) return '<div class="vp-mhud-empty">Sin tareas pendientes ✓</div>';
        const items = pend.slice(0,5).map(t => {
          const hi = t.prioridad === 'alta' ? ' vp-mhud-hi' : '';
          const pre = t.prioridad==='alta' ? '⚡' : t.prioridad==='baja' ? '·' : '▹';
          return `<div class="vp-mhud-item${hi}">${pre} ${_escHtml(t.texto)}</div>`;
        }).join('');
        return `<div class="vp-mhud-stat">${pend.length} pendiente${pend.length>1?'s':''} · <span class="${venc.length?'vp-mhud-urg':''}">${venc.length} vencida${venc.length!==1?'s':''}</span></div>${items}`;
      }
      case 'gastos': {
        const gs  = JSON.parse(localStorage.getItem('arex_gastos_pers') || '[]');
        const mes = gs.filter(g => { const d=new Date(g.fecha||g.creadoEn||now); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear(); });
        const tot = mes.reduce((s,g)=>s+(g.monto||0),0);
        const cats = {};
        mes.forEach(g => { cats[g.categoria] = (cats[g.categoria]||0)+(g.monto||0); });
        const top = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,3);
        const catHtml = top.map(([k,v])=>`<div class="vp-mhud-item">${window.GP_CATS?.[k]?.e||'📦'} ${k}: $${v.toLocaleString('es-MX',{maximumFractionDigits:0})}</div>`).join('');
        return `<div class="vp-mhud-stat">$${tot.toLocaleString('es-MX',{maximumFractionDigits:0})} MXN este mes</div>${catHtml||'<div class="vp-mhud-empty">Sin gastos registrados</div>'}`;
      }
      case 'metas': {
        const ms  = JSON.parse(localStorage.getItem('arex_metas') || '[]');
        const act = ms.filter(m => !m.completada);
        if (!act.length) return '<div class="vp-mhud-empty">Sin metas activas</div>';
        const items = act.slice(0,4).map(m => {
          const pct = m.meta>0 ? Math.min(100,Math.round(((m.actual||0)/m.meta)*100)) : 0;
          return `<div class="vp-mhud-item vp-mhud-meta"><span>${_escHtml(m.nombre)}</span><span class="vp-mhud-pct">${pct}%</span></div>`;
        }).join('');
        return `<div class="vp-mhud-stat">${act.length} meta${act.length>1?'s':''} activa${act.length>1?'s':''}</div>${items}`;
      }
      case 'finanzas': {
        const data  = JSON.parse(localStorage.getItem('arex_finanzas_overrides') || '{}');
        const cards = data.tarjetas || [];
        if (!cards.length) return '<div class="vp-mhud-empty">Sin tarjetas registradas</div>';
        const debt = cards.reduce((s,c)=>s+(c.saldoActual||0),0);
        const html = cards.slice(0,3).map(c=>`<div class="vp-mhud-item">💳 ${_escHtml(c.nombre||c.banco||'Tarjeta')}: $${(c.saldoActual||0).toLocaleString('es-MX',{maximumFractionDigits:0})}</div>`).join('');
        return `<div class="vp-mhud-stat">${cards.length} tarjeta${cards.length>1?'s':''} · Deuda: $${debt.toLocaleString('es-MX',{maximumFractionDigits:0})}</div>${html}`;
      }
      case 'negocio': {
        const neg = JSON.parse(localStorage.getItem('arex_negocio') || '{}');
        const ventas = neg.ventas || [];
        const hoy = ventas.filter(v => new Date(v.fecha||now).toDateString()===now.toDateString());
        const ingresoHoy = hoy.reduce((s,v)=>s+(v.total||0),0);
        const stock = neg.inventario?.stockKg || 0;
        const html = hoy.slice(0,3).map(v=>`<div class="vp-mhud-item">📦 ${v.cantidad||0} ML · $${(v.total||0).toLocaleString('es-MX',{maximumFractionDigits:0})}</div>`).join('');
        return `<div class="vp-mhud-stat">Hoy: $${ingresoHoy.toLocaleString('es-MX',{maximumFractionDigits:0})} · Stock: ${stock}kg</div>${html||'<div class="vp-mhud-empty">Sin ventas hoy</div>'}`;
      }
      case 'proyectos': {
        const ps  = JSON.parse(localStorage.getItem('arex_proyectos') || '[]');
        const act = ps.filter(p => p.estado!=='completado'&&p.estado!=='cancelado');
        if (!act.length) return '<div class="vp-mhud-empty">Sin proyectos activos</div>';
        const items = act.slice(0,4).map(p=>`<div class="vp-mhud-item">⚡ ${_escHtml(p.nombre)}</div>`).join('');
        return `<div class="vp-mhud-stat">${act.length} proyecto${act.length>1?'s':''} activo${act.length>1?'s':''}</div>${items}`;
      }
      default: {
        const ctx = _getCrossCtx();
        return `<div class="vp-mhud-stat">Di "AREX + acción" para interactuar</div>`;
      }
    }
  } catch(e) { return '<div class="vp-mhud-empty">Error cargando datos</div>'; }
}

function _showModuleHud(id) {
  const hud = document.getElementById('vis-module-hud');
  if (!hud) return;
  _hudModuleId = id;
  const mod = _MODS_GRID.find(m => m.id === id) || { icon:'◈', label: id.toUpperCase() };
  const icon = document.getElementById('vis-mhud-icon');
  const title = document.getElementById('vis-mhud-title');
  if (icon)  icon.textContent  = mod.icon;
  if (title) title.textContent = mod.label;
  const body = document.getElementById('vis-mhud-body');
  if (body)  body.innerHTML    = _getModuleHudContent(id);

  // Extra action buttons per module
  const actionsEl = document.getElementById('vis-mhud-actions');
  if (actionsEl) {
    const extras = { tareas: '+ TAREA', gastos: '+ GASTO' };
    const extraHtml = extras[id] ? `<button class="vp-mhud-act-btn vp-mhud-act-add" data-vaction="${id==='tareas'?'add_tarea':'add_gasto'}">${extras[id]}</button>` : '';
    actionsEl.innerHTML = extraHtml;
    actionsEl.querySelectorAll('[data-vaction]').forEach(btn => {
      btn.addEventListener('click', () => _handleHudAction(btn.dataset.vaction, id));
    });
  }

  hud.classList.add('visible');
  _visionSpeak(`${mod.label} — ${_getModuleHudSpeech(id)}`);
}

function _getModuleHudSpeech(id) {
  try {
    const now = new Date();
    switch (id) {
      case 'tareas': {
        const ts = JSON.parse(localStorage.getItem('arex_tareas')||'[]');
        const p = ts.filter(t=>!t.done).length;
        const v = ts.filter(t=>!t.done&&t.fecha&&new Date(t.fecha)<now).length;
        return v>0 ? `${p} pendientes, ${v} vencidas.` : `${p} pendientes.`;
      }
      case 'gastos': {
        const gs = JSON.parse(localStorage.getItem('arex_gastos_pers')||'[]');
        const tot = gs.filter(g=>{ const d=new Date(g.fecha||now); return d.getMonth()===now.getMonth(); }).reduce((s,g)=>s+(g.monto||0),0);
        return `$${tot.toLocaleString('es-MX',{maximumFractionDigits:0})} pesos este mes.`;
      }
      case 'metas': {
        const ms = JSON.parse(localStorage.getItem('arex_metas')||'[]');
        return `${ms.filter(m=>!m.completada).length} metas activas.`;
      }
      default: return 'datos cargados.';
    }
  } catch { return ''; }
}

function _hideModuleHud() {
  document.getElementById('vis-module-hud')?.classList.remove('visible');
  _hudModuleId = null;
}

function _handleHudAction(action, moduleId) {
  if (action === 'add_tarea') {
    const txt = window.prompt('Nueva tarea:');
    if (txt?.trim()) {
      _voiceAddTarea(txt.trim());
      _showModuleHud(moduleId);
      _visionSpeak('Tarea agregada.');
    }
  } else if (action === 'add_gasto') {
    const txt = window.prompt('Gasto (ej: 150 comida):');
    if (txt?.trim()) {
      const parts = txt.trim().split(/\s+/);
      const monto = parseFloat(parts[0]);
      const cat   = parts[1] || 'otro';
      if (monto > 0) {
        window.gpAddGastoAuto?.(monto, cat, 'HUD AREX');
        _showModuleHud(moduleId);
        _visionSpeak(`Gasto de $${monto} registrado en ${cat}.`);
      }
    }
  }
}

/* ─── Gesture Customization ───────────────────────────── */
function _loadGestureMap() {
  if (_gestureMapCache) return _gestureMapCache;
  try { _gestureMapCache = JSON.parse(localStorage.getItem('arex_gesture_map') || '{}'); }
  catch { _gestureMapCache = {}; }
  return _gestureMapCache;
}
function _saveGestureMap(map) {
  _gestureMapCache = map;
  localStorage.setItem('arex_gesture_map', JSON.stringify(map));
}

const _GESTURE_ACTIONS_LABELS = {
  analyze:     '👁 ANALIZAR escena',
  stop:        '✋ DETENER / Silenciar',
  modules:     '◈ MOSTRAR módulos',
  toggle_auto: '⬤ MODO AUTO',
  voice:       '🎙 TOGGLE micrófono',
  scene:       '🌐 ANALIZAR escena',
  product:     '🔍 ANALIZAR objeto',
  text_scan:   '📄 LEER texto',
  flip:        '⟳ CAMBIAR cámara',
  recibo:      '🧾 ESCANEAR recibo',
};

function _toggleGestureConfig() {
  const panel = document.getElementById('vis-gesture-config');
  if (!panel) return;
  if (panel.classList.contains('visible')) { panel.classList.remove('visible'); return; }

  const list = document.getElementById('vis-gest-cfg-list');
  if (!list) return;
  const map = _loadGestureMap();
  const gestures = [
    { key:'open_hand', icon:'✋', label:'Mano abierta', def:'analyze' },
    { key:'fist',      icon:'✊', label:'Puño cerrado', def:'stop' },
    { key:'index_up',  icon:'☝', label:'Índice arriba', def:'modules' },
    { key:'peace',     icon:'✌', label:'Victoria / V', def:'toggle_auto' },
    { key:'thumb_up',  icon:'👍', label:'Pulgar arriba', def:'voice' },
  ];
  list.innerHTML = gestures.map(g => {
    const cur = map[g.key] || g.def;
    const opts = Object.entries(_GESTURE_ACTIONS_LABELS)
      .map(([k,v]) => `<option value="${k}" ${cur===k?'selected':''}>${v}</option>`)
      .join('');
    return `<div class="vp-gest-cfg-row">
      <span class="vp-gest-cfg-ico">${g.icon}</span>
      <span class="vp-gest-cfg-lbl">${g.label}</span>
      <select class="vp-gest-cfg-sel" data-gest="${g.key}">${opts}</select>
    </div>`;
  }).join('') + `<div class="vp-gest-cfg-note">Los cambios se guardan automáticamente.</div>`;

  list.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', () => {
      const m = _loadGestureMap();
      m[sel.dataset.gest] = sel.value;
      _gestureMapCache = null;
      _saveGestureMap(m);
    });
  });
  panel.classList.add('visible');
}

/* ─── Voice-add task/gasto (sin salir de visión) ──────── */
function _voiceAddTarea(text, priority = 'media') {
  try {
    const ts = JSON.parse(localStorage.getItem('arex_tareas') || '[]');
    const t  = { id:String(Date.now()), texto:text, prioridad:priority, done:false,
                  fecha:null, creadaEn:new Date().toISOString() };
    ts.push(t);
    localStorage.setItem('arex_tareas', JSON.stringify(ts));
    window.renderTareas?.();
    window._updateUrgencyBadges?.();
    return t;
  } catch { return null; }
}

/* ─── Navigate and close vision ──────────────────────── */
function _navigateAndClose(id) {
  closeVision();
  setTimeout(() => window.AREXNav?.cambiarModulo?.(id), 300);
}

/* ─── Module Navigation ───────────────────────────────── */
function _navigateModule(id) {
  _navigateAndClose(id);
}

window.visNavigate = (id) => _navigateAndClose(id);

/* ─── Gesture + Swipe + Pinch Handler ────────────────── */
function _handleGesture(type, data) {
  // Mirror compensation: front camera swipe directions are inverted
  if (_facingMode === 'user') {
    if (type === 'swipe_left')  type = 'swipe_right';
    else if (type === 'swipe_right') type = 'swipe_left';
  }
  // Swipe events — navigate modules
  if (type === 'swipe_left')  { _navigatePrevModule(); return; }
  if (type === 'swipe_right') { _navigateNextModule(); return; }
  if (type === 'swipe_up')    { _hudModuleId ? _hideModuleHud() : closeVision(); return; }
  if (type === 'swipe_down')  { _toggleModuleGrid(); return; }

  // Pinch — click element at cursor position
  if (type === 'pinch' && data) { _doPinchClick(data); return; }

  const g = window.GESTURES?.[type];
  if (!g) return;

  const customMap = _loadGestureMap();
  const action = customMap[type] || g.action;
  const actionLabel = (_GESTURE_ACTIONS_LABELS[action] || g.label).replace(/^[^\s]+\s/, '');

  const telGest = document.getElementById('vis-tel-gest');
  if (telGest) telGest.textContent = `${g.icon} ${type}`;

  const flash = document.getElementById('vis-gest-flash');
  if (flash) {
    flash.textContent = `${g.icon} ${actionLabel}`;
    flash.style.color = g.color;
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 900);
  }

  const _GESTURE_PHRASES = {
    analyze:      ['Voy a ver qué hay ahí.', 'A ver qué encuentro.', 'Dame un segundo.'],
    scene:        ['Déjame describir lo que te rodea.', 'Analizando la escena completa.'],
    product:      ['A ver qué es eso.', 'Identificando el objeto.'],
    text_scan:    ['Un momento, leyendo.', 'Déjame leer eso.'],
    recibo:       ['Dame ese recibo.', 'Escaneando el comprobante.'],
    stop:         ['Listo, detenido.', 'Entendido.'],
    modules:      ['Aquí los módulos.'],
    toggle_auto:  [],
    voice:        [],
    flip:         ['Cambiando cámara.'],
  };
  const _pick = (arr) => arr.length ? arr[Math.floor(Math.random() * arr.length)] : null;

  switch (action) {
    case 'analyze':
      if (!_busy) { _visionSpeak(_pick(_GESTURE_PHRASES.analyze)); _analyze('describe'); }
      break;
    case 'scene':
      if (!_busy) { _visionSpeak(_pick(_GESTURE_PHRASES.scene)); _analyze('scene'); }
      break;
    case 'product':
      if (!_busy) { _visionSpeak(_pick(_GESTURE_PHRASES.product)); _analyze('product'); }
      break;
    case 'text_scan':
      if (!_busy) { _visionSpeak(_pick(_GESTURE_PHRASES.text_scan)); _analyze('text'); }
      break;
    case 'recibo':
      if (!_busy) { _visionSpeak(_pick(_GESTURE_PHRASES.recibo)); _analyze('recibo'); }
      break;
    case 'stop':
      _contOn = false;
      window.speechSynthesis?.cancel();
      _setStatus('LISTO');
      _visionSpeak(_pick(_GESTURE_PHRASES.stop));
      break;
    case 'modules':
      _visionSpeak(_pick(_GESTURE_PHRASES.modules));
      _toggleModuleGrid();
      break;
    case 'toggle_auto':
      _toggleContinuous();
      break;
    case 'voice':
      _toggleVoiceCmd();
      break;
    case 'flip':
      _visionSpeak(_pick(_GESTURE_PHRASES.flip));
      _flipCamera();
      break;
  }
}

/* ─── Swipe Module Navigation ─────────────────────────── */
const _MOD_ORDER = [
  'inicio','finanzas','metas','tareas','notas',
  'negocio','gastos','proyectos','evidencias','control','chat',
];

function _navigatePrevModule() {
  const cur = _hudModuleId || window.AREXNav?.moduloActual || 'chat';
  const idx = _MOD_ORDER.indexOf(cur);
  const prev = _MOD_ORDER[idx > 0 ? idx - 1 : _MOD_ORDER.length - 1];
  _gestureFlash('◀ ' + prev.toUpperCase(), '#00d4ff');
  _showModuleHud(prev);
}

function _navigateNextModule() {
  const cur = _hudModuleId || window.AREXNav?.moduloActual || 'chat';
  const idx = _MOD_ORDER.indexOf(cur);
  const next = _MOD_ORDER[(idx + 1) % _MOD_ORDER.length];
  _gestureFlash('▶ ' + next.toUpperCase(), '#00d4ff');
  _showModuleHud(next);
}

function _gestureFlash(text, color) {
  const flash = document.getElementById('vis-gest-flash');
  if (!flash) return;
  flash.textContent = text;
  flash.style.color = color || '#00d4ff';
  flash.classList.add('active');
  setTimeout(() => flash.classList.remove('active'), 900);
}

/* ─── Pinch-to-Click ──────────────────────────────────── */
function _doPinchClick(data) {
  const canvas = document.getElementById('vis-gesture-canvas');
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const sx = rect.left + data.x * rect.width;
  const sy = rect.top  + data.y * rect.height;
  // Canvas already has pointer-events:none from CSS — elementFromPoint looks through it
  // Temporarily hide tap-canvas too so pinch can reach buttons underneath
  const tapCv = document.getElementById('vis-tap-canvas');
  const prevPE = tapCv?.style.pointerEvents;
  if (tapCv) tapCv.style.pointerEvents = 'none';
  const el = document.elementFromPoint(sx, sy);
  if (tapCv) tapCv.style.pointerEvents = prevPE || '';
  if (el && el.tagName !== 'CANVAS' && el.tagName !== 'VIDEO' && el !== _panel) {
    el.click();
    _gestureFlash('🤏 TAP', '#00ffaa');
    // Ripple effect at pinch location
    const ripple = document.createElement('div');
    ripple.className = 'pinch-ripple';
    ripple.style.cssText = `left:${sx}px;top:${sy}px;`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 420);
  }
}

/* ─── Module Grid ─────────────────────────────────────── */
function _toggleModuleGrid() {
  _moduleGridVis = !_moduleGridVis;
  document.getElementById('vis-module-grid')?.classList.toggle('visible', _moduleGridVis);
}

function _hideModuleGrid() {
  _moduleGridVis = false;
  document.getElementById('vis-module-grid')?.classList.remove('visible');
}

/* ─── Telemetry Updater ───────────────────────────────── */
function _updateTelemetry() {
  if (!_panel) return;
  const telCam = document.getElementById('vis-tel-cam');
  if (telCam && _video?.videoWidth) {
    telCam.textContent = `${_video.videoWidth}×${_video.videoHeight}`;
  }
  const telMode = document.getElementById('vis-tel-mode');
  if (telMode) {
    telMode.textContent = _contOn ? 'AUTO' : _gestureOn ? 'GESTOS' : 'VISUAL';
  }
  if (!_voiceCmdOn) {
    const telVoice = document.getElementById('vis-tel-voice');
    if (telVoice) telVoice.textContent = '—';
  }
}

/* ─── Vision Workspace ─────────────────────────────────
   Full module panels + mini-chat visible alongside camera
─────────────────────────────────────────────────────── */

window._toggleWorkspace = function() {
  _wkOn ? _closeWorkspace() : _openWorkspace();
};

window._closeWorkspace = function() {
  _wkOn = false;
  document.getElementById('vis-workspace')?.classList.remove('vw-active');
  _panel?.classList.remove('wk-open');
};

function _openWorkspace() {
  _wkOn = true;
  const ws = document.getElementById('vis-workspace');
  if (!ws) return;
  ws.classList.add('vw-active');
  _panel?.classList.add('wk-open');
  _wkRender();
  _visionSpeak('Panel abierto. ¿Qué quieres revisar?');
}

function _wkRender() {
  const body = document.getElementById('vis-wk-body');
  if (!body) return;
  body.innerHTML = _wkContent(_wkModId);
  // bind wk action buttons after render
  body.querySelectorAll('[data-wkaction]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.wkaction;
      const idx    = btn.dataset.idx;
      if (action === 'check-tarea') _wkCheckTarea(parseInt(idx));
      if (action === 'add-tarea')   _wkAddTarea();
      if (action === 'add-gasto')   _wkAddGasto();
    });
  });
}

function _wkContent(id) {
  const now  = new Date();
  const esc  = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  switch (id) {
    case 'tareas': {
      const ts   = JSON.parse(localStorage.getItem('arex_tareas')  || '[]');
      const pend = ts.filter(t => !t.done);
      const done = ts.filter(t =>  t.done);
      let html = `<div class="wk-section">
        <div class="wk-sec-lbl">PENDIENTES (${pend.length})</div>`;
      if (!pend.length) {
        html += '<div class="wk-empty">Sin tareas pendientes ✓</div>';
      } else {
        html += pend.slice(0,8).map((t, i) => {
          const allIdx = ts.indexOf(t);
          const pri = t.prioridad || 'media';
          const fecha = t.fecha ? ` · ${t.fecha}` : '';
          return `<div class="wk-item" data-wkaction="check-tarea" data-idx="${allIdx}">
            <div class="wk-chk"></div>
            <div class="wk-pri ${pri}"></div>
            <div class="wk-txt">${esc(t.texto)}<span style="color:var(--text-muted);font-size:9px">${fecha}</span></div>
          </div>`;
        }).join('');
      }
      if (done.length) {
        html += `<div class="wk-sec-lbl" style="margin-top:12px">COMPLETADAS (${done.length})</div>`;
        html += done.slice(-3).map(t =>
          `<div class="wk-item done"><div class="wk-chk">✓</div><div class="wk-txt">${esc(t.texto)}</div></div>`
        ).join('');
      }
      html += `</div>
        <div class="wk-add">
          <input class="wk-in" id="wk-t-in" placeholder="Nueva tarea..."/>
          <button class="wk-btn" data-wkaction="add-tarea">+</button>
        </div>`;
      return html;
    }

    case 'gastos': {
      const gs  = JSON.parse(localStorage.getItem('arex_gastos_pers') || '[]');
      const mes = gs.filter(g => {
        const d = new Date(g.fecha || g.creadoEn || now);
        return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
      });
      const tot = mes.reduce((s,g) => s+(g.monto||0), 0);
      const cats = {};
      mes.forEach(g => { cats[g.categoria||'Otro'] = (cats[g.categoria||'Otro']||0)+(g.monto||0); });
      const topCats = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,4);
      let html = `<div class="wk-section">
        <div class="wk-sec-lbl">RESUMEN DEL MES</div>
        <div class="wk-stat"><span>TOTAL GASTADO</span><span>$${tot.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
        <div class="wk-stat"><span>TRANSACCIONES</span><span>${mes.length}</span></div>
      </div>`;
      if (topCats.length) {
        html += `<div class="wk-section"><div class="wk-sec-lbl">POR CATEGORÍA</div>`;
        html += topCats.map(([k,v]) =>
          `<div class="wk-stat"><span>${esc(k)}</span><span>$${v.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>`
        ).join('');
        html += `</div>`;
      }
      const last5 = mes.slice(-5).reverse();
      if (last5.length) {
        html += `<div class="wk-section"><div class="wk-sec-lbl">ÚLTIMAS</div>`;
        html += last5.map(g =>
          `<div class="wk-stat"><span>${esc(g.concepto||g.categoria||'Gasto')}</span><span>$${(g.monto||0).toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>`
        ).join('');
        html += `</div>`;
      }
      html += `<div class="wk-add">
        <input class="wk-in" id="wk-g-in" placeholder="Ej: 150 comida"/>
        <button class="wk-btn" data-wkaction="add-gasto">+</button>
      </div>`;
      return html;
    }

    case 'metas': {
      const ms  = JSON.parse(localStorage.getItem('arex_metas') || '[]');
      const act = ms.filter(m => !m.completada);
      const com = ms.filter(m =>  m.completada);
      if (!act.length && !com.length) return '<div class="wk-empty">Sin metas registradas</div>';
      let html = `<div class="wk-section"><div class="wk-sec-lbl">ACTIVAS (${act.length})</div>`;
      if (!act.length) {
        html += '<div class="wk-empty">Todas las metas completadas 🎯</div>';
      } else {
        html += act.slice(0,5).map(m => {
          const pct = m.progreso || 0;
          return `<div class="wk-item" style="flex-direction:column;align-items:flex-start;gap:5px">
            <div class="wk-txt">${esc(m.titulo||m.texto||'Meta')}</div>
            <div class="wk-prog-bar" style="width:100%"><div class="wk-prog-fill" style="width:${pct}%"></div></div>
            <span style="font-size:9px;color:var(--text-muted)">${pct}%</span>
          </div>`;
        }).join('');
      }
      html += `</div>`;
      if (com.length) {
        html += `<div class="wk-section"><div class="wk-sec-lbl">COMPLETADAS (${com.length})</div>`;
        html += com.slice(-3).map(m =>
          `<div class="wk-stat"><span>✓ ${esc(m.titulo||m.texto||'Meta')}</span><span style="color:var(--green)">100%</span></div>`
        ).join('');
        html += `</div>`;
      }
      return html;
    }

    case 'finanzas': {
      const fd = JSON.parse(localStorage.getItem('arex_finanzas_overrides') || localStorage.getItem('arex_finanzas') || '{}');
      const ing = fd.ingresoMensual || 0;
      const deu = (fd.deudas||[]).reduce((s,d)=>s+(d.saldo||0),0);
      const prx = (fd.deudas||[]).filter(d=>{
        if (!d.fechaPago) return false;
        const fp = new Date(d.fechaPago+'T00:00:00');
        const diff = (fp-now)/(1000*60*60*24);
        return diff>=0 && diff<=14;
      });
      let html = `<div class="wk-section">
        <div class="wk-sec-lbl">PANORAMA</div>
        <div class="wk-stat"><span>INGRESO MENSUAL</span><span>$${ing.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
        <div class="wk-stat"><span>DEUDA TOTAL</span><span style="color:${deu>0?'#ff8844':'var(--green)'}">$${deu.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
      </div>`;
      if (prx.length) {
        html += `<div class="wk-section"><div class="wk-sec-lbl">PRÓXIMOS PAGOS</div>`;
        html += prx.map(d =>
          `<div class="wk-stat"><span>${esc(d.nombre)}</span><span style="color:#ff9900">$${(d.pago||d.monto||0).toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>`
        ).join('');
        html += `</div>`;
      }
      return html;
    }

    case 'negocio': {
      const nd = JSON.parse(localStorage.getItem('arex_negocio') || '{}');
      const ventas  = (nd.ventas||[]);
      const gastos  = (nd.gastos||[]);
      const mesV = ventas.filter(v=>{const d=new Date(v.fecha||now);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
      const mesG = gastos.filter(g=>{const d=new Date(g.fecha||now);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();});
      const totV = mesV.reduce((s,v)=>s+(v.total||0),0);
      const totG = mesG.reduce((s,g)=>s+(g.monto||0),0);
      const gan  = totV - totG;
      const stock = nd.inventario?.stockKg ?? '—';
      return `<div class="wk-section">
        <div class="wk-sec-lbl">FRIJOL MAYOCOBA · ESTE MES</div>
        <div class="wk-stat"><span>VENTAS</span><span style="color:var(--green)">$${totV.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
        <div class="wk-stat"><span>GASTOS</span><span style="color:#ff8844">$${totG.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
        <div class="wk-stat"><span>GANANCIA</span><span style="color:${gan>=0?'var(--cyan)':'#ff4444'}">$${gan.toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>
        <div class="wk-stat"><span>STOCK DISPONIBLE</span><span>${stock} kg</span></div>
      </div>
      <div class="wk-section">
        <div class="wk-sec-lbl">ÚLTIMAS VENTAS</div>
        ${mesV.slice(-4).reverse().map(v=>`<div class="wk-stat"><span>${esc(v.sucursal||'Venta')}</span><span>$${(v.total||0).toLocaleString('es-MX',{maximumFractionDigits:0})}</span></div>`).join('') || '<div class="wk-empty">Sin ventas este mes</div>'}
      </div>`;
    }

    case 'notas': {
      const ns  = JSON.parse(localStorage.getItem('arex_notas') || '[]');
      if (!ns.length) return '<div class="wk-empty">Sin notas guardadas</div>';
      return `<div class="wk-section"><div class="wk-sec-lbl">NOTAS (${ns.length})</div>` +
        ns.slice(-6).reverse().map(n =>
          `<div class="wk-item" style="flex-direction:column;align-items:flex-start;gap:3px">
            <div style="font-size:9px;color:var(--text-muted);letter-spacing:1px">${esc(n.categoria||'General')}</div>
            <div class="wk-txt">${esc(n.texto||n.cuerpo||'')}</div>
          </div>`
        ).join('') + `</div>`;
    }

    default:
      return `<div class="wk-empty">Módulo en construcción</div>`;
  }
}

function _wkCheckTarea(idx) {
  const ts = JSON.parse(localStorage.getItem('arex_tareas') || '[]');
  if (ts[idx]) {
    ts[idx].done = !ts[idx].done;
    localStorage.setItem('arex_tareas', JSON.stringify(ts));
    window.renderTareas?.();
    _wkRender();
    _visionSpeak(ts[idx].done ? 'Tarea completada.' : 'Tarea reactivada.');
  }
}

function _wkAddTarea() {
  const input = document.getElementById('wk-t-in');
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = '';
  _voiceAddTarea(text, 'media');
  _wkRender();
  _visionSpeak(`Tarea agregada.`);
}

function _wkAddGasto() {
  const input = document.getElementById('wk-g-in');
  const raw   = input?.value?.trim();
  if (!raw) return;
  input.value = '';
  // parse "150 comida" or "1500 compras"
  const m = raw.match(/^(\d+(?:[.,]\d+)?)\s*(.+)?$/);
  if (!m) return;
  const monto = parseFloat(m[1].replace(/,/g,''));
  const cat   = (m[2] || 'otro').trim();
  if (monto > 0) {
    window.gpAddGastoAuto?.(monto, cat, 'AREX Visión');
    _wkRender();
    _visionSpeak(`Gasto de ${monto} pesos registrado.`);
  }
}

async function _wkSendChat() {
  const input = document.getElementById('vis-wk-inp');
  const text  = input?.value?.trim();
  if (!text) return;
  input.value = '';

  const msgs = document.getElementById('vis-wk-msgs');
  if (msgs) {
    const um = document.createElement('div');
    um.className = 'wk-msg-u';
    um.textContent = text;
    msgs.appendChild(um);
    msgs.scrollTop = msgs.scrollHeight;
  }

  const cfg = window.AREX_CONFIG;
  if (!cfg?.groqKey) {
    _wkAppendArex('Sin API key configurada.');
    return;
  }

  const pending = msgs ? document.createElement('div') : null;
  if (pending) {
    pending.className = 'wk-msg-a';
    pending.textContent = '...';
    msgs.appendChild(pending);
    msgs.scrollTop = msgs.scrollHeight;
  }

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.groqKey}` },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 180,
        messages: [
          { role: 'system', content: 'Eres AREX, asistente personal de Alexiz. Estás en modo Visión AR. Responde en 1-2 oraciones naturales y directas. Sin bullets, sin markdown.' },
          { role: 'user', content: text },
        ],
      }),
    });
    const data  = await res.json();
    const reply = data.choices?.[0]?.message?.content || 'Sin respuesta.';
    if (pending) { pending.textContent = reply; msgs.scrollTop = msgs.scrollHeight; }
    _visionSpeak(reply);
  } catch {
    if (pending) { pending.textContent = 'Error de conexión.'; }
  }
}

function _wkAppendArex(text) {
  const msgs = document.getElementById('vis-wk-msgs');
  if (!msgs) return;
  const el = document.createElement('div');
  el.className = 'wk-msg-a';
  el.textContent = text;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}
