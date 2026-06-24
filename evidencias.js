// AREX — Tablero de Evidencias
const EV_KEY = 'arex_evidencias';

const EV_TIPOS = {
  investigacion: { ico: '🔍', color: '#22d3ee', label: 'INVESTIGACIÓN' },
  finanzas:      { ico: '💰', color: '#34ffc3', label: 'FINANZAS' },
  alerta:        { ico: '⚠', color: '#ff9900', label: 'ALERTA' },
  meta:          { ico: '🎯', color: '#8B5CF6', label: 'META' },
  general:       { ico: '📋', color: '#22d3ee', label: 'GENERAL' },
};

function getEvidencias() {
  try { return JSON.parse(localStorage.getItem(EV_KEY) || '[]'); } catch { return []; }
}
function saveEvidencias(arr) {
  localStorage.setItem(EV_KEY, JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData(EV_KEY);
}

function addEvidencia(tipo, titulo, contenido) {
  const arr = getEvidencias();
  arr.unshift({ id: String(Date.now()), tipo: tipo || 'general', titulo, contenido, ts: Date.now() });
  if (arr.length > 50) arr.splice(50);
  saveEvidencias(arr);
  renderEvidenciasWidget();
  return arr[0];
}

function deleteEvidencia(id) {
  saveEvidencias(getEvidencias().filter(e => e.id !== id));
  renderEvidenciasWidget();
}

function saveEvidenciaAsNota(id) {
  const ev = getEvidencias().find(e => e.id === id);
  if (!ev) return;
  if (typeof addNota === 'function') {
    addNota(ev.titulo, ev.contenido);
    if (typeof addMsg === 'function') addMsg('arex', `Nota guardada: "${ev.titulo}"`);
  }
}

let _evSearchQ = '';

function renderEvidenciasWidget() {
  const allArr = getEvidencias();

  // Update all count badges
  ['ev-count', 'ev-mod-count'].forEach(id => {
    const c = document.getElementById(id);
    if (c) c.textContent = allArr.length;
  });

  // Search filter
  const q = _evSearchQ.toLowerCase().trim();
  const arr = q ? allArr.filter(ev =>
    (ev.titulo || '').toLowerCase().includes(q) ||
    (ev.contenido || '').toLowerCase().includes(q)
  ) : allArr;

  const searchHTML = `<input class="ev-search" id="ev-search-input" placeholder="Buscar evidencias..." value="${_evSearchQ.replace(/"/g,'&quot;')}" oninput="_evSearchQ=this.value;renderEvidenciasWidget()" />`;

  const _ts = ms => {
    const d = new Date(ms);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  };

  const emptyHTML = searchHTML + '<div class="ev-empty">Sin evidencias' + (q ? ` para "${q}"` : ' aún.<br><em>Las respuestas importantes de AREX aparecerán aquí.</em>') + '</div>';

  const cardsHTML = searchHTML + arr.slice(0, 20).map(ev => {
    const t = EV_TIPOS[ev.tipo] || EV_TIPOS.general;
    const safeT = _h(ev.titulo || 'Sin título');
    const safeB = _h(ev.contenido || '').replace(/\*\*/g,'');
    const isLong = (ev.contenido || '').length > 180;
    return `<div class="ev-card" style="--ev-color:${t.color}" data-ev-id="${ev.id}">
      <div class="ev-card-head">
        <span class="ev-ico">${t.ico}</span>
        <span class="ev-titulo">${safeT}</span>
        <span class="ev-ts">${_ts(ev.ts)}</span>
      </div>
      <div class="ev-body" id="ev-body-${ev.id}">${safeB}</div>
      ${isLong ? `<button class="ev-btn" style="margin-top:2px;align-self:flex-start;" onclick="evToggleExpand('${ev.id}')">VER MÁS</button>` : ''}
      <div class="ev-actions">
        <button class="ev-btn" onclick="saveEvidenciaAsNota('${ev.id}')">GUARDAR NOTA</button>
        <button class="ev-btn danger" onclick="deleteEvidencia('${ev.id}')">ELIMINAR</button>
      </div>
    </div>`;
  }).join('');

  // Paint to both containers: dashboard widget and standalone module
  ['ev-board', 'ev-mod-board'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = arr.length ? cardsHTML : emptyHTML;
  });
}

function evToggleExpand(id) {
  const body = document.getElementById(`ev-body-${id}`);
  if (!body) return;
  const expanded = body.classList.toggle('expanded');
  const btn = body.nextElementSibling;
  if (btn && btn.tagName === 'BUTTON') {
    btn.textContent = expanded ? 'VER MENOS' : 'VER MÁS';
  }
}

window.addEvidencia           = addEvidencia;
window.deleteEvidencia        = deleteEvidencia;
window.saveEvidenciaAsNota    = saveEvidenciaAsNota;
window.renderEvidenciasWidget = renderEvidenciasWidget;
window.evToggleExpand         = evToggleExpand;
