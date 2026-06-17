// ═══════════════════════════════════════════════════════════
// AREX - NAVEGACIÓN DE MÓDULOS
// Maneja el cambio entre Chat y módulos adicionales
// ═══════════════════════════════════════════════════════════

// Inyección dinámica de scripts pesados solo cuando se necesitan
const _lazyLoaded = {};
function _lazyLoad(src, asModule = false) {
  if (_lazyLoaded[src]) return Promise.resolve();
  if (document.querySelector(`script[src="${src}"]`)) {
    _lazyLoaded[src] = true;
    return Promise.resolve();
  }
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    if (asModule) s.type = 'module';
    s.onload  = () => { _lazyLoaded[src] = true; res(); };
    s.onerror = rej;
    document.body.appendChild(s);
  });
}

const AREXNav = {
  moduloActual: 'chat',

  init() {
    this.setupModuleNavigation();
    console.log('🤖 AREX Navegación iniciada');
  },

  setupModuleNavigation() {
    document.querySelectorAll('.nav-btn[data-module]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.cambiarModulo(e.currentTarget.dataset.module);
      });
    });
  },

  cambiarModulo(modulo) {
    // Actualizar botones
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.module === modulo);
    });

    // Mostrar panel del módulo activo
    document.querySelectorAll('.module-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const target = document.getElementById(`module-${modulo}`);
    if (target) target.classList.add('active');

    this.moduloActual = modulo;
    this.actualizarEstadoSistema(modulo);
  },

  actualizarEstadoSistema(modulo) {
    const statusEl = document.getElementById('sys-val');
    const estados  = { inicio:'INICIO', chat:'ACTIVO', finanzas:'FINANZAS', tareas:'TAREAS', notas:'NOTAS', negocio:'NEGOCIO', gastos:'GASTOS', metas:'METAS', proyectos:'PROYECTOS', control:'CONTROL', evidencias:'EVIDENCIAS', reparto:'REPARTO', agenda:'AGENDA', habitos:'HÁBITOS' };
    if (statusEl && estados[modulo]) statusEl.textContent = estados[modulo];
    if (modulo === 'inicio'    && typeof renderDashboard         === 'function') renderDashboard();
    if (modulo === 'finanzas'  && window.FinanzasModule?.renderDashboard)        window.FinanzasModule.renderDashboard();
    if (modulo === 'notas'     && typeof renderNotas             === 'function') renderNotas();
    if (modulo === 'negocio'   && typeof renderNegocioModule     === 'function') renderNegocioModule();
    if (modulo === 'gastos'    && typeof renderGastosModule      === 'function') renderGastosModule();
    if (modulo === 'metas'     && typeof renderMetasModule       === 'function') renderMetasModule();
    if (modulo === 'proyectos' && typeof renderProyectosModule   === 'function') renderProyectosModule();
    if (modulo === 'control'   && typeof renderControlModule     === 'function') renderControlModule();
    if (modulo === 'reparto') {
      _lazyLoad('reparto.js').then(() => {
        if (typeof renderRepartoModule === 'function') renderRepartoModule();
      }).catch(e => console.warn('reparto.js lazy-load:', e));
    }
    if (modulo === 'agenda'    && typeof renderAgendaModule      === 'function') renderAgendaModule();
    if (modulo === 'habitos'    && typeof renderHabitosModule    === 'function') renderHabitosModule();
    if (modulo === 'evidencias' && typeof renderEvidenciasWidget === 'function') renderEvidenciasWidget();
    // Update urgency badge counts (debounced — rapid module switches batch into one call)
    clearTimeout(AREXNav._badgeTimer);
    AREXNav._badgeTimer = setTimeout(() => { if (typeof window._updateUrgencyBadges === 'function') window._updateUrgencyBadges(); }, 300);
    // Fire proactive greeting hook (registered by app.js)
    clearTimeout(AREXNav._greetTimer);
    AREXNav._greetTimer = setTimeout(() => window._arexModuleGreeting?.(modulo), 700);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AREXNav.init());
} else {
  AREXNav.init();
}

window.AREXNav = AREXNav;

// ── Centro de navegación v89 ─────────────────────
const CENTROS = {
  capital:  ['finanzas','gastos','negocio','reparto'],
  impulso:  ['metas','tareas','agenda','habitos'],
  mente:    ['notas','evidencias','proyectos'],
  control:  ['control'],
};

let centroActivo = null;
let tabActiva    = null;

function abrirCentro(centro) {
  centroActivo = centro;
  const modulos = CENTROS[centro];
  if (!modulos) return;
  tabActiva = modulos[0];
  _renderCentroTabs(centro, modulos);
  if (typeof cambiarModulo === 'function') cambiarModulo(tabActiva);
}

function _renderCentroTabs(centro, modulos) {
  let bar = document.getElementById('center-tabs');
  if (!bar) return;
  bar.style.display = 'flex';
  bar.style.pointerEvents = 'auto';
  bar.innerHTML = modulos.map(m => _ctabHTML(m, m === tabActiva)).join('');
}

function _ctabHTML(m, active) {
  const bg  = active
    ? 'linear-gradient(155deg,rgba(14,42,66,.82),rgba(10,30,52,.68))'
    : 'linear-gradient(155deg,rgba(14,42,66,.42),rgba(10,30,52,.32))';
  const bdr = active ? 'rgba(34,211,238,.55)' : 'rgba(34,211,238,.22)';
  const clr = active ? '#22d3ee' : 'rgba(34,211,238,.50)';
  const shd = active
    ? '0 2px 14px rgba(0,0,0,.55),inset 0 1px 0 rgba(34,211,238,.18)'
    : '0 1px 6px rgba(0,0,0,.35)';
  return `<button onclick="abrirTab('${m}')" id="ctab-${m}"
    style="font-family:var(--font);font-size:10px;letter-spacing:2px;
           padding:6px 14px;border:1px solid ${bdr};border-top-color:${active?'rgba(34,211,238,.80)':bdr};
           background:${bg};color:${clr};border-radius:4px;cursor:pointer;
           text-transform:uppercase;box-shadow:${shd};transition:all .18s;">
    ${m.toUpperCase()}
  </button>`;
}

function abrirTab(modulo) {
  tabActiva = modulo;
  AREXNav.cambiarModulo(modulo);
  document.dispatchEvent(new CustomEvent('arex-module-change', { detail: { module: modulo } }));
  document.querySelectorAll('[id^="ctab-"]').forEach(b => {
    const m = b.id.replace('ctab-','');
    const active = m === modulo;
    const bg  = active ? 'linear-gradient(155deg,rgba(14,42,66,.82),rgba(10,30,52,.68))' : 'linear-gradient(155deg,rgba(14,42,66,.42),rgba(10,30,52,.32))';
    const bdr = active ? 'rgba(34,211,238,.55)' : 'rgba(34,211,238,.22)';
    b.style.background   = bg;
    b.style.borderColor  = bdr;
    b.style.color        = active ? '#22d3ee' : 'rgba(34,211,238,.50)';
    b.style.boxShadow    = active ? '0 2px 14px rgba(0,0,0,.55),inset 0 1px 0 rgba(34,211,238,.18)' : '0 1px 6px rgba(0,0,0,.35)';
    b.style.borderTopColor = active ? 'rgba(34,211,238,.80)' : bdr;
  });
}

function cerrarCentro() {
  centroActivo = null;
  const bar = document.getElementById('center-tabs');
  if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
}

// Exponer cambiarModulo globalmente apuntando directamente a AREXNav
window.cambiarModulo = function(mod) {
  if (mod === 'inicio') cerrarCentro();
  AREXNav.cambiarModulo(mod);
  document.dispatchEvent(new CustomEvent('arex-module-change', { detail: { module: mod } }));
};

window.abrirCentro = abrirCentro;
window.abrirTab    = abrirTab;
