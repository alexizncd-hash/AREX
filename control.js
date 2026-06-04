// AREX — Mission Control
const BITACORA_KEY = 'arex_bitacora';
let _ctrlView      = 'telemetria';
let _logFilter     = 'todos';
let _ctrlBootTime  = Date.now();

/* ── Bitácora ─────────────────────────────────────────── */
function logBitacora(modulo, accion) {
  const arr = _getBitacora();
  arr.unshift({ ts: Date.now(), modulo: modulo || 'sistema', accion });
  if (arr.length > 500) arr.splice(500);
  localStorage.setItem(BITACORA_KEY, JSON.stringify(arr));
  // Re-render log if control module is visible
  const logEl = document.getElementById('ctrl-log-body');
  if (logEl && document.getElementById('module-control')?.classList.contains('active')) {
    _renderLog(logEl);
  }
}

function _getBitacora() {
  try { return JSON.parse(localStorage.getItem(BITACORA_KEY) || '[]'); } catch { return []; }
}

/* ── Telemetría ──────────────────────────────────────── */
function _getTelemetria() {
  // localStorage usage
  let lsBytes = 0;
  try {
    for (const k of Object.keys(localStorage)) {
      lsBytes += (localStorage.getItem(k) || '').length * 2;
    }
  } catch (e) { console.warn('AREX control: localStorage enumeration failed', e); }
  const lsKB = (lsBytes / 1024).toFixed(1);
  const lsMax = 5120; // 5MB estimate
  const lsPct = Math.min(100, Math.round(lsBytes / (lsMax * 10.24)));

  // SW version
  const swVer = window.AREX_SW_VERSION || 'v52';

  // Uptime
  const uptimeSec = Math.floor((Date.now() - _ctrlBootTime) / 1000);
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  const s = uptimeSec % 60;
  const uptime = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`;

  // Firebase
  const fbStatus = window._arexDb ? 'CONECTADO' : 'OFFLINE';

  // Groq key present
  const groqOk = !!(window.AREX_CONFIG?.groqKey);
  const geminiOk = !!(window.AREX_CONFIG?.geminiKey);

  return { lsKB, lsPct, swVer, uptime, fbStatus, groqOk, geminiOk };
}

function _renderTelemetria(el) {
  const t   = _getTelemetria();
  const log = _getBitacora();
  const recent = log.slice(0, 10);
  const _fmt = ms => new Date(ms).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const swVer = window.AREX_SW_VERSION || t.swVer;

  el.innerHTML = `
    <div class="diag-title">
      <span class="diag-title-line"></span>
      <span class="diag-title-text">▸ MISSION DIAGNOSTICS</span>
      <span class="diag-title-line"></span>
    </div>
    <div class="diag-grid">

      <!-- Q1: AI CORE INTEGRATION -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◈</span> AI CORE</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">GROQ LLAMA-4</span>
            <span class="diag-v ${t.groqOk?'ok':'err'}">${t.groqOk?'⬤ ONLINE':'⬤ SIN KEY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">GEMINI 2.5</span>
            <span class="diag-v ${t.geminiOk?'ok':'muted'}">${t.geminiOk?'⬤ ACTIVO':'⬤ STANDBY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">VISION MAVERICK</span>
            <span class="diag-v ${t.groqOk?'ok':'muted'}">${t.groqOk?'⬤ LISTO':'⬤ SIN KEY'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">TAVILY SEARCH</span>
            <span class="diag-v muted">⬤ CONFIGURADO</span>
          </div>
        </div>
      </div>

      <!-- Q2: NETWORK & SYNC -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◉</span> NETWORK & SYNC</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">FIREBASE DB</span>
            <span class="diag-v ${t.fbStatus==='CONECTADO'?'ok':'warn'}">${t.fbStatus==='CONECTADO'?'⬤ ENLAZADO':'⬤ OFFLINE'}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SERVICE WORKER</span>
            <span class="diag-v ok">${swVer} ⬤ ACTIVO</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">PWA MODE</span>
            <span class="diag-v ok">⬤ INSTALADO</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SINCRONIZACIÓN</span>
            <span class="diag-v muted">⬤ TIEMPO REAL</span>
          </div>
        </div>
      </div>

      <!-- Q3: SYSTEM STATE -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◫</span> SYSTEM STATE</div>
        <div class="diag-quad-body">
          <div class="diag-row">
            <span class="diag-k">UPTIME SESIÓN</span>
            <span class="diag-v ok">${t.uptime}</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">ALMACENAMIENTO</span>
            <span class="diag-v ${t.lsPct>70?'warn':'ok'}">${t.lsKB} KB <span class="diag-pct">(${t.lsPct}%)</span></span>
          </div>
          <div class="diag-storage-bar">
            <div class="diag-storage-fill" style="width:${t.lsPct}%"></div>
          </div>
          <div class="diag-row">
            <span class="diag-k">ENTRADAS DE LOG</span>
            <span class="diag-v muted">${log.length} registros</span>
          </div>
          <div class="diag-row">
            <span class="diag-k">SESIÓN ACTUAL</span>
            <span class="diag-v ok">⬤ ACTIVA</span>
          </div>
        </div>
      </div>

      <!-- Q4: RECENT LOG -->
      <div class="diag-quad">
        <div class="diag-quad-hdr"><span class="diag-ico">◷</span> ACTIVIDAD RECIENTE</div>
        <div class="diag-quad-body diag-log">
          ${recent.length ? recent.map(e => `
            <div class="diag-log-row">
              <span class="diag-log-ts">${_fmt(e.ts)}</span>
              <span class="diag-log-mod ${e.modulo}">${e.modulo.slice(0,5).toUpperCase()}</span>
              <span class="diag-log-txt">${String(e.accion).replace(/&/g,'&amp;').replace(/</g,'&lt;').slice(0,26)}</span>
            </div>`).join('') : '<div class="diag-empty">Sin actividad reciente</div>'}
        </div>
      </div>

    </div>`;
}

/* ── Log ─────────────────────────────────────────────── */
function _renderLog(el) {
  const all = _getBitacora();
  const filt = _logFilter === 'todos' ? all : all.filter(e => e.modulo === _logFilter);
  if (!filt.length) { el.innerHTML = '<div style="color:var(--text-muted);font-size:10px;padding:0.5rem;">Sin entradas en el log.</div>'; return; }
  const _fmt = ms => new Date(ms).toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  el.innerHTML = filt.slice(0, 200).map(e =>
    `<div class="ctrl-log-entry">
      <span class="ctrl-log-ts">${_fmt(e.ts)}</span>
      <span class="ctrl-log-mod ${e.modulo}">${e.modulo.toUpperCase()}</span>
      <span class="ctrl-log-txt">${String(e.accion).replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>
    </div>`
  ).join('');
}

/* ── Agentes ─────────────────────────────────────────── */
const AGENT_ACTIVE_MS = 300000; // 5 min — ventana de actividad reciente

const AGENTES = [
  {
    id: 'hermes', nombre: 'HERMES', color: '#00ffaa',
    desc: 'Finanzas · Monitorea deudas y alertas de pago',
    area: 'finanzas'
  },
  {
    id: 'atlas', nombre: 'ATLAS', color: '#ff9900',
    desc: 'Negocio · Rastrea ventas y stock de frijol mayocoba',
    area: 'negocio'
  },
  {
    id: 'sentinel', nombre: 'SENTINEL', color: '#8B5CF6',
    desc: 'Sistema · Firebase y Service Worker',
    area: 'sistema'
  },
  {
    id: 'scribe', nombre: 'SCRIBE', color: '#00d4ff',
    desc: 'Notas · Organiza y resume información',
    area: 'chat'
  },
];

function _getAgentLastAction(area) {
  const log = _getBitacora();
  const last = log.find(e => e.modulo === area);
  if (!last) return 'Sin actividad registrada';
  const ago = Math.floor((Date.now() - last.ts) / 60000);
  return `Hace ${ago < 1 ? 'menos de 1 min' : ago + ' min'}: ${last.accion}`;
}

function _getAgentStatus(area) {
  const log = _getBitacora();
  const last = log.find(e => e.modulo === area);
  if (!last) return 'standby';
  return (Date.now() - last.ts) < AGENT_ACTIVE_MS ? 'online' : 'standby';
}

function _renderAgentes(el) {
  el.innerHTML = AGENTES.map(a => {
    const status = _getAgentStatus(a.area);
    const last   = _getAgentLastAction(a.area);
    // Derive glow color from agent color
    const hex = a.color.replace('#','');
    const r = parseInt(hex.slice(0,2),16);
    const g = parseInt(hex.slice(2,4),16);
    const b = parseInt(hex.slice(4,6),16);
    const glow = `rgba(${r},${g},${b},0.38)`;
    return `
      <div class="agent-orb-wrap" data-state="${status}"
           style="--aoc:${a.color};--aog:${glow}"
           onclick="window._runAgent('${a.id}','${a.area}')"
           title="${a.nombre} — ${a.desc}">
        <div class="agent-orb-stage">
          <div class="agent-orb-ring r2"></div>
          <div class="agent-orb-ring r1"></div>
          <div class="agent-orb-sphere">
            <div class="agent-orb-shine"></div>
            <div class="agent-orb-rim"></div>
          </div>
        </div>
        <div class="agent-orb-name">${a.nombre}</div>
        <div class="agent-orb-desc">${a.desc}</div>
        <div class="agent-orb-status ${status}">
          ${status === 'online' ? '● ACTIVO' : '○ EN ESPERA'}
        </div>
        <div style="font-size:8px;color:var(--text-muted);text-align:center;max-width:120px;margin-top:2px;letter-spacing:0.3px">${last}</div>
        <button class="agent-run-btn">EJECUTAR</button>
      </div>`;
  }).join('');
}

window._runAgent = function(agentId, area) {
  // Set orb to thinking state temporarily
  const wrap = document.querySelector(`.agent-orb-wrap[data-state]`);
  const all  = document.querySelectorAll('.agent-orb-wrap');
  all.forEach(w => {
    if (w.querySelector('.agent-orb-name')?.textContent === agentId.toUpperCase()) {
      w.dataset.state = 'thinking';
      setTimeout(() => { w.dataset.state = _getAgentStatus(area); }, 3000);
    }
  });
  logBitacora(area, `Agente ${agentId.toUpperCase()} ejecutado manualmente`);
  // Route to relevant module
  if (typeof window.AREXNav?.cambiarModulo === 'function') {
    const modMap = { finanzas:'finanzas', negocio:'negocio', sistema:'control', chat:'chat' };
    const mod = modMap[area] || area;
    window.AREXNav.cambiarModulo(mod);
  }
};

/* ── Render principal del módulo ────────────────────── */
function renderControlModule() {
  const wrap = document.getElementById('ctrl-wrap');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="ctrl-header">
      <div class="ctrl-title">MISSION CONTROL</div>
    </div>
    <div class="ctrl-tabs">
      <button class="ctrl-tab ${_ctrlView==='telemetria'?'active':''}" onclick="switchCtrlView('telemetria')">TELEMETRÍA</button>
      <button class="ctrl-tab ${_ctrlView==='bitacora'?'active':''}" onclick="switchCtrlView('bitacora')">BITÁCORA</button>
      <button class="ctrl-tab ${_ctrlView==='agentes'?'active':''}" onclick="switchCtrlView('agentes')">AGENTES</button>
    </div>

    <div class="ctrl-view ${_ctrlView==='telemetria'?'active':''}" id="ctrl-tel-view">
      <div id="ctrl-tel-body"></div>
    </div>

    <div class="ctrl-view ${_ctrlView==='bitacora'?'active':''}" id="ctrl-log-view">
      <div class="ctrl-log-filters">
        ${['todos','chat','finanzas','negocio','sistema','alerta'].map(f =>
          `<button class="ctrl-tab ${_logFilter===f?'active':''}" style="font-size:8px;padding:4px 10px" onclick="ctrlSetFilter('${f}')">${f.toUpperCase()}</button>`
        ).join('')}
      </div>
      <div class="ctrl-log-wrap">
        <div id="ctrl-log-body"></div>
      </div>
    </div>

    <div class="ctrl-view ${_ctrlView==='agentes'?'active':''}" id="ctrl-agents-view">
      <div class="ctrl-agents" id="ctrl-agents-body"></div>
    </div>`;

  // Render active view content
  if (_ctrlView === 'telemetria') {
    const tel = document.getElementById('ctrl-tel-body');
    if (tel) _renderTelemetria(tel);
    // Auto-refresh telemetria every 5s
    clearInterval(window._ctrlTelTimer);
    window._ctrlTelTimer = setInterval(() => {
      const t = document.getElementById('ctrl-tel-body');
      if (t && document.getElementById('module-control')?.classList.contains('active')) _renderTelemetria(t);
      else clearInterval(window._ctrlTelTimer);
    }, 5000);
  } else if (_ctrlView === 'bitacora') {
    const log = document.getElementById('ctrl-log-body');
    if (log) _renderLog(log);
  } else if (_ctrlView === 'agentes') {
    const ag = document.getElementById('ctrl-agents-body');
    if (ag) _renderAgentes(ag);
  }
}

function switchCtrlView(view) {
  _ctrlView = view;
  renderControlModule();
}

function ctrlSetFilter(f) {
  _logFilter = f;
  renderControlModule();
}

window.renderControlModule = renderControlModule;
window.switchCtrlView      = switchCtrlView;
window.ctrlSetFilter       = ctrlSetFilter;
window.logBitacora         = logBitacora;
