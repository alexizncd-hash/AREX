// ══════════════════════════════════════════════════════
// AREX — Módulo Metas
// Seguimiento de metas personales con progreso
// ══════════════════════════════════════════════════════

const METAS_KEY = 'arex_metas';

const METAS_CATS = {
  personal:  { l: 'Personal',   c: '#22d3ee' },
  negocio:   { l: 'Negocio',    c: '#34ffc3' },
  salud:     { l: 'Salud',      c: '#ff9900' },
  finanzas:  { l: 'Finanzas',   c: '#9b59b6' },
  educacion: { l: 'Educación',  c: '#e74c3c' }
};

// ── Helpers de escape ───────────────────────────────
const _escA = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Persistencia ────────────────────────────────────
function getMetas() {
  try {
    const raw = localStorage.getItem(METAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMetas(arr) {
  guardar(METAS_KEY, arr);
}

function checkMetasAlerts() {
  if (typeof window.arexAlert !== 'function') return;
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const urgentes = getMetas().filter(m => {
    if (m.completada || !m.fechaLimite) return false;
    const fin = new Date(m.fechaLimite + 'T00:00:00');
    const dias = Math.round((fin - hoy) / 86400000);
    return dias >= 0 && dias <= 3;
  });
  urgentes.forEach(m => {
    const fin  = new Date(m.fechaLimite + 'T00:00:00');
    const dias = Math.round((fin - hoy) / 86400000);
    const label = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `en ${dias} días`;
    window.arexAlert('METAS', `Meta **"${m.titulo}"** vence ${label}.`, 'warn');
  });
}
window.checkMetasAlerts = checkMetasAlerts;

// ── Navegación ──────────────────────────────────────
function switchMetasView(view) {
  document.querySelectorAll('#module-metas .neg-view').forEach(v =>
    v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#module-metas .neg-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  const renders = {
    activas:     renderMetasActivas,
    nueva:       renderMetasNueva,
    completadas: renderMetasCompletadas
  };
  renders[view]?.();
}

// ── Utilidades de fecha ─────────────────────────────
function _diasRestantes(fechaLimite) {
  if (!fechaLimite) return null;
  const hoy  = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin  = new Date(fechaLimite + 'T00:00:00');
  return Math.round((fin - hoy) / 86400000);
}

function _fmtDias(dias) {
  if (dias === null) return '';
  if (dias < 0)  return `<span class="meta-dias" style="color:#ff4444;">VENCIDA ${Math.abs(dias)}d</span>`;
  if (dias === 0) return `<span class="meta-dias" style="color:#ff9900;">HOY</span>`;
  if (dias <= 7)  return `<span class="meta-dias" style="color:#ff9900;">${dias}d restantes</span>`;
  return `<span class="meta-dias">${dias}d restantes</span>`;
}

// ── Vista: Activas ───────────────────────────────────
function renderMetasActivas() {
  const el = document.getElementById('metas-activas-content');
  if (!el) return;

  const metas = getMetas().filter(m => !m.completada);

  if (metas.length === 0) {
    el.innerHTML = `<div class="neg-empty">Sin metas activas.<br>Crea una nueva meta para comenzar.</div>`;
    return;
  }

  // Ordenar: con fecha primero (más próxima antes), luego sin fecha
  metas.sort((a, b) => {
    if (a.fechaLimite && b.fechaLimite) return a.fechaLimite.localeCompare(b.fechaLimite);
    if (a.fechaLimite && !b.fechaLimite) return -1;
    if (!a.fechaLimite && b.fechaLimite) return 1;
    return a.creada - b.creada;
  });

  el.innerHTML = metas.map(m => {
    const cat   = METAS_CATS[m.categoria] || METAS_CATS.personal;
    const pct   = m.valorObjetivo > 0
      ? Math.min(100, Math.round((m.valorActual / m.valorObjetivo) * 100))
      : 0;
    const dias  = _diasRestantes(m.fechaLimite);
    const lograda = pct >= 100;

    const valLabel = m.tipo === 'porcentaje'
      ? `${m.valorActual}% / 100%`
      : `${m.valorActual}${m.unidad ? ' ' + _h(m.unidad) : ''} / ${m.valorObjetivo}${m.unidad ? ' ' + _h(m.unidad) : ''}`;

    const doneBtn = lograda
      ? `<button class="meta-btn-done" onclick="metaCompletar('${_escA(m.id)}')">&#10003; LOGRADA</button>`
      : '';

    const stepVal = m.tipo === 'porcentaje' ? '1' : 'any';
    const maxVal  = m.tipo === 'porcentaje' ? '100' : '';
    const maxAttr = maxVal ? ` max="${maxVal}"` : '';

    return `
      <div class="meta-card" id="meta-card-${_escA(m.id)}">
        <div class="meta-header">
          <div>
            <span class="meta-cat-badge" style="color:${cat.c};border-color:${cat.c};">${_h(cat.l.toUpperCase())}</span>
            <div class="meta-titulo">${_h(m.titulo)}</div>
          </div>
          <div style="display:flex;gap:4px;align-items:center;">
            <button class="neg-edit" onclick="metaEditar('${_escA(m.id)}')">✎</button>
            <button class="neg-del" onclick="metaEliminar('${_escA(m.id)}')">&#x2715;</button>
          </div>
        </div>
        ${m.descripcion ? `<div class="meta-desc">${_h(m.descripcion)}</div>` : ''}
        <div class="meta-progress-row">
          <div class="meta-track">
            <div class="meta-fill" style="width:${pct}%;background:${cat.c};"></div>
          </div>
          <span class="meta-pct">${pct}%</span>
        </div>
        <div class="meta-footer">
          <span class="meta-val">${valLabel}</span>
          ${_fmtDias(dias)}
        </div>
        <div class="meta-actions">
          <input
            type="number"
            id="meta-upd-${_escA(m.id)}"
            class="neg-input meta-update-input"
            placeholder="Nuevo valor"
            step="${stepVal}"${maxAttr}
            value="${m.valorActual}"
          />
          <button class="neg-btn-primary" style="width:auto;padding:7px 12px;" onclick="metaActualizar('${_escA(m.id)}')">ACTUALIZAR</button>
          ${doneBtn}
        </div>
        ${(() => {
          const hitos = m.hitos || [];
          const hitosDoneN = hitos.filter(h => h.completado).length;
          const hitosHtml = hitos.length ? `<div class="meta-hitos-list">${hitos.map(h => `
            <div class="meta-hito${h.completado ? ' hito-done' : ''}">
              <button class="hito-toggle" onclick="toggleHito('${_escA(m.id)}','${_escA(h.id)}')">${h.completado ? '✓' : ''}</button>
              <span class="hito-text">${_h(h.texto)}</span>
              <button class="hito-del" onclick="deleteHito('${_escA(m.id)}','${_escA(h.id)}')">✕</button>
            </div>`).join('')}</div>` : '';
          const progHito = hitos.length ? `<span class="meta-hito-count">${hitosDoneN}/${hitos.length} hitos</span>` : '';
          return `<div class="meta-hitos-section">
            ${progHito}${hitosHtml}
            <div class="meta-hito-add-row">
              <input class="meta-hito-input" type="text" placeholder="+ Agregar hito..." data-mid="${_escA(m.id)}" onkeydown="if(event.key==='Enter'&&this.value.trim()){addHito(this.dataset.mid,this.value.trim());this.value='';event.preventDefault();}"/>
            </div>
          </div>`;
        })()}
      </div>`;
  }).join('');
}

// ── Vista: Nueva ─────────────────────────────────────
function renderMetasNueva() {
  const el = document.getElementById('metas-nueva-content');
  if (!el) return;

  const catOptions = Object.entries(METAS_CATS)
    .map(([k, v]) => `<option value="${k}">${v.l}</option>`)
    .join('');

  el.innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">NUEVA META</div>

      <div class="neg-cfg-fila">
        <label>Título *</label>
        <input type="text" id="mt-titulo" class="neg-input" placeholder="Ej: Bajar 10 kg" maxlength="80"/>
      </div>

      <div class="neg-cfg-fila">
        <label>Descripción (opcional)</label>
        <input type="text" id="mt-desc" class="neg-input" placeholder="Detalles adicionales" maxlength="200"/>
      </div>

      <div class="neg-form-row">
        <div class="neg-cfg-fila" style="flex:1;">
          <label>Categoría</label>
          <select id="mt-cat" class="neg-select">${catOptions}</select>
        </div>
        <div class="neg-cfg-fila" style="flex:1;">
          <label>Tipo</label>
          <select id="mt-tipo" class="neg-select" onchange="mtTipoChange()">
            <option value="numero">Numérica</option>
            <option value="porcentaje">Porcentaje</option>
          </select>
        </div>
      </div>

      <div id="mt-num-fields">
        <div class="neg-form-row">
          <div class="neg-cfg-fila" style="flex:1;">
            <label>Valor objetivo *</label>
            <input type="number" id="mt-objetivo" class="neg-input" placeholder="Ej: 10" min="0" step="any"/>
          </div>
          <div class="neg-cfg-fila" style="flex:1;">
            <label>Unidad (opcional)</label>
            <input type="text" id="mt-unidad" class="neg-input" placeholder="Ej: kg, $, km" maxlength="10"/>
          </div>
        </div>
      </div>

      <div class="neg-cfg-fila">
        <label>Fecha límite (opcional)</label>
        <input type="date" id="mt-fecha" class="neg-input"/>
      </div>

      <button class="neg-btn-primary" onclick="metaCrear()">CREAR META</button>
    </div>`;
}

// ── Vista: Completadas ────────────────────────────────
function renderMetasCompletadas() {
  const el = document.getElementById('metas-comp-content');
  if (!el) return;

  const metas = getMetas().filter(m => m.completada);

  if (metas.length === 0) {
    el.innerHTML = `<div class="neg-empty">Aún no has logrado ninguna meta.<br>&#161;Sigue adelante, puedes hacerlo!</div>`;
    return;
  }

  metas.sort((a, b) => (b.fechaCompletada || b.creada) - (a.fechaCompletada || a.creada));

  const _fmtFecha = ms => ms ? new Date(ms).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  el.innerHTML = metas.map(m => {
    const cat = METAS_CATS[m.categoria] || METAS_CATS.personal;
    return `
      <div class="meta-card meta-done">
        <div class="meta-header">
          <div>
            <span class="meta-cat-badge" style="color:${cat.c};border-color:${cat.c};">${_h(cat.l.toUpperCase())}</span>
            <div class="meta-titulo">${_h(m.titulo)}</div>
          </div>
          <button class="neg-del" onclick="metaEliminar('${_escA(m.id)}')">&#x2715;</button>
        </div>
        <div class="meta-lograda-lbl">META LOGRADA &#10003;</div>
        ${m.fechaCompletada ? `<div class="meta-fecha-completada">Completada: ${_fmtFecha(m.fechaCompletada)}</div>` : ''}
        <button class="meta-reactivar-btn" onclick="metaReactivar('${_escA(m.id)}')">↩ REACTIVAR</button>
      </div>`;
  }).join('');
}

// ── Acciones ─────────────────────────────────────────
function metaCrear() {
  const titulo  = (document.getElementById('mt-titulo')?.value  || '').trim();
  const desc    = (document.getElementById('mt-desc')?.value    || '').trim();
  const cat     = document.getElementById('mt-cat')?.value      || 'personal';
  const tipo    = document.getElementById('mt-tipo')?.value     || 'numero';
  const fecha   = document.getElementById('mt-fecha')?.value    || '';

  if (!titulo) {
    tost('El título es obligatorio.', 'error');
    return;
  }

  let valorObjetivo = 100;
  let unidad = '';

  if (tipo === 'numero') {
    const rawObj = document.getElementById('mt-objetivo')?.value;
    valorObjetivo = parseFloat(rawObj);
    if (!rawObj || isNaN(valorObjetivo) || valorObjetivo <= 0) {
      tost('Ingresa un valor objetivo válido mayor a 0.', 'error');
      return;
    }
    unidad = (document.getElementById('mt-unidad')?.value || '').trim();
  }

  const metas = getMetas();
  metas.push({
    id:            Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    titulo,
    descripcion:   desc,
    categoria:     cat,
    tipo,
    unidad,
    valorActual:   0,
    valorObjetivo,
    fechaLimite:   fecha,
    creada:        Date.now(),
    completada:    false
  });
  saveMetas(metas);
  switchMetasView('activas');
}

function metaActualizar(id) {
  const input = document.getElementById(`meta-upd-${id}`);
  if (!input) return;
  let val = parseFloat(input.value);
  if (isNaN(val)) return;

  const metas = getMetas();
  const meta  = metas.find(m => m.id === id);
  if (!meta) return;

  if (meta.tipo === 'porcentaje') {
    val = Math.max(0, Math.min(100, val));
  } else {
    val = Math.max(0, val);
  }

  meta.valorActual = val;
  saveMetas(metas);
  renderMetasActivas();
}

async function metaCompletar(id) {
  if (!await pregunta('¿Marcar esta meta como lograda?')) return;   // v216: confirm() se suprime en la PWA de iOS
  const metas = getMetas();
  const meta  = metas.find(m => m.id === id);
  if (!meta) return;
  meta.completada     = true;
  meta.valorActual    = meta.valorObjetivo;
  meta.fechaCompletada = Date.now();
  saveMetas(metas);
  renderMetasActivas();
}

function metaReactivar(id) {
  const metas = getMetas();
  const meta  = metas.find(m => m.id === id);
  if (!meta) return;
  meta.completada      = false;
  meta.fechaCompletada = null;
  saveMetas(metas);
  renderMetasCompletadas();
}

async function metaEliminar(id) {
  if (!await pregunta('¿Eliminar esta meta?')) return;   // v216: confirm() se suprime en la PWA de iOS
  const metas = getMetas().filter(m => m.id !== id);
  saveMetas(metas);

  // Re-render la vista activa
  const activeView = document.querySelector('#module-metas .neg-view.active');
  const view = activeView?.dataset.view || 'activas';
  const renders = {
    activas:     renderMetasActivas,
    completadas: renderMetasCompletadas
  };
  renders[view]?.();
}

function mtTipoChange() {
  const tipo   = document.getElementById('mt-tipo')?.value;
  const fields = document.getElementById('mt-num-fields');
  if (!fields) return;
  fields.style.display = tipo === 'porcentaje' ? 'none' : '';
}

function metaEditar(id) {
  const card = document.getElementById(`meta-card-${id}`);
  if (!card) return;
  const m = getMetas().find(x => x.id === id);
  if (!m) return;
  const catOpts = Object.entries(METAS_CATS)
    .map(([k, v]) => `<option value="${k}"${m.categoria === k ? ' selected' : ''}>${v.l}</option>`)
    .join('');
  card.innerHTML = `
    <div class="neg-form-title">EDITAR META</div>
    <div class="neg-cfg-fila">
      <label>Título</label>
      <input type="text" id="me-t-${_escA(id)}" class="neg-input" value="${_escA(m.titulo)}" maxlength="80"/>
    </div>
    <div class="neg-cfg-fila">
      <label>Descripción</label>
      <input type="text" id="me-d-${_escA(id)}" class="neg-input" value="${_escA(m.descripcion || '')}" maxlength="200"/>
    </div>
    <div class="neg-form-row">
      <div class="neg-cfg-fila" style="flex:1;">
        <label>Categoría</label>
        <select id="me-c-${_escA(id)}" class="neg-select">${catOpts}</select>
      </div>
      <div class="neg-cfg-fila" style="flex:1;">
        <label>Fecha límite</label>
        <input type="date" id="me-f-${_escA(id)}" class="neg-input" value="${m.fechaLimite || ''}"/>
      </div>
    </div>
    <div class="neg-form-row">
      <button class="neg-btn-primary" style="flex:1;" onclick="metaGuardarEdit('${_escA(id)}')">GUARDAR</button>
      <button class="neg-btn-primary neg-btn-cancel" style="flex:1;" onclick="renderMetasActivas()">CANCELAR</button>
    </div>`;
}

function metaGuardarEdit(id) {
  const metas = getMetas();
  const m = metas.find(x => x.id === id);
  if (!m) return;
  const titulo = (document.getElementById(`me-t-${id}`)?.value || '').trim();
  if (!titulo) { tost('El título es obligatorio.', 'error'); return; }
  m.titulo      = titulo;
  m.descripcion = (document.getElementById(`me-d-${id}`)?.value || '').trim();
  m.categoria   = document.getElementById(`me-c-${id}`)?.value || m.categoria;
  m.fechaLimite = document.getElementById(`me-f-${id}`)?.value || '';
  saveMetas(metas);
  renderMetasActivas();
}

// ── Init ─────────────────────────────────────────────
function initMetasModule() {
  document.querySelectorAll('#module-metas .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchMetasView(tab.dataset.view)));
  switchMetasView('activas');
}

// ── Hitos (milestones) ───────────────────────────────
function addHito(metaId, texto) {
  if (!texto?.trim()) return;
  saveMetas(getMetas().map(m => {
    if (m.id !== metaId) return m;
    const hitos = m.hitos || [];
    return { ...m, hitos: [...hitos, { id: String(Date.now()), texto: texto.trim(), completado: false }] };
  }));
  renderMetasActivas();
}
function toggleHito(metaId, hitoId) {
  saveMetas(getMetas().map(m => {
    if (m.id !== metaId) return m;
    return { ...m, hitos: (m.hitos||[]).map(h => h.id === hitoId ? { ...h, completado: !h.completado } : h) };
  }));
  renderMetasActivas();
}
function deleteHito(metaId, hitoId) {
  saveMetas(getMetas().map(m => {
    if (m.id !== metaId) return m;
    return { ...m, hitos: (m.hitos||[]).filter(h => h.id !== hitoId) };
  }));
  renderMetasActivas();
}
window.addHito    = addHito;
window.toggleHito = toggleHito;
window.deleteHito = deleteHito;

// ── Exports globales ─────────────────────────────────
window.renderMetasModule    = () => switchMetasView('activas');
// Alias: app.js (pull de Firebase, quick-capture) y control.js refrescan con
// window.renderMetas?.() — sin el alias eran no-ops y Metas no se actualizaba
window.renderMetas          = window.renderMetasModule;
window.switchMetasView      = switchMetasView;
window.metaCrear            = metaCrear;
window.metaActualizar       = metaActualizar;
window.metaCompletar        = metaCompletar;
window.metaReactivar        = metaReactivar;
window.metaEliminar         = metaEliminar;
window.metaEditar           = metaEditar;
window.metaGuardarEdit      = metaGuardarEdit;
window.mtTipoChange         = mtTipoChange;

// ── Bootstrap ────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMetasModule);
} else {
  initMetasModule();
}
