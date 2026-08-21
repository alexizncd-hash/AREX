// ══════════════════════════════════════════════════════
// AREX — Módulo Gastos Personales
// Control de gastos diarios por categoría con presupuesto mensual
// ══════════════════════════════════════════════════════

const GP_KEY = 'arex_gastos_pers';

const GP_CATS = {
  comida:          { l: 'Comida',          e: '🍔' },
  transporte:      { l: 'Transporte',      e: '🚌' },
  entretenimiento: { l: 'Entretenimiento', e: '🎬' },
  salud:           { l: 'Salud',           e: '💊' },
  ropa:            { l: 'Ropa',            e: '👕' },
  hogar:           { l: 'Hogar',           e: '🏠' },
  educacion:       { l: 'Educación',       e: '📚' },
  otro:            { l: 'Otro',            e: '📦' }
};

let _gpView  = 'resumen';
let _gpMes   = new Date().getMonth();
let _gpAnio  = new Date().getFullYear();

// ── Helpers ─────────────────────────────────────────
const _$MXN    = n => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const _todayISO = () => window.hoy();   // v216: era UTC
const _escAttr  = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const _MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ── Datos ────────────────────────────────────────────
function getGastosData() {
  const catKeys = Object.keys(GP_CATS);
  const presDefaults = {};
  catKeys.forEach(k => { presDefaults[k] = 0; });

  const defaults = {
    presupuesto: { ...presDefaults },
    gastos: []
  };

  const saved = leer(GP_KEY, null);
  if (!saved || typeof saved !== 'object') return defaults;
  return {
    presupuesto: { ...presDefaults, ...(saved.presupuesto || {}) },
    gastos:      saved.gastos || []
  };
}

function saveGastosData(data) {
  guardar(GP_KEY, data);
  _checkGastosAlerts(data);
}

function _checkGastosAlerts(data) {
  if (typeof window.arexAlert !== 'function') return;
  const now  = new Date();
  const mes  = _gastosDelMes(data.gastos);
  for (const [k, cat] of Object.entries(GP_CATS)) {
    const pres  = data.presupuesto[k] || 0;
    if (!pres) continue;
    const gasto = mes.filter(g => g.categoria === k).reduce((a, g) => a + g.monto, 0);
    if (gasto > pres) {
      window.arexAlert('GASTOS',
        `${cat.e} ${cat.l} excedida: gastaste ${_$MXN(gasto)} de ${_$MXN(pres)} (+${_$MXN(gasto - pres)})`,
        'warn');
    }
  }
}

// ── Navegación de vistas ─────────────────────────────
function switchGastosView(view) {
  _gpView = view;
  document.querySelectorAll('#module-gastos .neg-view').forEach(v =>
    v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#module-gastos .neg-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  const renders = {
    resumen:     renderGpResumen,
    historial:   renderGpHistorial,
    presupuesto: renderGpPresupuesto
  };
  renders[view]?.();
}

// ── Navegación de mes ────────────────────────────────
function gpMesPrev() {
  const now   = new Date();
  const minMs = (now.getFullYear() - 2) * 12 + now.getMonth();
  const curMs = _gpAnio * 12 + _gpMes;
  if (curMs <= minMs) return;  // límite: máximo 24 meses atrás
  if (_gpMes === 0) { _gpMes = 11; _gpAnio--; }
  else { _gpMes--; }
  switchGastosView(_gpView);
}

function gpMesNext() {
  const now = new Date();
  const nowM = now.getMonth();
  const nowY = now.getFullYear();
  if (_gpAnio > nowY || (_gpAnio === nowY && _gpMes >= nowM)) return;
  if (_gpMes === 11) { _gpMes = 0; _gpAnio++; }
  else { _gpMes++; }
  switchGastosView(_gpView);
}

function _gpMesNavHTML() {
  const now  = new Date();
  const esFuturo = _gpAnio > now.getFullYear() ||
    (_gpAnio === now.getFullYear() && _gpMes >= now.getMonth());
  return `
    <div class="gp-mes-nav">
      <button class="gp-mes-nav-btn" onclick="gpMesPrev()">‹</button>
      <span style="font-size:12px;letter-spacing:3px;color:var(--cyan);">
        ${_MESES[_gpMes].toUpperCase()} ${_gpAnio}
      </span>
      <button class="gp-mes-nav-btn" onclick="gpMesNext()"${esFuturo ? ' disabled' : ''}>›</button>
    </div>`;
}

function _gastosDelMes(gastos) {
  return gastos.filter(g => {
    if (!g.fecha) return false;
    const d = new Date(g.fecha + 'T12:00:00');
    return !isNaN(d) && d.getMonth() === _gpMes && d.getFullYear() === _gpAnio;
  });
}

// ── Vista: Resumen ───────────────────────────────────
function _gastosDelMesAnterior(gastos) {
  let m = _gpMes - 1, y = _gpAnio;
  if (m < 0) { m = 11; y--; }
  return gastos.filter(g => {
    if (!g.fecha) return false;
    const d = new Date(g.fecha + 'T12:00:00');
    return !isNaN(d) && d.getMonth() === m && d.getFullYear() === y;
  });
}

function renderGpResumen() {
  const el = document.getElementById('gp-resumen-content');
  if (!el) return;
  const data        = getGastosData();
  const mesGastos   = _gastosDelMes(data.gastos);
  const antGastos   = _gastosDelMesAnterior(data.gastos);
  const totalGastado = mesGastos.reduce((a, g) => a + g.monto, 0);
  const totalAnt     = antGastos.reduce((a, g) => a + g.monto, 0);
  const totalPres    = Object.values(data.presupuesto).reduce((a, v) => a + v, 0);
  const disponible   = totalPres - totalGastado;
  const diffPct      = totalAnt > 0 ? ((totalGastado - totalAnt) / totalAnt * 100).toFixed(0) : null;
  const diffLabel    = diffPct !== null
    ? `<span style="color:${Number(diffPct) <= 0 ? '#34ffc3' : '#ff6644'};font-size:8px;margin-left:4px;">${Number(diffPct) > 0 ? '+' : ''}${diffPct}% vs mes ant.</span>`
    : totalAnt > 0 ? '' : '';

  // Gasto por categoría en el mes
  const porCat = {};
  Object.keys(GP_CATS).forEach(k => { porCat[k] = 0; });
  mesGastos.forEach(g => {
    if (porCat[g.categoria] !== undefined) porCat[g.categoria] += g.monto;
  });

  // Solo categorías con presupuesto o con gasto
  const catsActivas = Object.keys(GP_CATS).filter(k =>
    data.presupuesto[k] > 0 || porCat[k] > 0
  );

  const overCats = catsActivas.filter(k => data.presupuesto[k] > 0 && porCat[k] > data.presupuesto[k]);
  const alertBanner = overCats.length > 0 ? `
    <div class="gp-alert-banner">
      <span class="gp-alert-icon">⚠</span>
      <div class="gp-alert-body">
        <span class="gp-alert-title">PRESUPUESTO EXCEDIDO</span>
        <div class="gp-alert-cats">
          ${overCats.map(k => `<span class="gp-alert-cat">${GP_CATS[k].e} ${GP_CATS[k].l} <strong>+${_$MXN(porCat[k] - data.presupuesto[k])}</strong></span>`).join('')}
        </div>
      </div>
    </div>` : '';

  const catsHTML = catsActivas.length === 0
    ? '<div class="neg-empty">Sin categorías activas este mes.<br>Configura un presupuesto o registra un gasto.</div>'
    : `<div class="gp-cats">
        ${catsActivas.map(k => {
          const cat    = GP_CATS[k];
          const gasto  = porCat[k];
          const pres   = data.presupuesto[k];
          const pct    = pres > 0 ? Math.min((gasto / pres) * 100, 100) : 0;
          const over   = pres > 0 && gasto > pres;
          return `
            <div class="gp-cat-row">
              <span class="gp-cat-icon">${cat.e}</span>
              <div class="gp-cat-info">
                <span class="gp-cat-name">${cat.l.toUpperCase()}</span>
                <div class="gp-cat-track">
                  <div class="gp-cat-fill${over ? ' over' : ''}" style="width:${pct}%"></div>
                </div>
              </div>
              <div class="gp-cat-nums">
                <span style="color:${over ? '#ff6644' : 'var(--text-main)'}">${_$MXN(gasto)}</span>
                ${pres > 0 ? `<span class="gp-cat-pres">/ ${_$MXN(pres)}</span>` : '<span class="gp-cat-pres">sin pres.</span>'}
              </div>
            </div>`;
        }).join('')}
      </div>`;

  // Opciones de categoría para el select
  const catOpts = Object.entries(GP_CATS)
    .map(([k, v]) => `<option value="${k}">${v.e} ${v.l}</option>`)
    .join('');

  el.innerHTML = `
    ${_gpMesNavHTML()}

    <div class="neg-kpi-grid">
      <div class="neg-kpi">
        <div class="neg-kpi-lbl">GASTADO ${diffLabel}</div>
        <div class="neg-kpi-val ${totalPres > 0 && totalGastado > totalPres ? 'neg-loss' : ''}">${_$MXN(totalGastado)}</div>
        <div class="neg-kpi-sub">de ${_$MXN(totalPres)} presupuesto${totalAnt > 0 ? ` · ant: ${_$MXN(totalAnt)}` : ''}</div>
      </div>
      <div class="neg-kpi ${disponible < 0 ? 'neg-kpi-warn' : ''}">
        <div class="neg-kpi-lbl">DISPONIBLE</div>
        <div class="neg-kpi-val ${disponible < 0 ? 'neg-loss' : 'neg-profit'}">${_$MXN(disponible)}</div>
        <div class="neg-kpi-sub">${disponible < 0 ? 'Presupuesto excedido' : 'Restante del mes'}</div>
      </div>
    </div>

    ${alertBanner}
    <div class="neg-section-title">CATEGORÍAS</div>
    ${catsHTML}

    <div class="neg-form-card">
      <div class="neg-form-title">REGISTRAR GASTO</div>
      <div class="neg-form-row">
        <select id="gp-r-cat" class="neg-select">${catOpts}</select>
        <input type="number" id="gp-r-monto" class="neg-input" placeholder="Monto ($)" step="1" min="0.01"/>
      </div>
      <div class="neg-form-row">
        <input type="text" id="gp-r-desc"  class="neg-input" placeholder="Descripción (opcional)"/>
        <input type="date" id="gp-r-fecha" class="neg-input" value="${_todayISO()}"/>
      </div>
      <button class="neg-btn-primary" onclick="gpRegistrar()">REGISTRAR</button>
    </div>
  `;
}

// ── Vista: Historial ─────────────────────────────────
function renderGpHistorial() {
  const el = document.getElementById('gp-hist-content');
  if (!el) return;
  const data     = getGastosData();
  const mesGastos = _gastosDelMes(data.gastos)
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const listHTML = mesGastos.length === 0
    ? '<div class="neg-empty">Sin gastos registrados este mes.</div>'
    : `<div class="neg-list">
        ${mesGastos.map(g => {
          const cat = GP_CATS[g.categoria] || { l: g.categoria, e: '📦' };
          return `
            <div class="neg-list-item" data-gp-id="${g.id}">
              <div class="neg-li-top">
                <span class="neg-li-name">${cat.e} ${_h(g.descripcion || cat.l)}</span>
                <span class="neg-loss">${_$MXN(g.monto)}</span>
              </div>
              <div class="neg-li-bot">
                <span>${g.fecha}</span>
                <span class="neg-badge">${cat.l}</span>
                <button class="neg-edit" onclick="gpEditar('${g.id}')">editar</button>
                <button class="neg-del"  onclick="gpEliminar('${g.id}')">✕</button>
              </div>
            </div>`;
        }).join('')}
      </div>`;

  el.innerHTML = `
    ${_gpMesNavHTML()}
    <div class="neg-section-title">GASTOS DEL MES (${mesGastos.length})</div>
    ${listHTML}
  `;
}

// ── Vista: Presupuesto ───────────────────────────────
function renderGpPresupuesto() {
  const el = document.getElementById('gp-pres-content');
  if (!el) return;
  const data  = getGastosData();
  const total = Object.values(data.presupuesto).reduce((a, v) => a + v, 0);

  const filasHTML = Object.entries(GP_CATS).map(([k, cat]) => `
    <div class="neg-cfg-fila">
      <label>${cat.e} ${cat.l}</label>
      <input type="number" id="gp-p-${k}" class="neg-input"
        value="${data.presupuesto[k] || 0}" placeholder="0" min="0" step="10"/>
    </div>`).join('');

  el.innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">PRESUPUESTO MENSUAL POR CATEGORÍA</div>
      ${filasHTML}
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-top:1px solid rgba(34,211,238,0.1);margin-top:0.2rem;">
        <span style="font-size:10px;letter-spacing:2px;color:var(--text-muted);">TOTAL PRESUPUESTO</span>
        <span id="gp-pres-total" style="font-size:15px;color:var(--cyan);">${_$MXN(total)}</span>
      </div>
      <button class="neg-btn-primary" id="gp-p-guardar-btn" onclick="gpGuardarPresupuesto()">GUARDAR</button>
    </div>
  `;

  // Actualizar total en tiempo real
  Object.keys(GP_CATS).forEach(k => {
    document.getElementById(`gp-p-${k}`)?.addEventListener('input', () => {
      const t = Object.keys(GP_CATS).reduce((acc, key) => {
        return acc + (parseFloat(document.getElementById(`gp-p-${key}`)?.value) || 0);
      }, 0);
      const totEl = document.getElementById('gp-pres-total');
      if (totEl) totEl.textContent = _$MXN(t);
    });
  });
}

// ── Acciones ─────────────────────────────────────────
function gpRegistrar() {
  const cat     = document.getElementById('gp-r-cat')?.value;
  const montoRaw = parseFloat(document.getElementById('gp-r-monto')?.value);
  const desc    = document.getElementById('gp-r-desc')?.value.trim() || '';
  const fecha   = document.getElementById('gp-r-fecha')?.value;

  if (!cat)                         { tost('Selecciona una categoría', 'error'); return; }
  if (!montoRaw || montoRaw <= 0)   { tost('Ingresa un monto válido', 'error');  return; }
  if (!fecha)                       { tost('Ingresa la fecha', 'error');         return; }

  const data = getGastosData();
  data.gastos.push({
    id:          String(Date.now()),
    fecha,
    categoria:   cat,
    monto:       montoRaw,
    descripcion: desc
  });
  saveGastosData(data);

  // Sincronizar vista al mes del gasto registrado
  const d = new Date(fecha + 'T12:00:00');
  _gpMes  = d.getMonth();
  _gpAnio = d.getFullYear();

  renderGpResumen();
}

async function gpEliminar(id) {
  if (!await pregunta('¿Eliminar este gasto?')) return;   // v216: confirm() se suprime en la PWA de iOS
  const data  = getGastosData();
  data.gastos = data.gastos.filter(g => g.id !== id);
  saveGastosData(data);
  renderGpHistorial();
}

function gpEditar(id) {
  const data = getGastosData();
  const g    = data.gastos.find(g => g.id === id);
  if (!g) return;
  const el = document.querySelector(`[data-gp-id="${id}"]`);
  if (!el) return;

  const catOpts = Object.entries(GP_CATS)
    .map(([k, v]) =>
      `<option value="${k}" ${g.categoria === k ? 'selected' : ''}>${v.e} ${v.l}</option>`)
    .join('');

  el.innerHTML = `
    <div class="neg-form-row">
      <select id="gp-e-cat-${id}" class="neg-select">${catOpts}</select>
      <input type="number" id="gp-e-monto-${id}" class="neg-input" value="${g.monto}" placeholder="Monto" step="1" min="0.01"/>
    </div>
    <div class="neg-form-row">
      <input type="text" id="gp-e-desc-${id}"  class="neg-input" value="${_escAttr(g.descripcion || '')}" placeholder="Descripción"/>
      <input type="date" id="gp-e-fecha-${id}" class="neg-input" value="${g.fecha}"/>
    </div>
    <div class="neg-form-row" style="margin-top:0.2rem;">
      <button class="neg-btn-primary" onclick="gpGuardarEdit('${id}')">GUARDAR</button>
      <button class="neg-btn-primary neg-btn-cancel" onclick="renderGpHistorial()">CANCELAR</button>
    </div>`;
}

function gpGuardarEdit(id) {
  const data  = getGastosData();
  const g     = data.gastos.find(g => g.id === id);
  if (!g) return;

  const monto = parseFloat(document.getElementById(`gp-e-monto-${id}`)?.value);
  if (!monto || monto <= 0) { tost('Ingresa un monto válido', 'error'); return; }

  g.categoria   = document.getElementById(`gp-e-cat-${id}`)?.value   || g.categoria;
  g.monto       = monto;
  g.descripcion = document.getElementById(`gp-e-desc-${id}`)?.value.trim() || '';
  const fs      = document.getElementById(`gp-e-fecha-${id}`)?.value;
  if (fs) g.fecha = fs;

  saveGastosData(data);
  renderGpHistorial();
}

function gpGuardarPresupuesto() {
  const data = getGastosData();
  Object.keys(GP_CATS).forEach(k => {
    const val = parseFloat(document.getElementById(`gp-p-${k}`)?.value) || 0;
    data.presupuesto[k] = val;
  });
  saveGastosData(data);

  const btn = document.getElementById('gp-p-guardar-btn');
  if (btn) {
    btn.textContent = 'GUARDADO ✓';
    btn.style.color = '#34ffc3';
    btn.style.borderColor = '#34ffc3';
    setTimeout(() => {
      btn.textContent = 'GUARDAR';
      btn.style.color = '';
      btn.style.borderColor = '';
    }, 1800);
  }
}

// ── Alta programática (recibos escaneados por Visión / voz) ──
// Devuelve el gasto creado. categoria se valida contra GP_CATS; si no existe usa 'otro'.
function gpAddGastoAuto(monto, categoria = 'otro', descripcion = '', fecha = null) {
  const m = parseFloat(monto);
  if (!m || m <= 0) return null;
  const cat = GP_CATS[categoria] ? categoria : 'otro';
  const data = getGastosData();
  const gasto = {
    id:          String(Date.now()),
    fecha:       fecha || _todayISO(),
    categoria:   cat,
    monto:       m,
    descripcion: String(descripcion || '').slice(0, 120),
  };
  data.gastos.push(gasto);
  saveGastosData(data);
  if (typeof logBitacora === 'function') logBitacora('gastos', `Gasto auto: ${_$MXN(m)} · ${GP_CATS[cat].l}`);
  return gasto;
}

// ── Init ─────────────────────────────────────────────
function initGastosModule() {
  document.querySelectorAll('#module-gastos .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchGastosView(tab.dataset.view)));
  switchGastosView('resumen');
}

// ── Exports globales ──────────────────────────────────
window.renderGastosModule  = () => switchGastosView('resumen');
window.switchGastosView    = switchGastosView;
window.gpMesPrev           = gpMesPrev;
window.gpMesNext           = gpMesNext;
window.gpRegistrar         = gpRegistrar;
window.gpEliminar          = gpEliminar;
window.gpEditar            = gpEditar;
window.gpGuardarEdit       = gpGuardarEdit;
window.gpGuardarPresupuesto = gpGuardarPresupuesto;
window.renderGpResumen     = renderGpResumen;
window.renderGpHistorial   = renderGpHistorial;
window.renderGpPresupuesto = renderGpPresupuesto;
window.gpAddGastoAuto      = gpAddGastoAuto;
window.GP_CATS             = GP_CATS;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGastosModule);
} else {
  initGastosModule();
}
