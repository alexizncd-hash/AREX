// AREX — Visión en vivo · MARK 39
// Full-screen HUD · Groq Scout first · Gemini fallback
// Resultados EN el panel · Modo continuo secuencial · iOS TTS keep-alive

/* ─── State ───────────────────────────────────────────── */
let _stream       = null;
let _video        = null;
let _panel        = null;
let _resultTimer  = null;
let _contOn       = false;
let _busy         = false;
let _facingMode   = 'environment';
let _voiceOn      = true;
let _iosKa        = null;   // iOS speech keep-alive interval

/* ─── Prompts ─────────────────────────────────────────── */
const PROMPTS = {
  describe: `Eres AREX, asistente IA de Alexiz. Describe con PRECISIÓN ESPECÍFICA lo que ves en esta imagen: qué objetos concretos hay, sus colores exactos, marcas visibles, textos legibles, posición de elementos. Menciona detalles relevantes. Si hay una persona descríbela físicamente. Si es Alexiz (joven mexicano universitario, delgado), salúdalo. NO seas genérico. 2-3 frases específicas. En español.`,

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

  scene: `Eres AREX. Haz un análisis EXHAUSTIVO de esta escena: lista todos los objetos visibles, describe personas si las hay (ropa, postura, expresión), el ambiente (interior/exterior, iluminación, colores dominantes), posibles actividades, contexto general. Sé específico y detallado. Si ves a Alexiz, menciónalo. En español.`,
};

const MODE_LABELS = {
  describe: '👁 VER',
  product:  '🔍 OBJETO',
  text:     '📄 TEXTO',
  scene:    '🌐 ESCENA',
};

/* ─── Resolución por modo ─────────────────────────────── */
// Modo continuo usa 480px (velocidad), modos de análisis 640px (detalle)
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
  _contOn = false;
  window.speechSynthesis?.cancel();
  _stopIosKa();
  clearTimeout(_resultTimer);
  _stream?.getTracks().forEach(t => t.stop());
  _stream = null; _video = null;
  _panel?.remove(); _panel = null;
  document.getElementById('btn-vision')?.classList.remove('active');
}

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
function _buildPanel() {
  const el = document.createElement('div');
  el.id = 'vision-panel';
  el.innerHTML = `
    <video id="vis-video" autoplay playsinline muted></video>
    <div class="vp-scan-line" id="vis-scan"></div>
    <div class="vp-corner vp-tl"></div>
    <div class="vp-corner vp-tr"></div>
    <div class="vp-corner vp-bl"></div>
    <div class="vp-corner vp-br"></div>

    <div class="vp-hud-top">
      <div class="vp-title"><span class="vp-dot"></span>AREX · VISIÓN</div>
      <div class="vp-top-btns">
        <button class="vp-icon-btn vp-voice-btn on" id="vis-voice" title="Voz">🔊</button>
        <button class="vp-icon-btn" id="vis-flip" title="Cambiar cámara">⟳</button>
        <button class="vp-icon-btn vp-close-btn" onclick="closeVision()" title="Cerrar">✕</button>
      </div>
    </div>

    <div class="vp-status-badge" id="vis-status">
      <span class="vp-status-dot"></span>
      <span id="vis-status-txt">LISTO</span>
    </div>

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

  document.getElementById('vis-cont').addEventListener('click', _toggleContinuous);
  document.getElementById('vis-flip').addEventListener('click', _flipCamera);
  document.getElementById('vis-qr').addEventListener('click', _detectQR);
  document.getElementById('vis-result-close').addEventListener('click', _hideResult);
  document.getElementById('vis-voice').addEventListener('click', _toggleVoice);
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

  const prompt    = extra || PROMPTS[mode] || PROMPTS.describe;
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
    _busy = false;
    _setScanActive(false);
    _setAnalyzing(false, mode);
  }
}

async function _callGemini(frame, prompt, key) {
  const [, b64] = frame.split(',');
  const models = ['gemini-2.0-flash', 'gemini-1.5-flash-latest'];
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
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
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
  while (_contOn) {
    await _analyze('describe');
    if (!_contOn) break;
    await _waitForSpeech();       // esperar a que termine de hablar
    if (!_contOn) break;
    await new Promise(r => setTimeout(r, 2000));  // pausa entre ciclos
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
