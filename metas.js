// ══════════════════════════════════════════════════════
// AREX — Módulo Metas
// Seguimiento de metas personales con progreso
// ══════════════════════════════════════════════════════

const METAS_KEY = 'arex_metas';

const METAS_CATS = {
  personal:  { l: 'Personal',   c: '#00d4ff' },
  negocio:   { l: 'Negocio',    c: '#00ffaa' },
  salud:     { l: 'Salud',      c: '#ff9900' },
  finanzas:  { l: 'Finanzas',   c: '#9b59b6' },
  educacion: { l: 'Educación',  c: '#e74c3c' }
};

// ── Helpers de escape ───────────────────────────────
const _escH = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const _escA = s => String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

// ── Persistencia ────────────────────────────────────
function getMetas() {
  try {
    const raw = localStorage.getItem(METAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveMetas(arr) {
  localStorage.setItem(METAS_KEY, JSON.stringify(arr));
}

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
      : `${m.valorActual}${m.unidad ? ' ' + _escH(m.unidad) : ''} / ${m.valorObjetivo}${m.unidad ? ' ' + _escH(m.unidad) : ''}`;

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
            <span class="meta-cat-badge" style="color:${cat.c};border-color:${cat.c};">${_escH(cat.l.toUpperCase())}</span>
            <div class="meta-titulo">${_escH(m.titulo)}</div>
          </div>
          <button class="neg-del" onclick="metaEliminar('${_escA(m.id)}')">&#x2715;</button>
        </div>
        ${m.descripcion ? `<div class="meta-desc">${_escH(m.descripcion)}</div>` : ''}
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

  metas.sort((a, b) => b.creada - a.creada);

  el.innerHTML = metas.map(m => {
    const cat = METAS_CATS[m.categoria] || METAS_CATS.personal;
    return `
      <div class="meta-card meta-done">
        <div class="meta-header">
          <div>
            <span class="meta-cat-badge" style="color:${cat.c};border-color:${cat.c};">${_escH(cat.l.toUpperCase())}</span>
            <div class="meta-titulo">${_escH(m.titulo)}</div>
          </div>
          <button class="neg-del" onclick="metaEliminar('${_escA(m.id)}')">&#x2715;</button>
        </div>
        <div class="meta-lograda-lbl">META LOGRADA &#10003;</div>
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
    alert('El título es obligatorio.');
    return;
  }

  let valorObjetivo = 100;
  let unidad = '';

  if (tipo === 'numero') {
    const rawObj = document.getElementById('mt-objetivo')?.value;
    valorObjetivo = parseFloat(rawObj);
    if (!rawObj || isNaN(valorObjetivo) || valorObjetivo <= 0) {
      alert('Ingresa un valor objetivo válido mayor a 0.');
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

function metaCompletar(id) {
  if (!confirm('¿Marcar esta meta como lograda?')) return;
  const metas = getMetas();
  const meta  = metas.find(m => m.id === id);
  if (!meta) return;
  meta.completada  = true;
  meta.valorActual = meta.valorObjetivo;
  saveMetas(metas);
  renderMetasActivas();
}

function metaEliminar(id) {
  if (!confirm('¿Eliminar esta meta?')) return;
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

// ── Init ─────────────────────────────────────────────
function initMetasModule() {
  document.querySelectorAll('#module-metas .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchMetasView(tab.dataset.view)));
  switchMetasView('activas');
}

// ── Exports globales ─────────────────────────────────
window.renderMetasModule    = () => switchMetasView('activas');
window.switchMetasView      = switchMetasView;
window.metaCrear            = metaCrear;
window.metaActualizar       = metaActualizar;
window.metaCompletar        = metaCompletar;
window.metaEliminar         = metaEliminar;
window.mtTipoChange         = mtTipoChange;

// ── Bootstrap ────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMetasModule);
} else {
  initMetasModule();
}
