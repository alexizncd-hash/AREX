// AREX — MEMORIA (larga + hechos aprendidos)
// Extraído de app.js en v203 (refactor por bloques, Sprint 2).
// Script CLÁSICO. Guarda la memoria permanente del usuario y los hechos que
// AREX aprende de las conversaciones; construye las secciones que se inyectan
// al system prompt. Única dependencia externa: window.addMsg (app.js), usada
// solo en runtime al listar hechos.

/* ── Memoria larga ──────────────────────────────────── */
function loadMemoria() {
  return _safeJSON(localStorage.getItem('arex_memoria'), []);
}
function saveMemoria(entries) {
  localStorage.setItem('arex_memoria', JSON.stringify(entries));
  if (typeof arexSyncData === 'function') arexSyncData('arex_memoria');
}
function buildMemoriaSection() {
  const entries  = loadMemoria();
  // OJO: en un script clásico `history` es window.history (API del navegador),
  // NO el historial de chat de app.js. Hay que pedirlo por su accessor.
  const _hist = (typeof window._arexHistory === 'function' ? window._arexHistory() : []) || [];
  const lastUser = _hist.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
  const hechos   = getHechosRelevantes(lastUser, 8);
  let section = '';
  if (entries.length) section += `MEMORIA PERMANENTE (datos fijos de Alexiz):\n${entries.map((e,i) => `${i+1}. ${e.text}`).join('\n')}`;
  if (hechos.length)  section += `${section?'\n\n':''}HECHOS APRENDIDOS EN CONVERSACIONES:\n${hechos.map(h => `- [${h.fecha}] ${h.texto}`).join('\n')}`;
  return section ? `\n\n${section}` : '';
}

/* ── Memoria de hechos ──────────────────────────────── */
function getHechos() { return _safeJSON(localStorage.getItem('arex_hechos'), []); }
function saveHechos(arr) {
  localStorage.setItem('arex_hechos', JSON.stringify(arr));
  if (typeof arexSyncData === 'function') arexSyncData('arex_hechos');
}

function addHecho(texto, fuente = 'auto') {
  if (!texto?.trim()) return;
  const arr = getHechos();
  if (arr.some(h => h.texto.toLowerCase() === texto.toLowerCase().trim())) return;
  arr.unshift({ id: String(Date.now()), texto: texto.trim(), fecha: _todayStr(), fuente });
  if (arr.length > 300) arr.splice(300);
  saveHechos(arr);
}

function deleteHecho(id) {
  saveHechos(getHechos().filter(h => h.id !== id));
}

function getHechosRelevantes(query, max = 10) {
  const all = getHechos();
  if (!query) return all.slice(0, max);
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  if (!words.length) return all.slice(0, max);
  return all
    .map(h => ({ ...h, score: words.filter(w => h.texto.toLowerCase().includes(w)).length }))
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score || b.id.localeCompare(a.id))
    .slice(0, max);
}

function renderHechosList() {
  const hechos = getHechos();
  if (!hechos.length) return addMsg('arex', 'Sin hechos almacenados aún. AREX los aprende automáticamente de las conversaciones, o dime explícitamente "recuerda que..."');
  const txt = hechos.slice(0, 30).map((h, i) => `**${i+1}.** [${h.fecha}] ${h.texto}`).join('\n');
  addMsg('arex', `📚 **HECHOS APRENDIDOS** (${hechos.length} total):\n\n${txt}\n\n_Usa \`/hechos borrar N\` para eliminar el hecho #N._`);
}
window.deleteHecho = deleteHecho;

/* ── Exports globales ── */
window.loadMemoria           = loadMemoria;
window.getHechos             = getHechos;
window.saveHechos            = saveHechos;
window.addHecho              = addHecho;
window.deleteHecho           = deleteHecho;
window.getHechosRelevantes   = getHechosRelevantes;
window.buildMemoriaSection   = buildMemoriaSection;
window.renderHechosList      = renderHechosList;
