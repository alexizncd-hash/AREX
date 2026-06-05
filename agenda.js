/* ═══════════════════════════════════════════════════════════════
   AREX — Módulo Agenda / Calendario Unificado
   Agrega tareas (con fecha), recordatorios y metas desde localStorage
   Vista: semanal (default) + mensual
   ═══════════════════════════════════════════════════════════════ */

/* ─── Helpers ─────────────────────────────────────────────── */
function _agFmt(date, opts) { return date.toLocaleDateString('es-MX', opts); }
function _agKey(date) { return date.toISOString().slice(0, 10); }
function _agToday() { const d = new Date(); d.setHours(0,0,0,0); return d; }

function _safeAgJSON(raw, def) {
  try { return JSON.parse(raw) || def; } catch { return def; }
}

/* ─── Data aggregation ───────────────────────────────────── */
function _agGetEvents() {
  const events = {};

  function addEv(fecha, ev) {
    if (!fecha) return;
    const key = typeof fecha === 'string' ? fecha.slice(0,10) : _agKey(fecha);
    if (!events[key]) events[key] = [];
    events[key].push(ev);
  }

  // Tareas con fecha
  const tareas = _safeAgJSON(localStorage.getItem('arex_tareas'), []);
  for (const t of tareas) {
    if (t.fecha && !t.done) {
      addEv(t.fecha, {
        type: 'tarea', id: t.id, title: t.text, prioridad: t.prioridad || 'media',
        repetir: t.repetir || 'ninguna', color: 'cyan',
      });
    }
  }

  // Recordatorios
  const recs = _safeAgJSON(localStorage.getItem('arex_recordatorios'), []);
  for (const r of recs) {
    if (!r.disparado && r.when) {
      const d = new Date(r.when);
      addEv(_agKey(d), {
        type: 'recordatorio', id: r.id, title: r.msg,
        hora: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
        color: 'orange',
      });
    }
  }

  // Metas con deadline
  const metas = _safeAgJSON(localStorage.getItem('arex_metas'), []);
  for (const m of metas) {
    if (!m.completada && m.deadline) {
      addEv(m.deadline, {
        type: 'meta', id: m.id, title: m.titulo || m.texto || 'Meta',
        progreso: m.progreso || 0, color: 'green',
      });
    }
  }

  return events;
}

/* ─── Render ────────────────────────────────────────────── */
let _agView    = 'semana';  // 'semana' | 'mes'
let _agOffset  = 0;         // weeks or months offset from today

function renderAgendaModule() {
  const el = document.getElementById('module-agenda');
  if (!el || !el.classList.contains('active')) return;

  const events = _agGetEvents();
  const today  = _agToday();

  el.innerHTML = `
    <div class="ag-wrap">
      <div class="ag-header">
        <div class="ag-title-row">
          <span class="ag-title">◈ AGENDA</span>
          <div class="ag-view-toggle">
            <button class="ag-vtab ${_agView==='semana'?'active':''}" data-av="semana">SEMANA</button>
            <button class="ag-vtab ${_agView==='mes'?'active':''}" data-av="mes">MES</button>
          </div>
        </div>
        <div class="ag-nav-row">
          <button class="ag-nav-btn" id="ag-prev">◂</button>
          <span class="ag-period" id="ag-period-label"></span>
          <button class="ag-nav-btn" id="ag-next">▸</button>
          <button class="ag-today-btn" id="ag-today">HOY</button>
        </div>
      </div>
      <div class="ag-body" id="ag-body"></div>
    </div>`;

  // Wire navigation
  el.querySelector('[data-av="semana"]').addEventListener('click', () => { _agView = 'semana'; _agOffset = 0; renderAgendaModule(); });
  el.querySelector('[data-av="mes"]').addEventListener('click',    () => { _agView = 'mes';    _agOffset = 0; renderAgendaModule(); });
  el.querySelector('#ag-prev').addEventListener('click',   () => { _agOffset--; _agRenderBody(events, today); });
  el.querySelector('#ag-next').addEventListener('click',   () => { _agOffset++; _agRenderBody(events, today); });
  el.querySelector('#ag-today').addEventListener('click',  () => { _agOffset = 0; _agRenderBody(events, today); });

  _agRenderBody(events, today);
}

function _agRenderBody(events, today) {
  if (_agView === 'semana') _agRenderSemana(events, today);
  else                      _agRenderMes(events, today);
}

/* ─── Weekly view ────────────────────────────────────────── */
function _agRenderSemana(events, today) {
  const body  = document.getElementById('ag-body');
  const label = document.getElementById('ag-period-label');
  if (!body) return;

  // Week start: Monday
  const start = new Date(today);
  const dow   = (today.getDay() + 6) % 7; // Mon=0
  start.setDate(today.getDate() - dow + _agOffset * 7);

  const end = new Date(start); end.setDate(start.getDate() + 6);
  if (label) label.textContent =
    `${_agFmt(start,{day:'numeric',month:'short'})} – ${_agFmt(end,{day:'numeric',month:'short',year:'numeric'})}`;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    days.push(d);
  }

  body.innerHTML = `<div class="ag-week-grid">${days.map(d => _agDayCard(d, events, today)).join('')}</div>`;
  _agAttachEvHandlers(body);
}

function _agDayCard(date, events, today) {
  const key  = _agKey(date);
  const isT  = key === _agKey(today);
  const evs  = events[key] || [];
  const dayNames = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const dayName  = dayNames[date.getDay()];

  return `<div class="ag-day-card${isT?' ag-today':''}">
    <div class="ag-day-hdr">
      <span class="ag-day-name">${dayName}</span>
      <span class="ag-day-num${isT?' ag-day-num-today':''}">${date.getDate()}</span>
      ${evs.length ? `<span class="ag-day-count">${evs.length}</span>` : ''}
    </div>
    <div class="ag-day-events">
      ${evs.length ? evs.map(e => _agEventChip(e)).join('') : '<span class="ag-day-empty">—</span>'}
    </div>
  </div>`;
}

/* ─── Monthly view ───────────────────────────────────────── */
function _agRenderMes(events, today) {
  const body  = document.getElementById('ag-body');
  const label = document.getElementById('ag-period-label');
  if (!body) return;

  const base  = new Date(today.getFullYear(), today.getMonth() + _agOffset, 1);
  const year  = base.getFullYear();
  const month = base.getMonth();
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  if (label) label.textContent = `${meses[month]} ${year}`;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0

  let html = `<div class="ag-month-grid">`;
  // Day headers
  ['L','M','X','J','V','S','D'].forEach(d => { html += `<div class="ag-month-hdr">${d}</div>`; });
  // Blank cells before month start
  for (let i = 0; i < firstDow; i++) html += `<div class="ag-month-cell ag-month-cell-empty"></div>`;
  // Days
  for (let day = 1; day <= daysInMonth; day++) {
    const d    = new Date(year, month, day);
    const key  = _agKey(d);
    const isT  = key === _agKey(today);
    const evs  = events[key] || [];
    html += `<div class="ag-month-cell${isT?' ag-today':''}${evs.length?' ag-has-ev':''}">
      <span class="ag-month-day-num${isT?' ag-day-num-today':''}">${day}</span>
      <div class="ag-month-dots">
        ${evs.slice(0,3).map(e => `<span class="ag-dot ag-dot-${e.color}"></span>`).join('')}
        ${evs.length > 3 ? `<span class="ag-dot-more">+${evs.length-3}</span>` : ''}
      </div>
    </div>`;
  }
  html += `</div>`;

  // Event list for today or selected
  const todayKey  = _agKey(today);
  const todayEvs  = events[todayKey] || [];
  if (todayEvs.length) {
    html += `<div class="ag-month-today-list">
      <div class="ag-mtl-hdr">HOY · ${_agFmt(today,{weekday:'long',day:'numeric',month:'long'})}</div>
      ${todayEvs.map(e => _agEventRow(e)).join('')}
    </div>`;
  }

  body.innerHTML = html;
  _agAttachEvHandlers(body);
}

/* ─── Event rendering ────────────────────────────────────── */
function _agEventChip(ev) {
  const icons = { tarea:'✓', recordatorio:'⏰', meta:'🎯' };
  const prioMap = { alta:'!', media:'', baja:'' };
  return `<div class="ag-chip ag-chip-${ev.color}" data-evtype="${ev.type}" data-evid="${ev.id}" title="${ev.title}">
    <span class="ag-chip-ico">${icons[ev.type]||'•'}</span>
    <span class="ag-chip-txt">${_agEsc(ev.title.slice(0,28))}${ev.title.length>28?'…':''}</span>
    ${ev.hora ? `<span class="ag-chip-time">${ev.hora}</span>` : ''}
    ${ev.prioridad==='alta' ? '<span class="ag-chip-prio">!</span>' : ''}
    ${ev.repetir && ev.repetir!=='ninguna' ? '<span class="ag-chip-rep">↻</span>' : ''}
  </div>`;
}

function _agEventRow(ev) {
  const icons = { tarea:'✓', recordatorio:'⏰', meta:'🎯' };
  return `<div class="ag-ev-row ag-ev-row-${ev.color}" data-evtype="${ev.type}" data-evid="${ev.id}">
    <span class="ag-ev-ico">${icons[ev.type]||'•'}</span>
    <div class="ag-ev-info">
      <span class="ag-ev-title">${_agEsc(ev.title)}</span>
      ${ev.hora ? `<span class="ag-ev-time">${ev.hora}</span>` : ''}
      ${ev.progreso !== undefined ? `<span class="ag-ev-prog">${ev.progreso}%</span>` : ''}
    </div>
  </div>`;
}

function _agEsc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }

/* ─── Click handlers ─────────────────────────────────────── */
function _agAttachEvHandlers(body) {
  body.querySelectorAll('[data-evtype]').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.dataset.evtype;
      if (type === 'tarea')        window.AREXNav?.cambiarModulo('tareas');
      else if (type === 'meta')    window.AREXNav?.cambiarModulo('metas');
      else if (type === 'recordatorio') window.AREXNav?.cambiarModulo('inicio');
    });
  });
}

/* ─── Public ─────────────────────────────────────────────── */
window.renderAgendaModule = renderAgendaModule;
window._agGetEvents = _agGetEvents;
