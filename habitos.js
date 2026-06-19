/* ═══════════════════════════════════════════════════════════════
   AREX — Módulo Hábitos
   Seguimiento de hábitos diarios, semanales y lunes-viernes
   Schema: [{ id, nombre, emoji, categoria, frecuencia, completados, creado }]
   ═══════════════════════════════════════════════════════════════ */

const HABITOS_KEY = 'arex_habitos';

/* ─── Helpers ─────────────────────────────────────────────────── */
function _habFecha(d) {
  // Returns 'YYYY-MM-DD' for a given Date (or today)
  const dt = d || new Date();
  return dt.toISOString().slice(0, 10);
}

function _habHoy() {
  return _habFecha(new Date());
}

function _habEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Persistencia ─────────────────────────────────────────────── */
function getHabitos() {
  try {
    const raw    = localStorage.getItem(HABITOS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function saveHabitos(arr) {
  localStorage.setItem(HABITOS_KEY, JSON.stringify(arr));
  window.arexSyncData?.(HABITOS_KEY);
}

/* ─── Operaciones de datos ─────────────────────────────────────── */
function addHabito(nombre, emoji, categoria, frecuencia) {
  const arr = getHabitos();
  arr.push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    nombre: nombre.trim(),
    emoji: emoji.trim() || '✦',
    categoria: categoria || 'personal',
    frecuencia: frecuencia || 'diaria',
    completados: {},
    creado: Date.now()
  });
  saveHabitos(arr);
}

function toggleHabitoHoy(id) {
  toggleHabitoDia(id, _habHoy());
}

function toggleHabitoDia(id, dateStr) {
  const arr = getHabitos();
  const hab = arr.find(h => h.id === id);
  if (!hab) return;
  if (!hab.completados) hab.completados = {};
  if (hab.completados[dateStr]) {
    delete hab.completados[dateStr];
  } else {
    hab.completados[dateStr] = true;
  }
  saveHabitos(arr);
}

function deleteHabito(id) {
  const arr = getHabitos().filter(h => h.id !== id);
  saveHabitos(arr);
}

/* ─── Streak ───────────────────────────────────────────────────── */
function getHabitoStreak(habito) {
  if (!habito || !habito.completados) return 0;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  let streak = 0;
  let d = new Date(hoy);

  // If today not done yet, start checking from yesterday
  const todayStr = _habFecha(hoy);
  if (!habito.completados[todayStr]) {
    d.setDate(d.getDate() - 1);
  }

  while (true) {
    const key = _habFecha(d);
    if (habito.completados[key]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
    // Safety limit
    if (streak > 3650) break;
  }
  return streak;
}

/* ─── Mini calendar dots (7 days: Mon-Sun of current week) ──────── */
function _habWeekDots(hab) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Mon=0 ... Sun=6
  const dow = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - dow);

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = _habFecha(d);
    const done = !!(hab.completados && hab.completados[key]);
    const isToday = key === _habFecha(today);
    const dayNames = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    html += `<span class="hab-dot${done ? ' hab-dot-done' : ''}${isToday ? ' hab-dot-today' : ''}" title="${key}">${dayNames[i]}</span>`;
  }
  return html;
}

/* ─── Category badge ───────────────────────────────────────────── */
const HAB_CAT_LABELS = {
  salud:    'Salud',
  ejercicio:'Ejercicio',
  mente:    'Mente',
  trabajo:  'Trabajo',
  personal: 'Personal'
};

function _habCatBadge(cat) {
  const label = HAB_CAT_LABELS[cat] || cat;
  return `<span class="hab-cat-badge hab-cat-${_habEsc(cat)}">${_habEsc(label)}</span>`;
}

/* ─── Frecuencia label ─────────────────────────────────────────── */
const HAB_FREC_LABELS = {
  'diaria':        'Diaria',
  'semanal':       'Semanal',
  'lunes-viernes': 'Lun-Vie'
};

/* ─── Render ───────────────────────────────────────────────────── */
let _habFormOpen = false;

function renderHabitosModule() {
  const el = document.getElementById('module-habitos');
  if (!el || !el.classList.contains('active')) return;

  const habitos = getHabitos();
  const hoy = _habHoy();

  /* ── Inline add form ── */
  const formHtml = _habFormOpen ? `
    <div class="hab-add-form" id="hab-add-form">
      <div class="hab-form-row">
        <input class="hab-input hab-input-emoji" id="hab-f-emoji" type="text" maxlength="2" placeholder="✦" value=""/>
        <input class="hab-input hab-input-name"  id="hab-f-name"  type="text" placeholder="Nombre del hábito..." maxlength="60"/>
      </div>
      <div class="hab-form-row">
        <select class="hab-select" id="hab-f-cat">
          <option value="salud">Salud</option>
          <option value="ejercicio">Ejercicio</option>
          <option value="mente">Mente</option>
          <option value="trabajo">Trabajo</option>
          <option value="personal" selected>Personal</option>
        </select>
        <select class="hab-select" id="hab-f-frec">
          <option value="diaria" selected>Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="lunes-viernes">Lunes-Viernes</option>
        </select>
        <button class="hab-btn-agregar" id="hab-btn-agregar">AGREGAR</button>
        <button class="hab-btn-cancel"  id="hab-btn-cancel">✕</button>
      </div>
    </div>` : '';

  /* ── Habit cards ── */
  const cardsHtml = habitos.length === 0
    ? `<div class="hab-empty">No hay hábitos todavía. Crea el primero con <strong>+ NUEVO</strong>.</div>`
    : habitos.map(hab => {
        const done    = !!(hab.completados && hab.completados[hoy]);
        const streak  = getHabitoStreak(hab);
        const dots    = _habWeekDots(hab);
        const frecLbl = HAB_FREC_LABELS[hab.frecuencia] || hab.frecuencia;
        return `
        <div class="hab-card" data-habid="${_habEsc(hab.id)}">
          <span class="hab-emoji">${_habEsc(hab.emoji)}</span>
          <div class="hab-info">
            <div class="hab-name-row">
              <span class="hab-name">${_habEsc(hab.nombre)}</span>
              ${_habCatBadge(hab.categoria)}
              <span class="hab-frec-badge">${_habEsc(frecLbl)}</span>
            </div>
            <div class="hab-dots" aria-label="Semana actual">${dots}</div>
          </div>
          ${streak > 0 ? `<span class="hab-streak">🔥 ${streak} ${streak === 1 ? 'día' : 'días'}</span>` : ''}
          <button class="hab-toggle${done ? ' hab-toggle-done' : ''}"
                  data-action="toggle" data-habid="${_habEsc(hab.id)}"
                  title="${done ? 'Marcar como pendiente' : 'Marcar como hecho hoy'}">
            ${done ? '✓' : ''}
          </button>
          <button class="hab-btn-del" data-action="delete" data-habid="${_habEsc(hab.id)}" title="Eliminar hábito">✕</button>
        </div>`;
      }).join('');

  el.innerHTML = `
    <div class="hab-wrap">
      <div class="hab-header">
        <span class="hab-title">◎ HÁBITOS</span>
        <div class="hab-header-right">
          <span class="hab-hoy-label">${hoy}</span>
          <button class="hab-btn-nuevo" id="hab-btn-nuevo">+ NUEVO</button>
        </div>
      </div>
      ${formHtml}
      <div class="hab-list" id="hab-list">
        ${cardsHtml}
      </div>
    </div>`;

  /* ── Wire events ── */
  el.querySelector('#hab-btn-nuevo')?.addEventListener('click', () => {
    _habFormOpen = true;
    renderHabitosModule();
    setTimeout(() => el.querySelector('#hab-f-emoji')?.focus(), 50);
  });

  el.querySelector('#hab-btn-cancel')?.addEventListener('click', () => {
    _habFormOpen = false;
    renderHabitosModule();
  });

  el.querySelector('#hab-btn-agregar')?.addEventListener('click', () => {
    const emoji = el.querySelector('#hab-f-emoji')?.value.trim() || '✦';
    const nombre = el.querySelector('#hab-f-name')?.value.trim();
    const cat    = el.querySelector('#hab-f-cat')?.value;
    const frec   = el.querySelector('#hab-f-frec')?.value;
    if (!nombre) {
      el.querySelector('#hab-f-name')?.focus();
      return;
    }
    addHabito(nombre, emoji, cat, frec);
    _habFormOpen = false;
    renderHabitosModule();
  });

  // Allow Enter in name field to submit
  el.querySelector('#hab-f-name')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') el.querySelector('#hab-btn-agregar')?.click();
  });

  /* ── Toggle / Delete via delegation ── */
  el.querySelector('#hab-list')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const habId  = btn.dataset.habid;

    if (action === 'toggle') {
      toggleHabitoHoy(habId);
      renderHabitosModule();
    }

    if (action === 'delete') {
      if (btn.dataset.confirm === '1') {
        deleteHabito(habId);
        renderHabitosModule();
      } else {
        btn.dataset.confirm = '1';
        btn.textContent = '¿?';
        btn.classList.add('hab-btn-del-confirm');
        setTimeout(() => {
          if (btn.dataset.confirm === '1') {
            btn.dataset.confirm = '0';
            btn.textContent = '✕';
            btn.classList.remove('hab-btn-del-confirm');
          }
        }, 2500);
      }
    }
  });
}

window.renderHabitosModule = renderHabitosModule;
window.toggleHabitoHoy    = toggleHabitoHoy;
window.toggleHabitoDia    = toggleHabitoDia;
window.addHabito          = addHabito;
window.deleteHabito       = deleteHabito;
