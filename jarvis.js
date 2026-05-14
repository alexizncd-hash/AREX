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
    // Usa el ID existente de AREX (sys-val en el header)
    const statusEl = document.getElementById('sys-val');
    const estados  = { chat: 'ACTIVO', finanzas: 'FINANZAS' };
    if (statusEl && estados[modulo]) statusEl.textContent = estados[modulo];
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => AREXNav.init());
} else {
  AREXNav.init();
}

window.AREXNav = AREXNav;
