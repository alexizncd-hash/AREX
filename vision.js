// AREX — Visión en vivo · MARK 38
// Full-screen HUD · Groq Scout first · Gemini fallback
// Resultados mostrados EN el panel (no en el chat oculto)

/* ─── State ───────────────────────────────────────────── */
let _stream       = null;
let _video        = null;
let _panel        = null;
let _contTimer    = null;
let _resultTimer  = null;
let _contOn       = false;
let _busy         = false;
let _facingMode   = 'environment';

/* ─── Prompts ─────────────────────────────────────────── */
const PROMPTS = {
  describe: `Eres AREX, asistente personal de Alexiz. Describe en 2-3 líneas lo que ves. Si hay una persona enfrente de la cámara descríbela. Si parece ser Alexiz (joven mexicano universitario), salúdalo directamente. Sé natural, conciso, en español.`,

  product: `Eres AREX analizando un objeto/producto para Alexiz. Responde EXACTAMENTE en este formato:

**Objeto:** [nombre]
**Marca:** [marca o "No identificada"]
**Descripción:** [1-2 líneas]
**Precio estimado MX:** [$X,XXX – $XX,XXX MXN aprox]
**Dónde comprar:** Amazon.com.mx · MercadoLibre · [otras tiendas]

Si no puedes identificar el objeto, descríbelo con el máximo detalle. Responde en español.`,

  text: `Lee y transcribe exactamente todo el texto visible en esta imagen. Organiza con saltos de línea. Responde en español.`,

  scene: `Eres AREX. Analiza esta escena completa: objetos, personas, contexto, ambiente, cualquier información relevante. Si Alexiz está en la imagen, menciónalo. Análisis detallado en español.`,
};

const MODE_LABELS = {
  describe: '👁 VER',
  product:  '🔍 OBJETO',
  text:     '📄 TEXTO',
  scene:    '🌐 ESCENA',
};

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
  _stopContinuous();
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
      <div class="vp-title">
        <span class="vp-dot"></span>
        AREX · VISIÓN
      </div>
      <div class="vp-top-btns">
        <button class="vp-icon-btn" id="vis-flip" title="Cambiar cámara">⟳</button>
        <button class="vp-icon-btn vp-close-btn" onclick="closeVision()" title="Cerrar">✕</button>
      </div>
    </div>

    <div class="vp-status-badge" id="vis-status">
      <span class="vp-status-dot"></span>
      <span id="vis-status-txt">LISTO</span>
    </div>

    <!-- Result panel — slides up from bottom -->
    <div class="vp-result" id="vis-result">
      <div class="vp-result-hd">
        <span class="vp-result-lbl" id="vis-result-lbl">ANÁLISIS</span>
        <button class="vp-icon-btn vp-close-btn" id="vis-result-close" title="Cerrar resultado">✕</button>
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
}

/* ─── Frame Capture ───────────────────────────────────── */
async function _waitForVideo() {
  for (let i = 0; i < 20; i++) {
    if (_video && _video.videoWidth > 0) return true;
    await new Promise(r => setTimeout(r, 100));
  }
  return false;
}

async function _captureFrame() {
  if (!_video) return null;
  const ready = await _waitForVideo();
  if (!ready) return null;

  const MAX = 480;
  const vw = _video.videoWidth, vh = _video.videoHeight;
  const scale = Math.min(1, MAX / Math.max(vw, vh));
  const c = document.createElement('canvas');
  c.width  = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  c.getContext('2d').drawImage(_video, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL('image/jpeg', 0.70);
  if (dataUrl.length < 5000) return null;
  return dataUrl;
}

/* ─── Analysis ────────────────────────────────────────── */
async function _analyze(mode, extra = '') {
  if (_busy) return;
  _busy = true;
  _setStatus('CAPTURANDO...');
  _setAnalyzing(true, mode);

  const frame = await _captureFrame();
  if (!frame) {
    _setStatus('SIN SEÑAL');
    _showResult('SIN SEÑAL', 'No se pudo capturar el frame. Espera un momento y vuelve a intentarlo.', null);
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

    // Groq first — free and reliable for vision
    if (groqKey) {
      try {
        _setStatus('ANALIZANDO · GROQ...');
        reply = await _withTimeout(_callGroq(frame, prompt, groqKey), 25000);
      } catch (e) {
        console.warn('Groq vision failed:', e.message);
      }
    }

    // Gemini fallback
    if (!reply && geminiKey) {
      _setStatus('ANALIZANDO · GEMINI...');
      reply = await _withTimeout(_callGemini(frame, prompt, geminiKey), 25000);
    }

    if (!reply) throw new Error('No hay API de visión disponible. Verifica tus keys en /config.');

    const label = MODE_LABELS[mode] || 'ANÁLISIS';

    // ✅ Show result INSIDE the HUD panel (so user can see it)
    _showResult(label, reply, frame);

    // Also add to chat for history
    _say(`**[${label}]**\n\n${reply}`);

    // Speak brief version
    if (typeof window.arexSpeak === 'function') {
      window.arexSpeak(reply.replace(/\*\*/g, '').replace(/^[-•]\s/gm, '').slice(0, 280));
    }

    // Product search
    if (mode === 'product' && window.AREX_CONFIG?.tavilyKey) {
      const m = reply.match(/\*\*Objeto:\*\*\s*(.+)/);
      if (m) _searchProduct(m[1].trim().slice(0, 60));
    }

    _setStatus('LISTO');
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
      max_tokens: 700,
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

  // Try BarcodeDetector (Chrome/Android/desktop)
  if (!('BarcodeDetector' in window)) {
    _showResult('🔲 QR/CÓDIGO', 'BarcodeDetector no disponible en este navegador.\nUsa Chrome en Android o escritorio.', null);
    return;
  }

  _busy = true;
  _setStatus('ESCANEANDO QR...');
  _setScanActive(true);

  try {
    const frame = await _captureFrame();
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

  // Simple markdown → HTML
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
  if (body) body.innerHTML = html;

  panel.classList.add('visible');

  // Auto-dismiss after 18s (skip in auto mode)
  clearTimeout(_resultTimer);
  if (!_contOn) {
    _resultTimer = setTimeout(_hideResult, 18000);
  }
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

/* ─── Continuous mode ─────────────────────────────────── */
function _toggleContinuous() {
  _contOn = !_contOn;
  const btn = document.getElementById('vis-cont');
  const lbl = btn?.querySelector('.vp-btn-lbl');
  if (btn) btn.classList.toggle('on', _contOn);
  if (lbl) lbl.textContent = _contOn ? 'AUTO ON' : 'AUTO';
  if (_contOn) {
    _analyze('describe');
    _contTimer = setInterval(() => _analyze('describe'), 8000);
    _setStatus('MODO CONTINUO');
  } else {
    _stopContinuous();
    _setStatus('LISTO');
  }
}

function _stopContinuous() {
  _contOn = false;
  clearInterval(_contTimer); _contTimer = null;
  const btn = document.getElementById('vis-cont');
  if (btn) {
    btn.classList.remove('on');
    const lbl = btn.querySelector('.vp-btn-lbl');
    if (lbl) lbl.textContent = 'AUTO';
  }
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

function _say(msg) {
  if (typeof window.addMsg === 'function') window.addMsg('arex', msg);
}
