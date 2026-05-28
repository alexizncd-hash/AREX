// AREX — Módulo Proyectos
const PROJ_KEY = 'arex_proyectos';

function getProyectos() { return JSON.parse(localStorage.getItem(PROJ_KEY) || '[]'); }
function saveProyectos(arr) {
  localStorage.setItem(PROJ_KEY, JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData(PROJ_KEY);
}

/* ─── CRUD ────────────────────────────────────────────── */
function proyectoCrear(nombre, descripcion = '') {
  if (!nombre.trim()) return null;
  const p = {
    id:          String(Date.now()),
    nombre:      nombre.trim(),
    descripcion: descripcion.trim(),
    estado:      'activo',
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
  const arr = getProyectos().map(p =>
    p.id === id ? { ...p, estado: p.estado === 'activo' ? 'completado' : 'activo' } : p
  );
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

  const proyectos = getProyectos();
  const activos    = proyectos.filter(p => p.estado === 'activo');
  const completados = proyectos.filter(p => p.estado === 'completado');

  panel.innerHTML = `
    <div class="proj-wrap">
      <div class="proj-header">
        <h2 class="proj-title">PROYECTOS</h2>
        <span class="proj-count">${activos.length} activo${activos.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="proj-nuevo">
        <input id="proj-nombre-in" class="proj-input" placeholder="Nombre del proyecto..." autocomplete="off"/>
        <input id="proj-desc-in"   class="proj-input" placeholder="Descripción (opcional)..." autocomplete="off"/>
        <button class="proj-add-btn" onclick="proyectoCrear(document.getElementById('proj-nombre-in').value, document.getElementById('proj-desc-in').value); document.getElementById('proj-nombre-in').value=''; document.getElementById('proj-desc-in').value='';">
          + NUEVO PROYECTO
        </button>
      </div>

      ${activos.length === 0 && completados.length === 0 ? `
        <div class="proj-empty">
          <p>Sin proyectos. Crea uno arriba o dile a AREX:<br>
          <em>"AREX, crea un proyecto para mi tesis"</em></p>
        </div>` : ''}

      ${activos.length ? `
        <div class="proj-section-label">ACTIVOS</div>
        <div class="proj-list">
          ${activos.map(p => _renderCard(p)).join('')}
        </div>` : ''}

      ${completados.length ? `
        <div class="proj-section-label" style="margin-top:1.2rem">COMPLETADOS</div>
        <div class="proj-list">
          ${completados.map(p => _renderCard(p)).join('')}
        </div>` : ''}
    </div>
  `;

  // Related tasks
  _loadRelatedData();
}

function _renderCard(p) {
  const tareas = _getTareasProyecto(p.nombre);
  const metas  = _getMetasProyecto(p.nombre);
  const notas  = _getNotasProyecto(p.nombre);
  const done   = p.estado === 'completado';

  return `
    <div class="proj-card ${done ? 'proj-done' : ''}" id="proj-${p.id}" style="--proj-color:${p.color}">
      <div class="proj-card-top">
        <div class="proj-color-dot" style="background:${p.color}"></div>
        <span class="proj-nombre" style="${done ? 'text-decoration:line-through;opacity:0.5' : ''}">${_safe(p.nombre)}</span>
        <div class="proj-card-actions">
          <button title="Editar" onclick="proyectoEditar('${p.id}')">✏</button>
          <button title="${done ? 'Reactivar' : 'Completar'}" onclick="proyectoToggleEstado('${p.id}')">${done ? '↩' : '✓'}</button>
          <button title="Eliminar" onclick="if(confirm('¿Eliminar proyecto?'))proyectoEliminar('${p.id}')">✕</button>
        </div>
      </div>
      ${p.descripcion ? `<p class="proj-desc">${_safe(p.descripcion)}</p>` : ''}
      <div class="proj-stats">
        ${tareas.length  ? `<span class="proj-stat">📋 ${tareas.length} tarea${tareas.length>1?'s':''}</span>` : ''}
        ${metas.length   ? `<span class="proj-stat">🎯 ${metas.length} meta${metas.length>1?'s':''}</span>` : ''}
        ${notas.length   ? `<span class="proj-stat">📝 ${notas.length} nota${notas.length>1?'s':''}</span>` : ''}
        ${!tareas.length && !metas.length && !notas.length ? `<span class="proj-stat" style="opacity:0.4">Sin elementos relacionados</span>` : ''}
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

const PROJ_COLORS = ['#00d4ff','#00ffaa','#ff9900','#c77dff','#ff6b6b','#4ecdc4','#ffd93d','#6bcb77'];
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
