// AREX — Módulo TAREAS
// Extraído de app.js en v201 (refactor por bloques, Sprint 1).
// Script CLÁSICO (como negocio.js/metas.js): sus funciones top-level quedan
// globales y app.js (módulo ES) las alcanza por el scope global.
// Depende de 3 helpers que app.js expone a window: _safeJSON, _todayStr,
// scheduleTaskNotifications. Se resuelven en tiempo de EJECUCIÓN (nunca al
// cargar), por eso no importa que este script corra antes que el módulo.

/* ── Módulo Tareas ──────────────────────────────────── */
function getTareas() {
  const arr = _safeJSON(localStorage.getItem('arex_tareas'), []);
  // v208: normaliza tareas creadas por versiones viejas de Visión, que
  // guardaban el campo como `texto`. Sin esto, una sola tarea mal formada
  // reventaba renderTareas y el módulo entero dejaba de abrir.
  let repar = false;
  for (const t of arr) {
    if (t && typeof t.text !== 'string') {
      t.text = (typeof t.texto === 'string' ? t.texto : '') || '(sin descripción)';
      delete t.texto;
      repar = true;
    }
  }
  if (repar) { try { localStorage.setItem('arex_tareas', JSON.stringify(arr)); } catch {} }
  return arr;
}
function saveTareasData(arr) { localStorage.setItem('arex_tareas', JSON.stringify(arr)); }

function urgenciaTarea(t) {
  if (!t.fecha) return null;
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const vence = new Date(t.fecha + 'T00:00:00');
  const dias = Math.round((vence - hoy) / 86400000);
  if (dias < 0)  return { cls: 'urg-vencida',  icon: '🔴', txt: `Venció hace ${-dias}d` };
  if (dias === 0) return { cls: 'urg-hoy',      icon: '🔴', txt: 'Vence HOY' };
  if (dias <= 2)  return { cls: 'urg-pronto',   icon: '🟠', txt: `${dias}d` };
  if (dias <= 7)  return { cls: 'urg-semana',   icon: '🟡', txt: `${dias}d` };
  const d = new Date(t.fecha + 'T00:00:00');
  return { cls: 'urg-normal', icon: '📅', txt: d.toLocaleDateString('es-MX', { day:'numeric', month:'short' }) };
}

function sortPending(arr) {
  const prioVal = { alta: 0, media: 1, baja: 2 };
  return [...arr].sort((a, b) => {
    const ua = urgenciaTarea(a), ub = urgenciaTarea(b);
    const urgOrder = { 'urg-vencida': 0, 'urg-hoy': 1, 'urg-pronto': 2, 'urg-semana': 3, 'urg-normal': 4, null: 5 };
    const oa = urgOrder[ua?.cls ?? null] ?? 5;
    const ob = urgOrder[ub?.cls ?? null] ?? 5;
    if (oa !== ob) return oa - ob;
    if (a.fecha && b.fecha) return a.fecha.localeCompare(b.fecha);
    return (prioVal[a.prioridad] ?? 1) - (prioVal[b.prioridad] ?? 1);
  });
}

function addTarea(text, fecha = '', prioridad = 'media', repetir = 'ninguna') {
  if (!text.trim()) return;
  const arr = getTareas();
  const t = { id: String(Date.now()), text: text.trim(), done: false, created: Date.now(), fecha, prioridad, repetir };
  arr.unshift(t);
  saveTareasData(arr);
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
  renderTareas();
  if (typeof logBitacora === 'function') logBitacora('chat', 'Tarea creada: ' + (t.text?.slice(0,40) || ''));
}
function toggleTarea(id) {
  const arr = getTareas();
  const tarea = arr.find(t => t.id === id);
  const newArr = arr.map(t => t.id === id ? { ...t, done: !t.done, ...(t.done ? { doneAt: null } : { doneAt: Date.now() }) } : t);
  // If marking done and has recurrence, spawn next occurrence
  if (tarea && !tarea.done && tarea.repetir && tarea.repetir !== 'ninguna') {
    const next = _nextFechaRepetir(tarea.fecha, tarea.repetir);
    if (next) {
      newArr.unshift({
        id: String(Date.now() + 1),
        text: tarea.text,
        done: false,
        created: Date.now(),
        fecha: next,
        prioridad: tarea.prioridad,
        repetir: tarea.repetir,
      });
    }
  }
  saveTareasData(newArr);
  renderTareas();
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
}

function _nextFechaRepetir(fechaActual, repetir) {
  const base = fechaActual ? new Date(fechaActual + 'T00:00:00') : new Date();
  const next  = new Date(base);
  if (repetir === 'diaria')   next.setDate(next.getDate() + 1);
  else if (repetir === 'semanal')  next.setDate(next.getDate() + 7);
  else if (repetir === 'mensual')  next.setMonth(next.getMonth() + 1);
  else if (repetir === 'anual')    next.setFullYear(next.getFullYear() + 1);
  else return null;
  return next.toISOString().slice(0, 10);
}
function deleteTarea(id) {
  saveTareasData(getTareas().filter(t => t.id !== id));
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
  renderTareas();
}
function updateTarea(id, changes) {
  saveTareasData(getTareas().map(t => t.id === id ? { ...t, ...changes } : t));
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
  renderTareas();
}
function addSubtarea(parentId, text) {
  if (!text?.trim()) return;
  saveTareasData(getTareas().map(t => {
    if (t.id !== parentId) return t;
    const subs = t.subtareas || [];
    return { ...t, subtareas: [...subs, { id: String(Date.now()), text: text.trim(), done: false }] };
  }));
  renderTareas();
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
}
function toggleSubtarea(parentId, subId) {
  saveTareasData(getTareas().map(t => {
    if (t.id !== parentId) return t;
    return { ...t, subtareas: (t.subtareas || []).map(s => s.id === subId ? { ...s, done: !s.done } : s) };
  }));
  renderTareas();
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
}
function deleteSubtarea(parentId, subId) {
  saveTareasData(getTareas().map(t => {
    if (t.id !== parentId) return t;
    return { ...t, subtareas: (t.subtareas || []).filter(s => s.id !== subId) };
  }));
  renderTareas();
  if (typeof arexSyncData === 'function') arexSyncData('arex_tareas');
}
// Swipe gestures en tarjetas de tareas: → completar/reabrir · ← borrar
function _attachTareaSwipe(div, t) {
  const inner = div.querySelector('.tarea-swipe-inner');
  if (!inner) return;
  const THRESH = 84;
  let startX = 0, startY = 0, dx = 0, dragging = false, decided = false, horizontal = false;

  inner.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    dx = 0; dragging = true; decided = false; horizontal = false;
    inner.style.transition = 'none';
  }, { passive: true });

  inner.addEventListener('touchmove', e => {
    if (!dragging) return;
    const ddx = e.touches[0].clientX - startX;
    const ddy = e.touches[0].clientY - startY;
    if (!decided && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) {
      decided = true; horizontal = Math.abs(ddx) > Math.abs(ddy);
    }
    if (!horizontal) return;
    e.preventDefault();
    dx = ddx;
    inner.style.transform = `translateX(${dx}px)`;
    div.classList.toggle('swipe-pos', dx > 12);
    div.classList.toggle('swipe-neg', dx < -12);
  }, { passive: false });

  const end = () => {
    if (!dragging) return;
    dragging = false;
    inner.style.transition = 'transform 0.25s cubic-bezier(0.2,0,0.2,1)';
    if (dx > THRESH) {
      try { navigator.vibrate?.(40); } catch (_) {}
      inner.style.transform = 'translateX(110%)';
      setTimeout(() => toggleTarea(t.id), 170);
    } else if (dx < -THRESH) {
      try { navigator.vibrate?.(40); } catch (_) {}
      inner.style.transform = 'translateX(-110%)';
      setTimeout(() => deleteTarea(t.id), 170);
    } else {
      inner.style.transform = 'translateX(0)';
      div.classList.remove('swipe-pos', 'swipe-neg');
    }
  };
  inner.addEventListener('touchend', end);
  inner.addEventListener('touchcancel', end);
}

let _tareasFilter = 'todas';

function setTareasFilter(f) {
  _tareasFilter = f;
  document.querySelectorAll('.tf-chip').forEach(c => c.classList.toggle('active', c.dataset.f === f));
  renderTareas();
}
window.setTareasFilter = setTareasFilter;

function renderTareas() {
  const all = getTareas();
  let pending = sortPending(all.filter(t => !t.done));
  if (_tareasFilter === 'hoy') {
    const h = _todayStr();
    pending = pending.filter(t => t.fecha === h);
  } else if (_tareasFilter === 'vencidas') {
    pending = pending.filter(t => urgenciaTarea(t)?.cls === 'urg-vencida');
  } else if (_tareasFilter === 'alta') {
    pending = pending.filter(t => t.prioridad === 'alta');
  }
  const done    = all.filter(t =>  t.done);

  const makeItem = t => {
    const urg  = urgenciaTarea(t);
    const prio = t.prioridad || 'media';
    const div  = document.createElement('div');
    const isAltaUrgente = !t.done && (t.prioridad === 'alta') && (urg?.cls === 'urg-vencida' || urg?.cls === 'urg-hoy');
    div.className = `tarea-item swipeable${t.done ? ' done' : ''}${urg ? ' ' + urg.cls : ''}${isAltaUrgente ? ' prio-alta-item' : ''}`;
    const _innerHTML = `
      <button class="tarea-toggle" data-id="${t.id}">${t.done ? '✓' : ''}</button>
      <div class="tarea-content">
        <span class="tarea-text">${String(t.text ?? '').replace(/</g,'&lt;')}</span>
        <div class="tarea-meta">
          ${!t.done ? `<span class="tarea-prio-badge prio-${prio}">${prio.toUpperCase()}</span>` : ''}
          ${urg && !t.done ? `<span class="tarea-urg-badge ${urg.cls}">${urg.icon} ${urg.txt}</span>` : ''}
          ${t.repetir && t.repetir !== 'ninguna' ? `<span class="tarea-rep-badge">↻ ${t.repetir}</span>` : ''}
          ${t.fecha && t.done ? `<span class="tarea-fecha-done">📅 ${new Date(t.fecha+'T00:00:00').toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</span>` : ''}
        </div>
      </div>
      <div class="tarea-actions">
        ${!t.done ? '<button class="tarea-edit" title="Editar">✎</button>' : ''}
        <button class="tarea-del" title="Eliminar">✕</button>
      </div>`;
    const subs = t.subtareas || [];
    const subsDone = subs.filter(s => s.done).length;
    const subsPctStr = subs.length ? `<span class="tarea-sub-count">${subsDone}/${subs.length}</span>` : '';
    const subListHtml = subs.length ? `<div class="tarea-subs-list">${subs.map(s => `
      <div class="tarea-sub-item${s.done ? ' sub-done' : ''}">
        <button class="tarea-sub-toggle" data-pid="${t.id}" data-sid="${s.id}">${s.done ? '✓' : ''}</button>
        <span class="tarea-sub-text">${s.text.replace(/</g,'&lt;')}</span>
        <button class="tarea-sub-del" data-pid="${t.id}" data-sid="${s.id}">✕</button>
      </div>`).join('')}</div>` : '';
    const subAddHtml = !t.done ? `<div class="tarea-sub-add-row">
      <input class="tarea-sub-input" type="text" placeholder="+ Subtarea..." data-pid="${t.id}"/>
    </div>` : '';
    div.innerHTML = `
      <div class="tarea-swipe-bg left">${t.done ? '↺ REABRIR' : '✓ HECHO'}</div>
      <div class="tarea-swipe-bg right">✕ BORRAR</div>
      <div class="tarea-swipe-inner">${_innerHTML}${subsPctStr}</div>
      ${subListHtml}${subAddHtml}`;
    _attachTareaSwipe(div, t);

    div.querySelectorAll('.tarea-sub-toggle').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); toggleSubtarea(b.dataset.pid, b.dataset.sid); }));
    div.querySelectorAll('.tarea-sub-del').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); deleteSubtarea(b.dataset.pid, b.dataset.sid); }));
    div.querySelector('.tarea-sub-input')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const v = e.target.value.trim();
        if (v) { addSubtarea(e.target.dataset.pid, v); e.target.value = ''; }
        e.preventDefault();
      }
    });

    div.querySelector('.tarea-toggle').addEventListener('click', () => toggleTarea(t.id));

    div.querySelector('.tarea-edit')?.addEventListener('click', () => {
      let _ep = t.prioridad || 'media';
      div.classList.remove('swipeable');
      div.innerHTML = `
        <div class="tarea-edit-form">
          <input class="tarea-edit-text" type="text" value="${String(t.text ?? '').replace(/"/g,'&quot;')}" placeholder="Descripción..."/>
          <div class="tarea-edit-row">
            <input class="tarea-edit-fecha" type="date" value="${t.fecha || ''}"/>
            <div class="tarea-edit-prio-btns">
              <button class="tep${t.prioridad==='alta'?' active':''}" data-p="alta">ALTA</button>
              <button class="tep${(!t.prioridad||t.prioridad==='media')?' active':''}" data-p="media">MEDIA</button>
              <button class="tep${t.prioridad==='baja'?' active':''}" data-p="baja">BAJA</button>
            </div>
          </div>
          <select class="tarea-edit-rep" title="Repetición">
            <option value="ninguna"${(t.repetir||'ninguna')==='ninguna'?' selected':''}>Sin repetir</option>
            <option value="diaria"${t.repetir==='diaria'?' selected':''}>↻ Diaria</option>
            <option value="semanal"${t.repetir==='semanal'?' selected':''}>↻ Semanal</option>
            <option value="mensual"${t.repetir==='mensual'?' selected':''}>↻ Mensual</option>
            <option value="anual"${t.repetir==='anual'?' selected':''}>↻ Anual</option>
          </select>
          <div class="tarea-edit-btns">
            <button class="tarea-edit-save">GUARDAR</button>
            <button class="tarea-edit-cancel">CANCELAR</button>
          </div>
        </div>`;
      div.querySelectorAll('.tep').forEach(b => b.addEventListener('click', () => {
        _ep = b.dataset.p;
        div.querySelectorAll('.tep').forEach(x => x.classList.toggle('active', x === b));
      }));
      div.querySelector('.tarea-edit-save').addEventListener('click', () => {
        const text = div.querySelector('.tarea-edit-text').value.trim();
        if (!text) return;
        const _rep = div.querySelector('.tarea-edit-rep')?.value || 'ninguna';
        updateTarea(t.id, { text, fecha: div.querySelector('.tarea-edit-fecha').value, prioridad: _ep, repetir: _rep });
      });
      div.querySelector('.tarea-edit-cancel').addEventListener('click', () => renderTareas());
      div.querySelector('.tarea-edit-text').select();
    });

    let _tap = false, _tapTimer;
    div.querySelector('.tarea-del').addEventListener('click', function() {
      if (_tap) {
        clearTimeout(_tapTimer); deleteTarea(t.id);
      } else {
        _tap = true; this.textContent = '?'; this.classList.add('confirming');
        _tapTimer = setTimeout(() => {
          _tap = false; this.textContent = '✕'; this.classList.remove('confirming');
        }, 2000);
      }
    });

    return div;
  };

  const elPending = document.getElementById('tareas-list-pending');
  const elDone    = document.getElementById('tareas-list-done');
  if (!elPending) return;

  elPending.innerHTML = '';
  elDone.innerHTML    = '';
  pending.forEach(t => elPending.appendChild(makeItem(t)));
  done.forEach(t    => elDone.appendChild(makeItem(t)));

  if (!pending.length) elPending.innerHTML = '<div class="tarea-empty">Sin tareas pendientes</div>';
  if (!done.length)    elDone.innerHTML    = '<div class="tarea-empty">—</div>';

  const urgentes = pending.filter(t => { const u = urgenciaTarea(t); return u?.cls === 'urg-vencida' || u?.cls === 'urg-hoy'; }).length;
  const count    = pending.length;
  const countEl  = document.getElementById('tareas-count');
  if (countEl) {
    countEl.textContent = urgentes
      ? `${count} pendiente${count !== 1 ? 's' : ''} · ${urgentes} urgente${urgentes !== 1 ? 's' : ''}`
      : `${count} pendiente${count !== 1 ? 's' : ''}`;
    countEl.classList.toggle('has-urgentes', urgentes > 0);
  }

  const badge = document.getElementById('dock-tareas-badge');
  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('hidden', count === 0);
    badge.classList.toggle('urgente', urgentes > 0);
  }
  scheduleTaskNotifications();
  window._updateUrgencyBadges?.();
}

/* ── Exports globales (los mismos que app.js exponía) ── */
window.getTareas       = getTareas;
window.saveTareasData  = saveTareasData;
window.urgenciaTarea   = urgenciaTarea;
window.sortPending     = sortPending;
window.addTarea        = addTarea;
window.toggleTarea     = toggleTarea;
window.deleteTarea     = deleteTarea;
window.updateTarea     = updateTarea;
window.addSubtarea     = addSubtarea;
window.toggleSubtarea  = toggleSubtarea;
window.deleteSubtarea  = deleteSubtarea;
window.setTareasFilter = setTareasFilter;
window.renderTareas    = renderTareas;
