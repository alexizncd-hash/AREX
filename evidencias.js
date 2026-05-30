// AREX — Tablero de Evidencias
const EV_KEY = 'arex_evidencias';

const EV_TIPOS = {
  investigacion: { ico: '🔍', color: '#00d4ff', label: 'INVESTIGACIÓN' },
  finanzas:      { ico: '💰', color: '#00ffaa', label: 'FINANZAS' },
  alerta:        { ico: '⚠', color: '#ff9900', label: 'ALERTA' },
  meta:          { ico: '🎯', color: '#8B5CF6', label: 'META' },
  general:       { ico: '📋', color: '#00d4ff', label: 'GENERAL' },
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

function renderEvidenciasWidget() {
  const el = document.getElementById('ev-board');
  if (!el) return;
  const arr = getEvidencias();
  const cnt = document.getElementById('ev-count');
  if (cnt) cnt.textContent = arr.length;

  if (!arr.length) {
    el.innerHTML = '<div class="ev-empty">Sin evidencias aún.<br><em>Las respuestas importantes de AREX aparecerán aquí.</em></div>';
    return;
  }

  const _ts = ms => {
    const d = new Date(ms);
    return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' });
  };

  el.innerHTML = arr.slice(0, 10).map(ev => {
    const t = EV_TIPOS[ev.tipo] || EV_TIPOS.general;
    const safeT = ev.titulo?.replace(/&/g,'&amp;').replace(/</g,'&lt;') || 'Sin título';
    const safeB = ev.contenido?.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\*\*/g,'') || '';
    return `<div class="ev-card" style="--ev-color:${t.color}">
      <div class="ev-card-head">
        <span class="ev-ico">${t.ico}</span>
        <span class="ev-titulo">${safeT}</span>
        <span class="ev-ts">${_ts(ev.ts)}</span>
      </div>
      <div class="ev-body">${safeB}</div>
      <div class="ev-actions">
        <button class="ev-btn" onclick="saveEvidenciaAsNota('${ev.id}')">GUARDAR NOTA</button>
        <button class="ev-btn danger" onclick="deleteEvidencia('${ev.id}')">ELIMINAR</button>
      </div>
    </div>`;
  }).join('');
}

window.addEvidencia       = addEvidencia;
window.deleteEvidencia    = deleteEvidencia;
window.saveEvidenciaAsNota = saveEvidenciaAsNota;
window.renderEvidenciasWidget = renderEvidenciasWidget;
