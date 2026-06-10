// ═══════════════════════════════════════════════════════════
// AREX - NAVEGACIÓN DE MÓDULOS
// Maneja el cambio entre Chat y módulos adicionales
// ═══════════════════════════════════════════════════════════

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
    if (modulo === 'reparto'   && typeof renderRepartoModule     === 'function') renderRepartoModule();
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
