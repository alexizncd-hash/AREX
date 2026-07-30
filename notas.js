// AREX — Módulo NOTAS
// Extraído de app.js en v202 (refactor por bloques, Sprint 2).
// Script CLÁSICO: sus funciones top-level quedan globales; app.js (módulo ES)
// las alcanza por el scope global. Persiste en localStorage y sincroniza con
// arexSyncData('arex_notas') — sin dependencias privadas de Firebase.
// (El sistema legado de notas en Firestore —saveNote/loadNotes/renderNote—
//  sigue en app.js: usa imports dinámicos privados del módulo.)

// ── Módulo Notas ────────────────────────────────────────
function getNotas() { return _safeJSON(localStorage.getItem('arex_notas'), []); }
function saveNotas(arr) {
  localStorage.setItem('arex_notas', JSON.stringify(arr));
  // Sin esto las notas bajaban de Firestore pero nunca subían: cualquier
  // documento remoto viejo pisaba las ediciones locales en cada arranque
  if (typeof arexSyncData === 'function') arexSyncData('arex_notas');
}

function addNota(titulo, contenido) {
  const arr = getNotas();
  const id  = String(Date.now());
  const tituloVal  = typeof titulo === 'string' ? titulo : '';
  const cuerpoVal  = typeof contenido === 'string' ? contenido : '';
  arr.unshift({ id, titulo: tituloVal, cuerpo: cuerpoVal, pinned: false, color: '', createdAt: Date.now(), updatedAt: Date.now() });
  saveNotas(arr);
  renderNotas();
  if (typeof logBitacora === 'function') logBitacora('chat', 'Nota creada: ' + (tituloVal?.slice(0,40) || '(sin título)'));
  if (!tituloVal) setTimeout(() => document.querySelector('#notas-list .nota-titulo')?.focus(), 60);
}

function updateNota(id, changes) {
  saveNotas(getNotas().map(n => n.id === id ? { ...n, ...changes, updatedAt: Date.now() } : n));
}

function deleteNota(id) {
  saveNotas(getNotas().filter(n => n.id !== id));
  renderNotas();
  renderDashboard();
}

function renderNotas() {
  const el = document.getElementById('notas-list');
  if (!el) return;
  const q = (document.getElementById('notas-search')?.value || '').toLowerCase().trim();
  let notas = getNotas();
  if (q) notas = notas.filter(n => n.titulo.toLowerCase().includes(q) || n.cuerpo.toLowerCase().includes(q));
  notas.sort((a, b) => (b.pinned - a.pinned) || (b.updatedAt - a.updatedAt));

  if (!notas.length) {
    const safeQ = q.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    el.innerHTML = `<div class="notas-empty">${q ? `Sin resultados para "${safeQ}"` : 'Sin notas — toca + NUEVA para crear una'}</div>`;
    return;
  }

  el.innerHTML = '';
  notas.forEach(n => {
    const card = document.createElement('div');
    card.className = 'nota-card' + (n.pinned ? ' pinned' : '') + (n.color ? ' nc-' + n.color : '');
    card.dataset.id = n.id;
    card.innerHTML = `
      <div class="nota-card-head">
        <input class="nota-titulo" value="${n.titulo.replace(/"/g,'&quot;')}" placeholder="Título..."/>
        <div class="nota-btn-row">
          <button class="nota-pin-btn${n.pinned ? ' active' : ''}" title="${n.pinned ? 'Desanclar' : 'Anclar'}">📌</button>
          <button class="nota-del-btn">✕</button>
        </div>
      </div>
      <textarea class="nota-cuerpo" placeholder="Escribe aquí...">${n.cuerpo.replace(/</g,'&lt;')}</textarea>
      <div class="nota-footer">
        <div class="nota-colors">
          ${['','amber','emerald','rose'].map(c =>
            `<span class="ncolor${n.color===c?' active':''}" data-c="${c}" title="${c||'default'}"></span>`
          ).join('')}
        </div>
        <span class="nota-wc">${n.cuerpo.trim() ? n.cuerpo.trim().split(/\s+/).length + ' pal' : ''}</span>
        <button class="nota-export-btn" title="Exportar como .txt" data-id="${n.id}">⬇</button>
        <span class="nota-ts">${new Date(n.updatedAt).toLocaleDateString('es-MX',{day:'numeric',month:'short'})}</span>
      </div>`;

    const ti = card.querySelector('.nota-titulo');
    let tt; ti.addEventListener('input', () => { clearTimeout(tt); tt = setTimeout(() => updateNota(n.id, { titulo: ti.value }), 700); });

    const ta = card.querySelector('.nota-cuerpo');
    let ct; ta.addEventListener('input', () => {
      clearTimeout(ct);
      ct = setTimeout(() => updateNota(n.id, { cuerpo: ta.value }), 700);
      const wc = card.querySelector('.nota-wc');
      if (wc) wc.textContent = ta.value.trim() ? ta.value.trim().split(/\s+/).length + ' pal' : '';
    });

    card.querySelector('.nota-pin-btn').addEventListener('click', () => {
      updateNota(n.id, { pinned: !n.pinned });
      renderNotas(); renderDashboard();
    });

    let _dt = null;
    const db = card.querySelector('.nota-del-btn');
    db.addEventListener('click', () => {
      if (_dt) { clearTimeout(_dt); deleteNota(n.id); return; }
      db.classList.add('confirming'); db.textContent = '¿Eliminar?';
      _dt = setTimeout(() => { db.classList.remove('confirming'); db.textContent = '✕'; _dt = null; }, 2500);
    });

    card.querySelectorAll('.ncolor').forEach(dot =>
      dot.addEventListener('click', () => { updateNota(n.id, { color: dot.dataset.c }); renderNotas(); })
    );

    card.querySelector('.nota-export-btn')?.addEventListener('click', () => {
      const blob = new Blob([`${n.titulo}\n${'─'.repeat(40)}\n${n.cuerpo}`], { type: 'text/plain;charset=utf-8' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = (n.titulo || 'nota') + '.txt';
      a.click();
      URL.revokeObjectURL(url);
    });

    el.appendChild(card);
  });
}
window.renderNotas = renderNotas;

function renderNotasWidget() {
  const el = document.getElementById('dash-notas-widget');
  if (!el) return;
  const pinned = getNotas().filter(n => n.pinned).sort((a, b) => b.updatedAt - a.updatedAt);
  if (!pinned.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.querySelector('.dash-notas-body').innerHTML = pinned.map(n => `
    <div class="dash-nota-item" onclick="AREXNav.cambiarModulo('notas')">
      ${n.titulo ? `<div class="dash-nota-titulo">${n.titulo.replace(/</g,'&lt;')}</div>` : ''}
      ${n.cuerpo ? `<div class="dash-nota-cuerpo">${n.cuerpo.replace(/</g,'&lt;').slice(0, 80)}${n.cuerpo.length > 80 ? '…' : ''}</div>` : ''}
    </div>`).join('');
}

/* ── Exports globales ── */
window.getNotas          = getNotas;
window.saveNotas         = saveNotas;
window.addNota           = addNota;
window.updateNota        = updateNota;
window.deleteNota        = deleteNota;
window.renderNotas       = renderNotas;
window.renderNotasWidget = renderNotasWidget;
