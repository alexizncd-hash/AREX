// AREX — Búsqueda Global · Cmd+K / Ctrl+K / /buscar
// Índice en tiempo real sobre todos los módulos locales

const SEARCH_SOURCES = [
  // v217: indexaba 'texto', pero las tareas guardan el campo como 'text'
  // desde v208. Resultado: la búsqueda global JAMÁS encontraba una tarea.
  // Comprobado creando una tarea de verdad con addTarea() y buscándola.
  { id:'tareas',     key:'arex_tareas',         fields:['text','texto'],                 icon:'✓',  label:'TAREAS',      mod:'tareas'     },
  { id:'notas',      key:'arex_notas',           fields:['texto','titulo','cuerpo'],      icon:'📝', label:'NOTAS',       mod:'notas'      },
  { id:'metas',      key:'arex_metas',           fields:['titulo','nombre','descripcion'],icon:'🎯', label:'METAS',       mod:'metas'      },
  { id:'proyectos',  key:'arex_proyectos',       fields:['nombre','descripcion'],         icon:'⚡', label:'PROYECTOS',   mod:'proyectos'  },
  /* v240: dos motivos por los que GASTOS no aparecía NUNCA en la búsqueda.
     Uno, arex_gastos_pers no es un array sino {presupuesto, gastos}, y la
     búsqueda descarta lo que no sea array antes de mirar nada. Dos, los
     campos declarados eran 'concepto' y 'notas', que gastos.js no escribe:
     usa 'descripcion'. El mismo patrón del bug texto/text, otra vez. */
  { id:'gastos',     key:'arex_gastos_pers',     fields:['descripcion','concepto','categoria'], icon:'💸', label:'GASTOS',      mod:'gastos',
    saca: d => d?.gastos },
  { id:'habitos',    key:'arex_habitos',         fields:['nombre'],                       icon:'✅', label:'HÁBITOS',     mod:'habitos'    },
  { id:'recordator', key:'arex_recordatorios',   fields:['msg'],                          icon:'⏰', label:'RECORDATORIOS', mod:'agenda'   },
  { id:'evidencias', key:'arex_evidencias',      fields:['titulo','descripcion'],         icon:'🔍', label:'EVIDENCIAS',  mod:'evidencias' },
  { id:'hechos',     key:'arex_hechos',          fields:['texto'],                        icon:'🧠', label:'MEMORIA',     mod:'chat'       },
  { id:'bitacora',   key:'arex_bitacora',        fields:['accion'],                       icon:'📋', label:'BITÁCORA',    mod:'control'    },
];

let _searchOpen = false;
let _searchTimer = null;
let _srchSelIdx  = -1;

// Escape HTML — se usaba _esc() en 4 lugares pero jamás fue definida:
// "Sin resultados" y el historial de chat reventaban con ReferenceError
const _esc = s => (typeof _h === 'function'
  ? _h(s)
  : String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'));

/* ── Open / Close ──────────────────────────────────────── */
function openSearch(prefill = '') {
  const ov = document.getElementById('srch-overlay');
  if (!ov) return;
  _searchOpen = true;
  _srchSelIdx = -1;
  ov.classList.add('visible');
  const inp = document.getElementById('srch-input');
  if (inp) {
    inp.value = prefill;
    setTimeout(() => inp.focus(), 60);
    if (prefill) _doSearch(prefill);
    else _showHints();
  }
}

function closeSearch() {
  _searchOpen = false;
  document.getElementById('srch-overlay')?.classList.remove('visible');
}

/* ── Hints ─────────────────────────────────────────────── */
function _showHints() {
  const el = document.getElementById('srch-results');
  if (!el) return;
  el.innerHTML = `
    <div class="srch-hints">
      <div class="srch-hint-row"><kbd>Cmd K</kbd><span>Abrir / cerrar</span></div>
      <div class="srch-hint-row"><kbd>↑ ↓</kbd><span>Navegar resultados</span></div>
      <div class="srch-hint-row"><kbd>Enter</kbd><span>Ir al módulo</span></div>
      <div class="srch-hint-row"><kbd>Esc</kbd><span>Cerrar</span></div>
      <div class="srch-scope">TAREAS · NOTAS · METAS · PROYECTOS · GASTOS · EVIDENCIAS · MEMORIA · HISTORIAL</div>
    </div>`;
}

/* ── Search engine ─────────────────────────────────────── */
function _doSearch(query) {
  const el = document.getElementById('srch-results');
  if (!el) return;
  const q = query.toLowerCase().trim();
  if (!q) { _showHints(); return; }

  const results = [];
  for (const src of SEARCH_SOURCES) {
    try {
      const raw = localStorage.getItem(src.key);
      if (!raw) continue;
      const crudo = JSON.parse(raw);
      // v240: hay fuentes que no son un array sino un objeto con el array
      // dentro (gastos personales). `saca` dice de dónde tomarlo.
      const items = src.saca ? src.saca(crudo) : crudo;
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        let matched = false;
        for (const f of src.fields) {
          if (String(item[f] || '').toLowerCase().includes(q)) { matched = true; break; }
        }
        if (matched) {
          // v238: faltaba `text`, que es como guardan las tareas su contenido
          // desde v208. Encontraba la tarea y luego la enseñaba como "—", sin
          // decir cuál era. Y una nota sin título (addNota las crea así) caía
          // en lo mismo, teniendo el cuerpo al lado.
          const title = item.texto || item.text || item.titulo || item.nombre
                     || item.concepto || item.accion || item.cuerpo || item.msg || '—';
          const sub   = item.descripcion || (item.titulo ? item.cuerpo : '')
                     || item.categoria || item.fecha || '';
          results.push({ src, title: String(title), sub: String(sub) });
        }
      }
    } catch {}
  }

  // Search through conversation sessions
  const sessionHits = [];
  try {
    const sessions = JSON.parse(localStorage.getItem('arex_sessions') || '[]');
    for (const s of sessions) {
      if (!Array.isArray(s.messages)) continue;
      const match = s.messages.find(m => String(m.content || '').toLowerCase().includes(q));
      if (match) {
        const date = s.updated ? new Date(s.updated).toLocaleDateString('es-MX', {day:'numeric',month:'short',year:'numeric'}) : '';
        sessionHits.push({ name: s.name || 'Sesión', snippet: (match.content || '').slice(0, 80), date, sid: s.id });
      }
    }
  } catch {}

  const total = results.length + sessionHits.length;
  if (!total) {
    el.innerHTML = `<div class="srch-empty">Sin resultados para <strong>${_esc(q)}</strong></div>`;
    return;
  }

  const groups = {};
  for (const r of results) {
    if (!groups[r.src.id]) groups[r.src.id] = { src: r.src, items: [] };
    groups[r.src.id].items.push(r);
  }

  let html = `<div class="srch-count">${total} resultado${total !== 1 ? 's' : ''}</div>`;
  for (const g of Object.values(groups)) {
    html += `<div class="srch-group">
      <div class="srch-group-hdr">${g.src.icon} ${g.src.label} <span class="srch-group-cnt">${g.items.length}</span></div>`;
    for (const r of g.items.slice(0, 6)) {
      const title = _hi(r.title.slice(0, 80), q);
      const sub   = r.sub ? `<span class="srch-item-sub">${_hi(r.sub.slice(0, 60), q)}</span>` : '';
      html += `<button class="srch-item" data-mod="${r.src.mod}"><span class="srch-item-title">${title}</span>${sub}</button>`;
    }
    html += `</div>`;
  }

  if (sessionHits.length) {
    html += `<div class="srch-group">
      <div class="srch-group-hdr">💬 HISTORIAL <span class="srch-group-cnt">${sessionHits.length}</span></div>`;
    for (const h of sessionHits.slice(0, 5)) {
      html += `<button class="srch-item" data-sid="${_esc(h.sid)}" data-mod="chat">
        <span class="srch-item-title">${_hi(_esc(h.name), q)}</span>
        <span class="srch-item-sub">${_hi(_esc(h.snippet), q)}${h.date ? ` · ${h.date}` : ''}</span>
      </button>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
  _srchSelIdx = -1;

  el.querySelectorAll('.srch-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const sid = btn.dataset.sid;
      closeSearch();
      if (sid && typeof loadSession === 'function') {
        loadSession(sid);
        window.AREXNav?.cambiarModulo('chat');
      } else if (btn.dataset.mod && window.AREXNav?.cambiarModulo) {
        window.AREXNav.cambiarModulo(btn.dataset.mod);
      }
    });
  });
}

function _hi(text, q) {
  const safe = _h(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}

/* ── Keyboard navigation ───────────────────────────────── */
document.addEventListener('keydown', e => {
  // Open shortcut
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); _searchOpen ? closeSearch() : openSearch(); return; }
  if (!_searchOpen) return;

  const items = [...document.querySelectorAll('.srch-item')];
  if (e.key === 'Escape') {
    const inp = document.getElementById('srch-input');
    if (inp?.value) { inp.value = ''; _showHints(); }
    else closeSearch();
    return;
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    _srchSelIdx = Math.min(_srchSelIdx + 1, items.length - 1);
    items.forEach((el, i) => el.classList.toggle('selected', i === _srchSelIdx));
    items[_srchSelIdx]?.scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    _srchSelIdx = Math.max(_srchSelIdx - 1, 0);
    items.forEach((el, i) => el.classList.toggle('selected', i === _srchSelIdx));
    items[_srchSelIdx]?.scrollIntoView({ block: 'nearest' });
  }
  if (e.key === 'Enter' && _srchSelIdx >= 0) items[_srchSelIdx]?.click();
});

/* ── Init ──────────────────────────────────────────────── */
function initSearch() {
  const ov = document.getElementById('srch-overlay');
  if (!ov) return;

  ov.addEventListener('click', e => { if (e.target === ov) closeSearch(); });

  const inp = document.getElementById('srch-input');
  if (inp) {
    inp.addEventListener('input', () => {
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(() => _doSearch(inp.value), 160);
    });
  }
  document.getElementById('srch-close-btn')?.addEventListener('click', closeSearch);
}

window.openSearch  = openSearch;
window.closeSearch = closeSearch;
window.initSearch  = initSearch;
