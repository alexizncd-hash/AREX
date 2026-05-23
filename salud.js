// ══════════════════════════════════════════════════════
// AREX — Módulo Salud
// Agua, sueño, ejercicio y peso
// ══════════════════════════════════════════════════════

const SALUD_KEY = 'arex_salud';

function getSaludData() {
  const defaults = {
    metas: { agua: 8, sueno: 8, ejercicio: 30, peso: 0 },
    registros: []
  };
  try {
    const raw = localStorage.getItem(SALUD_KEY);
    if (!raw) return defaults;
    const saved = JSON.parse(raw);
    return {
      metas: { ...defaults.metas, ...saved.metas },
      registros: saved.registros || []
    };
  } catch { return defaults; }
}

function saveSaludData(data) {
  localStorage.setItem(SALUD_KEY, JSON.stringify(data));
  if (typeof arexSyncData === 'function') arexSyncData(SALUD_KEY);
}

const _todaySalud = () => new Date().toISOString().slice(0, 10);

function getRegistroHoy(data) {
  const hoy = _todaySalud();
  let r = data.registros.find(r => r.fecha === hoy);
  if (!r) {
    r = { fecha: hoy, agua: 0, sueno: 0, ejercicioMins: 0, ejercicioTipo: '', peso: 0 };
    data.registros.push(r);
  }
  return r;
}

function getLast7(data, campo) {
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const reg = data.registros.find(r => r.fecha === key);
    dias.push({
      label: d.toLocaleDateString('es-MX', { weekday: 'short' }).slice(0, 3).toUpperCase(),
      val: reg ? (reg[campo] || 0) : 0,
      isHoy: i === 0
    });
  }
  return dias;
}

function miniChart(dias, meta, color) {
  const max = Math.max(...dias.map(d => d.val), meta || 1, 1);
  return `<div class="sal-chart-bars">
    ${dias.map(d => {
      const pct = Math.round((d.val / max) * 100);
      const over = meta > 0 && d.val >= meta;
      return `<div class="sal-chart-col">
        <div class="sal-chart-bar-wrap">
          <div class="sal-chart-bar${over ? ' over' : ''}${d.isHoy ? ' hoy' : ''}" style="height:${pct}%;background:${over ? '#00ffaa' : color}"></div>
        </div>
        <div class="sal-chart-lbl">${d.label}</div>
      </div>`;
    }).join('')}
  </div>`;
}

function dotTracker(actual, meta, onclick) {
  const dots = [];
  for (let i = 0; i < meta; i++) {
    dots.push(`<button class="sal-dot${i < actual ? ' filled' : ''}" onclick="${onclick}(${i + 1})" title="${i + 1}"></button>`);
  }
  return `<div class="sal-dots">${dots.join('')}</div>`;
}

// ── Vistas ──────────────────────────────────────────

function renderSaludHoy() {
  const data = getSaludData();
  const reg  = getRegistroHoy(data);
  const m    = data.metas;

  const aguaPct   = m.agua > 0    ? Math.min(100, Math.round((reg.agua / m.agua) * 100)) : 0;
  const suenoPct  = m.sueno > 0   ? Math.min(100, Math.round((reg.sueno / m.sueno) * 100)) : 0;
  const ejercPct  = m.ejercicio > 0 ? Math.min(100, Math.round((reg.ejercicioMins / m.ejercicio) * 100)) : 0;

  document.getElementById('sal-hoy-content').innerHTML = `
    <div class="sal-section">
      <div class="sal-sec-title">AGUA</div>
      <div class="sal-agua-header">
        <span class="sal-agua-val">${reg.agua} / ${m.agua} vasos</span>
        <span class="sal-agua-pct ${aguaPct >= 100 ? 'complete' : ''}">${aguaPct}%</span>
      </div>
      ${dotTracker(reg.agua, m.agua, 'saludSetAgua')}
      <div class="sal-agua-btns">
        <button class="sal-btn-sm" onclick="saludAgua(-1)">−</button>
        <span class="sal-agua-big">${reg.agua}</span>
        <button class="sal-btn-sm sal-btn-plus" onclick="saludAgua(1)">+</button>
      </div>
      ${miniChart(getLast7(data, 'agua'), m.agua, 'rgba(0,212,255,0.5)')}
    </div>

    <div class="sal-section">
      <div class="sal-sec-title">SUEÑO</div>
      <div class="sal-kpi-row">
        <div class="sal-kpi">
          <div class="sal-kpi-lbl">ANOCHE</div>
          <div class="sal-kpi-val ${suenoPct >= 100 ? 'kpi-green' : suenoPct < 60 ? 'kpi-red' : ''}">${reg.sueno}h</div>
          <div class="sal-kpi-sub">meta: ${m.sueno}h</div>
        </div>
        <div class="sal-kpi-input">
          <label class="sal-input-lbl">ACTUALIZAR</label>
          <div class="sal-row-inline">
            <input type="number" id="sal-inp-sueno" class="sal-input" min="0" max="24" step="0.5" value="${reg.sueno}" placeholder="horas"/>
            <button class="sal-btn-save" onclick="saludSueno()">OK</button>
          </div>
        </div>
      </div>
      ${miniChart(getLast7(data, 'sueno'), m.sueno, 'rgba(120,80,255,0.5)')}
    </div>

    <div class="sal-section">
      <div class="sal-sec-title">EJERCICIO</div>
      <div class="sal-kpi-row">
        <div class="sal-kpi">
          <div class="sal-kpi-lbl">HOY</div>
          <div class="sal-kpi-val ${ejercPct >= 100 ? 'kpi-green' : ''}">${reg.ejercicioMins} min</div>
          <div class="sal-kpi-sub">${reg.ejercicioTipo || 'sin tipo'}</div>
        </div>
        <div class="sal-kpi-input">
          <label class="sal-input-lbl">REGISTRAR</label>
          <div class="sal-row-inline">
            <input type="number" id="sal-inp-ej-mins" class="sal-input" min="0" max="300" step="5" value="${reg.ejercicioMins || ''}" placeholder="min"/>
            <select id="sal-inp-ej-tipo" class="sal-select">
              <option value="">Tipo</option>
              ${['Caminata','Correr','Ciclismo','Pesas','HIIT','Natación','Yoga','Fútbol','Otro'].map(t =>
                `<option value="${t}"${reg.ejercicioTipo === t ? ' selected' : ''}>${t}</option>`).join('')}
            </select>
            <button class="sal-btn-save" onclick="saludEjercicio()">OK</button>
          </div>
        </div>
      </div>
      ${miniChart(getLast7(data, 'ejercicioMins'), m.ejercicio, 'rgba(0,255,170,0.5)')}
    </div>

    <div class="sal-section">
      <div class="sal-sec-title">PESO</div>
      <div class="sal-kpi-row">
        <div class="sal-kpi">
          <div class="sal-kpi-lbl">ÚLTIMO</div>
          <div class="sal-kpi-val">${reg.peso > 0 ? reg.peso + ' kg' : '—'}</div>
          <div class="sal-kpi-sub">meta: ${m.peso > 0 ? m.peso + ' kg' : 'no config.'}</div>
        </div>
        <div class="sal-kpi-input">
          <label class="sal-input-lbl">REGISTRAR</label>
          <div class="sal-row-inline">
            <input type="number" id="sal-inp-peso" class="sal-input" min="0" max="300" step="0.1" value="${reg.peso || ''}" placeholder="kg"/>
            <button class="sal-btn-save" onclick="saludPeso()">OK</button>
          </div>
        </div>
      </div>
      ${miniChart(getLast7(data, 'peso'), m.peso, 'rgba(255,153,0,0.5)')}
    </div>
  `;
}

function renderSaludHistorial() {
  const data = getSaludData();
  const regs = data.registros.slice().reverse().slice(0, 30);

  document.getElementById('sal-hist-content').innerHTML = regs.length === 0
    ? '<div class="sal-empty">Sin registros aún. Empieza registrando tu día en la pestaña HOY.</div>'
    : `<div class="sal-hist-list">
        <div class="sal-hist-head">
          <span>FECHA</span><span>💧 AGUA</span><span>😴 SUEÑO</span><span>🏃 EJ.</span><span>⚖️ PESO</span>
        </div>
        ${regs.map(r => `
          <div class="sal-hist-row">
            <span class="sal-hist-fecha">${new Date(r.fecha + 'T12:00').toLocaleDateString('es-MX', { day:'numeric', month:'short' })}</span>
            <span>${r.agua || 0}v</span>
            <span>${r.sueno || 0}h</span>
            <span>${r.ejercicioMins || 0}min</span>
            <span>${r.peso > 0 ? r.peso + 'kg' : '—'}</span>
          </div>`).join('')}
      </div>`;
}

function renderSaludConfig() {
  const data = getSaludData();
  const m    = data.metas;

  document.getElementById('sal-cfg-content').innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">METAS DIARIAS</div>
      <div class="neg-cfg-fila">
        <label>VASOS DE AGUA AL DÍA</label>
        <input type="number" id="sal-cfg-agua" class="neg-input" min="1" max="20" value="${m.agua}" placeholder="8"/>
      </div>
      <div class="neg-cfg-fila">
        <label>HORAS DE SUEÑO</label>
        <input type="number" id="sal-cfg-sueno" class="neg-input" min="1" max="12" step="0.5" value="${m.sueno}" placeholder="8"/>
      </div>
      <div class="neg-cfg-fila">
        <label>MINUTOS DE EJERCICIO</label>
        <input type="number" id="sal-cfg-ejercicio" class="neg-input" min="0" max="300" step="5" value="${m.ejercicio}" placeholder="30"/>
      </div>
      <div class="neg-cfg-fila">
        <label>PESO META (kg, 0 = sin meta)</label>
        <input type="number" id="sal-cfg-peso" class="neg-input" min="0" max="300" step="0.5" value="${m.peso}" placeholder="70"/>
      </div>
      <button class="neg-btn-primary" onclick="saludGuardarMetas()">GUARDAR METAS</button>
      <div id="sal-cfg-ok" style="display:none;text-align:center;font-size:10px;color:#00ffaa;letter-spacing:2px;margin-top:4px;">✓ METAS ACTUALIZADAS</div>
    </div>
  `;
}

// ── Acciones ────────────────────────────────────────

function saludAgua(delta) {
  const data = getSaludData();
  const reg  = getRegistroHoy(data);
  reg.agua   = Math.max(0, (reg.agua || 0) + delta);
  saveSaludData(data);
  renderSaludHoy();
}

function saludSetAgua(n) {
  const data = getSaludData();
  const reg  = getRegistroHoy(data);
  reg.agua   = reg.agua === n ? n - 1 : n;
  reg.agua   = Math.max(0, reg.agua);
  saveSaludData(data);
  renderSaludHoy();
}

function saludSueno() {
  const val  = parseFloat(document.getElementById('sal-inp-sueno')?.value) || 0;
  const data = getSaludData();
  const reg  = getRegistroHoy(data);
  reg.sueno  = val;
  saveSaludData(data);
  renderSaludHoy();
}

function saludEjercicio() {
  const mins  = parseInt(document.getElementById('sal-inp-ej-mins')?.value) || 0;
  const tipo  = document.getElementById('sal-inp-ej-tipo')?.value || '';
  const data  = getSaludData();
  const reg   = getRegistroHoy(data);
  reg.ejercicioMins = mins;
  reg.ejercicioTipo = tipo;
  saveSaludData(data);
  renderSaludHoy();
}

function saludPeso() {
  const val  = parseFloat(document.getElementById('sal-inp-peso')?.value) || 0;
  const data = getSaludData();
  const reg  = getRegistroHoy(data);
  reg.peso   = val;
  saveSaludData(data);
  renderSaludHoy();
}

function saludGuardarMetas() {
  const data = getSaludData();
  data.metas = {
    agua:      parseInt(document.getElementById('sal-cfg-agua')?.value) || 8,
    sueno:     parseFloat(document.getElementById('sal-cfg-sueno')?.value) || 8,
    ejercicio: parseInt(document.getElementById('sal-cfg-ejercicio')?.value) || 30,
    peso:      parseFloat(document.getElementById('sal-cfg-peso')?.value) || 0
  };
  saveSaludData(data);
  const ok = document.getElementById('sal-cfg-ok');
  if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 2000); }
}

// ── Módulo principal ─────────────────────────────────

function switchSaludView(view) {
  document.querySelectorAll('#module-salud .sal-view').forEach(v =>
    v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#module-salud .neg-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  if (view === 'hoy')       renderSaludHoy();
  if (view === 'historial') renderSaludHistorial();
  if (view === 'config')    renderSaludConfig();
}

function renderSaludModule() {
  switchSaludView('hoy');
}

// Expose
window.saludAgua         = saludAgua;
window.saludSetAgua      = saludSetAgua;
window.saludSueno        = saludSueno;
window.saludEjercicio    = saludEjercicio;
window.saludPeso         = saludPeso;
window.saludGuardarMetas = saludGuardarMetas;
window.switchSaludView   = switchSaludView;
window.renderSaludModule = renderSaludModule;
window.getSaludData      = getSaludData;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#module-salud .neg-tab').forEach(tab =>
      tab.addEventListener('click', () => switchSaludView(tab.dataset.view)));
  });
} else {
  document.querySelectorAll('#module-salud .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchSaludView(tab.dataset.view)));
}
