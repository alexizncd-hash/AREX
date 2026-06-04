// AREX — Búsqueda Global · Cmd+K / Ctrl+K / /buscar
// Índice en tiempo real sobre todos los módulos locales

const SEARCH_SOURCES = [
  { id:'tareas',     key:'arex_tareas',         fields:['texto'],                        icon:'✓',  label:'TAREAS',      mod:'tareas'     },
  { id:'notas',      key:'arex_notas',           fields:['texto','titulo','cuerpo'],      icon:'📝', label:'NOTAS',       mod:'notas'      },
  { id:'metas',      key:'arex_metas',           fields:['titulo','nombre','descripcion'],icon:'🎯', label:'METAS',       mod:'metas'      },
  { id:'proyectos',  key:'arex_proyectos',       fields:['nombre','descripcion'],         icon:'⚡', label:'PROYECTOS',   mod:'proyectos'  },
  { id:'gastos',     key:'arex_gastos_pers',     fields:['concepto','categoria','notas'], icon:'💸', label:'GASTOS',      mod:'gastos'     },
  { id:'evidencias', key:'arex_evidencias',      fields:['titulo','descripcion'],         icon:'🔍', label:'EVIDENCIAS',  mod:'evidencias' },
  { id:'hechos',     key:'arex_hechos',          fields:['texto'],                        icon:'🧠', label:'MEMORIA',     mod:'chat'       },
  { id:'bitacora',   key:'arex_bitacora',        fields:['accion'],                       icon:'📋', label:'BITÁCORA',    mod:'control'    },
];

let _searchOpen = false;
let _searchTimer = null;
let _srchSelIdx  = -1;

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
      <div class="srch-scope">TAREAS · NOTAS · METAS · PROYECTOS · GASTOS · EVIDENCIAS · MEMORIA</div>
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
      const items = JSON.parse(raw);
      if (!Array.isArray(items)) continue;
      for (const item of items) {
        let matched = false;
        for (const f of src.fields) {
          if (String(item[f] || '').toLowerCase().includes(q)) { matched = true; break; }
        }
        if (matched) {
          const title = item.texto || item.titulo || item.nombre || item.concepto || item.accion || '—';
          const sub   = item.descripcion || item.cuerpo || item.categoria || item.fecha || '';
          results.push({ src, title: String(title), sub: String(sub) });
        }
      }
    } catch {}
  }

  if (!results.length) {
    el.innerHTML = `<div class="srch-empty">Sin resultados para <strong>${_esc(q)}</strong></div>`;
    return;
  }

  // Group by module
  const groups = {};
  for (const r of results) {
    if (!groups[r.src.id]) groups[r.src.id] = { src: r.src, items: [] };
    groups[r.src.id].items.push(r);
  }

  let html = `<div class="srch-count">${results.length} resultado${results.length !== 1 ? 's' : ''}</div>`;
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
  el.innerHTML = html;
  _srchSelIdx = -1;

  el.querySelectorAll('.srch-item').forEach(btn => {
    btn.addEventListener('click', () => {
      closeSearch();
      if (btn.dataset.mod && window.AREXNav?.cambiarModulo) window.AREXNav.cambiarModulo(btn.dataset.mod);
    });
  });
}

function _hi(text, q) {
  const safe = _esc(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return safe.replace(re, '<mark>$1</mark>');
}
function _esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

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
