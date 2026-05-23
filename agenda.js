// ══════════════════════════════════════════════════════
// AREX — Módulo Agenda
// Eventos con fecha, hora y categoría
// ══════════════════════════════════════════════════════

const AGENDA_KEY = 'arex_agenda';

const AGENDA_CATS = {
  trabajo:     { label: 'Trabajo',     color: '#00d4ff', icon: '💼' },
  personal:    { label: 'Personal',    color: '#00ffaa', icon: '🙋' },
  salud:       { label: 'Salud',       color: '#ff9900', icon: '🏃' },
  universidad: { label: 'Universidad', color: '#c478ff', icon: '📚' },
  familia:     { label: 'Familia',     color: '#ff6644', icon: '👨‍👩‍👧' },
  otro:        { label: 'Otro',        color: '#aaaaaa', icon: '📌' }
};

function getAgendaData() {
  try {
    const raw = localStorage.getItem(AGENDA_KEY);
    if (!raw) return { eventos: [] };
    const saved = JSON.parse(raw);
    return { eventos: saved.eventos || [] };
  } catch { return { eventos: [] }; }
}

function saveAgendaData(data) {
  localStorage.setItem(AGENDA_KEY, JSON.stringify(data));
  if (typeof arexSyncData === 'function') arexSyncData(AGENDA_KEY);
}

const _agendaTodayStr = () => new Date().toISOString().slice(0, 10);

function _sortEventos(evs) {
  return evs.slice().sort((a, b) => {
    const da = a.fecha + (a.hora || '00:00');
    const db = b.fecha + (b.hora || '00:00');
    return da.localeCompare(db);
  });
}

function _fmtFecha(dateStr) {
  return new Date(dateStr + 'T12:00').toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
}
function _fmtFechaCorta(dateStr) {
  return new Date(dateStr + 'T12:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
}
function _fmtHora(h) {
  if (!h) return '';
  const [hh, mm] = h.split(':');
  return `${parseInt(hh)}:${mm}`;
}

function _getWeekDays() {
  const hoy = new Date();
  const dow  = hoy.getDay(); // 0=Dom
  const lun  = new Date(hoy); lun.setDate(hoy.getDate() - ((dow + 6) % 7));
  const dias = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(lun); d.setDate(lun.getDate() + i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

function _eventCard(ev, showDate) {
  const cat = AGENDA_CATS[ev.categoria] || AGENDA_CATS.otro;
  const isHoy = ev.fecha === _agendaTodayStr();
  const tareas = window.getTareas ? window.getTareas().filter(t => !t.done && t.fecha === ev.fecha) : [];
  return `
    <div class="ag-card${isHoy ? ' ag-hoy' : ''}" style="border-left-color:${cat.color}">
      <div class="ag-card-top">
        <span class="ag-card-icon">${cat.icon}</span>
        <div class="ag-card-body">
          ${showDate ? `<div class="ag-card-fecha">${_fmtFechaCorta(ev.fecha)}</div>` : ''}
          <div class="ag-card-titulo">${ev.titulo.replace(/</g,'&lt;')}</div>
          ${ev.hora ? `<div class="ag-card-hora">${_fmtHora(ev.hora)}${ev.duracion ? ' · ' + ev.duracion + ' min' : ''}</div>` : ''}
          ${ev.notas ? `<div class="ag-card-notas">${ev.notas.replace(/</g,'&lt;')}</div>` : ''}
        </div>
        <button class="ag-del" onclick="agendaEliminar('${ev.id}')" title="Eliminar">✕</button>
      </div>
    </div>`;
}

// ── Vista HOY ───────────────────────────────────────

function renderAgendaHoy() {
  const data = getAgendaData();
  const hoy  = _agendaTodayStr();
  const hoyDate = new Date();
  const mañana = new Date(hoyDate); mañana.setDate(hoyDate.getDate() + 1);
  const mStr = mañana.toISOString().slice(0, 10);

  const evHoy  = _sortEventos(data.eventos.filter(e => e.fecha === hoy));
  const evMañ  = _sortEventos(data.eventos.filter(e => e.fecha === mStr));

  // Tareas pendientes con fecha hoy (integración con módulo Tareas)
  const tareasHoy = window.getTareas ? window.getTareas().filter(t => !t.done && t.fecha === hoy) : [];

  document.getElementById('ag-hoy-content').innerHTML = `
    <div class="ag-date-header">
      <span class="ag-date-main">${hoyDate.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' }).toUpperCase()}</span>
    </div>

    <div class="ag-section-title">HOY — ${evHoy.length} evento${evHoy.length !== 1 ? 's' : ''}</div>
    ${evHoy.length === 0
      ? '<div class="ag-empty-small">Sin eventos hoy</div>'
      : evHoy.map(e => _eventCard(e, false)).join('')}

    ${tareasHoy.length > 0 ? `
    <div class="ag-section-title" style="margin-top:0.8rem">TAREAS HOY — ${tareasHoy.length}</div>
    <div class="ag-tareas-list">
      ${tareasHoy.map(t => `
        <div class="ag-tarea-item">
          <span class="ag-tarea-dot ${t.prioridad || 'media'}"></span>
          <span class="ag-tarea-txt">${t.text.replace(/</g,'&lt;')}</span>
        </div>`).join('')}
    </div>` : ''}

    ${evMañ.length > 0 ? `
    <div class="ag-section-title" style="margin-top:0.8rem">MAÑANA</div>
    ${evMañ.map(e => _eventCard(e, false)).join('')}` : ''}

    <button class="neg-btn-primary" style="margin-top:0.8rem" onclick="switchAgendaView('nuevo')">+ AGREGAR EVENTO</button>
  `;
}

// ── Vista SEMANA ────────────────────────────────────

function renderAgendaSemana() {
  const data = getAgendaData();
  const dias = _getWeekDays();
  const hoy  = _agendaTodayStr();
  const DIAS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const rows = dias.map(d => {
    const date  = new Date(d + 'T12:00');
    const evs   = _sortEventos(data.eventos.filter(e => e.fecha === d));
    const isHoy = d === hoy;
    const esHoy = date.getDay();
    return `
      <div class="ag-week-row${isHoy ? ' ag-week-hoy' : ''}">
        <div class="ag-week-day">
          <span class="ag-week-lbl">${DIAS_ES[esHoy]}</span>
          <span class="ag-week-num ${isHoy ? 'hoy' : ''}">${date.getDate()}</span>
        </div>
        <div class="ag-week-evs">
          ${evs.length === 0
            ? '<span class="ag-week-empty">—</span>'
            : evs.map(e => {
                const cat = AGENDA_CATS[e.categoria] || AGENDA_CATS.otro;
                return `<span class="ag-week-chip" style="background:${cat.color}22;border-color:${cat.color}44;color:${cat.color}">${cat.icon} ${e.titulo.replace(/</g,'&lt;').slice(0,22)}</span>`;
              }).join('')}
        </div>
      </div>`;
  }).join('');

  document.getElementById('ag-sem-content').innerHTML = `
    <div class="ag-week-grid">${rows}</div>
    <button class="neg-btn-primary" style="margin-top:0.8rem" onclick="switchAgendaView('nuevo')">+ AGREGAR EVENTO</button>
  `;
}

// ── Vista NUEVO EVENTO ──────────────────────────────

function renderAgendaNuevo() {
  const hoy = _agendaTodayStr();
  document.getElementById('ag-nuevo-content').innerHTML = `
    <div class="neg-form-card">
      <div class="neg-form-title">NUEVO EVENTO</div>
      <div class="neg-cfg-fila">
        <label>TÍTULO</label>
        <input type="text" id="ag-titulo" class="neg-input" placeholder="Reunión, cita, clase..." autocomplete="off"/>
      </div>
      <div class="neg-form-row">
        <div class="neg-cfg-fila" style="flex:1">
          <label>FECHA</label>
          <input type="date" id="ag-fecha" class="neg-input" value="${hoy}"/>
        </div>
        <div class="neg-cfg-fila" style="flex:1">
          <label>HORA</label>
          <input type="time" id="ag-hora" class="neg-input" placeholder="08:00"/>
        </div>
      </div>
      <div class="neg-form-row">
        <div class="neg-cfg-fila" style="flex:1">
          <label>DURACIÓN (min)</label>
          <input type="number" id="ag-duracion" class="neg-input" placeholder="60" min="0" step="15"/>
        </div>
        <div class="neg-cfg-fila" style="flex:1">
          <label>CATEGORÍA</label>
          <select id="ag-cat" class="neg-select">
            ${Object.entries(AGENDA_CATS).map(([k, v]) =>
              `<option value="${k}">${v.icon} ${v.label}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="neg-cfg-fila">
        <label>NOTAS (opcional)</label>
        <input type="text" id="ag-notas" class="neg-input" placeholder="Detalles adicionales..."/>
      </div>
      <button class="neg-btn-primary" onclick="agendaGuardar()">GUARDAR EVENTO</button>
      <div id="ag-form-ok" style="display:none;text-align:center;font-size:10px;color:#00ffaa;letter-spacing:2px;margin-top:4px;">✓ EVENTO GUARDADO</div>
    </div>
  `;
}

// ── Acciones ────────────────────────────────────────

function agendaGuardar() {
  const titulo = document.getElementById('ag-titulo')?.value.trim();
  if (!titulo) {
    document.getElementById('ag-titulo')?.focus();
    return;
  }
  const data = getAgendaData();
  data.eventos.push({
    id:        String(Date.now()),
    titulo,
    fecha:     document.getElementById('ag-fecha')?.value   || _agendaTodayStr(),
    hora:      document.getElementById('ag-hora')?.value    || '',
    duracion:  parseInt(document.getElementById('ag-duracion')?.value) || 0,
    categoria: document.getElementById('ag-cat')?.value     || 'otro',
    notas:     document.getElementById('ag-notas')?.value.trim() || ''
  });
  saveAgendaData(data);
  const ok = document.getElementById('ag-form-ok');
  if (ok) { ok.style.display = 'block'; setTimeout(() => ok.style.display = 'none', 1500); }
  document.getElementById('ag-titulo').value   = '';
  document.getElementById('ag-hora').value     = '';
  document.getElementById('ag-duracion').value = '';
  document.getElementById('ag-notas').value    = '';
}

function agendaEliminar(id) {
  const data = getAgendaData();
  data.eventos = data.eventos.filter(e => e.id !== id);
  saveAgendaData(data);
  const view = document.querySelector('#module-agenda .sal-view.active, #module-agenda .neg-view.active');
  if (view?.dataset.view === 'hoy')    renderAgendaHoy();
  if (view?.dataset.view === 'semana') renderAgendaSemana();
}

// ── Módulo principal ─────────────────────────────────

function switchAgendaView(view) {
  document.querySelectorAll('#module-agenda .ag-view').forEach(v =>
    v.classList.toggle('active', v.dataset.view === view));
  document.querySelectorAll('#module-agenda .neg-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.view === view));
  if (view === 'hoy')    renderAgendaHoy();
  if (view === 'semana') renderAgendaSemana();
  if (view === 'nuevo')  renderAgendaNuevo();
}

function renderAgendaModule() {
  switchAgendaView('hoy');
}

// Expose
window.agendaGuardar     = agendaGuardar;
window.agendaEliminar    = agendaEliminar;
window.switchAgendaView  = switchAgendaView;
window.renderAgendaModule = renderAgendaModule;
window.getAgendaData     = getAgendaData;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('#module-agenda .neg-tab').forEach(tab =>
      tab.addEventListener('click', () => switchAgendaView(tab.dataset.view)));
  });
} else {
  document.querySelectorAll('#module-agenda .neg-tab').forEach(tab =>
    tab.addEventListener('click', () => switchAgendaView(tab.dataset.view)));
}
