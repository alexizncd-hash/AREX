// AREX — Módulo Proyectos
const PROJ_KEY = 'arex_proyectos';

function getProyectos() { try { return JSON.parse(localStorage.getItem(PROJ_KEY) || '[]'); } catch { return []; } }
function saveProyectos(arr) {
  localStorage.setItem(PROJ_KEY, JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData(PROJ_KEY);
}

/* ─── CRUD ────────────────────────────────────────────── */
const PROJ_ESTADOS = ['activo', 'planeando', 'en-progreso', 'revision', 'completado'];
const PROJ_ESTADO_LABELS = {
  'activo':      'ACTIVO',
  'planeando':   'PLANEANDO',
  'en-progreso': 'EN PROGRESO',
  'revision':    'REVISIÓN',
  'completado':  'COMPLETADO'
};

function proyectoCrear(nombre, descripcion = '', fechaLimite = '') {
  if (!nombre.trim()) return null;
  if (fechaLimite) {
    const d = new Date(fechaLimite + 'T00:00:00'); const y = d.getFullYear();
    if (isNaN(d.getTime()) || y < 2020 || y > 2040) fechaLimite = '';
  }
  const p = {
    id:          String(Date.now()),
    nombre:      nombre.trim().slice(0, 120),
    descripcion: descripcion.trim().slice(0, 300),
    estado:      'activo',
    fechaLimite: fechaLimite,
    creadoEn:    Date.now(),
    color:       _nextColor(),
  };
  const arr = getProyectos(); arr.push(p); saveProyectos(arr);
  renderProyectosModule();
  return p;
}

function proyectoEliminar(id) {
  saveProyectos(getProyectos().filter(p => p.id !== id));
  renderProyectosModule();
}

function proyectoToggleEstado(id) {
  const arr = getProyectos().map(p => {
    if (p.id !== id) return p;
    const idx = PROJ_ESTADOS.indexOf(p.estado);
    const next = PROJ_ESTADOS[(idx + 1) % PROJ_ESTADOS.length];
    return { ...p, estado: next };
  });
  saveProyectos(arr);
  renderProyectosModule();
}

function proyectoEditar(id) {
  const p = getProyectos().find(p => p.id === id);
  if (!p) return;
  const el = document.getElementById(`proj-${id}`);
  if (!el) return;
  el.querySelector('.proj-nombre').contentEditable = 'true';
  el.querySelector('.proj-nombre').focus();
  el.querySelector('.proj-nombre').addEventListener('blur', () => {
    const nuevo = el.querySelector('.proj-nombre').textContent.trim();
    if (nuevo) {
      saveProyectos(getProyectos().map(p => p.id === id ? { ...p, nombre: nuevo } : p));
    }
    el.querySelector('.proj-nombre').contentEditable = 'false';
  }, { once: true });
}

/* ─── Render ──────────────────────────────────────────── */
function renderProyectosModule() {
  const panel = document.getElementById('module-proyectos');
  if (!panel) return;

  const handle = panel.querySelector('.drawer-handle');
  const proyectos = getProyectos();
  const enCurso    = proyectos.filter(p => p.estado !== 'completado');
  const completados = proyectos.filter(p => p.estado === 'completado');

  panel.innerHTML = `
    <div class="proj-wrap">
      <div class="proj-header">
        <h2 class="proj-title">PROYECTOS</h2>
        <span class="proj-count">${enCurso.length} en curso</span>
      </div>

      <div class="proj-nuevo">
        <input id="proj-nombre-in" class="proj-input" placeholder="Nombre del proyecto..." autocomplete="off"/>
        <input id="proj-desc-in"   class="proj-input" placeholder="Descripción (opcional)..." autocomplete="off"/>
        <input id="proj-fecha-in"  class="proj-input" type="date" title="Fecha límite (opcional)"/>
        <button class="proj-add-btn" onclick="proyectoCrear(document.getElementById('proj-nombre-in').value, document.getElementById('proj-desc-in').value, document.getElementById('proj-fecha-in').value); document.getElementById('proj-nombre-in').value=''; document.getElementById('proj-desc-in').value=''; document.getElementById('proj-fecha-in').value='';">
          + NUEVO PROYECTO
        </button>
      </div>

      ${enCurso.length === 0 && completados.length === 0 ? `
        <div class="proj-empty">
          <p>Sin proyectos. Crea uno arriba o dile a AREX:<br>
          <em>"AREX, crea un proyecto para mi tesis"</em></p>
        </div>` : ''}

      ${enCurso.length ? `
        <div class="proj-section-label">EN CURSO</div>
        <div class="proj-list">
          ${enCurso.map(p => _renderCard(p)).join('')}
        </div>` : ''}

      ${completados.length ? `
        <div class="proj-section-label" style="margin-top:1.2rem">COMPLETADOS</div>
        <div class="proj-list">
          ${completados.map(p => _renderCard(p)).join('')}
        </div>` : ''}
    </div>
  `;

  if (handle) panel.prepend(handle);

  // Related tasks
  _loadRelatedData();
}

function _renderCard(p) {
  const tareas = _getTareasProyecto(p.nombre);
  const metas  = _getMetasProyecto(p.nombre);
  const notas  = _getNotasProyecto(p.nombre);
  const done   = p.estado === 'completado';

  // Task-based progress
  const doneTareas = tareas.filter(t => t.done).length;
  const pct = tareas.length > 0 ? Math.round((doneTareas / tareas.length) * 100) : 0;

  // Deadline badge
  let deadlineHTML = '';
  if (p.fechaLimite && !done) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const fin = new Date(p.fechaLimite + 'T00:00:00');
    const dias = Math.round((fin - hoy) / 86400000);
    const cls = dias < 0 ? 'late' : dias <= 3 ? 'soon' : '';
    const txt = dias < 0 ? `Venció hace ${-dias}d` : dias === 0 ? 'Hoy' : `${dias}d`;
    deadlineHTML = `<span class="proj-deadline${cls ? ' ' + cls : ''}">📅 ${txt}</span>`;
  }

  const estadoLabel = PROJ_ESTADO_LABELS[p.estado] || p.estado.toUpperCase();
  const nextEstado = PROJ_ESTADOS[(PROJ_ESTADOS.indexOf(p.estado) + 1) % PROJ_ESTADOS.length];

  return `
    <div class="proj-card ${done ? 'proj-done' : ''}" id="proj-${p.id}" style="--proj-color:${p.color}">
      <div class="proj-card-top">
        <div class="proj-color-dot" style="background:${p.color}"></div>
        <span class="proj-nombre${done ? ' proj-done-label' : ''}">${_safe(p.nombre)}</span>
        <span class="proj-estado-badge ${p.estado}">${estadoLabel}</span>
        <div class="proj-card-actions">
          <button title="Editar" onclick="proyectoEditar('${p.id}')">✏</button>
          <button title="→ ${PROJ_ESTADO_LABELS[nextEstado]}" onclick="proyectoToggleEstado('${p.id}')">→</button>
          <button title="Eliminar" onclick="if(confirm('¿Eliminar proyecto?'))proyectoEliminar('${p.id}')">✕</button>
        </div>
      </div>
      ${p.descripcion ? `<p class="proj-desc">${_safe(p.descripcion)}</p>` : ''}
      ${tareas.length > 0 ? `
        <div class="proj-progress-row">
          <div class="proj-progress-track">
            <div class="proj-progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="proj-progress-pct">${pct}%</span>
        </div>` : ''}
      <div class="proj-stats">
        ${deadlineHTML}
        ${tareas.length  ? `<span class="proj-stat">📋 ${doneTareas}/${tareas.length} tareas</span>` : ''}
        ${metas.length   ? `<span class="proj-stat">🎯 ${metas.length} meta${metas.length>1?'s':''}</span>` : ''}
        ${notas.length   ? `<span class="proj-stat">📝 ${notas.length} nota${notas.length>1?'s':''}</span>` : ''}
        ${!tareas.length && !metas.length && !notas.length && !deadlineHTML ? `<span class="proj-stat" style="opacity:0.4">Sin elementos relacionados</span>` : ''}
      </div>
    </div>
  `;
}

function _loadRelatedData() { /* counts are loaded inline via helpers */ }

function _getTareasProyecto(nombre) {
  try {
    if (typeof getTareas !== 'function') return [];
    const n = nombre.toLowerCase();
    return getTareas().filter(t => t.text?.toLowerCase().includes(n) || t.proyecto === nombre);
  } catch(_) { return []; }
}

function _getMetasProyecto(nombre) {
  try {
    if (typeof getMetas !== 'function') return [];
    const n = nombre.toLowerCase();
    return getMetas().filter(m => m.titulo?.toLowerCase().includes(n) || m.proyecto === nombre);
  } catch(_) { return []; }
}

function _getNotasProyecto(nombre) {
  try {
    if (typeof getNotas !== 'function') return [];
    const n = nombre.toLowerCase();
    return getNotas().filter(nt => nt.titulo?.toLowerCase().includes(n) || nt.cuerpo?.toLowerCase().includes(n));
  } catch(_) { return []; }
}

const PROJ_COLORS = ['#22d3ee','#34ffc3','#ff9900','#c77dff','#ff6b6b','#4ecdc4','#ffd93d','#6bcb77'];
let _colorIdx = 0;
function _nextColor() { return PROJ_COLORS[(_colorIdx++) % PROJ_COLORS.length]; }
function _safe(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ─── Exports ─────────────────────────────────────────── */
window.renderProyectosModule = renderProyectosModule;
window.proyectoCrear         = proyectoCrear;
window.proyectoEliminar      = proyectoEliminar;
window.proyectoToggleEstado  = proyectoToggleEstado;
window.proyectoEditar        = proyectoEditar;
window.getProyectos          = getProyectos;
window.PROJ_ESTADOS          = PROJ_ESTADOS;
window.PROJ_ESTADO_LABELS    = PROJ_ESTADO_LABELS;
