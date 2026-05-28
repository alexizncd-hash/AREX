// AREX — Sistema de Visión en Vivo (Fase 4)
// Cámara en tiempo real + Llama 4 Scout Vision + búsqueda de productos

/* ─── State ───────────────────────────────────────────── */
let _stream    = null;
let _video     = null;
let _panel     = null;
let _contTimer = null;
let _contOn    = false;
let _busy      = false;

/* ─── Prompts por modo ────────────────────────────────── */
const PROMPTS = {
  describe: `Eres AREX, el asistente personal de Alexiz. Describe brevemente lo que ves en 2-3 líneas. Si hay una persona, descríbela. Si parece ser Alexiz (joven mexicano universitario, dueño de AREX), salúdalo directamente. Sé natural y conciso. Responde en español.`,

  product: `Eres AREX analizando un producto para Alexiz. Identifica el objeto y responde EXACTAMENTE en este formato:

**Producto:** [nombre comercial completo]
**Marca:** [marca si es visible, o "No identificada"]
**Descripción:** [1-2 líneas sobre el producto]
**Especificaciones clave:**
- [spec 1]
- [spec 2]
- [spec 3]
**Precio estimado MX:** [$X,XXX – $XX,XXX MXN aprox]
**Dónde comprar en México:** Amazon.com.mx · MercadoLibre · [otras tiendas relevantes]

Si no puedes identificar el producto, describe el objeto con el máximo detalle posible. Responde en español.`,

  text: `Lee y transcribe TODO el texto visible en esta imagen, exactamente como aparece. Organiza la información de forma clara con saltos de línea. Responde en español.`,

  scene: `Eres AREX. Analiza esta escena completa: objetos presentes, contexto, personas si las hay, y cualquier información relevante. Si Alexiz (el dueño) está en la imagen, menciónalo. Dame un análisis detallado en español.`,
};

/* ─── Public API ──────────────────────────────────────── */
export async function openVision() {
  if (_panel) { _panel.style.display = 'flex'; return; }
  if (!navigator.mediaDevices?.getUserMedia) {
    _say('Cámara no disponible en este navegador.');
    return;
  }
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
  } catch (e) {
    _say(`No se pudo acceder a la cámara: ${e.message}\n\nAsegúrate de dar permiso de cámara al navegador.`);
    return;
  }
  _buildPanel();
  document.getElementById('btn-vision')?.classList.add('active');
}

export function closeVision() {
  _stopContinuous();
  _stream?.getTracks().forEach(t => t.stop());
  _stream = null; _video = null;
  _panel?.remove(); _panel = null;
  document.getElementById('btn-vision')?.classList.remove('active');
}

export async function captureAndAnalyze(mode = 'describe', extra = '') {
  if (!_stream) {
    await openVision();
    if (!_stream) return;
    await new Promise(r => setTimeout(r, 900));
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
    <div class="vp-header">
      <span class="vp-title">
        <span class="vp-dot"></span>
        AREX VISION
      </span>
      <div class="vp-head-btns">
        <button class="vp-btn-sm" id="vis-flip" title="Cambiar cámara">⟳</button>
        <button class="vp-btn-sm vp-close" onclick="closeVision()">✕</button>
      </div>
    </div>
    <div class="vp-video-wrap">
      <video id="vis-video" autoplay playsinline muted></video>
      <div class="vp-scan-line"></div>
      <div class="vp-status" id="vis-status">LISTO</div>
    </div>
    <div class="vp-actions">
      <button class="vp-btn" id="vis-describe" onclick="captureAndAnalyze('describe')">👁 VER</button>
      <button class="vp-btn" id="vis-product"  onclick="captureAndAnalyze('product')">🔍 PRODUCTO</button>
      <button class="vp-btn" id="vis-text"     onclick="captureAndAnalyze('text')">📄 TEXTO</button>
    </div>
    <button class="vp-btn-cont" id="vis-cont">⬤ CONTINUO: OFF</button>
  `;
  document.body.appendChild(el);
  _panel = el;

  _video = document.getElementById('vis-video');
  _video.srcObject = _stream;
  _video.play();

  document.getElementById('vis-cont').addEventListener('click', _toggleContinuous);
  document.getElementById('vis-flip').addEventListener('click', _flipCamera);

  // Hacer draggable
  _makeDraggable(el);
}

/* ─── Frame Capture ───────────────────────────────────── */
function _captureFrame() {
  if (!_video || _video.readyState < 2) return null;
  const scale = Math.min(1, 900 / Math.max(_video.videoWidth, _video.videoHeight));
  const c = document.createElement('canvas');
  c.width  = _video.videoWidth  * scale;
  c.height = _video.videoHeight * scale;
  c.getContext('2d').drawImage(_video, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.80);
}

/* ─── Analysis ────────────────────────────────────────── */
async function _analyze(mode, extra = '') {
  if (_busy) return;
  const frame = _captureFrame();
  if (!frame) { _setStatus('SIN SEÑAL DE CÁMARA'); return; }

  _busy = true;
  _setStatus('ANALIZANDO...');
  _panel?.querySelector('.vp-scan-line')?.classList.add('active');

  const prompt = extra || PROMPTS[mode] || PROMPTS.describe;

  try {
    const key = window.AREX_CONFIG?.groqKey;
    if (!key) { _say('Groq API Key no configurada. Ve a /config.'); _busy = false; return; }

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

    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e?.error?.message || res.status); }
    const data    = await res.json();
    const reply   = data?.choices?.[0]?.message?.content || 'Sin respuesta.';

    // Mostrar en chat
    if (typeof window.addMsg === 'function') {
      const modeLabel = { describe:'👁 Visión', product:'🔍 Producto', text:'📄 Texto', scene:'🌐 Escena' }[mode] || 'Visión';
      window.addMsg('arex', `**[${modeLabel}]**\n\n${reply}`);
    }

    // Hablar respuesta
    if (typeof window.arexSpeak === 'function') {
      const spoken = reply.replace(/\*\*/g,'').replace(/^-\s/gm,'').slice(0, 300);
      window.arexSpeak(spoken);
    }

    // Buscar link de compra si es producto y Tavily está disponible
    if (mode === 'product' && window.AREX_CONFIG?.tavilyKey) {
      const nameMatch = reply.match(/\*\*Producto:\*\*\s*(.+)/);
      if (nameMatch) {
        const nombre = nameMatch[1].trim().slice(0, 60);
        _searchProduct(nombre);
      }
    }

    _setStatus('LISTO');
  } catch (e) {
    _setStatus('ERROR');
    _say(`Error al analizar imagen: ${e.message}`);
  } finally {
    _busy = false;
    _panel?.querySelector('.vp-scan-line')?.classList.remove('active');
  }
}

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
    const linksText = links.map(l => `- [${l.title?.slice(0, 50) || l.url}](${l.url})`).join('\n');
    if (typeof window.addMsg === 'function') {
      window.addMsg('arex', `**🛒 Links de compra para "${nombre}":**\n\n${linksText}`);
    }
  } catch (_) {}
}

/* ─── Continuous Vision ───────────────────────────────── */
function _toggleContinuous() {
  _contOn = !_contOn;
  const btn = document.getElementById('vis-cont');
  if (btn) {
    btn.textContent = `⬤ CONTINUO: ${_contOn ? 'ON' : 'OFF'}`;
    btn.classList.toggle('on', _contOn);
  }
  if (_contOn) {
    _contTimer = setInterval(() => _analyze('describe'), 6000);
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
  if (btn) { btn.textContent = '⬤ CONTINUO: OFF'; btn.classList.remove('on'); }
}

/* ─── Camera Flip ─────────────────────────────────────── */
let _facingMode = 'environment';
async function _flipCamera() {
  if (!_stream) return;
  _stream.getTracks().forEach(t => t.stop());
  _facingMode = _facingMode === 'environment' ? 'user' : 'environment';
  try {
    _stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: _facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    if (_video) _video.srcObject = _stream;
  } catch (e) { _say('No se pudo cambiar de cámara.'); }
}

/* ─── Draggable ───────────────────────────────────────── */
function _makeDraggable(el) {
  const header = el.querySelector('.vp-header');
  if (!header) return;
  let ox = 0, oy = 0, mx = 0, my = 0;
  header.style.cursor = 'grab';
  header.addEventListener('mousedown', e => {
    e.preventDefault();
    mx = e.clientX; my = e.clientY;
    document.addEventListener('mousemove', mv);
    document.addEventListener('mouseup', up);
    header.style.cursor = 'grabbing';
  });
  function mv(e) {
    ox = mx - e.clientX; oy = my - e.clientY;
    mx = e.clientX; my = e.clientY;
    el.style.top  = (el.offsetTop  - oy) + 'px';
    el.style.left = (el.offsetLeft - ox) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
  }
  function up() {
    document.removeEventListener('mousemove', mv);
    document.removeEventListener('mouseup', up);
    header.style.cursor = 'grab';
  }
}

/* ─── Helpers ─────────────────────────────────────────── */
function _setStatus(txt) {
  const el = document.getElementById('vis-status');
  if (el) el.textContent = txt;
}
function _say(msg) {
  if (typeof window.addMsg === 'function') window.addMsg('arex', msg);
}
