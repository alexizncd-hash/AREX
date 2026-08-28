// AREX — Módulo Proyectos
const PROJ_KEY = 'arex_proyectos';

function getProyectos() { return leer(PROJ_KEY, []); }
function saveProyectos(arr) { guardar(PROJ_KEY, arr); }

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

async function proyectoEliminar(id) {
  // v216: la confirmación estaba metida en el onclick del botón —
  // if(confirm(...))proyectoEliminar(...)— y confirm() se suprime en la PWA
  // instalada de iOS, así que el proyecto se borraba sin preguntar nada.
  if (!await pregunta('¿Eliminar este proyecto?')) return;
  saveProyectos(getProyectos().filter(p => p.id !== id));
  renderProyectosModule();
  tost('Proyecto eliminado', 'ok');
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

/* v242 · RENOMBRAR UN PROYECTO SE PERDÍA EN SILENCIO.
   El guardado colgaba de un `blur` con {once:true}. Cualquier repintado del
   módulo —crear otro proyecto, cambiar un estado, o que llegue un cambio de
   la nube— reemplaza el nodo: el blur no llega a dispararse nunca y el
   nombre nuevo se descarta sin decir nada. Ahora también se guarda con Enter
   y se vuelca lo escrito poco después de dejar de teclear, así que aunque el
   nodo desaparezca el nombre ya está en disco. */
function proyectoEditar(id) {
  const p = getProyectos().find(p => p.id === id);
  if (!p) return;
  const el = document.getElementById(`proj-${id}`);
  const campo = el?.querySelector('.proj-nombre');
  if (!campo) return;

  campo.contentEditable = 'true';
  campo.focus();

  let guardado = false;
  const guardar = () => {
    const nuevo = campo.textContent.trim();
    if (!nuevo || guardado) return;
    guardado = true;
    saveProyectos(getProyectos().map(x => x.id === id ? { ...x, nombre: nuevo } : x));
  };

  let t;
  campo.addEventListener('input', () => { clearTimeout(t); guardado = false; t = setTimeout(guardar, 600); });
  campo.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); clearTimeout(t); guardar(); campo.blur(); }
    if (e.key === 'Escape') { guardado = true; campo.textContent = p.nombre; campo.blur(); }
  });
  campo.addEventListener('blur', () => {
    clearTimeout(t); guardar();
    campo.contentEditable = 'false';
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

  // v241: p.estado.toUpperCase() sin guarda. Un proyecto sin estado —de una
  // versión anterior o traído de la nube— lanzaba TypeError DENTRO del
  // template, así que la asignación de innerHTML no llegaba a ocurrir: el
  // panel se quedaba con el contenido viejo y PROYECTOS dejaba de
  // actualizarse, sin ningún error visible.
  const estadoLabel = PROJ_ESTADO_LABELS[p.estado] || String(p.estado || 'activo').toUpperCase();
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
          <button title="Eliminar" onclick="proyectoEliminar('${p.id}')">✕</button>
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

/* v241 · LAS COSAS SE ASOCIABAN A UN PROYECTO POR PARECIDO DE NOMBRE.

   Bastaba con que el texto CONTUVIERA el nombre del proyecto. Con un
   proyecto llamado "Casa", la tarea "Comprar casaca para Sofi" y la nota
   "regresar a casa antes de las 8" contaban como suyas — y la barra de
   progreso sale de esa muestra: con una tarea real hecha y tres coladas sin
   hacer, el proyecto decía 25 %. Un proyecto llamado "Ver", "Pan" o "Sol" se
   tragaba medio sistema.

   Ahora manda el vínculo explícito (`proyecto === nombre`). La coincidencia
   por texto sigue existiendo, pero solo como SUGERENCIA: se enseña aparte y
   no entra en el progreso. */
function _porNombreExacto(lista, nombre) {
  return lista.filter(x => x.proyecto === nombre);
}
function _porTexto(lista, nombre, campos) {
  const n = nombre.toLowerCase();
  if (n.length < 4) return [];   // "Ver", "Pan", "Sol" enganchan cualquier cosa
  return lista.filter(x => x.proyecto !== nombre &&
    campos.some(c => x[c]?.toLowerCase().includes(n)));
}

function _getTareasProyecto(nombre) {
  try {
    if (typeof getTareas !== 'function') return [];
    return _porNombreExacto(getTareas(), nombre);
  } catch(_) { return []; }
}
function _getTareasSugeridas(nombre) {
  try {
    if (typeof getTareas !== 'function') return [];
    return _porTexto(getTareas(), nombre, ['text', 'texto']);
  } catch(_) { return []; }
}

function _getMetasProyecto(nombre) {
  try {
    if (typeof getMetas !== 'function') return [];
    return _porNombreExacto(getMetas(), nombre);
  } catch(_) { return []; }
}

function _getNotasProyecto(nombre) {
  try {
    if (typeof getNotas !== 'function') return [];
    return _porNombreExacto(getNotas(), nombre);
  } catch(_) { return []; }
}

const PROJ_COLORS = ['#22d3ee','#34ffc3','#ff9900','#c77dff','#ff6b6b','#4ecdc4','#ffd93d','#6bcb77'];
let _colorIdx = 0;
function _nextColor() { return PROJ_COLORS[(_colorIdx++) % PROJ_COLORS.length]; }
function _safe(s) { return _h(s); }

/* ─── Exports ─────────────────────────────────────────── */
window.renderProyectosModule = renderProyectosModule;
window.proyectoCrear         = proyectoCrear;
window.proyectoEliminar      = proyectoEliminar;
window.proyectoToggleEstado  = proyectoToggleEstado;
window.proyectoEditar        = proyectoEditar;
window.getProyectos          = getProyectos;
window.PROJ_ESTADOS          = PROJ_ESTADOS;
window.PROJ_ESTADO_LABELS    = PROJ_ESTADO_LABELS;
