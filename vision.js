// AREX — Visión en vivo · MARK 40
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
      return `Eres AREX en modo observación en vivo, ciclo ${_contCycle}.${pc}${ctx}

Haz UNA observación breve y directa sobre lo que ves ahora — una acción, cambio, detalle nuevo, o comentario ingenioso sobre la escena. Si hay una persona y coincide con alguna de las conocidas, dirígete a ella. 1-2 frases máximo. Tono JARVIS: observador, inteligente, con personalidad. En español.`;
    }
    return `Eres AREX, sistema IA de Alexiz (Hermosillo, México). Observación en vivo.${pc}${ctx}

Describe EXACTAMENTE lo que observas visualmente:
• PERSONAS: color y largo de cabello, complexión, ropa (colores, tipo de prenda), expresión facial, postura. Si coincide con alguna persona conocida arriba, salúdala por nombre. NUNCA respondas "no puedo describir personas" — siempre describe lo que VES físicamente.
• OBJETOS: nombre específico, marca visible, color, material, texto legible.
• ENTORNO: tipo de lugar, iluminación, colores dominantes, contexto.

Responde en 2-3 frases directas. Tono JARVIS: preciso, observador, con personalidad. En español.`;
  }

  if (mode === 'scene') {
    return `Eres AREX. Análisis exhaustivo de escena para Alexiz.${pc}${ctx}

Lista TODOS los elementos visibles:
• Personas: apariencia física (cabello, ropa, complexión, expresión, postura). Si coincide con alguna persona conocida, nómbrala.
• Objetos: nombre, marca, colores, materiales.
• Ambiente: interior/exterior, iluminación, colores dominantes, posibles actividades.
Detallado y específico. En español.`;
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
};

const MODE_LABELS = {
  describe: '👁 VER',
  product:  '🔍 OBJETO',
  text:     '📄 TEXTO',
  scene:    '🌐 ESCENA',
};

const MODE_RES = { describe: 480, product: 640, text: 640, scene: 640 };

/* ─── Public API ──────────────────────────────────────── */
export async function openVision() {
  if (_panel) { _panel.style.display = 'flex'; _video?.play(); return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    _say('Cámara no disponible en este navegador.'); return;
  }
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: _facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch (e) {
    _say(`No se pudo acceder a la cámara.\n\n${e.message}`); return;
  }
  _buildPanel();
  document.getElementById('btn-vision')?.classList.add('active');
}

export function closeVision() {
  _contOn      = false;
  _contRunning = false;
  _contCycle   = 0;
  if (_arMode && typeof window.stopContinuousMode === 'function') {
    window.stopContinuousMode();
  }
  _arMode = false;
  window.speechSynthesis?.cancel();
  _stopIosKa();
  clearTimeout(_resultTimer);
  clearInterval(_telTimer);
  _telTimer = null;
  // Stop gesture engine
  if (_gestureOn) { _gestureOn = false; if (typeof stopGestureEngine === 'function') stopGestureEngine(); }
  // Stop voice commands
  _stopVoiceCmd();
  _stream?.getTracks().forEach(t => t.stop());
  _stream = null; _video = null;
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
      <div class="vp-tel-hdr"><span class="vp-tel-dot"></span>GESTOS</div>
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
    </div>

    <!-- SWIPE HINT -->
    <div class="vp-swipe-hint">◀ DESLIZA ▶ · PELLIZCA PARA SELECCIONAR</div>

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
      <button class="vp-action-btn" data-mode="scene" onclick="captureAndAnalyze('scene')">
        <span class="vp-btn-ico">🌐</span><span class="vp-btn-lbl">ESCENA</span>
      </button>
      <button class="vp-action-btn vp-qr-btn" id="vis-qr">
        <span class="vp-btn-ico">🔲</span><span class="vp-btn-lbl">QR</span>
      </button>
      <button class="vp-action-btn vp-cont-btn" id="vis-cont">
        <span class="vp-btn-ico">⬤</span><span class="vp-btn-lbl">AUTO</span>
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

  // Close module grid on outside tap
  document.getElementById('vis-module-grid').addEventListener('click', e => {
    if (e.target === document.getElementById('vis-module-grid')) _hideModuleGrid();
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

  // Start telemetry ticker
  _telTimer = setInterval(_updateTelemetry, 3000);
  _updateTelemetry();
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
  const ready = await _waitForVideo();
  if (!ready) return null;
  const vw = _video.videoWidth, vh = _video.videoHeight;
  const scale = Math.min(1, maxPx / Math.max(vw, vh));
  const c = document.createElement('canvas');
  c.width  = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  c.getContext('2d').drawImage(_video, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.80);
  if (dataUrl.length < 5000) return null;
  return dataUrl;
}

/* ─── Analysis ────────────────────────────────────────── */
async function _analyze(mode, extra = '') {
  if (_busy) return;
  _busy = true;

  // Safety: si _analyze se cuelga por cualquier razón, libera _busy a los 35s
  // Evita que el botón quede permanentemente bloqueado hasta recargar la app
  clearTimeout(_busyTimer);
  _busyTimer = setTimeout(() => {
    _busy = false;
    _setScanActive(false);
    _setAnalyzing(false, mode);
    _setStatus('LISTO');
    console.warn('AREX Vision: _busy forzado a false por timeout de seguridad');
  }, 35000);

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

  const prompt    = extra || _buildVisionPrompt(mode);
  const geminiKey = window.AREX_CONFIG?.geminiKey;
  const groqKey   = window.AREX_CONFIG?.groqKey;

  try {
    let reply;

    if (groqKey) {
      try {
        _setStatus('ANALIZANDO · GROQ...');
        reply = await _withTimeout(_callGroq(frame, prompt, groqKey), 25000);
      } catch (e) {
        console.warn('Groq vision failed:', e.message);
      }
    }

    if (!reply && geminiKey) {
      _setStatus('ANALIZANDO · GEMINI...');
      reply = await _withTimeout(_callGemini(frame, prompt, geminiKey), 25000);
    }

    if (!reply) throw new Error('No hay API de visión disponible. Verifica tus keys en /config.');

    const label = MODE_LABELS[mode] || 'ANÁLISIS';
    _showResult(label, reply, frame);
    _say(`**[${label}]**\n\n${reply}`);
    _visionSpeak(reply);

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

async function _callGroq(frame, prompt, key) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
      max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: frame } },
        { type: 'text', text: prompt }
      ]}]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq ${res.status}: ${err?.error?.message || res.statusText}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || 'Sin respuesta de Groq.';
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
      _showResult('🔲 QR/CÓDIGO', 'No se detectó ningún código.\nAcerca la cámara e intenta de nuevo.', frame);
    } else {
      const txt = codes.map(c => `**${c.format.toUpperCase()}:** ${c.rawValue}`).join('\n\n');
      _showResult('🔲 QR/CÓDIGO', txt, frame);
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
function _showResult(label, text, thumb) {
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
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  if (body) body.innerHTML = html;
  panel.classList.add('visible');
  clearTimeout(_resultTimer);
  if (!_contOn) _resultTimer = setTimeout(_hideResult, 20000);
}

function _hideResult() {
  document.getElementById('vis-result')?.classList.remove('visible');
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
  if (lbl) lbl.textContent = _contOn ? 'AUTO ON' : 'AUTO';
  if (_contOn) {
    _setStatus('MODO CONTINUO');
    _runContinuous();
  } else {
    window.speechSynthesis?.cancel();
    _stopIosKa();
    _setStatus('LISTO');
  }
}

async function _runContinuous() {
  if (_contRunning) return;
  _contRunning = true;
  _contCycle   = 0;
  try {
    while (_contOn) {
      _contCycle++;
      await _analyze('describe');
      if (!_contOn) break;
      await _waitForSpeech();
      if (!_contOn) break;
      // Primer ciclo: pausa más corta para que se sienta responsivo
      await new Promise(r => setTimeout(r, _contCycle === 1 ? 800 : 2200));
    }
  } finally {
    _contRunning = false;
    _contCycle   = 0;
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

/* ─── Camera flip ─────────────────────────────────────── */
async function _flipCamera() {
  if (!_stream) return;
  _stream.getTracks().forEach(t => t.stop());
  _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    if (_video) { _video.srcObject = _stream; _video.play().catch(() => {}); }
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
  if (!_voiceOn || !window.speechSynthesis) return;

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
  u.lang = 'es-MX'; u.rate = 0.91; u.pitch = 0.78; u.volume = 1;

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
  u.onend   = () => _stopIosKa();
  u.onerror = () => _stopIosKa();

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
    canvas.width  = _video.clientWidth  || 320;
    canvas.height = _video.clientHeight || 480;
    if (typeof initGestureEngine === 'function') {
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

  if (/\b(analiz|ver|mira|describe|scene|escena|producto|objeto|texto)\b/.test(t)) {
    const mode = /\b(escena|scene)\b/.test(t) ? 'scene'
               : /\b(producto|objeto)\b/.test(t) ? 'product'
               : /\b(texto|lee)\b/.test(t) ? 'text' : 'describe';
    feedback(`ANALIZAR · ${mode.toUpperCase()}`);
    _say(`**[Voz]** Analizando... *${t}*`);
    _analyze(mode);
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

  if (/\b(módulos|modulos|navegar|navega)\b/.test(t)) {
    feedback('MÓDULOS');
    _toggleModuleGrid();
    return;
  }

  const modMap = {
    inicio:     ['inicio', 'home'],
    finanzas:   ['finanzas', 'dinero'],
    metas:      ['metas', 'meta', 'objetivos'],
    tareas:     ['tareas', 'tarea', 'pendientes'],
    notas:      ['notas', 'nota', 'apuntes'],
    negocio:    ['negocio', 'tienda', 'inventario'],
    gastos:     ['gastos', 'gasto'],
    proyectos:  ['proyectos', 'proyecto'],
    evidencias: ['evidencias', 'evidencia'],
    control:    ['control', 'configuración', 'ajustes'],
    chat:       ['chat', 'chatear'],
  };
  for (const [id, keywords] of Object.entries(modMap)) {
    if (keywords.some(k => t.includes(k))) {
      feedback(`IR A ${id.toUpperCase()}`);
      _say(`**[Voz]** Navegando a ${id}...`);
      setTimeout(() => _navigateModule(id), 800);
      return;
    }
  }
}

/* ─── Module Navigation ───────────────────────────────── */
function _navigateModule(id) {
  closeVision();
  setTimeout(() => {
    if (typeof window.AREXNav?.cambiarModulo === 'function') {
      window.AREXNav.cambiarModulo(id);
    } else if (typeof window.cambiarModulo === 'function') {
      window.cambiarModulo(id);
    }
  }, 300);
}

window.visNavigate = (id) => _navigateModule(id);

/* ─── Gesture + Swipe + Pinch Handler ────────────────── */
function _handleGesture(type, data) {
  // Swipe events — navigate modules
  if (type === 'swipe_left')  { _navigatePrevModule(); return; }
  if (type === 'swipe_right') { _navigateNextModule(); return; }
  if (type === 'swipe_up')    { closeVision(); return; }
  if (type === 'swipe_down')  { _toggleModuleGrid(); return; }

  // Pinch — click element at cursor position
  if (type === 'pinch' && data) { _doPinchClick(data); return; }

  const g = window.GESTURES?.[type];
  if (!g) return;

  const telGest = document.getElementById('vis-tel-gest');
  if (telGest) telGest.textContent = `${g.icon} ${type}`;

  const flash = document.getElementById('vis-gest-flash');
  if (flash) {
    flash.textContent = `${g.icon} ${g.label}`;
    flash.style.color = g.color;
    flash.classList.add('active');
    setTimeout(() => flash.classList.remove('active'), 900);
  }

  switch (g.action) {
    case 'analyze':
      _say('**[Gesto ✋]** Analizando...');
      _analyze('describe');
      break;
    case 'stop':
      _contOn = false;
      window.speechSynthesis?.cancel();
      _setStatus('LISTO');
      _say('**[Gesto ✊]** Detenido.');
      break;
    case 'modules':
      _toggleModuleGrid();
      break;
    case 'toggle_auto':
      _toggleContinuous();
      break;
    case 'voice':
      _toggleVoiceCmd();
      break;
  }
}

/* ─── Swipe Module Navigation ─────────────────────────── */
const _MOD_ORDER = [
  'inicio','finanzas','metas','tareas','notas',
  'negocio','gastos','proyectos','evidencias','control','chat',
];

function _navigatePrevModule() {
  const cur = window.AREXNav?.moduloActual || 'chat';
  const idx = _MOD_ORDER.indexOf(cur);
  const prev = _MOD_ORDER[idx > 0 ? idx - 1 : _MOD_ORDER.length - 1];
  _gestureFlash('◀ ' + prev.toUpperCase(), '#00d4ff');
  _say(`**[Gesto ◀]** → ${prev}`);
  setTimeout(() => _navigateModule(prev), 500);
}

function _navigateNextModule() {
  const cur = window.AREXNav?.moduloActual || 'chat';
  const idx = _MOD_ORDER.indexOf(cur);
  const next = _MOD_ORDER[(idx + 1) % _MOD_ORDER.length];
  _gestureFlash('▶ ' + next.toUpperCase(), '#00d4ff');
  _say(`**[Gesto ▶]** → ${next}`);
  setTimeout(() => _navigateModule(next), 500);
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
  // Temporarily disable canvas pointer events so elementFromPoint works
  canvas.style.pointerEvents = 'auto';
  const el = document.elementFromPoint(sx, sy);
  canvas.style.pointerEvents = 'none';
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
