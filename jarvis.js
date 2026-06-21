// ═══════════════════════════════════════════════════════
// AREX — Navegación v118
// Drawer Architecture: INICIO permanente, módulos como
// bottom-sheet overlays animados
// ═══════════════════════════════════════════════════════

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

// ── Grupos de módulos ────────────────────────────────────
const CENTROS = {
  capital:  ['finanzas','gastos','negocio','reparto'],
  impulso:  ['metas','tareas','agenda','habitos'],
  mente:    ['notas','evidencias','proyectos'],
  control:  ['control'],
};

const LABELS = {
  finanzas:'FINANZAS', gastos:'GASTOS', negocio:'NEGOCIO', reparto:'REPARTO',
  metas:'METAS', tareas:'TAREAS', agenda:'AGENDA', habitos:'HÁBITOS',
  notas:'NOTAS', evidencias:'EVIDENCIAS', proyectos:'PROYECTOS',
  control:'CONTROL', chat:'CHAT',
};

const CENTRO_LABELS = {
  capital:'CAPITAL', impulso:'IMPULSO', mente:'MENTE', control:'CONTROL',
};

// ── Renders + lazy loads por módulo ─────────────────────
function _renderModulo(modulo) {
  if (modulo === 'inicio')    { if (typeof renderDashboard === 'function') renderDashboard(); return; }
  if (modulo === 'finanzas')  { if (window.FinanzasModule?.renderDashboard) window.FinanzasModule.renderDashboard(); return; }
  if (modulo === 'notas')     { if (typeof renderNotas === 'function') renderNotas(); return; }

  const _lazy = (src, fn) => _lazyLoad(src).then(() => { if (typeof fn === 'function') fn(); });

  if (modulo === 'negocio')   { _lazy('negocio.js',   () => renderNegocioModule?.());  return; }
  if (modulo === 'gastos')    { _lazy('gastos.js',    () => renderGastosModule?.());   return; }
  if (modulo === 'metas')     { _lazy('metas.js',     () => renderMetasModule?.());    return; }
  if (modulo === 'proyectos') { _lazy('proyectos.js', () => renderProyectosModule?.()); return; }
  if (modulo === 'control')   { _lazy('control.js',   () => renderControlModule?.());  return; }
  if (modulo === 'agenda')    { _lazy('agenda.js',    () => renderAgendaModule?.());   return; }
  if (modulo === 'habitos')   { _lazy('habitos.js',   () => renderHabitosModule?.());  return; }
  if (modulo === 'evidencias'){ _lazy('evidencias.js',() => renderEvidenciasWidget?.()); return; }
  if (modulo === 'reparto')   { _lazy('reparto.js',   () => renderRepartoModule?.());  return; }
}

// ── AREXNav (status bar sync) ────────────────────────────
const AREXNav = {
  moduloActual: 'inicio',

  init() {
    // Ensure INICIO is the starting state
    this._ensureInicio();
    // Wire dock buttons
    document.querySelectorAll('.nav-btn[data-module]').forEach(btn => {
      btn.addEventListener('click', () => {
        const mod = btn.dataset.module;
        if (mod === 'inicio') {
          window.cambiarModulo('inicio');
        } else if (CENTROS[mod]) {
          window.abrirCentro(mod);
        } else {
          window.cambiarModulo(mod);
        }
      });
    });
    console.log('🤖 AREX Navegación v118 iniciada — Drawer Architecture');
  },

  _ensureInicio() {
    const inicio = document.getElementById('module-inicio');
    if (inicio) inicio.classList.add('active');
    document.querySelectorAll('.module-panel:not(#module-inicio)').forEach(p => {
      p.classList.remove('active', 'drawer-open');
    });
    // Render dashboard content after app.js functions are guaranteed loaded
    setTimeout(() => { if (typeof renderDashboard === 'function') renderDashboard(); }, 80);
  },

  actualizarEstadoSistema(modulo) {
    const statusEl = document.getElementById('sys-val');
    const estados  = {
      inicio:'INICIO', chat:'ACTIVO', finanzas:'FINANZAS', tareas:'TAREAS',
      notas:'NOTAS', negocio:'NEGOCIO', gastos:'GASTOS', metas:'METAS',
      proyectos:'PROYECTOS', control:'CONTROL', evidencias:'EVIDENCIAS',
      reparto:'REPARTO', agenda:'AGENDA', habitos:'HÁBITOS',
    };
    if (statusEl && estados[modulo]) statusEl.textContent = estados[modulo];
    this.moduloActual = modulo;
    clearTimeout(AREXNav._badgeTimer);
    AREXNav._badgeTimer = setTimeout(() => {
      if (typeof window._updateUrgencyBadges === 'function') window._updateUrgencyBadges();
    }, 300);
    clearTimeout(AREXNav._greetTimer);
    AREXNav._greetTimer = setTimeout(() => window._arexModuleGreeting?.(modulo), 700);
  }
};

// ── DRAWER ───────────────────────────────────────────────
let _drawerCurrent = null;
let _drawerCentro  = null;

const DRAWER = {

  backdrop() {
    let bd = document.getElementById('drawer-backdrop');
    if (!bd) {
      bd = document.createElement('div');
      bd.id = 'drawer-backdrop';
      bd.addEventListener('click', () => DRAWER.close());
      document.body.appendChild(bd);
    }
    return bd;
  },

  _renderHandle(panel, modulo, centro) {
    let handle = panel.querySelector('.drawer-handle');
    if (!handle) {
      handle = document.createElement('div');
      handle.className = 'drawer-handle';
      panel.prepend(handle);
    }
    const tabs = centro ? CENTROS[centro].map(m => {
      const active = m === modulo ? ' active' : '';
      return `<button class="drawer-tab${active}" onclick="DRAWER.switchTab('${m}')">${LABELS[m] || m.toUpperCase()}</button>`;
    }).join('') : '';

    const centroLabel = centro
      ? (CENTRO_LABELS[centro] || centro.toUpperCase())
      : (LABELS[modulo] || modulo.toUpperCase());

    handle.innerHTML = `
      <button class="drawer-back-btn" onclick="DRAWER.close()" title="Volver a INICIO">⌂</button>
      <span class="drawer-centro-label">${centroLabel}</span>
      ${tabs ? `<div class="drawer-tabs">${tabs}</div>` : ''}
    `;
  },

  open(modulo, centro, instant = false) {
    if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();

    const prevModule = _drawerCurrent;
    const sameCentro = centro && centro === _drawerCentro;

    // Close previous panel
    if (prevModule && prevModule !== modulo) {
      const prev = document.getElementById(`module-${prevModule}`);
      if (prev) {
        if (sameCentro) {
          // Tab switch: no closing animation
          prev.style.transition = 'none';
          prev.classList.remove('drawer-open');
          requestAnimationFrame(() => { prev.style.transition = ''; });
        } else {
          prev.classList.remove('drawer-open');
        }
      }
    }

    _drawerCurrent = modulo;
    _drawerCentro  = centro || null;

    const panel = document.getElementById(`module-${modulo}`);
    if (!panel) return;

    // Inject handle
    this._renderHandle(panel, modulo, centro);

    // Open — sin rAF para garantizar ejecución inmediata en iOS Safari
    if (sameCentro || instant) {
      panel.style.transition = 'none';
      panel.classList.add('drawer-open');
      requestAnimationFrame(() => { panel.style.transition = ''; });
    } else {
      panel.classList.add('drawer-open');
    }

    // Backdrop
    const bd = this.backdrop();
    bd.style.display = 'block';
    requestAnimationFrame(() => bd.classList.add('active'));

    // Dock state
    document.querySelectorAll('.nav-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.module === (centro || modulo));
    });

    // Render module
    _renderModulo(modulo);
    AREXNav.actualizarEstadoSistema(modulo);

    document.dispatchEvent(new CustomEvent('arex-module-change', { detail: { module: modulo } }));
  },

  close() {
    if (_drawerCurrent) {
      const panel = document.getElementById(`module-${_drawerCurrent}`);
      if (panel) panel.classList.remove('drawer-open');
      _drawerCurrent = null;
      _drawerCentro  = null;
    }
    const bd = document.getElementById('drawer-backdrop');
    if (bd) {
      bd.classList.remove('active');
      setTimeout(() => { bd.style.display = 'none'; }, 320);
    }
    // Return to INICIO
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const inicioBtn = document.querySelector('[data-module="inicio"]');
    if (inicioBtn) inicioBtn.classList.add('active');

    AREXNav.moduloActual = 'inicio';
    AREXNav.actualizarEstadoSistema('inicio');
    if (typeof renderDashboard === 'function') renderDashboard();

    document.dispatchEvent(new CustomEvent('arex-module-change', { detail: { module: 'inicio' } }));
  },

  switchTab(modulo) {
    if (!_drawerCentro) return;
    DRAWER.open(modulo, _drawerCentro, false);
  }
};

// ── Public API ───────────────────────────────────────────
function abrirCentro(centro) {
  const mods = CENTROS[centro];
  if (!mods?.length) return;
  DRAWER.open(mods[0], centro);
}

function abrirTab(modulo) {
  DRAWER.switchTab(modulo);
}

function cerrarCentro() {
  DRAWER.close();
}

window.cambiarModulo = function(mod) {
  if (window.speechSynthesis?.speaking) window.speechSynthesis.cancel();
  if (mod === 'inicio') {
    DRAWER.close();
    return;
  }
  // Find centro
  let centro = null;
  for (const [c, mods] of Object.entries(CENTROS)) {
    if (mods.includes(mod)) { centro = c; break; }
  }
  DRAWER.open(mod, centro);
};

window.abrirCentro  = abrirCentro;
window.abrirTab     = abrirTab;
window.cerrarCentro = cerrarCentro;
window.DRAWER       = DRAWER;
window.AREXNav      = AREXNav;

// ── Init ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AREXNav.init());
} else {
  AREXNav.init();
}
