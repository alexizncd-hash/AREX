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
    // Update urgency badge counts
    if (typeof window._updateUrgencyBadges === 'function') window._updateUrgencyBadges();
    // Fire proactive greeting hook (registered by app.js)
    setTimeout(() => window._arexModuleGreeting?.(modulo), 650);
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
  bar.innerHTML = modulos.map(m =>
    `<button onclick="abrirTab('${m}')" id="ctab-${m}"
      style="font-family:var(--font);font-size:10px;letter-spacing:2px;
             padding:5px 12px;border:1px solid rgba(34,211,238,.3);
             background:${m===tabActiva?'rgba(34,211,238,.15)':'rgba(0,0,0,.4)'};
             color:${m===tabActiva?'#22d3ee':'rgba(34,211,238,.5)'};
             border-radius:3px;cursor:pointer;text-transform:uppercase;">
      ${m.toUpperCase()}
    </button>`
  ).join('');
}

function abrirTab(modulo) {
  tabActiva = modulo;
  if (typeof cambiarModulo === 'function') cambiarModulo(modulo);
  // Update tab highlight
  document.querySelectorAll('[id^="ctab-"]').forEach(b => {
    const m = b.id.replace('ctab-','');
    b.style.background = m === modulo ? 'rgba(34,211,238,.15)' : 'rgba(0,0,0,.4)';
    b.style.color      = m === modulo ? '#22d3ee' : 'rgba(34,211,238,.5)';
  });
}

function cerrarCentro() {
  centroActivo = null;
  const bar = document.getElementById('center-tabs');
  if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
}

// Override cambiarModulo to handle center routing
const _origCambiarModulo = typeof cambiarModulo !== 'undefined' ? cambiarModulo : null;
window.cambiarModulo = function(mod) {
  // If switching to inicio, close center tabs
  if (mod === 'inicio') cerrarCentro();
  if (_origCambiarModulo) _origCambiarModulo(mod);
  // Fire module change event for reactor3d
  document.dispatchEvent(new CustomEvent('arex-module-change', { detail: { module: mod } }));
};

window.abrirCentro = abrirCentro;
window.abrirTab    = abrirTab;
